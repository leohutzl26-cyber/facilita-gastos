import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function PUT(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // Next.js 15 requires awaiting params
        const params = await context.params;
        const id = params.id;
        const body = await request.json();
        const { name, color, max_amount_alert } = body;

        const { data, error } = await supabase
            .from('categories')
            .update({ name, color, max_amount_alert })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json({ category: data });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}

export async function DELETE(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // Next.js 15 route handler param handling
        const params = await context.params;
        const id = params.id;

        const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
