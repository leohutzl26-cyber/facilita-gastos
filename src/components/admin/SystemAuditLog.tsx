'use client';
import { useState, useEffect } from 'react';
import { ShieldAlert, Clock, User, Activity, Loader2, Search } from 'lucide-react';

export default function SystemAuditLog() {
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [debugError, setDebugError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [totalLogs, setTotalLogs] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const limit = 50;

    // Debounce del buscador
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(1); // Reset a la primera página al buscar
        }, 400);

        return () => clearTimeout(handler);
    }, [searchTerm]);

    useEffect(() => {
        const fetchLogs = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/audit?page=${page}&limit=${limit}&search=${encodeURIComponent(debouncedSearch)}`, { cache: 'no-store' });
                const data = await res.json();
                if (res.ok && data.logs) {
                    setLogs(data.logs);
                    setTotalLogs(data.total || 0);
                    setDebugError(null);
                } else {
                    setDebugError(data.error || 'Server returned not OK');
                }
            } catch (err: any) {
                console.error("Error fetching audit logs", err);
                setDebugError(err.message || 'Network exception');
            } finally {
                setIsLoading(false);
            }
        };

        fetchLogs();
    }, [page, debouncedSearch]);

    const isDangerAction = (action: string) => {
        const lowerAction = action.toLowerCase();
        return lowerAction.includes('rechazo') || 
               lowerAction.includes('eliminar') || 
               lowerAction.includes('limpieza') || 
               lowerAction.includes('borrado');
    };

    return (
        <div className="mt-8 bg-[#1C2D54]/30 border border-[#8CC63F]/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-[#8CC63F]/10 rounded-lg">
                    <ShieldAlert className="w-5 h-5 text-[#8CC63F]" />
                </div>
                <h2 className="text-xl font-bold text-zinc-100">Log de Auditoría del Sistema</h2>
            </div>
            
            <p className="text-sm text-zinc-400 mb-6 max-w-3xl">
                Registro inmutable de todas las acciones y accesos al sistema. Las acciones de alto riesgo se resaltan en <span className="text-red-400 font-medium">rojo</span>.
            </p>

            {/* Buscador */}
            <div className="relative mb-6 w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                    type="text"
                    placeholder="Buscar por usuario, acción o detalle..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-[#121D38] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#8CC63F] text-zinc-200"
                />
            </div>

            <div className="bg-[#121D38] border border-white/5 rounded-xl overflow-hidden">
                <div className="overflow-y-auto max-h-[500px]">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-[#1C2D54] border-b border-white/5 text-zinc-400 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-6 py-4 font-medium"><div className="flex items-center gap-2"><Clock className="w-4 h-4"/> Fecha y Hora</div></th>
                                <th className="px-6 py-4 font-medium"><div className="flex items-center gap-2"><User className="w-4 h-4"/> Usuario</div></th>
                                <th className="px-6 py-4 font-medium"><div className="flex items-center gap-2"><Activity className="w-4 h-4"/> Acción</div></th>
                                <th className="px-6 py-4 font-medium w-full">Detalles</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-zinc-300">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#8CC63F]" />
                                        Cargando logs...
                                    </td>
                                </tr>
                            ) : debugError ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-red-500 font-medium">
                                        Error obteniendo logs: {debugError}
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                                        No hay registros de auditoría almacenados aún. Si activaste el logging recientemente, realiza alguna acción para verla aquí.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => {
                                    const danger = isDangerAction(log.action);
                                    return (
                                        <tr key={log.id} className={`${danger ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-white/5'} transition-colors`}>
                                            <td className="px-6 py-3 text-xs text-zinc-400">
                                                {new Date(log.created_at).toLocaleString('es-CL', {
                                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                                                })}
                                            </td>
                                            <td className="px-6 py-3 font-medium text-zinc-200">
                                                {log.user_email}
                                            </td>
                                            <td className="px-6 py-3">
                                                <span className={`px-2 py-1 rounded text-[11px] font-bold ${
                                                    danger 
                                                    ? 'bg-red-500/20 text-red-400 border border-red-500/20' 
                                                    : 'bg-[#8CC63F]/10 text-[#8CC63F] border border-[#8CC63F]/20'
                                                }`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className={`px-6 py-3 text-xs truncate max-w-[400px] ${danger ? 'text-red-300' : 'text-zinc-400'}`} title={log.details}>
                                                {log.details}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination Controls */}
                {!isLoading && !debugError && logs.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-white/5 text-sm text-zinc-400 bg-[#1C2D54]/20">
                        <div>
                            Mostrando <span className="font-semibold text-zinc-200">{((page - 1) * limit) + 1}</span> a{' '}
                            <span className="font-semibold text-zinc-200">
                                {Math.min(page * limit, totalLogs)}
                            </span>{' '}
                            de <span className="font-semibold text-zinc-200">{totalLogs}</span> registros
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 disabled:opacity-30 disabled:hover:border-white/10 transition-colors disabled:cursor-not-allowed text-zinc-200 bg-white/5 hover:bg-white/10 disabled:bg-transparent font-medium"
                            >
                                Anterior
                            </button>
                            <span className="text-zinc-300">
                                Página <span className="font-semibold text-zinc-100">{page}</span> de{' '}
                                <span className="font-semibold text-zinc-100">{Math.ceil(totalLogs / limit) || 1}</span>
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(Math.ceil(totalLogs / limit), p + 1))}
                                disabled={page >= Math.ceil(totalLogs / limit)}
                                className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 disabled:opacity-30 disabled:hover:border-white/10 transition-colors disabled:cursor-not-allowed text-zinc-200 bg-white/5 hover:bg-white/10 disabled:bg-transparent font-medium"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
