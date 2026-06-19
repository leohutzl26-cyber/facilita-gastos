'use client';
import { useState, useEffect, useRef } from 'react';
import {
    X, RotateCw, ZoomIn, ZoomOut, Edit, Save, RotateCcw,
    Send, CheckCircle, XCircle, CreditCard, Trash2, Loader2,
    Calendar, MapPin, User, Tag, FolderOpen, AlertCircle,
    MessageSquare, History, Check, Eye
} from 'lucide-react';

type ReceiptDetailModalProps = {
    receipt: any;
    onClose: () => void;
    onUpdate: (updatedReceipt: any) => void;
    onDelete: (id: string) => void;
    categories: any[];
    projects: any[];
    workers: any[];
};

export default function ReceiptDetailModal({
    receipt,
    onClose,
    onUpdate,
    onDelete,
    categories,
    projects,
    workers
}: ReceiptDetailModalProps) {
    // UI States
    const [isEditing, setIsEditing] = useState(false);
    const [isLoadingLogs, setIsLoadingLogs] = useState(true);
    const [isLoadingComments, setIsLoadingComments] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isCommenting, setIsCommenting] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState<string | null>(null);

    // Image Manipulation States
    const [zoom, setZoom] = useState(1);
    const [rotate, setRotate] = useState(0);

    // Data States
    const [comments, setComments] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Rejection sub-modal state within detail modal
    const [isRejecting, setIsRejecting] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    // Form States for Edit
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

    const commentsEndRef = useRef<HTMLDivElement>(null);

    const isPdf = receipt.image_url?.toLowerCase().split('?')[0].endsWith('.pdf');

    // Load comments and audit logs
    useEffect(() => {
        fetchComments();
        fetchAuditLogs();
    }, [receipt.id]);

    useEffect(() => {
        if (commentsEndRef.current) {
            commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [comments]);

    const fetchComments = async () => {
        setIsLoadingComments(true);
        try {
            const res = await fetch(`/api/admin/receipts/${receipt.id}/comments`);
            const data = await res.json();
            if (res.ok && data.comments) {
                setComments(data.comments);
            }
        } catch (err) {
            console.error("Error fetching comments:", err);
        } finally {
            setIsLoadingComments(false);
        }
    };

    const fetchAuditLogs = async () => {
        setIsLoadingLogs(true);
        try {
            const res = await fetch(`/api/admin/receipts/${receipt.id}/audit-logs`);
            const data = await res.json();
            if (res.ok && data.logs) {
                setAuditLogs(data.logs);
            }
        } catch (err) {
            console.error("Error fetching audit logs:", err);
        } finally {
            setIsLoadingLogs(false);
        }
    };

    // Helper: Map email to worker name
    const getWorkerName = (email: string) => {
        if (!email) return 'Desconocido';
        const worker = workers.find(w => w.email === email);
        return worker && worker.name ? worker.name : email.split('@')[0];
    };

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.75));
    const handleRotate = () => setRotate(prev => (prev + 90) % 360);
    const handleResetImage = () => {
        setZoom(1);
        setRotate(0);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError('');
        setSuccessMsg('');

        try {
            const res = await fetch(`/api/admin/receipts/${receipt.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al guardar los cambios');

            setSuccessMsg('¡Gastos actualizados con éxito!');
            onUpdate(data.receipt);
            setIsEditing(false);
            fetchAuditLogs(); // Recargar historial de cambios
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleStatusChange = async (newStatus: string, reason?: string) => {
        setIsActionLoading(newStatus);
        setError('');
        setSuccessMsg('');

        try {
            const resolvedReason = newStatus === 'Pendiente' ? null : (reason !== undefined ? reason : receipt.rejection_reason);
            const res = await fetch('/api/admin/receipts/status', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: receipt.id,
                    status: newStatus,
                    rejection_reason: resolvedReason
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al cambiar el estado');

            setSuccessMsg(`Estado cambiado a: ${newStatus}`);
            // Actualizamos localmente el recibo que tiene el modal
            const updatedReceipt = { 
                ...receipt, 
                status: newStatus,
                rejection_reason: resolvedReason
            };
            onUpdate(updatedReceipt);
            fetchAuditLogs(); // Recargar historial
            setIsRejecting(false);
            setRejectionReason('');
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsActionLoading(null);
        }
    };

    const handleCommentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        setIsCommenting(true);
        try {
            const res = await fetch(`/api/admin/receipts/${receipt.id}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment: newComment })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al agregar el comentario');

            setComments(prev => [...prev, data.comment]);
            setNewComment('');
            fetchAuditLogs(); // Agregar comentario genera una entrada de auditoría
        } catch (err: any) {
            alert(err.message);
        } finally {
            setIsCommenting(false);
        }
    };

    const handleDeleteClick = () => {
        if (!confirm('¿Estás seguro de ELIMINAR permanentemente este recibo? Esta acción no se puede deshacer.')) return;
        onDelete(receipt.id);
        onClose();
    };

    const isLimitExceeded = () => {
        const cat = categories.find(c => c.name === receipt.category);
        return cat && cat.max_amount_alert && Number(receipt.amount) > Number(cat.max_amount_alert);
    };

    const limitAmount = () => {
        const cat = categories.find(c => c.name === receipt.category);
        return cat ? cat.max_amount_alert : null;
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
            {/* Modal Container */}
            <div className="bg-[#121D38] border border-white/10 rounded-[2.5rem] w-full max-w-6xl h-[90vh] md:h-[80vh] flex flex-col md:flex-row overflow-hidden shadow-2xl relative">
                
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 z-50 p-2 bg-black/40 hover:bg-black/60 rounded-full border border-white/10 text-zinc-400 hover:text-white transition-all hover:scale-105"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Left Side: Receipt Image & Viewer */}
                <div className="w-full md:w-1/2 bg-black/40 border-r border-white/5 flex flex-col relative h-[40vh] md:h-full">
                    {/* Toolbar */}
                    {!isPdf && (
                        <div className="absolute top-4 left-4 z-10 flex gap-1.5 bg-black/50 backdrop-blur-md border border-white/10 p-1.5 rounded-full shadow-lg">
                            <button 
                                onClick={handleZoomIn}
                                title="Acercar"
                                className="p-2 text-zinc-300 hover:text-white hover:bg-white/10 rounded-full transition"
                            >
                                <ZoomIn className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={handleZoomOut}
                                title="Alejar"
                                className="p-2 text-zinc-300 hover:text-white hover:bg-white/10 rounded-full transition"
                            >
                                <ZoomOut className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={handleRotate}
                                title="Rotar 90°"
                                className="p-2 text-zinc-300 hover:text-white hover:bg-white/10 rounded-full transition"
                            >
                                <RotateCw className="w-4 h-4" />
                            </button>
                            {(zoom !== 1 || rotate !== 0) && (
                                <button 
                                    onClick={handleResetImage}
                                    title="Restablecer"
                                    className="p-2 text-zinc-300 hover:text-white hover:bg-white/10 rounded-full transition text-[#8CC63F]"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Image or PDF Area */}
                    <div className="flex-1 flex items-center justify-center overflow-hidden p-6 relative w-full h-full">
                        {receipt.image_url ? (
                            receipt.image_url.startsWith('http') ? (
                                isPdf ? (
                                    <div className="w-full h-full p-2 bg-zinc-950/40 rounded-xl border border-white/5 overflow-hidden">
                                        <iframe 
                                            src={`${receipt.image_url}#toolbar=1&navpanes=0`}
                                            className="w-full h-full rounded-lg border-none"
                                            title={`PDF ${receipt.merchant}`}
                                        />
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center" style={{ perspective: 1000 }}>
                                        <img 
                                            src={receipt.image_url} 
                                            alt={`Boleta ${receipt.merchant}`}
                                            className="max-h-full max-w-full object-contain rounded-xl select-none shadow-md"
                                            style={{ 
                                                transform: `scale(${zoom}) rotate(${rotate}deg)`,
                                                transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                            }}
                                            draggable="false"
                                        />
                                    </div>
                                )
                            ) : (
                                <div className="text-center text-red-400 p-4 border border-red-500/20 bg-red-500/5 rounded-2xl max-w-xs">
                                    <AlertCircle className="w-10 h-10 mx-auto mb-2 text-red-400" />
                                    <p className="font-semibold text-sm">Error en URL de imagen/PDF</p>
                                    <span className="text-[10px] text-zinc-500 break-all">{receipt.image_url}</span>
                                </div>
                            )
                        ) : (
                            <div className="text-center text-zinc-500">
                                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-zinc-600 animate-pulse" />
                                <p className="font-medium text-sm">Sin comprobante digital disponible</p>
                            </div>
                        )}
                    </div>

                    {/* Footer Image Indicator */}
                    <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm border border-white/5 px-3 py-1 rounded-full text-xs text-zinc-400">
                        {receipt.image_url ? (isPdf ? 'Documento PDF' : 'Comprobante de Imagen') : 'Sin Imagen'}
                    </div>
                </div>

                {/* Right Side: Data, Timeline, Comments */}
                <div className="w-full md:w-1/2 flex flex-col h-[50vh] md:h-full overflow-y-auto">
                    {/* Header Info */}
                    <div className="p-6 border-b border-white/5 space-y-4">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                    receipt.status === 'Pendiente' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                    receipt.status === 'Aprobado por Supervisor' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                    receipt.status === 'Rechazado' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                    'bg-green-500/10 text-[#8CC63F] border-green-500/20'
                                }`}>
                                    {receipt.status || 'Pendiente'}
                                </span>
                                {isEditing ? (
                                    <input 
                                        name="merchant"
                                        value={formData.merchant}
                                        onChange={handleInputChange}
                                        className="text-2xl font-bold text-white mt-3 bg-black/40 border border-white/10 rounded-xl px-3 py-1 w-full focus:outline-none focus:ring-1 focus:ring-[#8CC63F]"
                                        placeholder="Ej: Gasolinera Copec"
                                    />
                                ) : (
                                    <h1 className="text-2xl font-bold text-white mt-2 leading-tight">{receipt.merchant}</h1>
                                )}
                            </div>

                            {/* Sum / Amount Block */}
                            <div className="text-right flex-shrink-0">
                                {isEditing ? (
                                    <div className="flex flex-col items-end">
                                        <label className="text-[10px] text-zinc-500">Monto ($)</label>
                                        <input 
                                            name="amount"
                                            type="number"
                                            value={formData.amount}
                                            onChange={handleInputChange}
                                            className="text-2xl font-bold text-[#8CC63F] bg-black/40 border border-white/10 rounded-xl px-3 py-1 w-32 text-right focus:outline-none focus:ring-1 focus:ring-[#8CC63F]"
                                        />
                                    </div>
                                ) : (
                                    <>
                                        {isLimitExceeded() ? (
                                            <div className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3 py-1.5 rounded-2xl inline-block text-right">
                                                <span className="text-2xl font-bold">${Number(receipt.amount).toLocaleString('es-CL')}</span>
                                                <div className="text-[10px] flex items-center justify-end gap-1 font-medium mt-0.5">
                                                    <AlertCircle className="w-3 h-3" /> Excede límite (${limitAmount()})
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-3xl font-extrabold text-[#8CC63F]">${Number(receipt.amount).toLocaleString('es-CL')}</span>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Notifications */}
                        {error && (
                            <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-2xl text-red-400 text-xs flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}
                        {successMsg && (
                            <div className="p-3 bg-green-500/15 border border-green-500/30 rounded-2xl text-[#8CC63F] text-xs flex items-center gap-2">
                                <Check className="w-4 h-4 flex-shrink-0" />
                                <span>{successMsg}</span>
                            </div>
                        )}
                    </div>

                    {/* Metadata Section / Edit Form */}
                    <form onSubmit={handleSaveEdit} className="p-6 border-b border-white/5 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Fecha */}
                            <div className="flex items-center gap-3 p-3 bg-black/20 rounded-xl border border-white/5">
                                <Calendar className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Fecha del Gasto</span>
                                    {isEditing ? (
                                        <input 
                                            type="date"
                                            name="date"
                                            value={formData.date}
                                            onChange={handleInputChange}
                                            className="bg-black/30 border border-white/10 rounded-lg text-xs text-white px-2 py-0.5 mt-0.5 focus:outline-none w-full"
                                        />
                                    ) : (
                                        <p className="text-sm font-medium text-zinc-200">{receipt.date}</p>
                                    )}
                                </div>
                            </div>

                            {/* Creador */}
                            <div className="flex items-center gap-3 p-3 bg-black/20 rounded-xl border border-white/5">
                                <User className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Colaborador</span>
                                    <p className="text-sm font-medium text-zinc-200 truncate" title={receipt.worker_email}>
                                        {getWorkerName(receipt.worker_email)}
                                    </p>
                                </div>
                            </div>

                            {/* RUT Comercio */}
                            <div className="flex items-center gap-3 p-3 bg-black/20 rounded-xl border border-white/5">
                                <Tag className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">RUT Proveedor</span>
                                    {isEditing ? (
                                        <input 
                                            name="merchant_rut"
                                            value={formData.merchant_rut}
                                            onChange={handleInputChange}
                                            className="bg-black/30 border border-white/10 rounded-lg text-xs text-white px-2 py-0.5 mt-0.5 focus:outline-none w-full"
                                            placeholder="12.345.678-9"
                                        />
                                    ) : (
                                        <p className="text-sm font-medium text-zinc-200">{receipt.merchant_rut || 'Sin RUT'}</p>
                                    )}
                                </div>
                            </div>

                            {/* Tipo Documento */}
                            <div className="flex items-center gap-3 p-3 bg-black/20 rounded-xl border border-white/5">
                                <Tag className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Documento</span>
                                    {isEditing ? (
                                        <div className="flex gap-1 mt-0.5">
                                            <select 
                                                name="document_type"
                                                value={formData.document_type}
                                                onChange={handleInputChange}
                                                className="bg-black/30 border border-white/10 rounded-lg text-[10px] text-white p-1 focus:outline-none"
                                            >
                                                <option value="boleta">Boleta</option>
                                                <option value="factura">Factura</option>
                                                <option value="boleta de honorarios">Boleta de Honorarios</option>
                                                <option value="comprobante de pago">Comprobante de Pago</option>
                                                <option value="otro">Otro</option>
                                            </select>
                                            <input 
                                                name="document_number"
                                                value={formData.document_number}
                                                onChange={handleInputChange}
                                                className="bg-black/30 border border-white/10 rounded-lg text-xs text-white px-2 py-0.5 focus:outline-none w-full"
                                                placeholder="N° Folio"
                                            />
                                        </div>
                                    ) : (
                                        <p className="text-sm font-medium text-zinc-200 capitalize">
                                            {receipt.document_type || 'Boleta'} {receipt.document_number ? `Nº ${receipt.document_number}` : ''}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Categoría */}
                            <div className="flex items-center gap-3 p-3 bg-black/20 rounded-xl border border-white/5">
                                <FolderOpen className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Categoría</span>
                                    {isEditing ? (
                                        <select 
                                            name="category"
                                            value={formData.category}
                                            onChange={handleInputChange}
                                            className="bg-black/30 border border-white/10 rounded-lg text-xs text-white px-2 py-0.5 mt-0.5 focus:outline-none w-full"
                                        >
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <p className="text-sm font-medium text-zinc-200">{receipt.category}</p>
                                    )}
                                </div>
                            </div>

                            {/* Proyecto Carpeta */}
                            <div className="flex items-center gap-3 p-3 bg-black/20 rounded-xl border border-white/5">
                                <FolderOpen className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Proyecto</span>
                                    {isEditing ? (
                                        <select 
                                            name="project_id"
                                            value={formData.project_id}
                                            onChange={handleInputChange}
                                            className="bg-black/30 border border-white/10 rounded-lg text-xs text-white px-2 py-0.5 mt-0.5 focus:outline-none w-full"
                                        >
                                            <option value="">Gasto Genérico</option>
                                            {projects.map(proj => (
                                                <option key={proj.id} value={proj.id}>{proj.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <p className="text-sm font-medium text-zinc-200">
                                            {receipt.projects?.name || 'Gasto Genérico'}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Ubicación Geolocalizada */}
                            <div className="flex items-center gap-3 p-3 bg-black/20 rounded-xl border border-white/5 sm:col-span-2">
                                <MapPin className="w-5 h-5 text-zinc-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Ubicación Registrada</span>
                                    {isEditing ? (
                                        <input 
                                            name="location"
                                            value={formData.location}
                                            onChange={handleInputChange}
                                            className="bg-black/30 border border-white/10 rounded-lg text-xs text-white px-2 py-0.5 mt-0.5 focus:outline-none w-full"
                                            placeholder="Dirección o Coordenadas Lat, Lng"
                                        />
                                    ) : (
                                        receipt.location ? (
                                            <a 
                                                href={receipt.location.trim().startsWith('http') ? receipt.location.trim() : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(receipt.location.trim())}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[#8CC63F] hover:text-[#3EAE49] text-sm font-medium flex items-center gap-1 mt-0.5 truncate"
                                            >
                                                {receipt.location} <Eye className="w-3.5 h-3.5 flex-shrink-0" />
                                            </a>
                                        ) : (
                                            <p className="text-sm font-medium text-zinc-500">Sin geolocalización registrada</p>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Edit Action Buttons */}
                        {isEditing && (
                            <div className="flex justify-end gap-3 pt-2">
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setIsEditing(false);
                                        setFormData({
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
                                    }} 
                                    className="px-4 py-2 border border-white/10 rounded-xl text-zinc-400 hover:text-white transition text-xs font-semibold"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSaving}
                                    className="px-4 py-2 bg-[#8CC63F] hover:bg-[#3EAE49] text-[#121D38] rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                                >
                                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                    Guardar Cambios
                                </button>
                            </div>
                        )}
                    </form>

                    {/* Timeline (Reimbursement Logs) & Comments Tabs */}
                    <div className="flex-1 flex flex-col bg-[#1C2D54]/20">
                        {/* Headers */}
                        <div className="grid grid-cols-2 border-b border-white/5 text-center text-xs">
                            <div className="py-3 font-semibold text-zinc-200 border-r border-white/5 flex items-center justify-center gap-1.5">
                                <History className="w-4 h-4 text-[#8CC63F]" /> Historial de Reembolso
                            </div>
                            <div className="py-3 font-semibold text-zinc-200 flex items-center justify-center gap-1.5">
                                <MessageSquare className="w-4 h-4 text-[#8CC63F]" /> Comentarios ({comments.length})
                            </div>
                        </div>

                        {/* Panes side-by-side or scrollable */}
                        <div className="grid grid-cols-1 md:grid-cols-2 flex-1 min-h-[300px]">
                            {/* 1. History Pane */}
                            <div className="p-4 border-b md:border-b-0 md:border-r border-white/5 overflow-y-auto max-h-[320px] space-y-4">
                                {isLoadingLogs ? (
                                    <div className="text-center py-12 text-zinc-500 text-xs">
                                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#8CC63F]" />
                                        Cargando logs...
                                    </div>
                                ) : (
                                    <div className="relative border-l border-white/10 ml-2.5 pl-5 space-y-5 py-2">
                                        {/* Evento inicial virtual: Creación */}
                                        <div className="relative">
                                            <div className="absolute -left-[26px] top-1.5 w-3 h-3 rounded-full bg-blue-500 border border-[#121D38]"></div>
                                            <span className="text-[10px] text-zinc-500 block">
                                                {new Date(receipt.created_at || new Date()).toLocaleString('es-CL')}
                                            </span>
                                            <p className="text-xs font-semibold text-zinc-200 mt-0.5">Creación del gasto</p>
                                            <span className="text-[10px] text-zinc-400">
                                                Registrado por {getWorkerName(receipt.worker_email)}
                                            </span>
                                        </div>

                                        {/* Logs de auditoría reales en la base de datos */}
                                        {auditLogs.map((log) => {
                                            let dotColor = 'bg-[#8CC63F]';
                                            if (log.action.includes('Rechazo') || log.action.includes('Eliminar')) dotColor = 'bg-red-500';
                                            if (log.action.includes('Editar')) dotColor = 'bg-yellow-500';
                                            if (log.action.includes('Comentario')) dotColor = 'bg-zinc-500';

                                            return (
                                                <div key={log.id} className="relative">
                                                    <div className={`absolute -left-[26px] top-1.5 w-3 h-3 rounded-full ${dotColor} border border-[#121D38]`}></div>
                                                    <span className="text-[10px] text-zinc-500 block">
                                                        {new Date(log.created_at).toLocaleString('es-CL')}
                                                    </span>
                                                    <p className="text-xs font-semibold text-zinc-200 mt-0.5">{log.action}</p>
                                                    <span className="text-[10px] text-zinc-400 block whitespace-pre-wrap leading-tight mt-0.5">
                                                        {log.details}
                                                    </span>
                                                    <span className="text-[9px] text-zinc-500 uppercase tracking-wider block mt-1">
                                                        Por: {getWorkerName(log.user_email)}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* 2. Comments Pane */}
                            <div className="p-4 flex flex-col max-h-[320px]">
                                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                                    {isLoadingComments ? (
                                        <div className="text-center py-12 text-zinc-500 text-xs">
                                            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#8CC63F]" />
                                            Cargando comentarios...
                                        </div>
                                    ) : comments.length === 0 ? (
                                        <div className="text-center py-12 text-zinc-500 text-xs">
                                            No hay comentarios de auditoría aún. Escribe el primero abajo.
                                        </div>
                                    ) : (
                                        comments.map((comment) => (
                                            <div key={comment.id} className="bg-black/35 p-3 rounded-2xl border border-white/5 space-y-1.5">
                                                <div className="flex justify-between items-center text-[10px]">
                                                    <span className="font-semibold text-zinc-300">
                                                        {getWorkerName(comment.user_email)}
                                                    </span>
                                                    <span className="text-zinc-500">
                                                        {new Date(comment.created_at).toLocaleString('es-CL', {
                                                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-zinc-300 leading-normal whitespace-pre-wrap">{comment.comment}</p>
                                            </div>
                                        ))
                                    )}
                                    <div ref={commentsEndRef} />
                                </div>

                                {/* Form Add Comment */}
                                <form onSubmit={handleCommentSubmit} className="mt-3 flex gap-2">
                                    <input
                                        type="text"
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder="Escribe un comentario..."
                                        disabled={isCommenting}
                                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#8CC63F] outline-none"
                                    />
                                    <button 
                                        type="submit"
                                        disabled={isCommenting || !newComment.trim()}
                                        className="p-2 bg-[#8CC63F] hover:bg-[#3EAE49] text-[#121D38] rounded-xl transition disabled:opacity-50"
                                    >
                                        {isCommenting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Sticky Action Buttons */}
                    <div className="p-6 bg-black/20 border-t border-white/5 flex flex-wrap gap-2 items-center justify-between mt-auto">
                        <div className="flex gap-2">
                            {/* Editar */}
                            {!isEditing && (
                                <button 
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center gap-1.5 border border-white/10 hover:bg-white/5 text-zinc-300 hover:text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition"
                                >
                                    <Edit className="w-4 h-4" /> Editar
                                </button>
                            )}

                            {/* Eliminar */}
                            <button 
                                onClick={handleDeleteClick}
                                className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 px-4 py-2.5 rounded-xl text-xs font-semibold transition"
                            >
                                <Trash2 className="w-4 h-4" /> Eliminar
                            </button>
                        </div>

                        {/* Status Transitions */}
                        <div className="flex gap-2">
                            {/* Aprobación */}
                            {(receipt.status === 'Pendiente' || !receipt.status) && (
                                <>
                                    <button 
                                        onClick={() => handleStatusChange('Aprobado por Supervisor')}
                                        disabled={isActionLoading !== null}
                                        className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50"
                                    >
                                        {isActionLoading === 'Aprobado por Supervisor' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                        Aprobar
                                    </button>
                                    
                                    <button 
                                        onClick={() => setIsRejecting(true)}
                                        disabled={isActionLoading !== null}
                                        className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Rechazar
                                    </button>
                                </>
                            )}

                            {/* Reembolso */}
                            {receipt.status === 'Aprobado por Supervisor' && (
                                <button 
                                    onClick={() => handleStatusChange('Reembolsado')}
                                    disabled={isActionLoading !== null}
                                    className="flex items-center gap-1.5 bg-[#8CC63F] hover:bg-[#3EAE49] text-[#121D38] px-4 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50 animate-pulse"
                                >
                                    {isActionLoading === 'Reembolsado' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                                    Reembolsar
                                </button>
                            )}

                            {/* Revertir */}
                            {receipt.status && receipt.status !== 'Pendiente' && (
                                <button 
                                    onClick={() => {
                                        if (window.confirm('¿Estás seguro de revertir el estado de este recibo a Pendiente?')) {
                                            handleStatusChange('Pendiente');
                                        }
                                    }}
                                    disabled={isActionLoading !== null}
                                    className="flex items-center gap-1.5 bg-zinc-600 hover:bg-zinc-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition disabled:opacity-50"
                                >
                                    {isActionLoading === 'Pendiente' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                                    Revertir a Pendiente
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Local Rejection dialog overlay */}
            {isRejecting && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#1C2D54] border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in scale-in duration-200">
                        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                            <XCircle className="w-5 h-5 text-red-400" /> Rechazar Reembolso
                        </h3>
                        <p className="text-xs text-zinc-400 mb-4">
                            Por favor, describe con detalle el motivo del rechazo del recibo para que el colaborador esté al tanto.
                        </p>
                        <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 text-white rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-red-500/50 min-h-[100px] mb-6 text-xs outline-none"
                            placeholder="Ej: La foto no es legible o el monto ingresado no concuerda con el comprobante adjunto."
                        />
                        <div className="flex gap-3 justify-end text-xs font-semibold">
                            <button
                                onClick={() => { setIsRejecting(false); setRejectionReason(''); }}
                                className="px-4 py-2 text-zinc-400 hover:text-white transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleStatusChange('Rechazado', rejectionReason)}
                                disabled={!rejectionReason.trim() || isActionLoading !== null}
                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {isActionLoading === 'Rechazado' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Confirmar Rechazo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
