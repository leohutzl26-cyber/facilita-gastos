'use client';
import { useState, useEffect } from 'react';
import { AlertTriangle, X, Loader2, Landmark, Share2, Mail, Upload, CheckCircle2 } from 'lucide-react';
import { getReceiptBalance } from '@/utils/payments';

const SOURCE_LABELS: Record<string, { label: string; icon: typeof Share2 }> = {
    share_target: { label: 'Compartido', icon: Share2 },
    email: { label: 'Correo', icon: Mail },
    manual: { label: 'Manual', icon: Upload },
    whatsapp: { label: 'WhatsApp', icon: Share2 },
};

type Props = {
    receipt: any;
    onClose: () => void;
    onConfirmWithoutProof: () => void;
    onAssociated: () => void;
};

export default function ReimburseWarningModal({ receipt, onClose, onConfirmWithoutProof, onAssociated }: Props) {
    const [pendingPayments, setPendingPayments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [associatingId, setAssociatingId] = useState<string | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);
    const [error, setError] = useState('');

    const balance = getReceiptBalance(receipt);

    useEffect(() => {
        fetch('/api/admin/payments?status=pendiente')
            .then(res => res.json())
            .then(data => setPendingPayments(data.payments || []))
            .catch(() => setPendingPayments([]))
            .finally(() => setIsLoading(false));
    }, []);

    const handleAssociate = async (paymentId: string) => {
        setAssociatingId(paymentId);
        setError('');
        try {
            const res = await fetch(`/api/admin/payments/${paymentId}/associate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ receiptIds: [receipt.id] })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al asociar el comprobante');

            onAssociated();
        } catch (err: any) {
            setError(err.message);
            setAssociatingId(null);
        }
    };

    const handleConfirmWithoutProof = async () => {
        setIsConfirming(true);
        await onConfirmWithoutProof();
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-[#121D38] border border-amber-500/20 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        Sin comprobante de pago
                    </h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="overflow-y-auto p-6 space-y-4">
                    <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 text-xs text-amber-300">
                        Estás por marcar <span className="font-semibold text-white">{receipt.merchant}</span>
                        {' '}(${Number(receipt.amount || 0).toLocaleString('es-CL')}) como <span className="font-semibold">Reembolsado</span>,
                        pero {balance.isPartial
                            ? `solo tiene un abono de $${balance.paid.toLocaleString('es-CL')} — le falta un comprobante por $${balance.remaining.toLocaleString('es-CL')}.`
                            : 'no tiene ningún comprobante de pago asociado.'}
                    </div>

                    <div>
                        <p className="text-xs font-semibold text-zinc-300 mb-2">Comprobantes pendientes disponibles</p>
                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-5 h-5 animate-spin text-[#8CC63F]" />
                            </div>
                        ) : pendingPayments.length === 0 ? (
                            <p className="text-xs text-zinc-500 py-4 text-center bg-[#1C2D54]/30 rounded-xl">
                                No hay comprobantes pendientes por asignar. Puedes subir uno nuevo desde la pestaña Comprobantes.
                            </p>
                        ) : (
                            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                {pendingPayments.map(payment => {
                                    const source = SOURCE_LABELS[payment.source] || SOURCE_LABELS.manual;
                                    const SourceIcon = source.icon;
                                    const isMatch = payment.amount && Number(payment.amount) === balance.remaining;
                                    return (
                                        <button
                                            key={payment.id}
                                            onClick={() => handleAssociate(payment.id)}
                                            disabled={associatingId !== null}
                                            className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition disabled:opacity-50 ${isMatch
                                                ? 'bg-[#8CC63F]/10 border border-[#8CC63F]/30 hover:bg-[#8CC63F]/15'
                                                : 'bg-[#1C2D54]/50 border border-white/5 hover:bg-[#1C2D54]'
                                                }`}
                                        >
                                            <div className="w-9 h-9 shrink-0 rounded-lg overflow-hidden bg-zinc-950/40 flex items-center justify-center">
                                                {payment.file_type === 'pdf' ? (
                                                    <SourceIcon className="w-4 h-4 text-zinc-500" />
                                                ) : (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={payment.file_url} alt="" className="w-full h-full object-cover" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                                                    {payment.amount ? `$${Number(payment.amount).toLocaleString('es-CL')}` : 'Monto no informado'}
                                                    {isMatch && <CheckCircle2 className="w-3.5 h-3.5 text-[#8CC63F]" />}
                                                </p>
                                                <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                                                    <SourceIcon className="w-3 h-3" />
                                                    {source.label} · {new Date(payment.created_at).toLocaleDateString('es-CL')}
                                                </p>
                                            </div>
                                            {associatingId === payment.id && <Loader2 className="w-4 h-4 animate-spin text-[#8CC63F] shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {error && <p className="text-xs text-red-400">{error}</p>}
                </div>

                <div className="p-6 bg-black/20 border-t border-white/5 shrink-0 flex gap-2">
                    <button
                        onClick={onClose}
                        disabled={isConfirming || associatingId !== null}
                        className="flex-1 border border-white/10 hover:bg-white/5 text-zinc-300 hover:text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirmWithoutProof}
                        disabled={isConfirming || associatingId !== null}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 px-4 py-2.5 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                    >
                        {isConfirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Landmark className="w-3.5 h-3.5" />}
                        Marcar igual sin comprobante
                    </button>
                </div>
            </div>
        </div>
    );
}
