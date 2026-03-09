import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const getAdminSupabase = () => {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

export async function GET() {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const adminAuthClient = getAdminSupabase();

        // Listamos usuarios. Importante: supabase admin listUsers no permite filtrar por email directo acá.
        const { data: authUsers, error } = await adminAuthClient.auth.admin.listUsers();

        if (error) throw error;

        // Filtramos para devolver solo los que tengan rol 'colaborador' (antes 'worker')
        const workers = authUsers.users
            .filter(u => u.user_metadata?.role === 'colaborador' || u.user_metadata?.role === 'worker')
            .map(u => ({
                id: u.id,
                name: u.user_metadata?.name || 'Trabajador',
                email: u.email
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
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
