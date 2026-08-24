import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { isAdmin } from '@/utils/roles';

const getAdminSupabase = () => {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

// Quita UNA boleta de un comprobante (por ejemplo si se asoció por error a la
// boleta equivocada), sin borrar el comprobante ni afectar otras boletas que
// también pueda cubrir.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user || !isAdmin(user)) {
        return NextResponse.json({ error: 'No autorizado: se requiere rol de administrador.' }, { status: 401 });
    }

    try {
        const { receiptId } = await request.json();
        if (!receiptId) {
            return NextResponse.json({ error: 'Falta receiptId' }, { status: 400 });
        }

        const { data: link, error: linkFetchError } = await supabaseSession
            .from('payment_receipts')
            .select('id')
            .eq('payment_id', id)
            .eq('receipt_id', receiptId)
            .maybeSingle();

        if (linkFetchError) throw linkFetchError;
        if (!link) {
            return NextResponse.json({ error: 'Esta boleta no está asociada a este comprobante' }, { status: 404 });
        }

        const { error: deleteLinkError } = await supabaseSession
            .from('payment_receipts')
            .delete()
            .eq('id', link.id);

        if (deleteLinkError) throw deleteLinkError;

        // Recalcular el saldo de la boleta sin este comprobante: si estaba
        // Reembolsado y queda con saldo pendiente, vuelve a Aprobado por Supervisor.
        const { data: receipt } = await supabaseSession
            .from('receipts')
            .select('id, amount, status, payment_receipts(amount_applied)')
            .eq('id', receiptId)
            .single();

        if (receipt && receipt.status === 'Reembolsado') {
            const stillPaid = (receipt.payment_receipts || [])
                .reduce((sum: number, l: any) => sum + Number(l.amount_applied || 0), 0);

            if (stillPaid < Number(receipt.amount || 0)) {
                await supabaseSession
                    .from('receipts')
                    .update({ status: 'Aprobado por Supervisor' })
                    .eq('id', receiptId);
            }
        }

        // Si el comprobante se quedó sin ninguna boleta asociada, vuelve a la
        // bandeja de pendientes.
        const { count: remainingLinks } = await supabaseSession
            .from('payment_receipts')
            .select('id', { count: 'exact', head: true })
            .eq('payment_id', id);

        if ((remainingLinks || 0) === 0) {
            await supabaseSession
                .from('payments')
                .update({ status: 'pendiente' })
                .eq('id', id);
        }

        const adminDbClient = getAdminSupabase();
        await adminDbClient.from('audit_logs').insert([{
            user_email: user.email,
            action: 'Comprobante Desasociado',
            details: `Se quitó la asociación entre el comprobante ${id} y la boleta ${receiptId}.`
        }]);

        return NextResponse.json({ success: true, paymentBackToPending: (remainingLinks || 0) === 0 });
    } catch (error: any) {
        console.error('Error desasociando boleta:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
