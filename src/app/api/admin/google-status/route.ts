import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { data, error } = await supabaseSession
            .from('google_integrations')
            .select('admin_id, settings')
            .eq('admin_id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = No rows found
            throw error;
        }

        return NextResponse.json({ isLinked: !!data, email: user.email, settings: data?.settings || {} });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}

export async function DELETE() {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { error } = await supabaseSession
            .from('google_integrations')
            .delete()
            .eq('admin_id', user.id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error unlinking:", error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
