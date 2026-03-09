import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { data: categories, error } = await supabaseSession
            .from('categories')
            .select('id, name, color')
            .order('name', { ascending: true });

        if (error) throw error;
        return NextResponse.json({ categories });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
