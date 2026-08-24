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

export async function GET() {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user || !canViewAdminPanel(user)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const adminAuthClient = getAdminSupabase();

        // Listamos usuarios. Importante: supabase admin listUsers no permite filtrar por email directo acá.
        const { data: authUsers, error } = await adminAuthClient.auth.admin.listUsers();

        if (error) throw error;

        // Mapeamos para devolver todos los usuarios y su rol
        const workers = authUsers.users
            .map(u => ({
                id: u.id,
                name: u.user_metadata?.name || 'Trabajador',
                email: u.email,
                is_suspended: !!u.user_metadata?.is_suspended,
                role: u.user_metadata?.role || 'colaborador'
            }));

        return NextResponse.json({ workers });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}

export async function POST(request: Request) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    // Requisito: Sólo un Admin logueado puede crear trabajadores
    if (!user || !isAdmin(user)) {
        return NextResponse.json({ error: 'No autorizado: se requiere rol de administrador.' }, { status: 401 });
    }

    try {
        const { name, email } = await request.json();

        const adminAuthClient = getAdminSupabase();

        // 1. Crear el usuario en Auth con clave inicial genérica y flag de cambio
        const { data: newAuthUser, error: authError } = await adminAuthClient.auth.admin.createUser({
            email: email,
            password: '123456', // Contraseña temporal por defecto
            email_confirm: true,
            user_metadata: {
                name: name,
                role: 'colaborador',
                requires_password_change: true
            }
        });

        if (authError) throw authError;

        return NextResponse.json({ success: true, user: newAuthUser.user });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
