'use client';
import { useState, useEffect, useRef } from 'react';
import { Camera, Search, Filter, History, MapPin, Receipt, ArrowLeft, Trash2, Eye, Edit, Save, X, ZoomIn, ZoomOut, RotateCw, RotateCcw, AlertCircle, Loader2, Calendar, User, Tag, FolderOpen } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function WorkerHistory() {
    const router = useRouter();
    const [history, setHistory] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filter States
    const [filterStatus, setFilterStatus] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    // Modal States
    const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);

    // Initial Data Fetch
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [resHistory, resCategories, resProjects] = await Promise.all([
                    fetch('/api/worker/receipts'),
                    fetch('/api/worker/categories'),
                    fetch('/api/worker/projects')
                ]);
                const dataHistory = await resHistory.json();
                const dataCategories = await resCategories.json();
                const dataProjects = await resProjects.json();

                if (resHistory.ok && dataHistory.receipts) setHistory(dataHistory.receipts);
                if (resCategories.ok && dataCategories.categories) setCategories(dataCategories.categories);
                if (resProjects.ok && dataProjects.projects) setProjects(dataProjects.projects);
            } catch (err) {
                console.error("Error fetching worker history data:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
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

    // stats calculation (Aprobados vs Reembolsados vs Pendientes)
    const stats = history.reduce((acc, curr) => {
        acc.totalRegistrado += Number(curr.amount) || 0;
        if (curr.status === 'Aprobado por Supervisor') acc.totalAprobado += Number(curr.amount) || 0;
        if (curr.status === 'Reembolsado') acc.totalReembolsado += Number(curr.amount) || 0;
        if (curr.status === 'Pendiente' || curr.status === 'Por Visar' || !curr.status) acc.countPendientes++;
        if (curr.status === 'Rechazado') acc.countRechazados++;
        return acc;
    }, { totalRegistrado: 0, totalAprobado: 0, totalReembolsado: 0, countPendientes: 0, countRechazados: 0 });

    // Filter Logic
    const filteredHistory = history.filter(record => {
        const matchSearch = !searchTerm ||
            record.merchant.toLowerCase().includes(searchTerm.toLowerCase()) ||
            record.category.toLowerCase().includes(searchTerm.toLowerCase());

        const matchStatus = !filterStatus ||
            (filterStatus === 'pendiente' && (record.status === 'Pendiente' || record.status === 'Por Visar' || !record.status)) ||
            (filterStatus === 'aprobado' && record.status === 'Aprobado por Supervisor') ||
            (filterStatus === 'reembolsado' && record.status === 'Reembolsado') ||
            (filterStatus === 'rechazado' && record.status === 'Rechazado');

        const matchProject = !filterProject || record.project_id === filterProject;

        return matchSearch && matchStatus && matchProject;
    });

    const handleDeleteReceipt = (deletedId: string) => {
        setHistory(prev => prev.filter(r => r.id !== deletedId));
    };

    const handleUpdateReceipt = (updated: any) => {
        setHistory(prev => prev.map(r => r.id === updated.id ? updated : r));
    };

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

                {/* Filters and Search block */}
                {!isLoading && history.length > 0 && (
                    <div className="bg-[#1C2D54]/30 border border-white/5 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                            <Filter className="w-4 h-4 text-[#8CC63F]" />
                            <span>Filtros de Búsqueda</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] text-zinc-500 uppercase block mb-1">Por Proyecto</label>
                                <select
                                    value={filterProject}
                                    onChange={e => setFilterProject(e.target.value)}
                                    className="w-full bg-[#1C2D54] border border-white/10 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200"
                                >
                                    <option value="">Todos los proyectos</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-zinc-500 uppercase block mb-1">Por Estado</label>
                                <select
                                    value={filterStatus}
                                    onChange={e => setFilterStatus(e.target.value)}
                                    className="w-full bg-[#1C2D54] border border-white/10 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200"
                                >
                                    <option value="">Todos los estados</option>
                                    <option value="pendiente">Pendientes</option>
                                    <option value="aprobado">Aprobados</option>
                                    <option value="reembolsado">Reembolsados/Pagados</option>
                                    <option value="rechazado">Rechazados</option>
                                </select>
                            </div>
                            <div className="sm:col-span-2">
                                <label className="text-[10px] text-zinc-500 uppercase block mb-1">Buscar por Comercio/Categoría</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Copec, Combustible..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full bg-[#1C2D54] border border-white/10 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200"
                                />
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
                ) : filteredHistory.length === 0 ? (
                    <div className="text-center py-10 bg-white/5 rounded-2xl border border-white/5 text-zinc-500 text-sm">
                        No se encontraron gastos con los filtros aplicados.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredHistory.map((record: any) => (
                            <div 
                                key={record.id} 
                                onClick={() => setSelectedReceipt(record)}
                                className="bg-[#1C2D54]/50 border border-white/5 rounded-2xl p-4 flex items-start gap-4 hover:border-[#8CC63F]/30 hover:bg-[#1C2D54]/75 transition-all cursor-pointer shadow-md"
                            >
                                <div className="w-12 h-12 rounded-xl bg-[#8CC63F]/20 text-[#8CC63F] flex items-center justify-center flex-shrink-0 font-bold text-lg">
                                    {record.merchant.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <h4 className="font-semibold text-zinc-100 truncate">{record.merchant}</h4>
                                        <div className="text-right">
                                            <span className="font-bold text-[#8CC63F] flex-shrink-0 text-sm sm:text-base">${record.amount}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                                        <span>{record.date}</span>
                                        <span className="bg-white/10 px-2 py-0.5 rounded text-zinc-300 truncate max-w-[120px]">{record.category}</span>
                                    </div>
                                    
                                    {/* Visualización de Proyecto */}
                                    <div className="text-[11px] text-zinc-500 truncate mt-1">
                                        Proyecto: <span className="text-zinc-300 font-medium">{record.projects?.name || 'Gasto Genérico'}</span>
                                    </div>

                                    <div className="flex flex-col gap-1 mt-2 border-t border-white/5 pt-2">
                                        <div className="flex items-center justify-between">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
                                                record.status === 'Pendiente' || record.status === 'Por Visar' || !record.status ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                                                record.status === 'Aprobado por Supervisor' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                                record.status === 'Rechazado' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                                'bg-[#8CC63F]/20 text-[#8CC63F] border border-[#8CC63F]/30'
                                            }`}>
                                                {record.status === 'Aprobado por Supervisor' ? 'Aprobado' : (record.status || 'Pendiente')}
                                            </span>
                                            <span className="text-[10px] text-zinc-500 hover:text-white flex items-center gap-1 font-semibold">
                                                <Eye className="w-3.5 h-3.5" /> Ver Detalle
                                            </span>
                                        </div>
                                        {record.status === 'Rechazado' && record.rejection_reason && (
                                            <div className="text-[11px] text-red-400/90 mt-1.5 p-2 bg-red-500/10 rounded-lg whitespace-pre-wrap">
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

            {/* Modal de Detalle / Edición Completo */}
            {selectedReceipt && (
                <WorkerReceiptDetailModal
                    receipt={selectedReceipt}
                    categories={categories}
                    projects={projects}
                    onClose={() => setSelectedReceipt(null)}
                    onDelete={handleDeleteReceipt}
                    onUpdate={handleUpdateReceipt}
                />
            )}
        </div>
    );
}

// Modal Component for Detail & Edit
function WorkerReceiptDetailModal({
    receipt,
    categories,
    projects,
    onClose,
    onDelete,
    onUpdate
}: {
    receipt: any;
    categories: any[];
    projects: any[];
    onClose: () => void;
    onDelete: (id: string) => void;
    onUpdate: (updated: any) => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form states
    const [formData, setFormData] = useState({
        merchant: receipt.merchant || '',
        merchant_rut: receipt.merchant_rut || '',
        document_type: receipt.document_type || 'boleta',
        document_number: receipt.document_number || '',
        amount: receipt.amount || '',
        date: receipt.date || '',
        category: receipt.category || '',
        project_id: receipt.project_id || '',
        location: receipt.location || ''
    });

    const [zoom, setZoom] = useState(1);
    const [rotate, setRotate] = useState(0);

    const isPdf = receipt.image_url?.toLowerCase().split('?')[0].endsWith('.pdf');

    // Permitido editar/eliminar si está en Pendiente, Por Visar o Rechazado
    const canModify = !receipt.status || ['Pendiente', 'Por Visar', 'Rechazado'].includes(receipt.status);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch(`/api/worker/receipts/${receipt.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al guardar los cambios');

            setSuccess('¡Cambios guardados con éxito!');
            onUpdate(data.receipt);
            setTimeout(() => {
                setIsEditing(false);
                onClose();
            }, 1000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('¿Estás seguro de que deseas eliminar permanentemente este recibo? Esta acción no se puede deshacer.')) return;
        setIsDeleting(true);
        setError('');

        try {
            const res = await fetch(`/api/worker/receipts/${receipt.id}`, {
                method: 'DELETE'
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al eliminar el recibo');

            onDelete(receipt.id);
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-[#121D38] border border-white/10 rounded-[2rem] w-full max-w-5xl h-[90vh] md:h-[80vh] flex flex-col md:flex-row overflow-hidden shadow-2xl relative">
                
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 z-50 p-2 bg-black/40 hover:bg-black/60 rounded-full border border-white/10 text-zinc-400 hover:text-white transition-all hover:scale-105"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Left Side: Viewer */}
                <div className="w-full md:w-1/2 bg-black/30 border-r border-white/5 flex flex-col relative h-[35vh] md:h-full">
                    {!isPdf && receipt.image_url && (
                        <div className="absolute top-4 left-4 z-10 flex gap-1 bg-black/60 border border-white/10 p-1 rounded-full shadow">
                            <button onClick={() => setZoom(prev => Math.min(prev + 0.25, 2.5))} className="p-1.5 hover:bg-white/10 rounded-full text-white"><ZoomIn className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.75))} className="p-1.5 hover:bg-white/10 rounded-full text-white"><ZoomOut className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setRotate(prev => (prev + 90) % 360)} className="p-1.5 hover:bg-white/10 rounded-full text-white"><RotateCw className="w-3.5 h-3.5" /></button>
                            {(zoom !== 1 || rotate !== 0) && (
                                <button onClick={() => { setZoom(1); setRotate(0); }} className="p-1.5 hover:bg-white/10 rounded-full text-[#8CC63F]"><RotateCcw className="w-3.5 h-3.5" /></button>
                            )}
                        </div>
                    )}

                    <div className="flex-1 flex items-center justify-center overflow-hidden p-4 relative">
                        {receipt.image_url ? (
                            isPdf ? (
                                <iframe 
                                    src={`${receipt.image_url}#toolbar=1&navpanes=0`}
                                    className="w-full h-full rounded-xl border-none"
                                    title="Visor PDF"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <img 
                                        src={receipt.image_url} 
                                        alt="Comprobante" 
                                        className="max-h-full max-w-full object-contain rounded-xl select-none"
                                        style={{ transform: `scale(${zoom}) rotate(${rotate}deg)`, transition: 'transform 0.2s' }}
                                    />
                                </div>
                            )
                        ) : (
                            <div className="text-zinc-600 text-xs">Sin comprobante digital disponible</div>
                        )}
                    </div>
                </div>

                {/* Right Side: Form / Details */}
                <div className="w-full md:w-1/2 flex flex-col h-[55vh] md:h-full overflow-y-auto bg-[#1C2D54]/10">
                    <div className="p-6 border-b border-white/5">
                        <div className="flex justify-between items-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                receipt.status === 'Pendiente' || receipt.status === 'Por Visar' || !receipt.status ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                receipt.status === 'Aprobado por Supervisor' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                receipt.status === 'Rechazado' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                'bg-green-500/10 text-[#8CC63F] border-green-500/20'
                            }`}>
                                {receipt.status === 'Aprobado por Supervisor' ? 'Aprobado' : (receipt.status || 'Pendiente')}
                            </span>
                            <span className="text-[22px] font-black text-[#8CC63F]">${Number(receipt.amount).toLocaleString('es-CL')}</span>
                        </div>
                        <h1 className="text-xl font-bold text-white mt-3 leading-tight">{receipt.merchant}</h1>
                    </div>

                    <div className="p-6 flex-1 space-y-4">
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}
                        {success && (
                            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-[#8CC63F] text-xs flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>{success}</span>
                            </div>
                        )}

                        {isEditing ? (
                            <form onSubmit={handleSave} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">Comercio *</label>
                                        <input
                                            required
                                            name="merchant"
                                            value={formData.merchant}
                                            onChange={handleInputChange}
                                            className="w-full bg-[#121D38] border border-white/10 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">RUT Proveedor</label>
                                        <input
                                            name="merchant_rut"
                                            value={formData.merchant_rut}
                                            onChange={handleInputChange}
                                            placeholder="Ej: 76.123.456-K"
                                            className="w-full bg-[#121D38] border border-white/10 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">Fecha *</label>
                                        <input
                                            type="date"
                                            required
                                            name="date"
                                            value={formData.date}
                                            onChange={handleInputChange}
                                            className="w-full bg-[#121D38] border border-white/10 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">Monto Total *</label>
                                        <input
                                            required
                                            name="amount"
                                            value={formData.amount}
                                            onChange={handleInputChange}
                                            className="w-full bg-[#121D38] border border-white/10 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">Categoría *</label>
                                        <select
                                            required
                                            name="category"
                                            value={formData.category}
                                            onChange={handleInputChange}
                                            className="w-full bg-[#121D38] border border-white/10 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none"
                                        >
                                            {categories.map(c => (
                                                <option key={c.id} value={c.name} className="bg-[#121D38] text-white">{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">Tipo Documento</label>
                                        <select
                                            name="document_type"
                                            value={formData.document_type}
                                            onChange={handleInputChange}
                                            className="w-full bg-[#121D38] border border-white/10 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none"
                                        >
                                            <option value="boleta" className="bg-[#121D38] text-white">Boleta</option>
                                            <option value="factura" className="bg-[#121D38] text-white">Factura</option>
                                            <option value="boleta de honorarios" className="bg-[#121D38] text-white">Boleta de Honorarios</option>
                                            <option value="comprobante de pago" className="bg-[#121D38] text-white">Comprobante de Pago</option>
                                            <option value="otro" className="bg-[#121D38] text-white">Otro</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">Folio / Nº</label>
                                        <input
                                            name="document_number"
                                            value={formData.document_number}
                                            onChange={handleInputChange}
                                            className="w-full bg-[#121D38] border border-white/10 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">Ubicación</label>
                                        <input
                                            name="location"
                                            value={formData.location}
                                            onChange={handleInputChange}
                                            className="w-full bg-[#121D38] border border-white/10 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] text-zinc-500 uppercase block mb-1">Proyecto Asignado</label>
                                    <select
                                        name="project_id"
                                        value={formData.project_id}
                                        onChange={handleInputChange}
                                        className="w-full bg-[#121D38] border border-white/10 text-zinc-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none"
                                    >
                                        <option value="" className="bg-[#121D38] text-white">Gasto Genérico</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id} className="bg-[#121D38] text-white">{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex justify-end gap-2 pt-4 border-t border-white/5 text-xs font-semibold">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditing(false)}
                                        className="px-4 py-2 border border-white/10 rounded-xl text-zinc-400 hover:text-white transition"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="px-5 py-2 bg-[#8CC63F] hover:bg-[#3EAE49] text-[#121D38] rounded-xl font-bold transition flex items-center gap-1.5"
                                    >
                                        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                        Guardar
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="flex items-center gap-3 p-3 bg-black/20 rounded-xl border border-white/5">
                                        <Calendar className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                                        <div>
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Fecha del Gasto</span>
                                            <p className="text-sm font-medium text-zinc-200">{receipt.date}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-black/20 rounded-xl border border-white/5">
                                        <Tag className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                                        <div>
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">RUT Proveedor</span>
                                            <p className="text-sm font-medium text-zinc-200">{receipt.merchant_rut || 'Sin RUT'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-black/20 rounded-xl border border-white/5">
                                        <FolderOpen className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                                        <div>
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Categoría</span>
                                            <p className="text-sm font-medium text-zinc-200">{receipt.category}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-black/20 rounded-xl border border-white/5">
                                        <Tag className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                                        <div>
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Documento</span>
                                            <p className="text-sm font-medium text-zinc-200 capitalize">
                                                {receipt.document_type || 'Boleta'} {receipt.document_number ? `Nº ${receipt.document_number}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-black/20 rounded-xl border border-white/5 sm:col-span-2">
                                        <FolderOpen className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                                        <div>
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Proyecto</span>
                                            <p className="text-sm font-medium text-zinc-200">
                                                {receipt.projects?.name || 'Gasto Genérico'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-black/20 rounded-xl border border-white/5 sm:col-span-2">
                                        <MapPin className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Ubicación</span>
                                            {receipt.location ? (
                                                <a 
                                                    href={receipt.location.trim().startsWith('http') ? receipt.location.trim() : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(receipt.location.trim())}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[#8CC63F] hover:text-[#3EAE49] text-sm font-medium block truncate"
                                                >
                                                    {receipt.location}
                                                </a>
                                            ) : (
                                                <p className="text-sm font-medium text-zinc-500">Sin geolocalización</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {receipt.status === 'Rechazado' && receipt.rejection_reason && (
                                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400">
                                        <p className="text-xs font-bold uppercase tracking-wider mb-1">Motivo del Rechazo</p>
                                        <p className="text-xs leading-normal">{receipt.rejection_reason}</p>
                                    </div>
                                )}

                                {/* Edit/Delete sticky options ONLY for pending/rejected */}
                                {canModify && (
                                    <div className="flex justify-end gap-2 pt-4 border-t border-white/5 text-xs font-semibold">
                                        <button
                                            type="button"
                                            onClick={handleDelete}
                                            disabled={isDeleting}
                                            className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition flex items-center gap-1.5"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Eliminar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsEditing(true)}
                                            className="px-4 py-2 border border-white/10 hover:bg-white/5 text-zinc-300 hover:text-white rounded-xl transition flex items-center gap-1.5"
                                        >
                                            <Edit className="w-4 h-4" />
                                            Editar Gasto
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
