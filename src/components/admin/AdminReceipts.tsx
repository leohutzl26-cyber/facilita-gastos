'use client';
import { useState, useEffect } from 'react';
import { Receipt, Search, ExternalLink } from 'lucide-react';

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

    const filteredReceipts = receipts.filter(r =>
        r.merchant.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.category.toLowerCase().includes(searchTerm.toLowerCase())
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
                                <th className="px-6 py-4 font-medium">Comercio</th>
                                <th className="px-6 py-4 font-medium text-left">Categoría</th>
                                <th className="px-6 py-4 font-medium text-center">Boleta</th>
                                <th className="px-6 py-4 font-medium text-right">Monto</th>
                                <th className="px-6 py-4 font-medium text-center">ID Creador</th>
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
                                        <td className="px-6 py-4 text-white font-medium">{receipt.merchant}</td>
                                        <td className="px-6 py-4">
                                            <span className="bg-[#8CC63F]/10 text-[#8CC63F] px-2 py-1 rounded text-xs whitespace-nowrap">
                                                {receipt.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {receipt.image_url ? (
                                                receipt.image_url.startsWith('http') ? (
                                                    <a href={receipt.image_url} target="_blank" rel="noopener noreferrer" className="text-[#8CC63F] hover:text-[#3EAE49] inline-flex items-center gap-1">
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                ) : (
                                                    <span className="text-red-400 text-[10px] leading-tight block max-w-[120px] font-medium" title={receipt.image_url}>
                                                        {receipt.image_url.length > 30 ? receipt.image_url.substring(0, 30) + '...' : receipt.image_url}
                                                    </span>
                                                )
                                            ) : (
                                                <span className="text-zinc-600 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right text-white font-semibold">
                                            ${receipt.amount}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-xs text-zinc-300 font-mono bg-black/30 px-2 py-1 rounded">
                                                {receipt.worker_email || receipt.worker_id.substring(0, 8) + '...'}
                                            </span>
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
