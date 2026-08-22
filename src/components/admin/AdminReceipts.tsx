'use client';
import { useState, useEffect } from 'react';
import { Receipt, Search, ExternalLink, CheckCircle, CreditCard, Loader2, XCircle, Download, Trash2, FileSpreadsheet, FileText, Image as ImageIcon, Eye, Plus, RotateCcw, ArrowUp, ArrowDown, ArrowUpDown, Landmark } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ReceiptDetailModal from './ReceiptDetailModal';
import AdminReceiptCreateModal from './AdminReceiptCreateModal';
import { getReceiptBalance } from '@/utils/payments';

export default function AdminReceipts() {
    const [receipts, setReceipts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [workers, setWorkers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Sorting States
    const [sortField, setSortField] = useState<string>('date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Advance Filters States
    const [filterCategory, setFilterCategory] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [filterWorker, setFilterWorker] = useState('');
    const [filterDocumentType, setFilterDocumentType] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);

    // Reset current page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterCategory, filterProject, filterWorker, filterDocumentType, filterStatus, filterStartDate, filterEndDate]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [resReceipts, resCategories, resWorkers] = await Promise.all([
                    fetch('/api/admin/receipts'),
                    fetch('/api/admin/categories'),
                    fetch('/api/admin/workers')
                ]);

                const dataReceipts = await resReceipts.json();
                const dataCategories = await resCategories.json();
                const dataWorkers = await resWorkers.json();

                if (resReceipts.ok && dataReceipts.receipts) {
                    setReceipts(dataReceipts.receipts);
                }
                if (resCategories.ok && dataCategories.categories) {
                    setCategories(dataCategories.categories);
                }
                if (resWorkers.ok && dataWorkers.workers) {
                    setWorkers(dataWorkers.workers);
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

    // Helper: Map email to worker name
    const getWorkerName = (email: string) => {
        if (!email) return 'Desconocido';
        const worker = workers.find(w => w.email === email);
        return worker && worker.name ? worker.name : email.split('@')[0];
    };

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

    const handleRevertStatus = async (id: string) => {
        if (!confirm('¿Estás seguro de revertir el estado de este recibo a Pendiente?')) return;

        try {
            const res = await fetch('/api/admin/receipts/status', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    status: 'Pendiente',
                    rejection_reason: null
                })
            });
            if (res.ok) {
                setReceipts(receipts.map(r => r.id === id ? { ...r, status: 'Pendiente', rejection_reason: null } : r));
            } else {
                alert("Error al revertir el estado.");
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
            'RUT Proveedor': r.merchant_rut || '-',
            'Tipo Documento': r.document_type || 'Boleta',
            'N° Documento': r.document_number || '-',
            'Proyecto': r.projects?.name || 'Gasto Genérico',
            'Categoría': r.category,
            'Monto ($)': Number(r.amount),
            'Estado': r.status || 'Pendiente',
            'Colaborador (Nombre)': getWorkerName(r.worker_email),
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

    const fetchImageAsBase64 = async (url: string): Promise<string | null> => {
        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            const blob = await response.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.error("Error fetching image:", e);
            return null;
        }
    };

    const loadPdfJs = (): Promise<any> => {
        return new Promise((resolve, reject) => {
            if ((window as any).pdfjsLib) {
                resolve((window as any).pdfjsLib);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
            script.onload = () => {
                const pdfjsLib = (window as any).pdfjsLib;
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
                resolve(pdfjsLib);
            };
            script.onerror = (e) => reject(new Error("Error al cargar PDF.js de CDN"));
            document.head.appendChild(script);
        });
    };

    const convertPdfToImageBase64 = async (pdfUrl: string): Promise<string | null> => {
        try {
            const pdfjsLib = await loadPdfJs();
            const loadingTask = pdfjsLib.getDocument(pdfUrl);
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);
            
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) return null;
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            await page.render(renderContext).promise;
            return canvas.toDataURL('image/jpeg', 0.85);
        } catch (err) {
            console.error("Error converting PDF to image:", err);
            return null;
        }
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
        const tableColumn = ["Fecha", "Comercio", "RUT Proveedor", "Documento", "Proyecto", "Categoría", "Colaborador", "Monto", "Estado"];
        const tableRows = filteredReceipts.map(r => [
            r.date,
            r.merchant,
            r.merchant_rut || '-',
            r.document_number ? `${r.document_type} N°${r.document_number}` : (r.document_type || 'Boleta'),
            (r.projects?.name || 'Gasto Genérico').substring(0, 15),
            r.category,
            getWorkerName(r.worker_email),
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

    const handleExportPDFWithPhotos = async () => {
        if (filteredReceipts.length === 0) return;
        setIsGeneratingPDF(true);

        try {
            const doc = new jsPDF();
            
            // --- INICIO DE LA TABLA ESTÁNDAR ---
            doc.setFontSize(18);
            doc.setTextColor(28, 45, 84); // #1C2D54
            doc.text('Facilita Capacitación - Reporte de Gastos con Anexos', 14, 22);
            
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

            const tableColumn = ["Fecha", "Comercio", "RUT", "Documento", "Categoría", "Colaborador", "Monto", "Estado"];
            const tableRows = filteredReceipts.map(r => [
                r.date,
                r.merchant,
                r.merchant_rut || '-',
                r.document_number ? `${r.document_type} N°${r.document_number}` : (r.document_type || 'Boleta'),
                r.category,
                getWorkerName(r.worker_email),
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

            // --- INICIO DE ANEXOS DE FOTOS ---
            const receiptsWithImages = filteredReceipts.filter(r => r.image_url && r.image_url.startsWith('http'));

            if (receiptsWithImages.length > 0) {
                doc.addPage();
                doc.setFontSize(16);
                doc.setTextColor(28, 45, 84);
                doc.text('ANEXO: Comprobantes Fotográficos', 14, 20);
                
                let currentY = 30;
                const PAGE_HEIGHT = 297;
                const MARGIN_BOTTOM = 15;
                const MARGIN_X = 14;
                const COL_GAP = 10;
                const COL_WIDTH = (210 - (MARGIN_X * 2) - COL_GAP) / 2; // Anchura aprox 86mm por columna
                const MAX_IMG_HEIGHT = 115; // Límite de alto para alojar 2 filas per página cómodamente
                
                let colIndex = 0;
                let rowMaxHeight = 0;

                for (let i = 0; i < receiptsWithImages.length; i++) {
                    const r = receiptsWithImages[i];
                    
                    // Si estamos empezando una fila (colIndex === 0), comprobamos si hay espacio vertical
                    // Asumimos un máximo espacio que podría ocupar la fila (MAX_IMG_HEIGHT + textos = ~135)
                    if (colIndex === 0 && (currentY + MAX_IMG_HEIGHT + 20 > PAGE_HEIGHT - MARGIN_BOTTOM)) {
                        doc.addPage();
                        currentY = 20; // reset
                    }

                    let base64Img: string | null = null;
                    let imgProps: any = null;
                    
                    try {
                        const isPdf = r.image_url.toLowerCase().split('?')[0].endsWith('.pdf');
                        if (isPdf) {
                            base64Img = await convertPdfToImageBase64(r.image_url);
                        } else {
                            base64Img = await fetchImageAsBase64(r.image_url);
                        }
                        
                        if (base64Img) {
                            imgProps = doc.getImageProperties(base64Img);
                        }
                    } catch (e) {
                         console.error("Error al cargar la imagen/PDF", e);
                    }
                    
                    let drawWidth = 0;
                    let drawHeight = 0;

                    if (imgProps) {
                        const imgRatio = imgProps.width / imgProps.height;
                        drawWidth = COL_WIDTH;
                        drawHeight = drawWidth / imgRatio;

                        if (drawHeight > MAX_IMG_HEIGHT) {
                            drawHeight = MAX_IMG_HEIGHT;
                            drawWidth = drawHeight * imgRatio;
                        }
                    }

                    // Posición X para la columna actual
                    const xStart = MARGIN_X + (colIndex * (COL_WIDTH + COL_GAP));

                    // Dibujar textos, reduciendo la fuente a 9 para el formato de grilla
                    doc.setFontSize(9);
                    doc.setTextColor(0);
                    
                    // Truncar textos largos si hace falta
                    const shortMerchant = r.merchant.length > 20 ? r.merchant.substring(0, 18) + '...' : r.merchant;
                    const workerName = getWorkerName(r.worker_email);
                    const shortWorker = workerName.length > 20 ? workerName.substring(0, 18) + '...' : workerName;

                    doc.text(`Comercio: ${shortMerchant}`, xStart, currentY);
                    doc.text(`Fecha: ${r.date} | Monto: $${Number(r.amount).toLocaleString()}`, xStart, currentY + 4);
                    doc.text(`Resp: ${shortWorker}`, xStart, currentY + 8);
                    
                    let currentItemHeight = 12; // Altura base de los textos

                    // Dibujar imagen
                    if (base64Img && imgProps) {
                        const xOffset = xStart + (COL_WIDTH - drawWidth) / 2; // centrar en la columna
                        doc.addImage(base64Img, imgProps.fileType, xOffset, currentY + 11, drawWidth, drawHeight);
                        currentItemHeight += drawHeight + 5;
                    } else {
                        doc.setTextColor(255, 0, 0);
                        doc.text('(Error al cargar foto)', xStart, currentY + 14);
                        currentItemHeight += 10;
                    }

                    // Registrar cuál fue el elemento más alto de esta fila
                    if (currentItemHeight > rowMaxHeight) {
                        rowMaxHeight = currentItemHeight;
                    }

                    // Pasar a la siguiente columna
                    colIndex++;
                    
                    // Si ya llenamos las 2 columnas, bajamos de fila
                    if (colIndex > 1) {
                        colIndex = 0;
                        currentY += rowMaxHeight + 10; // Espaciado entre filas de 10mm
                        rowMaxHeight = 0; // reset
                    }
                }
            }

            doc.save(`Reporte_Anexos_Facilita_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error("Error generando PDF con fotos:", error);
            alert("Hubo un error al generar el PDF con fotos.");
        } finally {
            setIsGeneratingPDF(false);
        }
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
        const matchWorker = !filterWorker || getWorkerName(r.worker_email) === filterWorker;

        // 4.5 Document Type Match
        const matchDocType = !filterDocumentType || (r.document_type || 'boleta').toLowerCase() === filterDocumentType.toLowerCase();

        // 4.7 Status Match
        const matchStatus = !filterStatus || (r.status || 'Pendiente').toLowerCase() === filterStatus.toLowerCase();

        // 5. Date Range Match
        let matchDate = true;
        if (filterStartDate) {
            matchDate = matchDate && new Date(r.date) >= new Date(filterStartDate);
        }
        if (filterEndDate) {
            matchDate = matchDate && new Date(r.date) <= new Date(filterEndDate);
        }

        return matchSearch && matchCategory && matchProject && matchWorker && matchDocType && matchStatus && matchDate;
    });

    // Extract unique values for dropdowns based on actual data
    const uniqueWorkerNames = Array.from(new Set(receipts.map(r => getWorkerName(r.worker_email)).filter(Boolean))) as string[];
    const uniqueProjects = Array.from(new Map(receipts.filter(r => r.projects).map(r => [r.project_id, r.projects])).values()) as any[];
    const uniqueCategories = Array.from(new Set(receipts.map(r => r.category).filter(Boolean))) as string[];
    const uniqueDocTypes = Array.from(new Set(receipts.map(r => (r.document_type || 'boleta').toLowerCase()).filter(Boolean))) as string[];
    const uniqueStatuses = Array.from(new Set(receipts.map(r => r.status || 'Pendiente').filter(Boolean))) as string[];

    const totalFilteredAmount = filteredReceipts.reduce((sum, r) => sum + Number(r.amount), 0);

    const sortedReceipts = [...filteredReceipts].sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        if (sortField === 'date') {
            valA = a.date || '';
            valB = b.date || '';
        } else if (sortField === 'merchant') {
            valA = a.merchant?.toLowerCase() || '';
            valB = b.merchant?.toLowerCase() || '';
        } else if (sortField === 'document') {
            valA = ((a.document_type || 'boleta') + (a.document_number || '')).toLowerCase();
            valB = ((b.document_type || 'boleta') + (b.document_number || '')).toLowerCase();
        } else if (sortField === 'category') {
            valA = a.category?.toLowerCase() || '';
            valB = b.category?.toLowerCase() || '';
        } else if (sortField === 'amount') {
            valA = Number(a.amount) || 0;
            valB = Number(b.amount) || 0;
        } else if (sortField === 'status') {
            valA = a.status?.toLowerCase() || 'pendiente';
            valB = b.status?.toLowerCase() || 'pendiente';
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const paginatedReceipts = sortedReceipts.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(sortedReceipts.length / itemsPerPage);

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
                    <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="flex items-center gap-2 bg-[#8CC63F] hover:bg-[#3EAE49] text-[#121D38] px-3 py-2 rounded-xl text-sm font-bold transition whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4" />
                            Registrar Gasto
                        </button>
                        <button
                            onClick={handleExportPDF}
                            disabled={filteredReceipts.length === 0 || isGeneratingPDF}
                            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-3 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            <FileText className="w-4 h-4" />
                            PDF
                        </button>
                        <button
                            onClick={handleExportPDFWithPhotos}
                            disabled={filteredReceipts.length === 0 || isGeneratingPDF}
                            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-3 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {isGeneratingPDF ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                            {isGeneratingPDF ? "Generando..." : "PDF + Fotos"}
                        </button>
                        <button
                            onClick={handleExportExcel}
                            disabled={filteredReceipts.length === 0 || isGeneratingPDF}
                            className="flex items-center gap-2 bg-[#8CC63F]/10 hover:bg-[#8CC63F]/20 text-[#8CC63F] border border-[#8CC63F]/20 px-3 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            Excel
                        </button>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 bg-[#1C2D54]/50 p-4 rounded-xl border border-white/5">
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
                            {uniqueWorkerNames.map(name => (
                                <option key={name} value={name}>{name}</option>
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
                    <div className="flex flex-col">
                        <label className="text-[10px] text-zinc-400 mb-1 uppercase tracking-wider">Tipo Documento</label>
                        <select
                            value={filterDocumentType}
                            onChange={(e) => setFilterDocumentType(e.target.value)}
                            className="bg-[#1C2D54] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200 capitalize"
                        >
                            <option value="">Todos los tipos</option>
                            {uniqueDocTypes.map(c => (
                                <option key={c} value={c} className="capitalize">{c}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] text-zinc-400 mb-1 uppercase tracking-wider">Estado</label>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="bg-[#1C2D54] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200 capitalize"
                        >
                            <option value="">Todos los estados</option>
                            {uniqueStatuses.map(s => (
                                <option key={s} value={s} className="capitalize">{s}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Total Summary Row */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#1C2D54]/30 border border-white/5 p-4 rounded-xl">
                    <div className="text-sm text-zinc-400">
                        Mostrando <span className="font-semibold text-zinc-200">{filteredReceipts.length}</span> {filteredReceipts.length === 1 ? 'comprobante' : 'comprobantes'}
                    </div>
                    <div className="bg-[#8CC63F]/10 border border-[#8CC63F]/20 rounded-xl px-4 py-2 flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                        <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Total Filtrado:</span>
                        <span className="text-lg font-bold text-[#8CC63F]">${totalFilteredAmount.toLocaleString('es-CL')}</span>
                    </div>
                </div>
            </div>

            <div className="bg-[#1C2D54] border border-white/10 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-[#1C2D54] border-b border-white/10 text-zinc-400 animate-in fade-in">
                            <tr>
                                <th onClick={() => handleSort('date')} className="px-6 py-4 font-medium cursor-pointer hover:text-white select-none transition-colors">
                                    <div className="flex items-center gap-1">
                                        Fecha
                                        {sortField === 'date' ? (
                                            sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#8CC63F]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#8CC63F]" />
                                        ) : (
                                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                                        )}
                                    </div>
                                </th>
                                <th onClick={() => handleSort('merchant')} className="px-6 py-4 font-medium cursor-pointer hover:text-white select-none transition-colors">
                                    <div className="flex items-center gap-1">
                                        Proyecto y Comercio
                                        {sortField === 'merchant' ? (
                                            sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#8CC63F]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#8CC63F]" />
                                        ) : (
                                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                                        )}
                                    </div>
                                </th>
                                <th onClick={() => handleSort('document')} className="px-6 py-4 font-medium cursor-pointer hover:text-white select-none transition-colors text-left">
                                    <div className="flex items-center gap-1">
                                        Documento
                                        {sortField === 'document' ? (
                                            sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#8CC63F]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#8CC63F]" />
                                        ) : (
                                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                                        )}
                                    </div>
                                </th>
                                <th onClick={() => handleSort('category')} className="px-6 py-4 font-medium cursor-pointer hover:text-white select-none transition-colors text-left">
                                    <div className="flex items-center gap-1">
                                        Categoría
                                        {sortField === 'category' ? (
                                            sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#8CC63F]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#8CC63F]" />
                                        ) : (
                                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                                        )}
                                    </div>
                                </th>
                                <th onClick={() => handleSort('amount')} className="px-6 py-4 font-medium cursor-pointer hover:text-white select-none transition-colors text-center">
                                    <div className="flex items-center justify-center gap-1">
                                        Info. Pago
                                        {sortField === 'amount' ? (
                                            sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#8CC63F]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#8CC63F]" />
                                        ) : (
                                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                                        )}
                                    </div>
                                </th>
                                <th onClick={() => handleSort('status')} className="px-6 py-4 font-medium cursor-pointer hover:text-white select-none transition-colors text-center">
                                    <div className="flex items-center justify-center gap-1">
                                        Estado
                                        {sortField === 'status' ? (
                                            sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#8CC63F]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#8CC63F]" />
                                        ) : (
                                            <ArrowUpDown className="w-3 h-3 opacity-30" />
                                        )}
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-medium text-right select-none">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-zinc-500">
                                        Cargando recibos...
                                    </td>
                                </tr>
                            ) : sortedReceipts.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center">
                                        <div className="flex flex-col items-center justify-center">
                                            <Receipt className="w-10 h-10 text-zinc-600 mb-3" />
                                            <p className="text-zinc-500 font-medium">No se encontraron recibos</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedReceipts.map((receipt) => (
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
                                            <div className="flex flex-col">
                                                <span className="text-white font-medium capitalize">
                                                    {receipt.document_type || 'Boleta'} {receipt.document_number ? `Nº ${receipt.document_number}` : ''}
                                                </span>
                                                <span className="text-xs text-zinc-400 mt-1">RUT: {receipt.merchant_rut || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="bg-[#8CC63F]/10 text-[#8CC63F] px-2 py-1 rounded text-xs whitespace-nowrap">
                                                {receipt.category}
                                            </span>
                                            <div className="text-[10px] text-zinc-500 mt-1" title={receipt.worker_email}>
                                                Generado por: {getWorkerName(receipt.worker_email)}
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
                                                    <button onClick={() => setSelectedReceipt(receipt)} className="text-[#8CC63F] hover:text-[#3EAE49] inline-flex items-center gap-1 text-xs font-semibold bg-[#8CC63F]/10 px-2 py-0.5 rounded-lg transition">
                                                        <Eye className="w-3.5 h-3.5" /> Detalle
                                                    </button>
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
                                            {(() => {
                                                const linkCount = receipt.payment_receipts?.length || 0;
                                                if (linkCount === 0) {
                                                    return receipt.status === 'Reembolsado' ? (
                                                        <div className="mt-1.5 inline-flex items-center gap-1 text-zinc-500 border border-white/5 px-2 py-0.5 rounded-full text-[10px]" title="Marcado como pagado, pero sin comprobante de pago adjunto">
                                                            <Landmark className="w-3 h-3" />
                                                            Sin comprobante
                                                        </div>
                                                    ) : null;
                                                }

                                                const balance = getReceiptBalance(receipt);
                                                const label = linkCount > 1 ? `${linkCount} comprobantes` : 'Con comprobante';

                                                return balance.isPartial ? (
                                                    <button
                                                        onClick={() => setSelectedReceipt(receipt)}
                                                        className="mt-1.5 inline-flex items-center gap-1 bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px] font-medium hover:bg-amber-500/25 transition"
                                                        title={`Abonado $${balance.paid.toLocaleString('es-CL')} de $${balance.total.toLocaleString('es-CL')} — saldo $${balance.remaining.toLocaleString('es-CL')}`}
                                                    >
                                                        <Landmark className="w-3 h-3" />
                                                        Abonado ${balance.paid.toLocaleString('es-CL')} de ${balance.total.toLocaleString('es-CL')}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => setSelectedReceipt(receipt)}
                                                        className="mt-1.5 inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-medium hover:bg-emerald-500/25 transition"
                                                        title="Ver comprobante(s) de pago asociado(s)"
                                                    >
                                                        <Landmark className="w-3 h-3" />
                                                        {label}
                                                    </button>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => setSelectedReceipt(receipt)}
                                                    className="p-1.5 bg-zinc-700/30 text-zinc-300 hover:bg-zinc-700 hover:text-white rounded-md transition"
                                                    title="Ver Detalle Completo"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
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
                                                {receipt.status && receipt.status !== 'Pendiente' && (
                                                    <button
                                                        onClick={() => handleRevertStatus(receipt.id)}
                                                        className="p-1.5 bg-zinc-700/30 text-zinc-300 hover:bg-zinc-700 hover:text-white rounded-md transition"
                                                        title="Revertir a Pendiente"
                                                    >
                                                        <RotateCcw className="w-4 h-4" />
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

                {/* Pagination Controls */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 border-t border-white/10 bg-[#1C2D54]/20 select-none">
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <span>Mostrar</span>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => {
                                setItemsPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="bg-[#121D38] border border-white/10 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200"
                        >
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={200}>200</option>
                        </select>
                        <span>registros por página</span>
                    </div>

                    {totalPages > 0 && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 bg-[#121D38]/50 border border-white/10 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white hover:border-[#8CC63F]/50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                Anterior
                            </button>
                            <span className="px-3 py-1 text-xs text-zinc-400">
                                Página {currentPage} de {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 bg-[#121D38]/50 border border-white/10 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white hover:border-[#8CC63F]/50 transition disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                Siguiente
                            </button>
                        </div>
                    )}
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
            {selectedReceipt && (
                <ReceiptDetailModal
                    receipt={selectedReceipt}
                    onClose={() => setSelectedReceipt(null)}
                    onUpdate={(updated) => {
                        // Merge para no perder relaciones anidadas (projects, payment_receipts)
                        // que el PATCH no devuelve en su respuesta.
                        setReceipts(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r));
                        setSelectedReceipt((prev: any) => prev ? { ...prev, ...updated } : updated);
                    }}
                    onDelete={(id) => {
                        setReceipts(prev => prev.filter(r => r.id !== id));
                        setSelectedReceipt(null);
                    }}
                    categories={categories}
                    projects={uniqueProjects}
                    workers={workers}
                />
            )}
            {isCreateModalOpen && (
                <AdminReceiptCreateModal
                    onClose={() => setIsCreateModalOpen(false)}
                    onSuccess={(newReceipt) => {
                        // Añadir el nuevo recibo al principio de la lista
                        setReceipts(prev => [newReceipt, ...prev]);
                    }}
                    categories={categories}
                    projects={uniqueProjects}
                />
            )}
        </div>
    );
}
