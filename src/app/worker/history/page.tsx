'use client';
import { useState, useEffect } from 'react';
import { Camera, Search, Filter, History, MapPin, Receipt, ArrowLeft, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function WorkerHistory() {
    const router = useRouter();
    const [history, setHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch('/api/worker/receipts');
                const data = await res.json();
                if (res.ok && data.receipts) {
                    setHistory(data.receipts);
                }
            } catch (err) {
                console.error("Error fetching history:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, []);

    // Password Security Check
    useEffect(() => {
        const checkSecurityStatus = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();

            if (user?.user_metadata?.requires_password_change) {
                router.push('/worker/change-password');
            }
        };

        checkSecurityStatus();
    }, [router]);

    const stats = history.reduce((acc, curr) => {
        acc.totalRegistrado += Number(curr.amount) || 0;
        if (curr.status === 'Aprobado por Supervisor') acc.totalAprobado += Number(curr.amount) || 0;
        if (curr.status === 'Reembolsado') acc.totalReembolsado += Number(curr.amount) || 0;
        if (curr.status === 'Pendiente' || !curr.status) acc.countPendientes++;
        if (curr.status === 'Rechazado') acc.countRechazados++;
        return acc;
    }, { totalRegistrado: 0, totalAprobado: 0, totalReembolsado: 0, countPendientes: 0, countRechazados: 0 });

    return (
        <div className="min-h-screen bg-[#121D38] text-zinc-50 font-sans pb-20">
            <nav className="border-b border-[#8CC63F]/10 bg-[#1C2D54]/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
                    <button onClick={() => router.push('/worker/capture')} className="flex items-center gap-2 text-zinc-400 hover:text-white transition">
                        <ArrowLeft className="w-5 h-5" />
                        <span className="font-medium text-sm hidden sm:inline">Volver a Escanear</span>
                    </button>
                    <div className="flex items-center gap-2">
                        <History className="w-5 h-5 text-[#8CC63F]" />
                        <span className="font-semibold text-zinc-200">Historial de Gastos</span>
                    </div>
                    {/* Botón de limpiar localstorage removido porque ahora es en vivo */}
                </div>
            </nav>

            <main className="max-w-xl mx-auto px-4 pt-6 space-y-6">

                {!isLoading && history.length > 0 && (
                    <div className="bg-gradient-to-br from-[#1C2D54] to-[#121D38] border border-[#8CC63F]/20 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#8CC63F]/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
                        <h2 className="text-sm font-medium text-zinc-400 mb-4">Resumen de Gastos</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-zinc-500 mb-1">Total Reembolsado</p>
                                <p className="text-2xl font-bold text-[#8CC63F]">${stats.totalReembolsado.toLocaleString('es-CL')}</p>
                            </div>
                            <div>
                                <p className="text-xs text-zinc-500 mb-1">Total Aprobado</p>
                                <p className="text-2xl font-bold text-blue-400">${stats.totalAprobado.toLocaleString('es-CL')}</p>
                            </div>
                            <div className="col-span-2 pt-2 border-t border-white/5">
                                <p className="text-xs text-zinc-500 mb-1">En Revisión</p>
                                <p className="text-lg font-semibold text-yellow-400">{stats.countPendientes} tickets</p>
                            </div>
                            <div className="col-span-2 pt-3 border-t border-white/5 flex justify-between items-center mt-2">
                                <div>
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Monto Total Registrado</p>
                                    <p className="text-sm font-medium text-zinc-300">${stats.totalRegistrado.toLocaleString('es-CL')}</p>
                                </div>
                                {stats.countRechazados > 0 && (
                                    <div className="bg-red-500/10 text-red-400 px-3 py-1 rounded-full text-xs font-medium border border-red-500/20">
                                        {stats.countRechazados} Rechazados
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {isLoading ? (
                    <div className="text-center py-20 text-zinc-500 flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full border-2 border-[#8CC63F] border-t-transparent animate-spin mb-4"></div>
                        Cargando historial...
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center py-20 bg-white/5 rounded-[2rem] border border-white/10">
                        <Receipt className="w-12 h-12 text-zinc-600 mx-auto mb-4 opacity-50" />
                        <h3 className="text-zinc-300 font-medium">No hay gastos recientes</h3>
                        <p className="text-sm text-zinc-500 mt-2 max-w-[250px] mx-auto">Tus recibos escaneados aparecerán aquí para que lleves el control.</p>
                        <button onClick={() => router.push('/worker/capture')} className="mt-6 bg-[#8CC63F] text-[#121D38] px-6 py-2 rounded-xl text-sm font-bold">
                            Escanear Recibo
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {history.map((record: any) => (
                            <div key={record.id} className="bg-[#1C2D54]/50 border border-white/5 rounded-2xl p-4 flex items-start gap-4 hover:border-[#8CC63F]/30 transition-all">
                                <div className="w-12 h-12 rounded-xl bg-[#8CC63F]/20 text-[#8CC63F] flex items-center justify-center flex-shrink-0 font-bold">
                                    {record.merchant.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <h4 className="font-semibold text-zinc-100 truncate">{record.merchant}</h4>
                                        <div className="text-right">
                                            <span className="font-bold text-[#8CC63F] flex-shrink-0">${record.amount}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                                        <span>{record.date}</span>
                                        <span className="bg-white/10 px-2 py-1 rounded text-zinc-300 truncate max-w-[120px]">{record.category}</span>
                                    </div>

                                    <div className="flex flex-col gap-1 mt-2 border-t border-white/5 pt-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${record.status === 'Pendiente' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                                record.status === 'Aprobado por Supervisor' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                    record.status === 'Rechazado' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                                        'bg-[#8CC63F]/20 text-[#8CC63F] border border-[#8CC63F]/30'
                                                }`}>
                                                {record.status || 'Pendiente'}
                                            </span>
                                        </div>
                                        {record.status === 'Rechazado' && record.rejection_reason && (
                                            <div className="text-[11px] text-red-400/90 mt-1 p-2 bg-red-500/10 rounded-lg whitespace-pre-wrap">
                                                <strong>Motivo del Rechazo:</strong> {record.rejection_reason}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
