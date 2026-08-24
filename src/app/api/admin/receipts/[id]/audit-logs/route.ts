import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { canViewAdminPanel } from '@/utils/roles';

const getAdminSupabase = () => {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user || !canViewAdminPanel(user)) {
        return NextResponse.json({ error: 'Unauthorized: Admin access required.' }, { status: 401 });
    }

    try {
        const resolvedParams = await context.params;
        const receiptId = resolvedParams.id;

        const adminSupabase = getAdminSupabase();

        // Buscamos todas las entradas de auditoría relacionadas con este recibo
        // Las entradas en audit_logs tienen "ID <receiptId>" en el campo details
        const { data: logs, error } = await adminSupabase
            .from('audit_logs')
            .select('*')
            .like('details', `%ID ${receiptId}%`)
            .order('created_at', { ascending: true });

        if (error) throw error;

        return NextResponse.json({ success: true, logs: logs || [] });
    } catch (error: any) {
        console.error("Error fetching audit logs for receipt:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
