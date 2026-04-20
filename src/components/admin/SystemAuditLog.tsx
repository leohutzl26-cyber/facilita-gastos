'use client';
import { useState, useEffect } from 'react';
import { ShieldAlert, Clock, User, Activity, Loader2 } from 'lucide-react';

export default function SystemAuditLog() {
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [debugError, setDebugError] = useState<string | null>(null);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await fetch('/api/audit', { cache: 'no-store' });
                const data = await res.json();
                if (res.ok && data.logs) {
                    setLogs(data.logs);
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
    }, []);

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
                Registro inmutable de todas las acciones y accesos al sistema. Las acciones de alto riesgo se resaltan en <span className="text-red-400 font-medium">rojo</span>. Mostrando las últimas 100 actividades.
            </p>

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
            </div>
        </div>
    );
}
