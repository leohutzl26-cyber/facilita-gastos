'use client';
import { useState, useEffect } from 'react';
import { Receipt, Search, ExternalLink, CheckCircle, CreditCard, Loader2 } from 'lucide-react';

export default function AdminReceipts() {
    const [receipts, setReceipts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchReceipts = async () => {
            try {
                const res = await fetch('/api/admin/receipts');
                const data = await res.json();
                if (res.ok && data.receipts) {
                    setReceipts(data.receipts);
                }
            } catch (err) {
                console.error("Error fetching receipts", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchReceipts();
    }, []);

    const handleStatusUpdate = async (id: string, newStatus: string) => {
        try {
            const res = await fetch('/api/admin/receipts/status', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status: newStatus })
            });
            if (res.ok) {
                setReceipts(receipts.map(r => r.id === id ? { ...r, status: newStatus } : r));
            } else {
                alert("Error al actualizar estado.");
            }
        } catch (err) {
            console.error(err);
        }
    };

    const filteredReceipts = receipts.filter(r =>
        r.merchant.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.projects && r.projects.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="Buscar comercio o categoría..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-[#1C2D54] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#8CC63F] text-zinc-200"
                    />
                </div>
            </div>

            <div className="bg-[#1C2D54] border border-white/10 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-[#1C2D54] border-b border-white/10 text-zinc-400">
                            <tr>
                                <th className="px-6 py-4 font-medium">Fecha</th>
                                <th className="px-6 py-4 font-medium">Proyecto y Comercio</th>
                                <th className="px-6 py-4 font-medium text-left">Categoría</th>
                                <th className="px-6 py-4 font-medium text-center">Info. Pago</th>
                                <th className="px-6 py-4 font-medium text-center">Estado</th>
                                <th className="px-6 py-4 font-medium text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">
                                        Cargando recibos...
                                    </td>
                                </tr>
                            ) : filteredReceipts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <Receipt className="w-10 h-10 text-zinc-600 mb-3" />
                                            <p className="text-zinc-500 font-medium">No se encontraron recibos</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredReceipts.map((receipt) => (
                                    <tr key={receipt.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 text-zinc-300 whitespace-nowrap">{receipt.date}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-white font-medium">{receipt.merchant}</span>
                                                <span className="text-xs text-zinc-400">
                                                    {receipt.projects ? `Carpeta: ${receipt.projects.name}` : 'Gasto Genérico'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="bg-[#8CC63F]/10 text-[#8CC63F] px-2 py-1 rounded text-xs whitespace-nowrap">
                                                {receipt.category}
                                            </span>
                                            <div className="text-[10px] text-zinc-500 mt-1" title={receipt.worker_email}>
                                                Generado por: {receipt.worker_email?.split('@')[0] || 'Unknown'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="text-white font-semibold mb-1">${receipt.amount}</div>
                                            {receipt.image_url ? (
                                                receipt.image_url.startsWith('http') ? (
                                                    <a href={receipt.image_url} target="_blank" rel="noopener noreferrer" className="text-[#8CC63F] hover:text-[#3EAE49] inline-flex items-center gap-1 text-xs">
                                                        <ExternalLink className="w-3 h-3" /> Ver Boleta
                                                    </a>
                                                ) : (
                                                    <span className="text-red-400 text-[10px] block font-medium" title={receipt.image_url}>
                                                        Error URL
                                                    </span>
                                                )
                                            ) : (
                                                <span className="text-zinc-600 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded text-[11px] font-medium whitespace-nowrap ${receipt.status === 'Pendiente' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                                    receipt.status === 'Aprobado por Supervisor' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                        'bg-[#8CC63F]/20 text-[#8CC63F] border border-[#8CC63F]/30'
                                                }`}>
                                                {receipt.status || 'Pendiente'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {(receipt.status === 'Pendiente' || !receipt.status) && (
                                                    <button
                                                        onClick={() => handleStatusUpdate(receipt.id, 'Aprobado por Supervisor')}
                                                        className="p-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-md transition"
                                                        title="Aprobar (Supervisor)"
                                                    >
                                                        <CheckCircle className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {receipt.status === 'Aprobado por Supervisor' && (
                                                    <button
                                                        onClick={() => handleStatusUpdate(receipt.id, 'Reembolsado')}
                                                        className="p-1.5 bg-[#8CC63F]/10 text-[#8CC63F] hover:bg-[#8CC63F] hover:text-[#121D38] rounded-md transition"
                                                        title="Marcar como Reembolsado/Pagado"
                                                    >
                                                        <CreditCard className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
