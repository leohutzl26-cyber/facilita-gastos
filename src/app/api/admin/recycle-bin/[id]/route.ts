import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const getAdminSupabase = () => {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    // Requisito: Sólo un Admin logueado puede purgar elementos definitivamente
    if (!user || user.user_metadata?.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 401 });
    }

    try {
        const resolvedParams = await context.params;
        const id = resolvedParams.id;

        if (!id) {
            return NextResponse.json({ error: 'Falta ID del registro a eliminar.' }, { status: 400 });
        }

        const adminDbClient = getAdminSupabase();

        // 1. Obtener detalles para auditoría
        const { data: record, error: fetchError } = await adminDbClient
            .from('deleted_records')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !record) {
            return NextResponse.json({ error: 'El registro no existe en la papelera.' }, { status: 404 });
        }

        // 2. Eliminar de forma definitiva
        const { error: deleteError } = await adminDbClient
            .from('deleted_records')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        // 3. Auditoría
        let detailText = '';
        if (record.table_name === 'receipts') detailText = `Recibo de comercio '${record.data.merchant}' por $${record.data.amount}`;
        else if (record.table_name === 'projects') detailText = `Proyecto '${record.data.name}'`;
        else if (record.table_name === 'categories') detailText = `Categoría '${record.data.name}'`;
        else if (record.table_name === 'workers') detailText = `Colaborador '${record.data.user_metadata?.name || record.data.email}'`;

        await adminDbClient.from('audit_logs').insert([{
            user_email: user.email,
            action: 'Purgado Permanente',
            details: `Se eliminó definitivamente de la papelera: ${detailText} (ID original: ${record.original_id})`
        }]);

        return NextResponse.json({ success: true, message: 'Registro purgado permanentemente.' });
    } catch (error: any) {
        console.error("Error purging recycle bin record:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
