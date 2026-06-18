'use client';
import { useState, useRef, useEffect } from 'react';
import { X, Camera, Loader2, UploadCloud, ChevronRight, Sparkles, AlertCircle, CheckCircle } from 'lucide-react';

type AdminReceiptCreateModalProps = {
    onClose: () => void;
    onSuccess: (newReceipt: any) => void;
    categories: any[];
    projects: any[];
};

export default function AdminReceiptCreateModal({
    onClose,
    onSuccess,
    categories,
    projects
}: AdminReceiptCreateModalProps) {
    const [image, setImage] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progressStatus, setProgressStatus] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form states
    const [results, setResults] = useState<{
        merchant: string;
        merchant_rut: string;
        document_type: string;
        document_number: string;
        amount: string;
        date: string;
        category: string;
        project_id: string;
        location: string;
    } | null>(null);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setProgressStatus('Procesando el archivo...');
        setErrorMsg('');

        try {
            if (file.type === 'application/pdf') {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64 = event.target?.result as string;
                    setImageBase64(base64);
                    setImage('PDF_DOCUMENT_PLACEHOLDER');
                    processImage(base64);
                };
                reader.readAsDataURL(file);
                return;
            }

            const url = URL.createObjectURL(file);
            setImage(url);

            const img = new Image();
            img.src = url;
            await new Promise((resolve) => { img.onload = resolve; });

            const MAX_DIMENSION = 2000;
            let finalWidth = img.width;
            let finalHeight = img.height;

            if (finalWidth > MAX_DIMENSION || finalHeight > MAX_DIMENSION) {
                const ratio = Math.min(MAX_DIMENSION / finalWidth, MAX_DIMENSION / finalHeight);
                finalWidth *= ratio;
                finalHeight *= ratio;
            }

            const canvas = document.createElement('canvas');
            canvas.width = finalWidth;
            canvas.height = finalHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(0, 0, finalWidth, finalHeight);
                ctx.drawImage(img, 0, 0, finalWidth, finalHeight);
            }

            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.9);
            setImageBase64(compressedBase64);
            setImage(compressedBase64);

            processImage(compressedBase64);
        } catch (error) {
            console.error(error);
            setIsProcessing(false);
            setErrorMsg("Hubo un error al preparar la imagen.");
        }
    };

    const processImage = async (imageUrl: string) => {
        setIsProcessing(true);
        setResults(null);
        setProgressStatus('IA (Gemini) analizando recibo...');

        try {
            const res = await fetch('/api/worker/ocr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: imageUrl })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Error al procesar la imagen con IA");
            }

            const { merchant, merchant_rut, document_type, document_number, date, amount, category } = data.data;

            let formattedDateForInput = new Date().toISOString().split('T')[0];
            if (date && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                formattedDateForInput = date;
            }

            const validCategoryNames = categories.map(c => c.name);
            let finalCategory = '';

            if (categories.length > 0) {
                finalCategory = validCategoryNames.includes(category) ? category : categories[0].name;
            } else {
                finalCategory = category || 'Otros';
            }

            setResults({
                amount: amount || '',
                date: formattedDateForInput,
                merchant: merchant || 'Desconocido',
                merchant_rut: merchant_rut || '',
                document_type: document_type || 'boleta',
                document_number: document_number || '',
                category: finalCategory,
                project_id: '',
                location: ''
            });

        } catch (error: any) {
            console.error(error);
            setErrorMsg("Atención: Falló el reconocimiento automático. Rellena los datos manualmente.");
            setResults({
                amount: '',
                date: new Date().toISOString().split('T')[0],
                merchant: '',
                merchant_rut: '',
                document_type: 'boleta',
                document_number: '',
                category: categories.length > 0 ? categories[0].name : '',
                project_id: '',
                location: ''
            });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrorMsg('');

        try {
            const payload = {
                ...results,
                imageBase64: imageBase64
            };

            const res = await fetch('/api/admin/receipts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok && data.success) {
                setSuccessMsg("¡Gasto registrado exitosamente!");
                setTimeout(() => {
                    onSuccess(data.receipt);
                    onClose();
                }, 1500);
            } else {
                throw new Error(data.error || "Error al subir recibo");
            }
        } catch (error: any) {
            console.error("Error submitting receipt:", error);
            setErrorMsg(error.message || "Error al subir el recibo.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-[#121D38] border border-white/10 rounded-[2.5rem] w-full max-w-4xl h-[90vh] md:h-[80vh] flex flex-col md:flex-row overflow-hidden shadow-2xl relative">
                
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 z-50 p-2 bg-black/40 hover:bg-black/60 rounded-full border border-white/10 text-zinc-400 hover:text-white transition-all hover:scale-105"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Left Side: Receipt Image Preview & Upload Dropzone */}
                <div className="w-full md:w-1/2 bg-black/40 border-r border-white/5 flex flex-col relative h-[35vh] md:h-full justify-center items-center">
                    {!image ? (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full h-full p-8 flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-white/5 transition-all text-center group"
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImageUpload}
                                accept="image/*,application/pdf"
                                className="hidden"
                            />
                            <div className="p-4 bg-white/5 rounded-full text-zinc-400 group-hover:text-[#8CC63F] group-hover:bg-[#8CC63F]/20 transition-all">
                                <UploadCloud className="w-10 h-10" />
                            </div>
                            <div>
                                <p className="font-semibold text-zinc-200">Subir comprobante (Imagen o PDF)</p>
                                <p className="text-xs text-zinc-500 mt-1">Haz clic para buscar o arrastrar aquí</p>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full h-full relative flex items-center justify-center bg-black/20 p-4">
                            {image === 'PDF_DOCUMENT_PLACEHOLDER' ? (
                                <div className="flex flex-col items-center justify-center text-zinc-400">
                                    <Sparkles className="w-12 h-12 mb-3 text-red-400 animate-pulse" />
                                    <p className="font-semibold text-zinc-200">Documento PDF Cargado</p>
                                </div>
                            ) : (
                                <img src={image} alt="Comprobante" className="max-h-full max-w-full object-contain rounded-xl shadow-md select-none" />
                            )}
                            <button
                                onClick={() => { setImage(null); setImageBase64(null); setResults(null); }}
                                className="absolute bottom-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-full text-xs font-semibold transition"
                            >
                                Cambiar comprobante
                            </button>
                        </div>
                    )}

                    {isProcessing && (
                        <div className="absolute inset-0 bg-[#121D38]/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-10">
                            <Loader2 className="w-10 h-10 text-[#8CC63F] animate-spin mb-4" />
                            <p className="text-sm font-semibold text-zinc-200">{progressStatus}</p>
                        </div>
                    )}
                </div>

                {/* Right Side: Colaborador selector & Form */}
                <div className="w-full md:w-1/2 flex flex-col h-[55vh] md:h-full overflow-y-auto bg-[#1C2D54]/10">
                    <div className="p-6 border-b border-white/5">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            Registrar Nuevo Gasto <Sparkles className="w-5 h-5 text-yellow-400" />
                        </h2>
                        <p className="text-xs text-zinc-400 mt-1">
                            Sube el recibo para procesarlo con IA o completa el formulario manualmente.
                        </p>
                    </div>

                    <div className="p-6 flex-1">
                        {errorMsg && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2 animate-in fade-in">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        {successMsg && (
                            <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-[#8CC63F] text-xs flex items-center gap-2 animate-in fade-in">
                                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                <span>{successMsg}</span>
                            </div>
                        )}

                        <div className="space-y-4">
                            {results ? (
                                <form onSubmit={handleSubmit} className="space-y-4 pt-2 border-t border-white/5 animate-in slide-in-from-bottom-2 duration-300">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2 sm:col-span-1">
                                            <label className="text-xs text-zinc-400 block mb-1 font-medium">Comercio / Proveedor *</label>
                                            <input
                                                required
                                                value={results.merchant}
                                                onChange={e => setResults({ ...results, merchant: e.target.value })}
                                                className="w-full bg-black/30 border border-white/10 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none"
                                            />
                                        </div>
                                        <div className="col-span-2 sm:col-span-1">
                                            <label className="text-xs text-zinc-400 block mb-1 font-medium">RUT Proveedor</label>
                                            <input
                                                value={results.merchant_rut}
                                                onChange={e => setResults({ ...results, merchant_rut: e.target.value })}
                                                placeholder="Ej: 76.123.456-K"
                                                className="w-full bg-black/30 border border-white/10 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-zinc-400 block mb-1 font-medium">Fecha *</label>
                                            <input
                                                type="date"
                                                required
                                                value={results.date}
                                                onChange={e => setResults({ ...results, date: e.target.value })}
                                                className="w-full bg-black/30 border border-white/10 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-zinc-400 block mb-1 font-medium">Monto Total *</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-xs">$</span>
                                                <input
                                                    required
                                                    value={results.amount}
                                                    onChange={e => setResults({ ...results, amount: e.target.value })}
                                                    className="w-full bg-black/30 border border-white/10 text-white rounded-xl pl-6 pr-3 py-2 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-zinc-400 block mb-1 font-medium">Categoría *</label>
                                            <select
                                                required
                                                value={results.category}
                                                onChange={e => setResults({ ...results, category: e.target.value })}
                                                className="w-full bg-[#121D38] border border-white/10 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none"
                                            >
                                                {categories.map(cat => (
                                                    <option key={cat.id} value={cat.name} className="bg-[#121D38] text-white">{cat.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-zinc-400 block mb-1 font-medium">Tipo Documento</label>
                                            <select
                                                required
                                                value={results.document_type}
                                                onChange={e => setResults({ ...results, document_type: e.target.value })}
                                                className="w-full bg-[#121D38] border border-white/10 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none"
                                            >
                                                <option value="boleta" className="bg-[#121D38] text-white">Boleta</option>
                                                <option value="factura" className="bg-[#121D38] text-white">Factura</option>
                                                <option value="boleta de honorarios" className="bg-[#121D38] text-white">Boleta de Honorarios</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2 sm:col-span-1">
                                            <label className="text-xs text-zinc-400 block mb-1 font-medium">Folio / Nº Documento</label>
                                            <input
                                                value={results.document_number}
                                                onChange={e => setResults({ ...results, document_number: e.target.value })}
                                                placeholder="Ej: 1459"
                                                className="w-full bg-black/30 border border-white/10 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none"
                                            />
                                        </div>
                                        <div className="col-span-2 sm:col-span-1">
                                            <label className="text-xs text-zinc-400 block mb-1 font-medium">Ubicación</label>
                                            <input
                                                value={results.location}
                                                onChange={e => setResults({ ...results, location: e.target.value })}
                                                placeholder="Ej: Coordenadas o Dirección"
                                                className="w-full bg-black/30 border border-white/10 text-white rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs text-zinc-400 block mb-1 font-medium">Proyecto Asignado</label>
                                        <select
                                            value={results.project_id}
                                            onChange={e => setResults({ ...results, project_id: e.target.value })}
                                            className="w-full bg-[#121D38] border border-white/10 text-zinc-300 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none"
                                        >
                                            <option value="" className="bg-[#121D38] text-white">Gasto Genérico</option>
                                            {projects.map(proj => (
                                                <option key={proj.id} value={proj.id} className="bg-[#121D38] text-white">{proj.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex gap-3 pt-4 justify-end border-t border-white/5 text-xs font-semibold">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="px-4 py-2 border border-white/10 rounded-xl text-zinc-400 hover:text-white transition"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="px-5 py-2 bg-[#8CC63F] hover:bg-[#3EAE49] text-[#121D38] rounded-xl font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                            {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Subir Gasto <ChevronRight className="w-3.5 h-3.5" /></>}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="mt-8 flex flex-col items-center justify-center p-6 border border-dashed border-white/5 bg-black/10 rounded-2xl">
                                    <Camera className="w-8 h-8 text-zinc-600 mb-2" />
                                    <p className="text-xs text-zinc-500 text-center">
                                        Sube un comprobante de imagen o PDF a la izquierda para cargar los datos automáticamente.
                                    </p>
                                    <div className="my-3 text-zinc-500 text-xs">— O BIEN —</div>
                                    <button
                                        type="button"
                                        onClick={() => setResults({
                                            merchant: '',
                                            merchant_rut: '',
                                            document_type: 'boleta',
                                            document_number: '',
                                            amount: '',
                                            date: new Date().toISOString().split('T')[0],
                                            category: categories.length > 0 ? categories[0].name : '',
                                            project_id: '',
                                            location: ''
                                        })}
                                        className="text-xs font-bold text-[#8CC63F] hover:text-[#3EAE49] transition"
                                    >
                                        Rellenar datos a mano
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
