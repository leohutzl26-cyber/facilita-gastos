import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const getAdminSupabase = () => {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
    const params = await context.params;
    const workerId = params.id;

    if (!workerId) {
        return NextResponse.json({ error: 'Worker ID is required' }, { status: 400 });
    }

    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    // STRICT CHECK: Only an authenticated 'admin' can toggle statuses
    if (!user || user.user_metadata?.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 401 });
    }

    try {
        const adminAuthClient = getAdminSupabase();

        // 1. Fetch current user metadata
        const { data: userData, error: fetchError } = await adminAuthClient.auth.admin.getUserById(workerId);

        if (fetchError || !userData.user) {
            return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
        }

        // 2. Determine inner toggle state
        const currentMeta = userData.user.user_metadata || {};
        const isCurrentlySuspended = currentMeta.is_suspended === true;
        const newStatus = !isCurrentlySuspended;

        // 3. Update the metadata flag
        const { data: updateData, error: updateError } = await adminAuthClient.auth.admin.updateUserById(
            workerId,
            { user_metadata: { ...currentMeta, is_suspended: newStatus } }
        );

        if (updateError) throw updateError;

        return NextResponse.json({
            success: true,
            is_suspended: newStatus,
            message: newStatus ? 'Usuario suspendido exitosamente.' : 'Usuario reactivado exitosamente.'
        });

    } catch (error: any) {
        console.error("Toggle status error:", error);
        return NextResponse.json({ error: error.message || 'Error executing status toggle operation' }, { status: 500 });
    }
}
