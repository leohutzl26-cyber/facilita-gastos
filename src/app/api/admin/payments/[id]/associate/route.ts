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
            .select('id, status, amount')
            .eq('id', id)
            .single();

        if (paymentError || !payment) {
            return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 });
        }

        // Traemos las boletas con lo que ya tienen pagado por OTROS comprobantes,
        // porque un gasto grande puede pagarse en varias transferencias.
        const { data: selectedReceipts, error: receiptsFetchError } = await supabaseSession
            .from('receipts')
            .select('id, amount, payment_receipts(payment_id, amount_applied)')
            .in('id', receiptIds);

        if (receiptsFetchError) throw receiptsFetchError;

        // Repartimos el monto del comprobante entre las boletas seleccionadas,
        // cubriendo primero lo que queda pendiente de cada una.
        let available: number | null = payment.amount != null ? Number(payment.amount) : null;

        const links: { payment_id: string; receipt_id: string; amount_applied: number }[] = [];
        const fullyCoveredIds: string[] = [];
        const partiallyCovered: string[] = [];

        for (const receiptId of receiptIds) {
            const receipt = (selectedReceipts || []).find((r: any) => r.id === receiptId);
            if (!receipt) continue;

            const total = Number(receipt.amount || 0);
            const paidByOthers = (receipt.payment_receipts || [])
                .filter((link: any) => link.payment_id !== id)
                .reduce((sum: number, link: any) => sum + Number(link.amount_applied || 0), 0);
            const remaining = Math.max(total - paidByOthers, 0);

            // Sin monto informado en el comprobante asumimos que cubre lo pendiente.
            let applied: number;
            if (available === null) {
                applied = remaining;
            } else {
                applied = Math.min(remaining, available);
                available -= applied;
            }

            links.push({ payment_id: id, receipt_id: receiptId, amount_applied: applied });

            if (total > 0 && paidByOthers + applied >= total) {
                fullyCoveredIds.push(receiptId);
            } else {
                partiallyCovered.push(receiptId);
            }
        }

        if (links.length === 0) {
            return NextResponse.json({ error: 'No se encontraron las boletas seleccionadas' }, { status: 400 });
        }

        const { error: linkError } = await supabaseSession
            .from('payment_receipts')
            .upsert(links, { onConflict: 'payment_id,receipt_id' });

        if (linkError) throw linkError;

        // Solo las boletas totalmente cubiertas pasan a Reembolsado. Las que quedan
        // con saldo siguen como "Aprobado por Supervisor" para poder seguir
        // aplicándoles las siguientes transferencias.
        if (fullyCoveredIds.length > 0) {
            const { error: receiptsError } = await supabaseSession
                .from('receipts')
                .update({ status: 'Reembolsado' })
                .in('id', fullyCoveredIds);

            if (receiptsError) throw receiptsError;
        }

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
            details: `Comprobante ${id} asociado a ${links.length} boleta(s). `
                + `${fullyCoveredIds.length} quedaron pagadas por completo (Reembolsado)`
                + `${partiallyCovered.length > 0 ? ` y ${partiallyCovered.length} con saldo pendiente` : ''}.`
        }]);

        return NextResponse.json({
            success: true,
            payment: updatedPayment,
            fullyCovered: fullyCoveredIds.length,
            partiallyCovered: partiallyCovered.length
        });
    } catch (error: any) {
        console.error('Error asociando comprobante:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
