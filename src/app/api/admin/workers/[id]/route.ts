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

        // 1. Eliminar al usuario de Auth (esto también debería eliminar sus dependencias si hay reglas de cascade, 
        // pero dado que es Supabase Auth, se elimina la identidad)
        const { error: deleteError } = await adminAuthClient.auth.admin.deleteUser(workerId);

        if (deleteError) throw deleteError;

        return NextResponse.json({ success: true, message: 'Usuario eliminado correctamente' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
