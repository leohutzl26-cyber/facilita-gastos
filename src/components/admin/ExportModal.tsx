'use client';
import { useState, useMemo, useRef } from 'react';
import {
    X, FileSpreadsheet, FileText, Images, FileArchive, Loader2,
    AlertTriangle, Download, Calendar
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';

type Format = 'excel' | 'pdf' | 'pdf-photos' | 'zip-images';
type Quality = 'alta' | 'media' | 'baja';

const QUALITY_SETTINGS: Record<Quality, { maxDim: number; jpegQuality: number; label: string; hint: string }> = {
    alta: { maxDim: 1400, jpegQuality: 0.85, label: 'Alta', hint: 'Mejor nitidez, archivo más pesado y más lento' },
    media: { maxDim: 900, jpegQuality: 0.7, label: 'Media', hint: 'Recomendada: buen balance entre nitidez y velocidad' },
    baja: { maxDim: 550, jpegQuality: 0.55, label: 'Baja', hint: 'La más rápida, ideal para muchos comprobantes' },
};

// Corre `worker` sobre `items` con un máximo de `batchSize` en paralelo,
// reportando avance. Es lo que evita que "PDF + Fotos" se cuelgue: antes se
// pedía cada imagen una por una en serie.
async function processInBatches<T, R>(
    items: T[],
    batchSize: number,
    worker: (item: T, index: number) => Promise<R>,
    onProgress?: (done: number, total: number) => void,
    signal?: AbortSignal
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let nextIndex = 0;
    let completed = 0;

    async function runLane() {
        while (nextIndex < items.length) {
            if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
            const i = nextIndex++;
            results[i] = await worker(items[i], i);
            completed++;
            onProgress?.(completed, items.length);
        }
    }

    await Promise.all(Array.from({ length: Math.min(batchSize, items.length) }, runLane));
    return results;
}

function downscaleImage(base64: string, maxDim: number, jpegQuality: number): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
            if (width > maxDim || height > maxDim) {
                const scale = maxDim / Math.max(width, height);
                width = Math.round(width * scale);
                height = Math.round(height * scale);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(base64); return; }
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', jpegQuality));
        };
        img.onerror = () => resolve(base64);
        img.src = base64;
    });
}

function fetchAsBase64(url: string, signal?: AbortSignal): Promise<string | null> {
    return fetch(url, { signal })
        .then(res => res.ok ? res.blob() : null)
        .then(blob => blob ? new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        }) : null)
        .catch(() => null);
}

function loadPdfJs(): Promise<any> {
    return new Promise((resolve, reject) => {
        if ((window as any).pdfjsLib) { resolve((window as any).pdfjsLib); return; }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
        script.onload = () => {
            const pdfjsLib = (window as any).pdfjsLib;
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
            resolve(pdfjsLib);
        };
        script.onerror = () => reject(new Error('Error al cargar PDF.js'));
        document.head.appendChild(script);
    });
}

async function pdfPageToImage(pdfUrl: string, maxDim: number, jpegQuality: number, signal?: AbortSignal): Promise<string | null> {
    try {
        const pdfjsLib = await loadPdfJs();
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = maxDim / Math.max(baseViewport.width, baseViewport.height);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return null;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport }).promise;
        return canvas.toDataURL('image/jpeg', jpegQuality);
    } catch {
        return null;
    }
}

function isPdfUrl(url: string) {
    return url.toLowerCase().split('?')[0].endsWith('.pdf');
}

function sanitizeFilename(text: string) {
    return text.replace(/[^a-zA-Z0-9\-_ ]/g, '').trim().replace(/\s+/g, '_').slice(0, 40) || 'archivo';
}

const DATE_PRESETS = [
    { id: 'mes-actual', label: 'Este mes' },
    { id: 'mes-anterior', label: 'Mes pasado' },
    { id: 'ult-3-meses', label: 'Últimos 3 meses' },
    { id: 'este-anio', label: 'Este año' },
    { id: 'todo', label: 'Todo' },
] as const;

function applyDatePreset(id: string): { start: string; end: string } {
    const now = new Date();
    const toISO = (d: Date) => d.toISOString().split('T')[0];

    if (id === 'mes-actual') {
        return { start: toISO(new Date(now.getFullYear(), now.getMonth(), 1)), end: toISO(now) };
    }
    if (id === 'mes-anterior') {
        return {
            start: toISO(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
            end: toISO(new Date(now.getFullYear(), now.getMonth(), 0))
        };
    }
    if (id === 'ult-3-meses') {
        return { start: toISO(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())), end: toISO(now) };
    }
    if (id === 'este-anio') {
        return { start: toISO(new Date(now.getFullYear(), 0, 1)), end: toISO(now) };
    }
    return { start: '', end: '' };
}

type Props = {
    receipts: any[];
    categories: string[];
    projects: any[];
    workerNames: string[];
    getWorkerName: (email: string) => string;
    initialFilters: {
        startDate: string;
        endDate: string;
        category: string;
        project: string;
        worker: string;
        status: string;
    };
    onClose: () => void;
};

export default function ExportModal({ receipts, categories, projects, workerNames, getWorkerName, initialFilters, onClose }: Props) {
    const [format, setFormat] = useState<Format>('pdf-photos');
    const [quality, setQuality] = useState<Quality>('media');

    const [startDate, setStartDate] = useState(initialFilters.startDate);
    const [endDate, setEndDate] = useState(initialFilters.endDate);
    const [activePreset, setActivePreset] = useState<string | null>(null);
    const [category, setCategory] = useState(initialFilters.category);
    const [project, setProject] = useState(initialFilters.project);
    const [worker, setWorker] = useState(initialFilters.worker);
    const [status, setStatus] = useState(initialFilters.status);

    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [errorMsg, setErrorMsg] = useState('');
    const abortRef = useRef<AbortController | null>(null);

    const matchingReceipts = useMemo(() => {
        return receipts.filter(r => {
            const matchCategory = !category || r.category === category;
            const matchProject = !project || r.project_id === project;
            const matchWorker = !worker || getWorkerName(r.worker_email) === worker;
            const matchStatus = !status || (r.status || 'Pendiente').toLowerCase() === status.toLowerCase();
            let matchDate = true;
            if (startDate) matchDate = matchDate && new Date(r.date) >= new Date(startDate);
            if (endDate) matchDate = matchDate && new Date(r.date) <= new Date(endDate);
            return matchCategory && matchProject && matchWorker && matchStatus && matchDate;
        });
    }, [receipts, category, project, worker, status, startDate, endDate, getWorkerName]);

    const totalAmount = matchingReceipts.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const withImagesCount = matchingReceipts.filter(r => r.image_url && r.image_url.startsWith('http')).length;

    const handlePreset = (id: string) => {
        setActivePreset(id);
        const { start, end } = applyDatePreset(id);
        setStartDate(start);
        setEndDate(end);
    };

    const buildTablePdf = (doc: jsPDF, title: string) => {
        doc.setFontSize(18);
        doc.setTextColor(28, 45, 84);
        doc.text(title, 14, 22);

        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Fecha de emisión: ${new Date().toLocaleDateString('es-CL')}`, 14, 30);
        doc.text(`Total de registros: ${matchingReceipts.length}`, 14, 36);

        doc.setFontSize(12);
        doc.setTextColor(140, 198, 63);
        doc.text(`Suma Total: $${totalAmount.toLocaleString('es-CL')}`, 14, 44);

        autoTable(doc, {
            startY: 50,
            head: [["Fecha", "Comercio", "RUT", "Documento", "Proyecto", "Categoría", "Colaborador", "Monto", "Estado"]],
            body: matchingReceipts.map(r => [
                r.date,
                r.merchant,
                r.merchant_rut || '-',
                r.document_number ? `${r.document_type} N°${r.document_number}` : (r.document_type || 'Boleta'),
                (r.projects?.name || 'Gasto Genérico').substring(0, 15),
                r.category,
                getWorkerName(r.worker_email),
                `$${Number(r.amount).toLocaleString('es-CL')}`,
                r.status || 'Pendiente'
            ]),
            theme: 'striped',
            headStyles: { fillColor: [28, 45, 84] },
            styles: { fontSize: 8, cellPadding: 2 }
        });
    };

    const exportExcel = () => {
        const dataForExcel = matchingReceipts.map(r => ({
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
        const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte_Gastos");
        XLSX.writeFile(workbook, `Reporte_Gastos_Facilita_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const exportPdfOnly = () => {
        const doc = new jsPDF();
        buildTablePdf(doc, 'Facilita Capacitación - Reporte de Gastos');
        doc.save(`Reporte_Gastos_Facilita_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const exportPdfWithPhotos = async (signal: AbortSignal) => {
        const { maxDim, jpegQuality } = QUALITY_SETTINGS[quality];
        const doc = new jsPDF();
        buildTablePdf(doc, 'Facilita Capacitación - Reporte de Gastos con Anexos');

        const receiptsWithImages = matchingReceipts.filter(r => r.image_url && r.image_url.startsWith('http'));
        if (receiptsWithImages.length === 0) {
            doc.save(`Reporte_Anexos_Facilita_${new Date().toISOString().split('T')[0]}.pdf`);
            return;
        }

        setProgress({ done: 0, total: receiptsWithImages.length });

        // 1. Descarga y compresión en paralelo (esto es lo que antes se hacía
        // en serie, una por una, y colgaba el navegador con muchos gastos).
        const images = await processInBatches(
            receiptsWithImages,
            4,
            async (r) => {
                if (isPdfUrl(r.image_url)) {
                    return pdfPageToImage(r.image_url, maxDim, jpegQuality, signal);
                }
                const raw = await fetchAsBase64(r.image_url, signal);
                return raw ? downscaleImage(raw, maxDim, jpegQuality) : null;
            },
            (done, total) => setProgress({ done, total }),
            signal
        );

        if (signal.aborted) throw new DOMException('Cancelado', 'AbortError');

        // 2. Maquetado del PDF: rápido y síncrono, ya con las imágenes listas.
        doc.addPage();
        doc.setFontSize(16);
        doc.setTextColor(28, 45, 84);
        doc.text('ANEXO: Comprobantes Fotográficos', 14, 20);

        let currentY = 30;
        const PAGE_HEIGHT = 297;
        const MARGIN_BOTTOM = 15;
        const MARGIN_X = 14;
        const COL_GAP = 10;
        const COL_WIDTH = (210 - (MARGIN_X * 2) - COL_GAP) / 2;
        const MAX_IMG_HEIGHT = 115;

        let colIndex = 0;
        let rowMaxHeight = 0;

        for (let i = 0; i < receiptsWithImages.length; i++) {
            const r = receiptsWithImages[i];
            const base64Img = images[i];

            if (colIndex === 0 && (currentY + MAX_IMG_HEIGHT + 20 > PAGE_HEIGHT - MARGIN_BOTTOM)) {
                doc.addPage();
                currentY = 20;
            }

            let drawWidth = 0;
            let drawHeight = 0;
            let imgProps: any = null;

            if (base64Img) {
                try {
                    imgProps = doc.getImageProperties(base64Img);
                    const imgRatio = imgProps.width / imgProps.height;
                    drawWidth = COL_WIDTH;
                    drawHeight = drawWidth / imgRatio;
                    if (drawHeight > MAX_IMG_HEIGHT) {
                        drawHeight = MAX_IMG_HEIGHT;
                        drawWidth = drawHeight * imgRatio;
                    }
                } catch {
                    imgProps = null;
                }
            }

            const xStart = MARGIN_X + (colIndex * (COL_WIDTH + COL_GAP));

            doc.setFontSize(9);
            doc.setTextColor(0);
            const shortMerchant = r.merchant.length > 20 ? r.merchant.substring(0, 18) + '...' : r.merchant;
            const workerName = getWorkerName(r.worker_email);
            const shortWorker = workerName.length > 20 ? workerName.substring(0, 18) + '...' : workerName;

            doc.text(`Comercio: ${shortMerchant}`, xStart, currentY);
            doc.text(`Fecha: ${r.date} | Monto: $${Number(r.amount).toLocaleString('es-CL')}`, xStart, currentY + 4);
            doc.text(`Resp: ${shortWorker}`, xStart, currentY + 8);

            let currentItemHeight = 12;

            if (base64Img && imgProps) {
                const xOffset = xStart + (COL_WIDTH - drawWidth) / 2;
                doc.addImage(base64Img, 'JPEG', xOffset, currentY + 11, drawWidth, drawHeight);
                currentItemHeight += drawHeight + 5;
            } else {
                doc.setTextColor(255, 0, 0);
                doc.text('(Error al cargar foto)', xStart, currentY + 14);
                currentItemHeight += 10;
            }

            if (currentItemHeight > rowMaxHeight) rowMaxHeight = currentItemHeight;

            colIndex++;
            if (colIndex > 1) {
                colIndex = 0;
                currentY += rowMaxHeight + 10;
                rowMaxHeight = 0;
            }
        }

        doc.save(`Reporte_Anexos_Facilita_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const exportImagesZip = async (signal: AbortSignal) => {
        const receiptsWithImages = matchingReceipts.filter(r => r.image_url && r.image_url.startsWith('http'));
        if (receiptsWithImages.length === 0) {
            setErrorMsg('Ningún gasto en esta selección tiene comprobante adjunto.');
            return;
        }

        setProgress({ done: 0, total: receiptsWithImages.length });
        const zip = new JSZip();
        const usedNames = new Set<string>();

        await processInBatches(
            receiptsWithImages,
            6,
            async (r) => {
                const res = await fetch(r.image_url, { signal }).catch(() => null);
                if (!res || !res.ok) return;
                const blob = await res.blob();
                const ext = isPdfUrl(r.image_url) ? 'pdf' : (r.image_url.split('.').pop()?.split('?')[0] || 'jpg');
                let name = `${r.date}_${sanitizeFilename(r.merchant)}_$${Math.round(Number(r.amount))}.${ext}`;
                let suffix = 1;
                while (usedNames.has(name)) {
                    name = `${r.date}_${sanitizeFilename(r.merchant)}_$${Math.round(Number(r.amount))}_${suffix}.${ext}`;
                    suffix++;
                }
                usedNames.add(name);
                zip.file(name, blob);
            },
            (done, total) => setProgress({ done, total }),
            signal
        );

        if (signal.aborted) throw new DOMException('Cancelado', 'AbortError');

        const summary = matchingReceipts.map(r => ({
            'Fecha': r.date,
            'Comercio': r.merchant,
            'Categoría': r.category,
            'Monto ($)': Number(r.amount),
            'Estado': r.status || 'Pendiente',
            'Colaborador': getWorkerName(r.worker_email)
        }));
        const worksheet = XLSX.utils.json_to_sheet(summary);
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        zip.file('resumen.csv', csv);

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Comprobantes_Facilita_${new Date().toISOString().split('T')[0]}.zip`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleGenerate = async () => {
        if (matchingReceipts.length === 0) return;
        setErrorMsg('');
        setIsGenerating(true);
        setProgress({ done: 0, total: 0 });
        const controller = new AbortController();
        abortRef.current = controller;

        try {
            if (format === 'excel') exportExcel();
            else if (format === 'pdf') exportPdfOnly();
            else if (format === 'pdf-photos') await exportPdfWithPhotos(controller.signal);
            else if (format === 'zip-images') await exportImagesZip(controller.signal);
            if (!controller.signal.aborted) onClose();
        } catch (err: any) {
            if (err?.name !== 'AbortError') {
                console.error('Error exportando:', err);
                setErrorMsg('Ocurrió un error generando el archivo. Intenta con una selección más acotada.');
            }
        } finally {
            setIsGenerating(false);
            abortRef.current = null;
        }
    };

    const handleCancel = () => {
        abortRef.current?.abort();
    };

    const FORMATS: { id: Format; label: string; desc: string; icon: any }[] = [
        { id: 'excel', label: 'Excel', desc: 'Tabla de datos, sin imágenes', icon: FileSpreadsheet },
        { id: 'pdf', label: 'PDF', desc: 'Tabla de datos, liviano y rápido', icon: FileText },
        { id: 'pdf-photos', label: 'PDF + Fotos', desc: 'Tabla + anexo de comprobantes', icon: Images },
        { id: 'zip-images', label: 'ZIP de comprobantes', desc: 'Imágenes originales sin recomprimir', icon: FileArchive },
    ];

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={!isGenerating ? onClose : undefined}>
            <div
                className="bg-[#121D38] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Download className="w-4 h-4 text-[#8CC63F]" />
                        Exportar Reporte
                    </h3>
                    <button onClick={onClose} disabled={isGenerating} className="text-zinc-500 hover:text-white transition disabled:opacity-30">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="overflow-y-auto p-6 space-y-6">
                    {/* Rango de fechas */}
                    <div>
                        <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 mb-2">
                            <Calendar className="w-3.5 h-3.5 text-[#8CC63F]" />
                            Rango de fechas
                        </label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {DATE_PRESETS.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => handlePreset(p.id)}
                                    className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition ${activePreset === p.id
                                        ? 'bg-[#8CC63F]/15 border-[#8CC63F]/40 text-[#8CC63F]'
                                        : 'bg-[#1C2D54]/50 border-white/5 text-zinc-400 hover:text-zinc-200'
                                        }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => { setStartDate(e.target.value); setActivePreset(null); }}
                                className="bg-[#1C2D54] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200"
                            />
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => { setEndDate(e.target.value); setActivePreset(null); }}
                                className="bg-[#1C2D54] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200"
                            />
                        </div>
                    </div>

                    {/* Filtros adicionales */}
                    <div>
                        <label className="text-xs font-semibold text-zinc-300 block mb-2">Filtros adicionales</label>
                        <div className="grid grid-cols-2 gap-3">
                            <select value={category} onChange={e => setCategory(e.target.value)} className="bg-[#1C2D54] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200">
                                <option value="">Todas las categorías</option>
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select value={project} onChange={e => setProject(e.target.value)} className="bg-[#1C2D54] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200">
                                <option value="">Todos los proyectos</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                            <select value={worker} onChange={e => setWorker(e.target.value)} className="bg-[#1C2D54] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200">
                                <option value="">Todos los colaboradores</option>
                                {workerNames.map(w => <option key={w} value={w}>{w}</option>)}
                            </select>
                            <select value={status} onChange={e => setStatus(e.target.value)} className="bg-[#1C2D54] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200">
                                <option value="">Todos los estados</option>
                                <option value="Pendiente">Pendiente</option>
                                <option value="Aprobado por Supervisor">Aprobado</option>
                                <option value="Rechazado">Rechazado</option>
                                <option value="Reembolsado">Reembolsado</option>
                            </select>
                        </div>
                    </div>

                    {/* Resumen en vivo */}
                    <div className="bg-[#1C2D54]/40 border border-white/5 rounded-xl px-4 py-3 flex items-center justify-between text-xs">
                        <span className="text-zinc-300">
                            <span className="text-white font-semibold">{matchingReceipts.length}</span> gastos seleccionados
                            {withImagesCount > 0 && <span className="text-zinc-500"> · {withImagesCount} con comprobante</span>}
                        </span>
                        <span className="text-[#8CC63F] font-semibold">${totalAmount.toLocaleString('es-CL')}</span>
                    </div>

                    {/* Formato */}
                    <div>
                        <label className="text-xs font-semibold text-zinc-300 block mb-2">Formato de exportación</label>
                        <div className="grid grid-cols-2 gap-2">
                            {FORMATS.map(f => {
                                const Icon = f.icon;
                                const isActive = format === f.id;
                                return (
                                    <button
                                        key={f.id}
                                        onClick={() => setFormat(f.id)}
                                        className={`text-left p-3 rounded-xl border transition ${isActive
                                            ? 'bg-[#8CC63F]/10 border-[#8CC63F]/40'
                                            : 'bg-[#1C2D54]/40 border-white/5 hover:border-white/15'
                                            }`}
                                    >
                                        <Icon className={`w-4 h-4 mb-1.5 ${isActive ? 'text-[#8CC63F]' : 'text-zinc-400'}`} />
                                        <p className={`text-xs font-semibold ${isActive ? 'text-white' : 'text-zinc-300'}`}>{f.label}</p>
                                        <p className="text-[10px] text-zinc-500 mt-0.5">{f.desc}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Opciones de calidad para PDF + Fotos */}
                    {format === 'pdf-photos' && (
                        <div>
                            <label className="text-xs font-semibold text-zinc-300 block mb-2">Calidad de las fotos</label>
                            <div className="grid grid-cols-3 gap-2">
                                {(Object.keys(QUALITY_SETTINGS) as Quality[]).map(q => (
                                    <button
                                        key={q}
                                        onClick={() => setQuality(q)}
                                        className={`p-2.5 rounded-xl border text-center transition ${quality === q
                                            ? 'bg-[#8CC63F]/10 border-[#8CC63F]/40 text-white'
                                            : 'bg-[#1C2D54]/40 border-white/5 text-zinc-400 hover:border-white/15'
                                            }`}
                                    >
                                        <p className="text-xs font-semibold">{QUALITY_SETTINGS[q].label}</p>
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-1.5">{QUALITY_SETTINGS[quality].hint}</p>

                            {withImagesCount > 150 && (
                                <div className="mt-3 flex items-start gap-2 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2.5">
                                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-amber-300">
                                        Estás por incluir {withImagesCount} comprobantes con foto — puede tardar varios minutos.
                                        Considera acotar el rango de fechas, o usar "ZIP de comprobantes" que es más rápido.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {format === 'zip-images' && (
                        <p className="text-[11px] text-zinc-500 -mt-2">
                            Descarga los archivos originales tal como se subieron, sin pasar por un PDF — es la opción más rápida y confiable para lotes grandes.
                        </p>
                    )}

                    {errorMsg && <p className="text-xs text-red-400">{errorMsg}</p>}
                </div>

                <div className="p-6 bg-black/20 border-t border-white/5 shrink-0">
                    {isGenerating ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs text-zinc-300">
                                <span className="flex items-center gap-2">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8CC63F]" />
                                    {progress.total > 0 ? `Procesando ${progress.done} de ${progress.total}...` : 'Generando...'}
                                </span>
                                <button onClick={handleCancel} className="text-zinc-400 hover:text-red-400 transition">
                                    Cancelar
                                </button>
                            </div>
                            {progress.total > 0 && (
                                <div className="h-1.5 bg-[#1C2D54] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[#8CC63F] transition-all duration-200"
                                        style={{ width: `${(progress.done / progress.total) * 100}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={handleGenerate}
                            disabled={matchingReceipts.length === 0}
                            className="w-full flex items-center justify-center gap-2 bg-[#8CC63F] hover:bg-[#3EAE49] disabled:opacity-40 disabled:cursor-not-allowed text-[#121D38] px-4 py-3 rounded-xl text-sm font-bold transition"
                        >
                            <Download className="w-4 h-4" />
                            {matchingReceipts.length === 0 ? 'Ningún gasto coincide con estos filtros' : `Exportar ${matchingReceipts.length} gasto(s)`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
