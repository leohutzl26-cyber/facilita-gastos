import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Usamos el rol "service_role" para tener privilegios de Admin y poder crear usuarios.
// Esto NUNCA debe exponerse al frontend.
const getAdminSupabase = () => {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

export async function POST(request: Request) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    // Requisito: Sólo un Admin logueado puede crear trabajadores
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { name, email, password } = await request.json();

        const adminAuthClient = getAdminSupabase();

        // 1. Crear el usuario en Auth
        const { data: newAuthUser, error: authError } = await adminAuthClient.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: { name: name, role: 'worker' }
        });

        if (authError) throw authError;

        // 2. (Opcional pero recomendado) Guardar el perfil en una tabla pública si necesitas listarlos fácil
        // const { error: dbError } = await adminAuthClient.from('profiles').insert({ id: newAuthUser.user.id, name, email, role: 'worker' });

        return NextResponse.json({ success: true, user: newAuthUser.user });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
