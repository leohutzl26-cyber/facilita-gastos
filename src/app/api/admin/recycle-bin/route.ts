import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { canViewAdminPanel, isAdmin } from '@/utils/roles';

const getAdminSupabase = () => {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

export const dynamic = 'force-dynamic';

export async function GET() {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user || !canViewAdminPanel(user)) {
        return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 401 });
    }

    try {
        const adminDbClient = getAdminSupabase();

        // Obtener todos los registros eliminados ordenados por fecha
        const { data: deletedRecords, error } = await adminDbClient
            .from('deleted_records')
            .select('*')
            .order('deleted_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ records: deletedRecords || [] });
    } catch (error: any) {
        console.error("Error fetching recycle bin records:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    // Requisito: Sólo un Admin logueado puede restaurar elementos
    if (!user || user.user_metadata?.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 401 });
    }

    try {
        const { id } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Falta ID del registro a restaurar.' }, { status: 400 });
        }

        const adminDbClient = getAdminSupabase();

        // 1. Obtener el registro de la papelera
        const { data: deletedRecord, error: fetchError } = await adminDbClient
            .from('deleted_records')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !deletedRecord) {
            return NextResponse.json({ error: 'El registro no se encuentra en la papelera.' }, { status: 404 });
        }

        const { table_name, original_id, data } = deletedRecord;

        // 2. Ejecutar la lógica de restauración según el tipo de elemento
        if (table_name === 'projects') {
            // Verificar si el proyecto ya existe
            const { data: existing } = await adminDbClient
                .from('projects')
                .select('id')
                .eq('id', original_id)
                .maybeSingle();

            if (existing) {
                return NextResponse.json({ error: 'Ya existe un proyecto activo con este mismo ID.' }, { status: 400 });
            }

            const { error: insertError } = await adminDbClient
                .from('projects')
                .insert([data]);

            if (insertError) throw insertError;

        } else if (table_name === 'categories') {
            // Verificar si la categoría ya existe
            const { data: existing } = await adminDbClient
                .from('categories')
                .select('id')
                .eq('id', original_id)
                .maybeSingle();

            if (existing) {
                return NextResponse.json({ error: 'Ya existe una categoría activa con este mismo ID.' }, { status: 400 });
            }

            const { error: insertError } = await adminDbClient
                .from('categories')
                .insert([data]);

            if (insertError) throw insertError;

        } else if (table_name === 'receipts') {
            // Verificar si el recibo ya existe
            const { data: existing } = await adminDbClient
                .from('receipts')
                .select('id')
                .eq('id', original_id)
                .maybeSingle();

            if (existing) {
                return NextResponse.json({ error: 'Ya existe un recibo con este mismo ID.' }, { status: 400 });
            }

            const receiptData = { ...data };

            // Validar que el proyecto referenciado exista. Si no existe, ponerlo a null.
            if (receiptData.project_id) {
                const { data: projExists } = await adminDbClient
                    .from('projects')
                    .select('id')
                    .eq('id', receiptData.project_id)
                    .maybeSingle();

                if (!projExists) {
                    receiptData.project_id = null;
                }
            }

            // Validar que el colaborador referenciado exista. Si no existe, ponerlo a null.
            if (receiptData.worker_id) {
                const { data: userExists } = await adminDbClient.auth.admin.getUserById(receiptData.worker_id)
                    .catch(() => ({ data: { user: null } }));

                if (!userExists || !userExists.user) {
                    receiptData.worker_id = null;
                }
            }

            const { error: insertError } = await adminDbClient
                .from('receipts')
                .insert([receiptData]);

            if (insertError) throw insertError;

        } else if (table_name === 'workers') {
            // Validar que no haya un usuario con el mismo email en Auth
            const { data: authUsers, error: listError } = await adminDbClient.auth.admin.listUsers();
            if (listError) throw listError;

            if (authUsers.users.some((u: any) => u.email === data.email)) {
                return NextResponse.json({ error: 'Ya existe un usuario activo con este correo electrónico.' }, { status: 400 });
            }

            // Recrear usuario de Auth con la clave temporal inicial y la metadata guardada
            const { error: createError } = await adminDbClient.auth.admin.createUser({
                id: original_id,
                email: data.email,
                password: '123456', // Contraseña temporal
                email_confirm: true,
                user_metadata: data.user_metadata
            });

            if (createError) throw createError;

        } else {
            return NextResponse.json({ error: 'Tipo de elemento no soportado para restauración.' }, { status: 400 });
        }

        // 3. Eliminar el registro de la papelera (deleted_records)
        const { error: deleteRecordError } = await adminDbClient
            .from('deleted_records')
            .delete()
            .eq('id', id);

        if (deleteRecordError) throw deleteRecordError;

        // 4. Registro de Auditoría
        let detailText = '';
        if (table_name === 'receipts') detailText = `Recibo de comercio '${data.merchant}' por $${data.amount}`;
        else if (table_name === 'projects') detailText = `Proyecto '${data.name}'`;
        else if (table_name === 'categories') detailText = `Categoría '${data.name}'`;
        else if (table_name === 'workers') detailText = `Colaborador '${data.user_metadata?.name || data.email}'`;

        await adminDbClient.from('audit_logs').insert([{
            user_email: user.email,
            action: 'Restaurar Elemento',
            details: `Se restauró desde la papelera de reciclaje: ${detailText} (ID original: ${original_id})`
        }]);

        return NextResponse.json({ success: true, message: 'Elemento restaurado correctamente.' });
    } catch (error: any) {
        console.error("Error restoring recycle bin record:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
