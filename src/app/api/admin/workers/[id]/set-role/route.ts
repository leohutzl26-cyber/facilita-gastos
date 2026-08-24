import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { isAdmin, ROLES, type AppRole } from '@/utils/roles';

const getAdminSupabase = () => {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

const ROLE_LABELS: Record<AppRole, string> = {
    admin: 'Administrador',
    revisor: 'Revisor',
    colaborador: 'Colaborador'
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    const workerId = (await context.params).id;

    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    // STRICT CHECK: Solo un admin autenticado puede cambiar roles
    if (!user || !isAdmin(user)) {
        return NextResponse.json({ error: 'No autorizado: se requiere rol de administrador.' }, { status: 401 });
    }

    try {
        const { role } = await request.json();

        if (!ROLES.includes(role)) {
            return NextResponse.json({ error: 'Rol inválido.' }, { status: 400 });
        }

        if (workerId === user.id && role !== 'admin') {
            return NextResponse.json({ error: 'No puedes quitarte tus propios permisos de administrador.' }, { status: 400 });
        }

        const adminAuthClient = getAdminSupabase();

        const { data: userData, error: fetchError } = await adminAuthClient.auth.admin.getUserById(workerId);
        if (fetchError || !userData.user) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }

        const currentMeta = userData.user.user_metadata || {};

        const { error: updateError } = await adminAuthClient.auth.admin.updateUserById(
            workerId,
            { user_metadata: { ...currentMeta, role } }
        );

        if (updateError) throw updateError;

        await adminAuthClient.from('audit_logs').insert([{
            user_email: user.email,
            action: 'Cambio de Rol',
            details: `Colaborador ${userData.user.email} -> ${ROLE_LABELS[role as AppRole]}`
        }]);

        return NextResponse.json({
            success: true,
            role,
            message: `Rol actualizado a ${ROLE_LABELS[role as AppRole]}.`
        });

    } catch (error: any) {
        console.error('Set role error:', error);
        return NextResponse.json({ error: error.message || 'Error al cambiar el rol' }, { status: 500 });
    }
}
