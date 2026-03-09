import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const getAdminSupabase = () => {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

export async function POST(request: Request) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    // STRICT CHECK: Only an authenticated 'admin' can wipe data
    if (!user || user.user_metadata?.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized: Danger Zone access restricted to administrators only.' }, { status: 401 });
    }

    try {
        const { target } = await request.json();

        if (!['receipts', 'projects', 'workers'].includes(target)) {
            return NextResponse.json({ error: 'Invalid target specified.' }, { status: 400 });
        }

        const adminDbClient = getAdminSupabase();

        if (target === 'receipts') {
            const { error } = await adminDbClient.from('receipts').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows trick
            if (error) throw error;
            return NextResponse.json({ success: true, message: 'Se eliminó todo el historial de recibos exitosamente.' });
        }

        if (target === 'projects') {
            const { error } = await adminDbClient.from('projects').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) throw error;
            return NextResponse.json({ success: true, message: 'Se eliminaron todos los proyectos activos.' });
        }

        if (target === 'workers') {
            // Fetch ALL users (Supabase caps listUsers at 50 per page by default, but we'll try to fetch all or a large chunk)
            const { data: authUsers, error: listError } = await adminDbClient.auth.admin.listUsers();
            if (listError) throw listError;

            // Target ONLY those with 'colaborador' or 'worker' metadata
            const usersToDelete = authUsers.users.filter(u =>
                u.user_metadata?.role === 'colaborador' || u.user_metadata?.role === 'worker'
            );

            let deletedCount = 0;
            // Iterate and delete
            for (const worker of usersToDelete) {
                const { error: delError } = await adminDbClient.auth.admin.deleteUser(worker.id);
                if (!delError) {
                    deletedCount++;
                } else {
                    console.error(`Failed to delete worker ${worker.email}:`, delError);
                }
            }

            return NextResponse.json({ success: true, message: `Se eliminaron ${deletedCount} colaboradores corporativos exitosamente.` });
        }

    } catch (error: any) {
        console.error("Clean error:", error);
        return NextResponse.json({ error: error.message || 'Error executing database clean operation' }, { status: 500 });
    }
}
