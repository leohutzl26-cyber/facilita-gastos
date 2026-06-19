import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const getAdminSupabase = () => {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { action, details } = await request.json();
        
        const adminDbClient = getAdminSupabase();
        
        // Log in DB using Admin privileges to bypass RLS mapping issues
        const { error } = await adminDbClient
            .from('audit_logs')
            .insert([{
                user_email: user.email,
                action: action,
                details: details || ''
            }]);

        if (error) {
            console.error("Audit DB Insert Error:", error);
            // Don't fail the original request if audit fails, but return warning.
            return NextResponse.json({ success: false, error: 'Failed to record audit log' });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        const search = searchParams.get('search') || '';

        const validPage = isNaN(page) || page < 1 ? 1 : page;
        const validLimit = isNaN(limit) || limit < 1 ? 50 : limit;
        const offset = (validPage - 1) * validLimit;

        const adminDbClient = getAdminSupabase();

        // Construir la consulta de manera eficiente obteniendo logs y total en una sola petición
        let dbQuery = adminDbClient
            .from('audit_logs')
            .select('*', { count: 'exact' });

        if (search.trim()) {
            dbQuery = dbQuery.or(`action.ilike.%${search}%,user_email.ilike.%${search}%,details.ilike.%${search}%`);
        }

        // Obtenemos los logs en el rango especificado por la paginación
        const { data: logs, count, error } = await dbQuery
            .order('created_at', { ascending: false })
            .range(offset, offset + validLimit - 1);

        if (error) throw error;

        return NextResponse.json({
            logs: logs || [],
            total: count || 0,
            page: validPage,
            limit: validLimit
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
