import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { action, details } = await request.json();
        
        // Log in DB
        const { error } = await supabaseSession
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

export async function GET() {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Obtenemos los logs, los admins pueden verlos
        const { data: logs, error } = await supabaseSession
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        return NextResponse.json({ logs });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
