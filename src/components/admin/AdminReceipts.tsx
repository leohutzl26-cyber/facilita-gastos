'use client';
import { useState, useEffect } from 'react';
import { Receipt, Search, ExternalLink, CheckCircle, CreditCard, Loader2, XCircle, Download, Trash2, FileSpreadsheet, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function AdminReceipts() {
    const [receipts, setReceipts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    // Advance Filters States
    const [filterCategory, setFilterCategory] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [filterWorker, setFilterWorker] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [resReceipts, resCategories] = await Promise.all([
                    fetch('/api/admin/receipts'),
                    fetch('/api/admin/categories')
                ]);

                const dataReceipts = await resReceipts.json();
                const dataCategories = await resCategories.json();

                if (resReceipts.ok && dataReceipts.receipts) {
                    setReceipts(dataReceipts.receipts);
                }
                if (resCategories.ok && dataCategories.categories) {
                    setCategories(dataCategories.categories);
                }
            } catch (err) {
                console.error("Error fetching data", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const categoryAlerts = categories.reduce((acc, cat) => {
        if (cat.max_amount_alert) {
            acc[cat.name] = cat.max_amount_alert;
        }
        return acc;
    }, {} as Record<string, number>);

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

    const handleRejectSubmit = async () => {
        if (!rejectingId || !rejectionReason.trim()) return;

        try {
            const res = await fetch('/api/admin/receipts/status', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: rejectingId,
                    status: 'Rechazado',
                    rejection_reason: rejectionReason
                })
            });
            if (res.ok) {
                setReceipts(receipts.map(r => r.id === rejectingId ? { ...r, status: 'Rechazado', rejection_reason: rejectionReason } : r));
                setRejectingId(null);
                setRejectionReason('');
            } else {
                alert("Error al actualizar estado.");
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleExportExcel = () => {
        if (filteredReceipts.length === 0) return;

        // Custom Header mapping for Excel
        const dataForExcel = filteredReceipts.map(r => ({
            'Fecha': r.date,
            'Comercio': r.merchant,
            'Proyecto': r.projects?.name || 'Gasto Genérico',
            'Categoría': r.category,
            'Monto ($)': Number(r.amount),
            'Estado': r.status || 'Pendiente',
            'Colaborador (Email)': r.worker_email || 'Desconocido',
            'Motivo Rechazo': r.rejection_reason || ''
        }));

        // 1. Convert specific JSON structure to a worksheet
        const worksheet = XLSX.utils.json_to_sheet(dataForExcel);

        // 2. Create a new workbook and append the worksheet
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte_Gastos");

        // 3. Trigger native browser download of the Excel File
        const fileName = `Reporte_Gastos_Facilita_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    const handleExportPDF = () => {
        if (filteredReceipts.length === 0) return;

        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(18);
        doc.setTextColor(28, 45, 84); // #1C2D54
        doc.text('Facilita Capacitación - Reporte de Gastos', 14, 22);
        
        doc.setFontSize(11);
        doc.setTextColor(100);
        const dateStr = new Date().toLocaleDateString('es-CL');
        doc.text(`Fecha de emisión: ${dateStr}`, 14, 30);
        doc.text(`Total de registros: ${filteredReceipts.length}`, 14, 36);

        const totalAmount = filteredReceipts.reduce((sum, r) => sum + Number(r.amount), 0);
        doc.setFontSize(12);
        // #8CC63F (140, 198, 63)
        doc.setTextColor(140, 198, 63); 
        doc.text(`Suma Total: $${totalAmount.toLocaleString()}`, 14, 44);

        // Table
        const tableColumn = ["Fecha", "Comercio", "Proyecto", "Categoría", "Colaborador", "Monto", "Estado"];
        const tableRows = filteredReceipts.map(r => [
            r.date,
            r.merchant,
            (r.projects?.name || 'Gasto Genérico').substring(0, 15),
            r.category,
            r.worker_email?.split('@')[0] || 'Desconocido',
            `$${Number(r.amount).toLocaleString()}`,
            r.status || 'Pendiente'
        ]);

        autoTable(doc, {
            startY: 50,
            head: [tableColumn],
            body: tableRows,
            theme: 'striped',
            headStyles: { fillColor: [28, 45, 84] },
            styles: { fontSize: 8, cellPadding: 2 }
        });

        doc.save(`Reporte_Gastos_Facilita_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de ELIMINAR permanentemente este recibo? Esta acción no se puede deshacer y borrará el registro de la base de datos.')) return;

        try {
            const res = await fetch(`/api/admin/receipts/${id}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al eliminar el recibo');
            }

            // Eliminar exitosamente del estado local
            setReceipts(receipts.filter(r => r.id !== id));
            alert('Recibo eliminado correctamente.');
        } catch (err: any) {
            console.error(err);
            alert('Falló la eliminación: ' + err.message);
        }
    };

    const filteredReceipts = receipts.filter(r => {
        // 1. Text Search
        const matchSearch = !searchTerm ||
            r.merchant.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.projects && r.projects.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (r.worker_email && r.worker_email.toLowerCase().includes(searchTerm.toLowerCase()));

        // 2. Category Match
        const matchCategory = !filterCategory || r.category === filterCategory;

        // 3. Project Match
        const matchProject = !filterProject || r.project_id === filterProject;

        // 4. Worker Match
        const matchWorker = !filterWorker || r.worker_email === filterWorker;

        // 5. Date Range Match
        let matchDate = true;
        if (filterStartDate) {
            matchDate = matchDate && new Date(r.date) >= new Date(filterStartDate);
        }
        if (filterEndDate) {
            matchDate = matchDate && new Date(r.date) <= new Date(filterEndDate);
        }

        return matchSearch && matchCategory && matchProject && matchWorker && matchDate;
    });

    // Extract unique values for dropdowns based on actual data
    const uniqueWorkerEmails = Array.from(new Set(receipts.map(r => r.worker_email).filter(Boolean))) as string[];
    const uniqueProjects = Array.from(new Map(receipts.filter(r => r.projects).map(r => [r.project_id, r.projects])).values()) as any[];
    const uniqueCategories = Array.from(new Set(receipts.map(r => r.category).filter(Boolean))) as string[];

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                {/* Top Row: Search & Export */}
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full sm:w-1/3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            type="text"
                            placeholder="Búsqueda rápida..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#1C2D54] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#8CC63F] text-zinc-200"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleExportPDF}
                            disabled={filteredReceipts.length === 0}
                            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            <FileText className="w-4 h-4" />
                            PDF
                        </button>
                        <button
                            onClick={handleExportExcel}
                            disabled={filteredReceipts.length === 0}
                            className="flex items-center gap-2 bg-[#8CC63F]/10 hover:bg-[#8CC63F]/20 text-[#8CC63F] border border-[#8CC63F]/20 px-4 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            Excel
                        </button>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-[#1C2D54]/50 p-4 rounded-xl border border-white/5">
                    <div className="flex flex-col">
                        <label className="text-[10px] text-zinc-400 mb-1 uppercase tracking-wider">Desde (Fecha)</label>
                        <input
                            type="date"
                            value={filterStartDate}
                            onChange={(e) => setFilterStartDate(e.target.value)}
                            className="bg-[#1C2D54] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200"
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] text-zinc-400 mb-1 uppercase tracking-wider">Hasta (Fecha)</label>
                        <input
                            type="date"
                            value={filterEndDate}
                            onChange={(e) => setFilterEndDate(e.target.value)}
                            className="bg-[#1C2D54] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200"
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] text-zinc-400 mb-1 uppercase tracking-wider">Colaborador</label>
                        <select
                            value={filterWorker}
                            onChange={(e) => setFilterWorker(e.target.value)}
                            className="bg-[#1C2D54] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200"
                        >
                            <option value="">Todos los colaboradores</option>
                            {uniqueWorkerEmails.map(email => (
                                <option key={email} value={email}>{email}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] text-zinc-400 mb-1 uppercase tracking-wider">Proyecto</label>
                        <select
                            value={filterProject}
                            onChange={(e) => setFilterProject(e.target.value)}
                            className="bg-[#1C2D54] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200"
                        >
                            <option value="">Todos los proyectos</option>
                            {uniqueProjects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] text-zinc-400 mb-1 uppercase tracking-wider">Categoría</label>
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="bg-[#1C2D54] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200"
                        >
                            <option value="">Todas las categorías</option>
                            {uniqueCategories.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
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
                                            {categoryAlerts[receipt.category] && receipt.amount > categoryAlerts[receipt.category] ? (
                                                <div className="bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-1 rounded inline-block font-bold mb-1" title="Supera el límite de categoría">
                                                    ${receipt.amount} ⚠️
                                                </div>
                                            ) : (
                                                <div className="text-white font-semibold mb-1">${receipt.amount}</div>
                                            )}

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
                                                    receipt.status === 'Rechazado' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                                        'bg-[#8CC63F]/20 text-[#8CC63F] border border-[#8CC63F]/30'
                                                }`}>
                                                {receipt.status || 'Pendiente'}
                                            </span>
                                            {receipt.status === 'Rechazado' && receipt.rejection_reason && (
                                                <div className="text-[10px] text-red-400/80 mt-1 max-w-[150px] truncate" title={receipt.rejection_reason}>
                                                    Motivo: {receipt.rejection_reason}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {(receipt.status === 'Pendiente' || !receipt.status) && (
                                                    <>
                                                        <button
                                                            onClick={() => handleStatusUpdate(receipt.id, 'Aprobado por Supervisor')}
                                                            className="p-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-md transition"
                                                            title="Aprobar (Supervisor)"
                                                        >
                                                            <CheckCircle className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setRejectingId(receipt.id)}
                                                            className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-md transition"
                                                            title="Rechazar Gasto"
                                                        >
                                                            <XCircle className="w-4 h-4" />
                                                        </button>
                                                    </>
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
                                                <button
                                                    onClick={() => handleDelete(receipt.id)}
                                                    className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-md transition ml-2"
                                                    title="Eliminar Recibo Permanentemente"
                                                >
                                                    <Trash2 className="w-4 h-4" />
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

            {rejectingId && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1C2D54] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h3 className="text-xl font-semibold text-white mb-4">Rechazar Gasto</h3>
                        <p className="text-sm text-zinc-300 mb-4">
                            Por favor, indica el motivo del rechazo para que el trabajador pueda corregirlo.
                        </p>
                        <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 text-white rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-red-500/50 min-h-[100px] mb-6"
                            placeholder="Ej: La foto está muy borrosa, el monto no coincide, etc."
                        />
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => { setRejectingId(null); setRejectionReason(''); }}
                                className="px-4 py-2 text-zinc-400 hover:text-white transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleRejectSubmit()}
                                disabled={!rejectionReason.trim()}
                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition disabled:opacity-50"
                            >
                                Confirmar Rechazo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
