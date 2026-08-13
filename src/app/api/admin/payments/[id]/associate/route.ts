import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const getAdminSupabase = () => {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const { receiptIds } = await request.json();

        if (!Array.isArray(receiptIds) || receiptIds.length === 0) {
            return NextResponse.json({ error: 'Debes seleccionar al menos una boleta' }, { status: 400 });
        }

        const { data: payment, error: paymentError } = await supabaseSession
            .from('payments')
            .select('id, status')
            .eq('id', id)
            .single();

        if (paymentError || !payment) {
            return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 });
        }

        const links = receiptIds.map((receiptId: string) => ({
            payment_id: id,
            receipt_id: receiptId
        }));

        const { error: linkError } = await supabaseSession
            .from('payment_receipts')
            .upsert(links, { onConflict: 'payment_id,receipt_id', ignoreDuplicates: true });

        if (linkError) throw linkError;

        const { error: receiptsError } = await supabaseSession
            .from('receipts')
            .update({ status: 'Reembolsado' })
            .in('id', receiptIds);

        if (receiptsError) throw receiptsError;

        const { data: updatedPayment, error: updatePaymentError } = await supabaseSession
            .from('payments')
            .update({ status: 'asociado' })
            .eq('id', id)
            .select()
            .single();

        if (updatePaymentError) throw updatePaymentError;

        const adminDbClient = getAdminSupabase();
        await adminDbClient.from('audit_logs').insert([{
            user_email: user.email,
            action: 'Comprobante Asociado',
            details: `Comprobante ${id} asociado a ${receiptIds.length} boleta(s). Marcadas como Reembolsado.`
        }]);

        return NextResponse.json({ success: true, payment: updatedPayment });
    } catch (error: any) {
        console.error('Error asociando comprobante:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
