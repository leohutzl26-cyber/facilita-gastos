import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function PATCH(request: Request) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id, status, rejection_reason } = await request.json();

        if (!id || !status) {
            return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
        }

        const updateData: any = { status };
        if (rejection_reason !== undefined) {
            updateData.rejection_reason = rejection_reason;
        }

        const { data, error } = await supabaseSession
            .from('receipts')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) throw error;

        return NextResponse.json({ success: true, receipt: data[0] });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
