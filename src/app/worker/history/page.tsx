'use client';
import { useState, useEffect } from 'react';
import { Camera, Search, Filter, History, MapPin, Receipt, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function WorkerHistory() {
    const router = useRouter();
    const [history, setHistory] = useState<any[]>([]);

    useEffect(() => {
        const stored = localStorage.getItem('worker_history');
        if (stored) {
            setHistory(JSON.parse(stored));
        }
    }, []);

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
                </div>
            </nav>

            <main className="max-w-xl mx-auto px-4 pt-6 space-y-6">

                {history.length === 0 ? (
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
                                        <span className="font-bold text-[#8CC63F] flex-shrink-0">${record.amount}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-zinc-500">
                                        <span>{record.date}</span>
                                        <span className="bg-white/10 px-2 py-1 rounded text-zinc-300 truncate max-w-[120px]">{record.category}</span>
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
