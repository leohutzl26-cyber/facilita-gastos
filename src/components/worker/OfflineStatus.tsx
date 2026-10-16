'use client';
import { AlertCircle, CheckCircle2, Clock, Loader2, WifiOff } from 'lucide-react';
import type { OfflineQueue } from '@/utils/useOfflineQueue';
import type { QueuedReceipt } from '@/utils/offlineQueue';

type Props = {
    queue: OfflineQueue;
    onEdit?: (item: QueuedReceipt) => void;
};

function formatAmount(raw: string) {
    const digits = String(raw ?? '').replace(/[^\d]/g, '');
    return digits ? `$${Number(digits).toLocaleString('es-CL')}` : 'Sin monto';
}

// Aviso de conexión y lista de gastos que aún no llegan al servidor.
export default function OfflineStatus({ queue, onEdit }: Props) {
    const { online, items, pendingCount, syncing, summary, syncNow, discard, retry } = queue;
    const rejected = items.filter((item) => item.status === 'rejected');
    const sentJustNow = summary && summary.sent > 0 ? summary.sent : 0;
    const needsLogin = summary?.blocked === 'auth' && pendingCount > 0;

    if (online && items.length === 0 && !sentJustNow) return null;

    return (
        <div className="space-y-3">
            {!online && (
                <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl p-4 text-sm">
                    <WifiOff className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold">Sin conexión</p>
                        <p className="text-xs opacity-90 mt-0.5">
                            Puedes seguir registrando gastos: se guardan en tu teléfono y se envían solos cuando vuelva la señal.
                        </p>
                    </div>
                </div>
            )}

            {online && pendingCount > 0 && (
                <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl p-4 text-sm">
                    {syncing ? <Loader2 className="w-5 h-5 shrink-0 animate-spin" /> : <Clock className="w-5 h-5 shrink-0" />}
                    <p className="flex-1 font-medium">
                        {needsLogin
                            ? 'Tu sesión venció: inicia sesión de nuevo para enviar tus gastos guardados.'
                            : syncing
                                ? `Enviando ${pendingCount} gasto${pendingCount === 1 ? '' : 's'}...`
                                : `${pendingCount} gasto${pendingCount === 1 ? '' : 's'} en espera de envío`}
                    </p>
                    {!syncing && !needsLogin && (
                        <button onClick={syncNow} className="text-xs font-bold underline shrink-0">Enviar ahora</button>
                    )}
                </div>
            )}

            {sentJustNow > 0 && (
                <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl p-4 text-sm">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <p className="font-medium">
                        ¡Conexión recuperada! Se enviaron {sentJustNow} gasto{sentJustNow === 1 ? '' : 's'} guardado{sentJustNow === 1 ? '' : 's'}.
                    </p>
                </div>
            )}

            {items.length > 0 && (
                <div className="bg-card-50 border border-line rounded-2xl divide-y divide-line overflow-hidden">
                    <p className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                        Guardados en tu teléfono ({items.length})
                    </p>
                    {items.map((item) => {
                        const isRejected = item.status === 'rejected';
                        const image = item.payload.imageBase64;
                        return (
                            <div key={item.id} className="p-4 flex gap-3 items-start">
                                <div className="w-11 h-11 rounded-xl bg-inset-30 overflow-hidden shrink-0 flex items-center justify-center text-zinc-500">
                                    {image?.startsWith('data:image') ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={image} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <AlertCircle className="w-5 h-5 opacity-40" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-zinc-200 truncate">
                                        {item.payload.merchant || 'Sin comercio'} · {formatAmount(item.payload.amount)}
                                    </p>
                                    <p className="text-[11px] text-zinc-500">{item.payload.date}</p>
                                    {isRejected ? (
                                        <p className="text-xs text-red-400 mt-1">No se pudo enviar: {item.lastError}</p>
                                    ) : (
                                        <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> En espera de conexión
                                        </p>
                                    )}
                                    <div className="flex gap-4 mt-2 text-xs font-semibold">
                                        {onEdit && <button onClick={() => onEdit(item)} className="text-brand">Editar</button>}
                                        {isRejected && <button onClick={() => retry(item.id)} className="text-brand">Reintentar</button>}
                                        <button
                                            onClick={() => {
                                                if (confirm('¿Descartar este gasto? Se perderán la foto y los datos guardados.')) discard(item.id);
                                            }}
                                            className="text-red-400"
                                        >
                                            Descartar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {rejected.length > 0 && !onEdit && (
                <p className="text-[11px] text-zinc-500 px-1">Para corregir un gasto rechazado, descártalo y regístralo de nuevo.</p>
            )}
        </div>
    );
}
