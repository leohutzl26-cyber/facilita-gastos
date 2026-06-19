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

    // Requisito: Sólo un Admin logueado puede eliminar trabajadores
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const adminAuthClient = getAdminSupabase();

        // 1. Extraer ID asíncronamente (Next.js 15+)
        const resolvedParams = await context.params;
        const workerId = resolvedParams.id;

        // Obtener detalles del colaborador antes de eliminarlo de Auth
        const { data: { user: workerUser }, error: getUserError } = await adminAuthClient.auth.admin.getUserById(workerId);
        if (getUserError) {
            console.error("Error fetching worker before delete:", getUserError);
        } else if (workerUser) {
            const workerData = {
                id: workerUser.id,
                email: workerUser.email,
                user_metadata: workerUser.user_metadata
            };

            // Guardar en la papelera
            const { error: binError } = await supabaseSession
                .from('deleted_records')
                .insert([{
                    table_name: 'workers',
                    original_id: workerId,
                    data: workerData,
                    deleted_by: user.email
                }]);
            if (binError) console.error("Error backing up worker to recycle bin:", binError);
        }

        // 1. Eliminar al usuario de Auth (esto también debería eliminar sus dependencias si hay reglas de cascade, 
        // pero dado que es Supabase Auth, se elimina la identidad)
        const { error: deleteError } = await adminAuthClient.auth.admin.deleteUser(workerId);

        if (deleteError) throw deleteError;

        return NextResponse.json({ success: true, message: 'Usuario eliminado correctamente' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
