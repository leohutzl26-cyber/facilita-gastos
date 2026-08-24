'use client';
import { useState, useEffect } from 'react';
import { Trash2, RotateCcw, Trash, Loader2, AlertCircle, RefreshCw, Eye } from 'lucide-react';
import RecycleBinDetailModal from './RecycleBinDetailModal';

type DeletedRecord = {
    id: string;
    table_name: 'receipts' | 'projects' | 'categories' | 'workers';
    original_id: string;
    data: any;
    deleted_at: string;
    deleted_by: string;
};

export default function RecycleBin() {
    const [records, setRecords] = useState<DeletedRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState<string | null>(null); // record ID or 'vaciar'
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [detailRecord, setDetailRecord] = useState<DeletedRecord | null>(null);

    useEffect(() => {
        fetchRecords();
    }, []);

    const fetchRecords = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/recycle-bin', { cache: 'no-store' });
            const data = await res.json();
            if (res.ok && data.records) {
                setRecords(data.records);
            } else {
                setError(data.error || 'No se pudo cargar la papelera.');
            }
        } catch (err: any) {
            console.error('Error fetching recycle bin:', err);
            setError(err.message || 'Error de red al cargar la papelera.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestore = async (record: DeletedRecord) => {
        const typeLabel = getTypeName(record.table_name);
        const nameLabel = getRecordName(record);
        if (!confirm(`¿Estás seguro de restaurar el ${typeLabel} "${nameLabel}"? Volverá a estar activo en el sistema.`)) return;

        setIsActionLoading(record.id);
        setError(null);
        setSuccessMsg(null);
        try {
            const res = await fetch('/api/admin/recycle-bin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: record.id })
            });
            const data = await res.json();

            if (res.ok) {
                setSuccessMsg(`¡${typeLabel} restaurado con éxito!`);
                setRecords(prev => prev.filter(r => r.id !== record.id));
                setTimeout(() => setSuccessMsg(null), 4000);
            } else {
                setError(data.error || 'Error al restaurar el elemento.');
            }
        } catch (err: any) {
            console.error('Error restoring:', err);
            setError(err.message || 'Error al procesar la restauración.');
        } finally {
            setIsActionLoading(null);
        }
    };

    const handlePurge = async (record: DeletedRecord) => {
        const typeLabel = getTypeName(record.table_name);
        const nameLabel = getRecordName(record);
        if (!confirm(`¿Estás seguro de ELIMINAR PERMANENTEMENTE el ${typeLabel} "${nameLabel}"? Esta acción no se puede deshacer y los datos se perderán para siempre.`)) return;

        setIsActionLoading(record.id);
        setError(null);
        setSuccessMsg(null);
        try {
            const res = await fetch(`/api/admin/recycle-bin/${record.id}`, {
                method: 'DELETE'
            });
            const data = await res.json();

            if (res.ok) {
                setSuccessMsg('Elemento eliminado definitivamente.');
                setRecords(prev => prev.filter(r => r.id !== record.id));
                setTimeout(() => setSuccessMsg(null), 4000);
            } else {
                setError(data.error || 'Error al purgar el elemento.');
            }
        } catch (err: any) {
            console.error('Error purging:', err);
            setError(err.message || 'Error al procesar la eliminación definitiva.');
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleEmptyBin = async () => {
        if (records.length === 0) return;
        if (!confirm('¿Estás seguro de VACIAR LA PAPELERA DE RECICLAJE? Todos los elementos en este listado se eliminarán permanentemente de forma irreversible.')) return;

        setIsActionLoading('vaciar');
        setError(null);
        setSuccessMsg(null);

        let purgedCount = 0;
        let failCount = 0;

        for (const record of records) {
            try {
                const res = await fetch(`/api/admin/recycle-bin/${record.id}`, {
                    method: 'DELETE'
                });
                if (res.ok) {
                    purgedCount++;
                } else {
                    failCount++;
                }
            } catch (err) {
                failCount++;
            }
        }

        if (purgedCount > 0) {
            setSuccessMsg(`Se vació la papelera: ${purgedCount} elementos eliminados permanentemente.`);
            setTimeout(() => setSuccessMsg(null), 5000);
        }
        if (failCount > 0) {
            setError(`No se pudieron eliminar permanentemente ${failCount} elementos.`);
        }

        fetchRecords();
        setIsActionLoading(null);
    };

    const getTypeName = (table_name: DeletedRecord['table_name']) => {
        switch (table_name) {
            case 'receipts': return 'Recibo';
            case 'projects': return 'Proyecto';
            case 'categories': return 'Categoría';
            case 'workers': return 'Colaborador';
            default: return 'Elemento';
        }
    };

    const getTypeStyle = (table_name: DeletedRecord['table_name']) => {
        switch (table_name) {
            case 'receipts':
                return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
            case 'projects':
                return 'bg-purple-500/10 text-purple-400 border border-purple-500/20';
            case 'categories':
                return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
            case 'workers':
                return 'bg-[#8CC63F]/10 text-[#8CC63F] border border-[#8CC63F]/20';
            default:
                return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';
        }
    };

    const getRecordName = (record: DeletedRecord) => {
        const { table_name, data } = record;
        if (!data) return 'Sin datos';
        switch (table_name) {
            case 'receipts':
                return `${data.merchant || 'Comercio'} ($${Number(data.amount || 0).toLocaleString('es-CL')})`;
            case 'projects':
                return data.name || 'Proyecto sin nombre';
            case 'categories':
                return data.name || 'Categoría sin nombre';
            case 'workers':
                return data.user_metadata?.name || data.email || 'Colaborador';
            default:
                return 'Detalles desconocidos';
        }
    };

    const getRecordDetail = (record: DeletedRecord) => {
        const { table_name, data } = record;
        if (!data) return '';
        switch (table_name) {
            case 'receipts':
                return `Categoría: ${data.category || '-'} | Fecha: ${data.date || '-'} | Resp: ${data.worker_email || '-'}`;
            case 'projects':
                return data.description ? `Descripción: ${data.description}` : 'Sin descripción adicional';
            case 'categories':
                return data.max_amount_alert ? `Límite de alerta: $${data.max_amount_alert.toLocaleString('es-CL')}` : 'Sin tope de alerta configurado';
            case 'workers':
                return `Email: ${data.email} | Rol: ${data.user_metadata?.role || 'colaborador'}`;
            default:
                return '';
        }
    };

    return (
        <div className="bg-[#1C2D54]/30 border border-[#8CC63F]/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#8CC63F]/10 rounded-lg">
                        <Trash2 className="w-5 h-5 text-[#8CC63F]" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-zinc-100 font-sans">Papelera de Reciclaje</h2>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            Recupera elementos borrados recientemente (recibos, colaboradores, proyectos y categorías).
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchRecords}
                        disabled={isLoading || isActionLoading !== null}
                        className="p-2 bg-[#1C2D54] border border-white/5 rounded-xl text-zinc-400 hover:text-white transition disabled:opacity-50"
                        title="Actualizar"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    {records.length > 0 && (
                        <button
                            onClick={handleEmptyBin}
                            disabled={isLoading || isActionLoading !== null}
                            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 px-3 py-2 rounded-xl text-xs font-semibold transition disabled:opacity-50"
                        >
                            {isActionLoading === 'vaciar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash className="w-4 h-4" />}
                            Vaciar Papelera
                        </button>
                    )}
                </div>
            </div>

            {/* Notification messages */}
            {error && (
                <div className="mb-4 p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}
            {successMsg && (
                <div className="mb-4 p-3 bg-[#8CC63F]/15 border border-[#8CC63F]/30 rounded-xl text-[#8CC63F] text-xs flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 flex-shrink-0" />
                    <span>{successMsg}</span>
                </div>
            )}

            {/* Content Table */}
            <div className="bg-[#121D38] border border-white/5 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-[#1C2D54] border-b border-white/5 text-zinc-400 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3.5 font-medium">Elemento / Tipo</th>
                                <th className="px-6 py-3.5 font-medium">Detalles</th>
                                <th className="px-6 py-3.5 font-medium">Fecha Eliminación</th>
                                <th className="px-6 py-3.5 font-medium">Borrado por</th>
                                <th className="px-6 py-3.5 font-medium text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-zinc-300">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#8CC63F]" />
                                        Cargando papelera de reciclaje...
                                    </td>
                                </tr>
                            ) : records.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                                        La papelera de reciclaje está vacía.
                                    </td>
                                </tr>
                            ) : (
                                records.map((record) => (
                                    <tr key={record.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-3.5 flex items-center gap-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${getTypeStyle(record.table_name)}`}>
                                                {getTypeName(record.table_name)}
                                            </span>
                                            <button
                                                onClick={() => setDetailRecord(record)}
                                                className="font-semibold text-zinc-100 hover:text-[#8CC63F] max-w-[200px] truncate text-left transition"
                                                title={getRecordName(record)}
                                            >
                                                {getRecordName(record)}
                                            </button>
                                        </td>
                                        <td className="px-6 py-3.5 text-xs text-zinc-400 max-w-[300px] truncate" title={getRecordDetail(record)}>
                                            {getRecordDetail(record)}
                                        </td>
                                        <td className="px-6 py-3.5 text-xs text-zinc-400">
                                            {new Date(record.deleted_at).toLocaleString('es-CL')}
                                        </td>
                                        <td className="px-6 py-3.5 text-xs text-zinc-300">
                                            {record.deleted_by}
                                        </td>
                                        <td className="px-6 py-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => setDetailRecord(record)}
                                                    className="p-2 bg-zinc-700/30 text-zinc-300 hover:bg-zinc-700 hover:text-white rounded-lg transition"
                                                    title="Ver Detalle"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleRestore(record)}
                                                    disabled={isActionLoading !== null}
                                                    className="p-2 bg-[#8CC63F]/10 text-[#8CC63F] hover:bg-[#8CC63F] hover:text-[#121D38] rounded-lg transition disabled:opacity-50 flex items-center gap-1 text-xs font-semibold"
                                                    title="Restaurar Elemento"
                                                >
                                                    {isActionLoading === record.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                                                    Restaurar
                                                </button>
                                                <button
                                                    onClick={() => handlePurge(record)}
                                                    disabled={isActionLoading !== null}
                                                    className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition disabled:opacity-50"
                                                    title="Eliminar Definitivamente (Purgar)"
                                                >
                                                    <Trash className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {detailRecord && (
                <RecycleBinDetailModal record={detailRecord} onClose={() => setDetailRecord(null)} />
            )}
        </div>
    );
}
