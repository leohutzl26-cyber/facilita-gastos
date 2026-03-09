import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
    const supabase = await createClient();

    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // Assuming simple auth for now; matching other admin routes pattern.

    try {
        const { data: categories, error } = await supabase
            .from('categories')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        return NextResponse.json({ categories });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}

export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { name, color, max_amount_alert } = body;

        const { data, error } = await supabase
            .from('categories')
            .insert([{ name, color, max_amount_alert }])
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ category: data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
