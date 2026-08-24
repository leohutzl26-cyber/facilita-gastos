import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const getAdminSupabase = () => {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
};

// Extrae el path dentro del bucket a partir de la URL pública de Storage
function extractStoragePath(fileUrl: string, bucket: string): string | null {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = fileUrl.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(fileUrl.slice(idx + marker.length));
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const { data: payment, error: paymentError } = await supabaseSession
            .from('payments')
            .select('id, file_url, amount, payment_receipts(receipt_id, amount_applied)')
            .eq('id', id)
            .single();

        if (paymentError || !payment) {
            return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 });
        }

        const linkedReceiptIds = (payment.payment_receipts || []).map((l: any) => l.receipt_id);

        // Si este comprobante era lo único (o parte) de lo que dejaba una boleta como
        // Reembolsado, hay que recalcular su saldo al quitarlo y revertir el estado
        // si vuelve a quedar con saldo pendiente.
        if (linkedReceiptIds.length > 0) {
            const { data: affectedReceipts } = await supabaseSession
                .from('receipts')
                .select('id, amount, status, payment_receipts(payment_id, amount_applied)')
                .in('id', linkedReceiptIds);

            for (const receipt of affectedReceipts || []) {
                if (receipt.status !== 'Reembolsado') continue;

                const paidByOthers = (receipt.payment_receipts || [])
                    .filter((l: any) => l.payment_id !== id)
                    .reduce((sum: number, l: any) => sum + Number(l.amount_applied || 0), 0);

                if (paidByOthers < Number(receipt.amount || 0)) {
                    await supabaseSession
                        .from('receipts')
                        .update({ status: 'Aprobado por Supervisor' })
                        .eq('id', receipt.id);
                }
            }
        }

        const adminDbClient = getAdminSupabase();

        // Borrar el archivo de Storage (best-effort: si falla, igual continuamos
        // para no dejar un comprobante roto que el admin no pueda quitar).
        const storagePath = extractStoragePath(payment.file_url, 'payment-proofs');
        if (storagePath) {
            const { error: storageError } = await adminDbClient.storage.from('payment-proofs').remove([storagePath]);
            if (storageError) console.warn('No se pudo borrar el archivo de Storage:', storageError.message);
        }

        // payment_receipts se elimina en cascada por la FK
        const { error: deleteError } = await supabaseSession
            .from('payments')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        await adminDbClient.from('audit_logs').insert([{
            user_email: user.email,
            action: 'Comprobante Eliminado',
            details: `Comprobante ${id} eliminado (cargado por error). Estaba asociado a ${linkedReceiptIds.length} boleta(s).`
        }]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error eliminando comprobante:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
