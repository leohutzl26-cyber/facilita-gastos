import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        let query = supabaseSession
            .from('payments')
            .select('*, payment_receipts(id, receipt_id, amount_applied)')
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        const { data: payments, error } = await query;

        if (error) throw error;

        return NextResponse.json({ payments: payments || [] });
    } catch (error: any) {
        console.error('Error fetching payments:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
