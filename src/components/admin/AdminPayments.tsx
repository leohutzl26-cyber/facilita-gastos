'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Landmark, Search, Loader2, CheckCircle2, FileText, Share2, Mail, Upload, X, Plus, Sparkles, Trash2, Link2Off } from 'lucide-react';
import { getReceiptBalance } from '@/utils/payments';

// Busca una boleta o un par de boletas cuyo saldo pendiente sume exactamente el monto objetivo
function findMatchingReceiptIds(candidates: any[], targetAmount: number): string[] {
    const balances = candidates.map(r => ({ id: r.id, remaining: getReceiptBalance(r).remaining }));

    const exact = balances.find(b => b.remaining === targetAmount);
    if (exact) return [exact.id];

    for (let i = 0; i < balances.length; i++) {
        for (let j = i + 1; j < balances.length; j++) {
            if (balances[i].remaining + balances[j].remaining === targetAmount) {
                return [balances[i].id, balances[j].id];
            }
        }
    }
    return [];
}

const SOURCE_LABELS: Record<string, { label: string; icon: typeof Share2 }> = {
    share_target: { label: 'Compartido', icon: Share2 },
    email: { label: 'Correo', icon: Mail },
    manual: { label: 'Manual', icon: Upload },
    whatsapp: { label: 'WhatsApp', icon: Share2 },
};

export default function AdminPayments({ readOnly = false }: { readOnly?: boolean }) {
    const [payments, setPayments] = useState<any[]>([]);
    const [receipts, setReceipts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activePaymentId, setActivePaymentId] = useState<string | null>(null);
    const [selectedReceiptIds, setSelectedReceiptIds] = useState<Set<string>>(new Set());
    const [receiptSearch, setReceiptSearch] = useState('');
    const [isConfirming, setIsConfirming] = useState(false);
    const [error, setError] = useState('');
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [suggestionApplied, setSuggestionApplied] = useState(false);
    const [statusFilter, setStatusFilter] = useState<'pendiente' | 'asociado' | 'todos'>('pendiente');

    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [uploadFile, setUploadFile] = useState<{ base64: string; name: string } | null>(null);
    const [uploadAmount, setUploadAmount] = useState('');
    const [uploadPaidAt, setUploadPaidAt] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDeletingPayment, setIsDeletingPayment] = useState(false);
    const [unassigningReceiptId, setUnassigningReceiptId] = useState<string | null>(null);

    const fetchPayments = async () => {
        try {
            const res = await fetch('/api/admin/payments');
            const data = await res.json();
            if (res.ok) setPayments(data.payments || []);
        } catch (err) {
            console.error('Error fetching payments', err);
        }
    };

    const fetchReceipts = async () => {
        try {
            const res = await fetch('/api/admin/receipts');
            const data = await res.json();
            if (res.ok) setReceipts(data.receipts || []);
        } catch (err) {
            console.error('Error fetching receipts', err);
        }
    };

    useEffect(() => {
        setIsLoading(true);
        Promise.all([fetchPayments(), fetchReceipts()]).finally(() => setIsLoading(false));
    }, []);

    const activePayment = payments.find(p => p.id === activePaymentId) || null;

    const pendingCount = payments.filter(p => p.status === 'pendiente').length;
    const associatedCount = payments.filter(p => p.status === 'asociado').length;

    const visiblePayments = useMemo(() => {
        if (statusFilter === 'todos') return payments;
        return payments.filter(p => p.status === statusFilter);
    }, [payments, statusFilter]);

    const isActiveAssociated = activePayment?.status === 'asociado';
    const activePaymentAmount = Number(activePayment?.amount || 0);

    // Boletas ya vinculadas al comprobante abierto (para la vista de solo lectura).
    // amount_applied es lo que ESTE comprobante aportó a cada boleta, que puede
    // ser menos que el total de la boleta si se pagó en varias transferencias.
    const linkedReceipts = useMemo(() => {
        return (activePayment?.payment_receipts || [])
            .filter((link: any) => link.receipts)
            .map((link: any) => ({ ...link.receipts, amount_applied: link.amount_applied }));
    }, [activePayment]);

    const linkedAppliedTotal = useMemo(() => {
        return linkedReceipts.reduce((sum: number, r: any) => sum + Number(r.amount_applied ?? r.amount ?? 0), 0);
    }, [linkedReceipts]);

    const candidateReceipts = useMemo(() => {
        const term = receiptSearch.trim().toLowerCase();
        return receipts
            .filter(r => r.status === 'Aprobado por Supervisor')
            .filter(r => {
                if (!term) return true;
                return (
                    r.merchant?.toLowerCase().includes(term) ||
                    r.worker_email?.toLowerCase().includes(term) ||
                    String(r.amount).includes(term)
                );
            });
    }, [receipts, receiptSearch]);

    // Lo que este comprobante debe cubrir es el saldo pendiente de las boletas
    // seleccionadas, no su monto total (pueden traer pagos previos).
    const selectedTotal = useMemo(() => {
        return receipts
            .filter(r => selectedReceiptIds.has(r.id))
            .reduce((sum, r) => sum + getReceiptBalance(r).remaining, 0);
    }, [receipts, selectedReceiptIds]);

    // El comprobante no alcanza a cubrir todo lo seleccionado: quedará saldo pendiente.
    const leavesBalance = activePaymentAmount > 0 && selectedTotal > activePaymentAmount;

    const openPayment = async (paymentId: string) => {
        setActivePaymentId(paymentId);
        setSelectedReceiptIds(new Set());
        setReceiptSearch('');
        setError('');
        setSuggestionApplied(false);

        // Los comprobantes ya asociados se abren en modo lectura: no hay
        // nada que sugerir ni que seleccionar. Un revisor tampoco puede
        // disparar la sugerencia IA (el servidor la rechaza igual).
        const target = payments.find(p => p.id === paymentId);
        if (target?.status !== 'pendiente' || readOnly) return;

        setIsSuggesting(true);
        try {
            const res = await fetch(`/api/admin/payments/${paymentId}/suggest`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok || !data.amount) return;

            const targetAmount = Number(data.amount);
            setPayments(prev => prev.map(p => p.id === paymentId ? { ...p, amount: data.amount, paid_at: data.paid_at } : p));

            const approved = receipts.filter(r => r.status === 'Aprobado por Supervisor');
            const matchIds = findMatchingReceiptIds(approved, targetAmount);
            if (matchIds.length > 0) {
                setSelectedReceiptIds(new Set(matchIds));
                setSuggestionApplied(true);
            }
        } catch (err) {
            console.error('Error obteniendo sugerencia IA', err);
        } finally {
            setIsSuggesting(false);
        }
    };

    const toggleReceipt = (receiptId: string) => {
        setSuggestionApplied(false);
        setSelectedReceiptIds(prev => {
            const next = new Set(prev);
            if (next.has(receiptId)) next.delete(receiptId);
            else next.add(receiptId);
            return next;
        });
    };

    const handleConfirm = async () => {
        if (!activePaymentId || selectedReceiptIds.size === 0) return;
        setIsConfirming(true);
        setError('');
        try {
            const res = await fetch(`/api/admin/payments/${activePaymentId}/associate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ receiptIds: Array.from(selectedReceiptIds) })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al asociar');

            setActivePaymentId(null);
            setSelectedReceiptIds(new Set());
            await Promise.all([fetchPayments(), fetchReceipts()]);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsConfirming(false);
        }
    };

    const handleDeletePayment = async (paymentId: string) => {
        if (!confirm('¿Eliminar este comprobante? Si estaba cubriendo alguna boleta, esta volverá a quedar pendiente de pago. Esta acción no se puede deshacer.')) return;

        setIsDeletingPayment(true);
        setError('');
        try {
            const res = await fetch(`/api/admin/payments/${paymentId}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al eliminar el comprobante');

            if (activePaymentId === paymentId) setActivePaymentId(null);
            await Promise.all([fetchPayments(), fetchReceipts()]);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsDeletingPayment(false);
        }
    };

    const handleUnassignReceipt = async (paymentId: string, receiptId: string) => {
        if (!confirm('¿Quitar esta boleta del comprobante? La boleta volverá a quedar pendiente de pago (o con el saldo que le falte).')) return;

        setUnassigningReceiptId(receiptId);
        setError('');
        try {
            const res = await fetch(`/api/admin/payments/${paymentId}/unassign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ receiptId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al desasociar la boleta');

            if (data.paymentBackToPending) setActivePaymentId(null);
            await Promise.all([fetchPayments(), fetchReceipts()]);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setUnassigningReceiptId(null);
        }
    };

    const handleFileSelect = (file: File) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            setUploadFile({ base64, name: file.name });
        };
        reader.readAsDataURL(file);
    };

    const resetUploadForm = () => {
        setIsUploadOpen(false);
        setUploadFile(null);
        setUploadAmount('');
        setUploadPaidAt('');
        setUploadError('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleManualUpload = async () => {
        if (!uploadFile) {
            setUploadError('Selecciona un archivo primero');
            return;
        }
        setIsUploading(true);
        setUploadError('');
        try {
            const res = await fetch('/api/admin/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileBase64: uploadFile.base64,
                    amount: uploadAmount || null,
                    paid_at: uploadPaidAt || null
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al subir comprobante');

            resetUploadForm();
            await fetchPayments();
        } catch (err: any) {
            setUploadError(err.message);
        } finally {
            setIsUploading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-[#8CC63F]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {!readOnly && (
                <div className="flex justify-end">
                    <button
                        onClick={() => setIsUploadOpen(prev => !prev)}
                        className="flex items-center gap-2 bg-[#1C2D54]/60 hover:bg-[#1C2D54] border border-[#8CC63F]/20 text-sm text-zinc-200 px-4 py-2 rounded-xl transition"
                    >
                        <Plus className="w-4 h-4 text-[#8CC63F]" />
                        Subir comprobante manualmente
                    </button>
                </div>
            )}

            {!readOnly && isUploadOpen && (
                <div className="bg-[#1C2D54]/40 border border-[#8CC63F]/10 rounded-2xl p-5 space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">Nuevo comprobante manual</h3>
                        <button onClick={resetUploadForm} className="text-zinc-500 hover:text-white transition">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                        className="block w-full text-xs text-zinc-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-[#8CC63F]/15 file:text-[#8CC63F] file:text-xs file:font-medium hover:file:bg-[#8CC63F]/25"
                    />
                    {uploadFile && <p className="text-xs text-zinc-500">Seleccionado: {uploadFile.name}</p>}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] text-zinc-500 block mb-1">Monto (opcional)</label>
                            <input
                                type="number"
                                value={uploadAmount}
                                onChange={e => setUploadAmount(e.target.value)}
                                placeholder="45000"
                                className="w-full bg-[#0F1830] border border-white/5 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#8CC63F]/40"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] text-zinc-500 block mb-1">Fecha de pago (opcional)</label>
                            <input
                                type="date"
                                value={uploadPaidAt}
                                onChange={e => setUploadPaidAt(e.target.value)}
                                className="w-full bg-[#0F1830] border border-white/5 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#8CC63F]/40"
                            />
                        </div>
                    </div>

                    {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}

                    <button
                        onClick={handleManualUpload}
                        disabled={!uploadFile || isUploading}
                        className="flex items-center gap-2 bg-[#8CC63F] hover:bg-[#3EAE49] disabled:opacity-40 disabled:cursor-not-allowed text-[#121D38] px-4 py-2 rounded-xl text-xs font-bold transition"
                    >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        Subir comprobante
                    </button>
                </div>
            )}

            <div className="flex gap-1 border-b border-white/5">
                {([
                    { id: 'pendiente' as const, label: 'Pendientes', count: pendingCount },
                    { id: 'asociado' as const, label: 'Asociados', count: associatedCount },
                    { id: 'todos' as const, label: 'Todos', count: payments.length },
                ]).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => { setStatusFilter(tab.id); setActivePaymentId(null); }}
                        className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${statusFilter === tab.id
                            ? 'border-[#8CC63F] text-[#8CC63F]'
                            : 'border-transparent text-zinc-400 hover:text-zinc-200'
                            }`}
                    >
                        {tab.label} ({tab.count})
                    </button>
                ))}
            </div>

            {visiblePayments.length === 0 ? (
                <div className="bg-[#1C2D54]/40 border border-[#8CC63F]/10 rounded-2xl p-10 text-center">
                    <Landmark className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
                    <p className="text-zinc-400 text-sm">
                        {statusFilter === 'pendiente'
                            ? 'No hay comprobantes pendientes por asociar.'
                            : statusFilter === 'asociado'
                                ? 'Todavía no hay comprobantes asociados a boletas.'
                                : 'Aún no se ha registrado ningún comprobante de pago.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visiblePayments.map(payment => {
                        const source = SOURCE_LABELS[payment.source] || SOURCE_LABELS.manual;
                        const SourceIcon = source.icon;
                        const linkedCount = payment.payment_receipts?.length || 0;
                        const isAssociated = payment.status === 'asociado';
                        return (
                            <div
                                key={payment.id}
                                role="button"
                                tabIndex={0}
                                onClick={() => openPayment(payment.id)}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openPayment(payment.id); }}
                                className={`text-left bg-[#1C2D54]/40 border rounded-2xl p-4 transition hover:border-[#8CC63F]/40 cursor-pointer ${activePaymentId === payment.id ? 'border-[#8CC63F]' : 'border-[#8CC63F]/10'}`}
                            >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                                        <SourceIcon className="w-3.5 h-3.5" />
                                        {source.label}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {isAssociated ? (
                                            <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                Asociado
                                            </span>
                                        ) : (
                                            <span className="text-[10px] bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                Pendiente
                                            </span>
                                        )}
                                        {!readOnly && (
                                            <button
                                                onClick={e => { e.stopPropagation(); handleDeletePayment(payment.id); }}
                                                disabled={isDeletingPayment}
                                                className="text-zinc-500 hover:text-red-400 transition disabled:opacity-40 shrink-0"
                                                title="Eliminar comprobante (cargado por error)"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <p className="text-sm font-medium text-white truncate">
                                    {payment.amount ? `$${Number(payment.amount).toLocaleString('es-CL')}` : 'Monto no informado'}
                                </p>
                                <p className="text-xs text-zinc-500 mt-1">
                                    {payment.paid_at
                                        ? `Pagado el ${payment.paid_at}`
                                        : new Date(payment.created_at).toLocaleString('es-CL')}
                                </p>
                                {linkedCount > 0 && (
                                    <p className="text-[11px] text-[#8CC63F] mt-2">
                                        {linkedCount === 1 ? '1 boleta vinculada' : `${linkedCount} boletas vinculadas`}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {activePayment && (
                <div className="bg-[#0F1830] border border-[#8CC63F]/20 rounded-2xl p-5 space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-4 flex-1 min-w-0">
                            <div className="w-28 h-28 shrink-0 rounded-xl overflow-hidden border border-white/5 bg-zinc-950/40">
                                {activePayment.file_type === 'pdf' ? (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <FileText className="w-8 h-8 text-zinc-500" />
                                    </div>
                                ) : (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={activePayment.file_url} alt="Comprobante" className="w-full h-full object-cover" />
                                )}
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-sm font-semibold text-white">
                                    {isActiveAssociated ? 'Comprobante asociado' : 'Asociar comprobante a boletas'}
                                </h3>
                                <a href={activePayment.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#8CC63F] hover:underline">
                                    Ver comprobante completo
                                </a>
                                <p className="text-xs text-zinc-500 mt-2 flex items-center gap-1.5">
                                    {isSuggesting && <Loader2 className="w-3 h-3 animate-spin text-[#8CC63F]" />}
                                    {activePayment.amount
                                        ? `Monto del comprobante: $${Number(activePayment.amount).toLocaleString('es-CL')}`
                                        : isSuggesting
                                            ? 'Leyendo comprobante con IA...'
                                            : isActiveAssociated
                                                ? 'Sin monto informado'
                                                : 'Sin monto informado — asocia por criterio manual'}
                                </p>
                                {isActiveAssociated && activePayment.paid_at && (
                                    <p className="text-[11px] text-zinc-500 mt-1">Fecha de pago: {activePayment.paid_at}</p>
                                )}
                                {suggestionApplied && (
                                    <p className="text-[11px] text-[#8CC63F] flex items-center gap-1 mt-1">
                                        <Sparkles className="w-3 h-3" />
                                        Boleta(s) sugerida(s) automáticamente por monto — revisa antes de confirmar
                                    </p>
                                )}
                            </div>
                        </div>
                        <button onClick={() => setActivePaymentId(null)} className="text-zinc-500 hover:text-white transition shrink-0">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {isActiveAssociated ? (
                        <div className="space-y-2">
                            <p className="text-xs text-zinc-400">
                                Boletas cubiertas por este comprobante
                                <span className="text-zinc-500"> ({linkedReceipts.length})</span>
                            </p>
                            {linkedReceipts.length === 0 ? (
                                <p className="text-xs text-zinc-500 py-3">No se encontraron las boletas vinculadas.</p>
                            ) : (
                                <>
                                    <div className="space-y-1.5">
                                        {linkedReceipts.map((receipt: any) => {
                                            const applied = Number(receipt.amount_applied ?? receipt.amount ?? 0);
                                            const total = Number(receipt.amount || 0);
                                            const isPartial = applied < total;
                                            return (
                                                <div
                                                    key={receipt.id}
                                                    className="flex items-center gap-3 bg-[#1C2D54]/50 rounded-xl px-3 py-2"
                                                >
                                                    {isPartial
                                                        ? <Landmark className="w-4 h-4 text-amber-400 shrink-0" />
                                                        : <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                                                    <span className="flex-1 min-w-0 text-xs text-zinc-200 truncate">
                                                        {receipt.merchant} · {receipt.worker_email}
                                                        {isPartial && (
                                                            <span className="block text-[10px] text-amber-400/90">
                                                                Abono parcial sobre un gasto de ${total.toLocaleString('es-CL')}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="text-xs text-zinc-500 whitespace-nowrap">{receipt.date}</span>
                                                    <span className="text-xs text-zinc-300 whitespace-nowrap font-medium">
                                                        ${applied.toLocaleString('es-CL')}
                                                    </span>
                                                    {!readOnly && (
                                                        <button
                                                            onClick={() => handleUnassignReceipt(activePayment.id, receipt.id)}
                                                            disabled={unassigningReceiptId === receipt.id}
                                                            className="text-zinc-500 hover:text-red-400 transition disabled:opacity-40 shrink-0"
                                                            title="Quitar esta boleta del comprobante (mal asignada)"
                                                        >
                                                            {unassigningReceiptId === receipt.id
                                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                : <Link2Off className="w-3.5 h-3.5" />}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="flex items-center justify-end gap-2 border-t border-white/5 pt-3 text-xs">
                                        <span className="text-zinc-400">Total aplicado:</span>
                                        <span className="text-[#8CC63F] font-medium">
                                            ${linkedAppliedTotal.toLocaleString('es-CL')}
                                        </span>
                                        {activePaymentAmount > 0 && activePaymentAmount !== linkedAppliedTotal && (
                                            <span className="text-yellow-400 ml-1">
                                                (el comprobante es de ${activePaymentAmount.toLocaleString('es-CL')})
                                            </span>
                                        )}
                                    </div>
                                </>
                            )}
                            {error && <p className="text-xs text-red-400">{error}</p>}
                        </div>
                    ) : readOnly ? (
                        <p className="text-xs text-zinc-500 py-4 text-center">
                            Este comprobante aún no ha sido asociado a ninguna boleta.
                        </p>
                    ) : (
                    <>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            type="text"
                            value={receiptSearch}
                            onChange={e => setReceiptSearch(e.target.value)}
                            placeholder="Buscar boleta por comercio, trabajador o monto..."
                            className="w-full bg-[#1C2D54]/60 border border-white/5 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#8CC63F]/40"
                        />
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                        {candidateReceipts.length === 0 ? (
                            <p className="text-xs text-zinc-500 py-4 text-center">No hay boletas aprobadas que coincidan.</p>
                        ) : (
                            candidateReceipts.map(receipt => {
                                const balance = getReceiptBalance(receipt);
                                const isPartiallyPaid = balance.paid > 0;
                                return (
                                    <label
                                        key={receipt.id}
                                        className="flex items-center gap-3 bg-[#1C2D54]/50 hover:bg-[#1C2D54] rounded-xl px-3 py-2 cursor-pointer transition"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedReceiptIds.has(receipt.id)}
                                            onChange={() => toggleReceipt(receipt.id)}
                                            className="accent-[#8CC63F] w-4 h-4"
                                        />
                                        <span className="flex-1 min-w-0 text-xs text-zinc-200 truncate">
                                            {receipt.merchant} · {receipt.worker_email}
                                            {isPartiallyPaid && (
                                                <span className="block text-[10px] text-amber-400/90">
                                                    Abonado ${balance.paid.toLocaleString('es-CL')} de ${balance.total.toLocaleString('es-CL')}
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-xs whitespace-nowrap text-right">
                                            <span className={isPartiallyPaid ? 'text-amber-400 font-medium' : 'text-zinc-400'}>
                                                ${balance.remaining.toLocaleString('es-CL')}
                                            </span>
                                            {isPartiallyPaid && <span className="block text-[10px] text-zinc-500">saldo</span>}
                                        </span>
                                    </label>
                                );
                            })
                        )}
                    </div>

                    {error && <p className="text-xs text-red-400">{error}</p>}

                    <div className="flex items-center justify-between gap-4 border-t border-white/5 pt-4">
                        <div className="text-xs text-zinc-400 min-w-0">
                            <div>
                                Saldo seleccionado: <span className="text-[#8CC63F] font-medium">${selectedTotal.toLocaleString('es-CL')}</span>
                                {activePaymentAmount > 0 ? ` · comprobante $${activePaymentAmount.toLocaleString('es-CL')}` : ''}
                            </div>
                            {leavesBalance && (
                                <div className="text-amber-400 text-[11px] mt-1">
                                    Abono parcial: quedará un saldo de ${(selectedTotal - activePaymentAmount).toLocaleString('es-CL')} por pagar con otra transferencia.
                                </div>
                            )}
                        </div>
                        <button
                            onClick={handleConfirm}
                            disabled={selectedReceiptIds.size === 0 || isConfirming}
                            className="flex items-center gap-2 bg-[#8CC63F] hover:bg-[#3EAE49] disabled:opacity-40 disabled:cursor-not-allowed text-[#121D38] px-4 py-2 rounded-xl text-xs font-bold transition shrink-0"
                        >
                            {isConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            {leavesBalance ? 'Confirmar abono parcial' : 'Confirmar y marcar Reembolsado'}
                        </button>
                    </div>
                    </>
                    )}
                </div>
            )}
        </div>
    );
}
