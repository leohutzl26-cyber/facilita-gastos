'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Image as ImageIcon, Loader2, UploadCloud, CheckCircle2, ChevronRight, LogOut, Receipt, History, Crop } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { useRouter } from 'next/navigation';
import Cropper from 'react-easy-crop';

export default function WorkerCapture() {
    const [image, setImage] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressStatus, setProgressStatus] = useState('');

    const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

    const [isCropping, setIsCropping] = useState(false);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const [results, setResults] = useState<{
        date: string;
        amount: string;
        merchant: string;
        category: string;
        project_id: string; // Nuevo campo
    } | null>(null);

    const CATEGORIES = [
        "Alimentación", "Transporte", "Combustible",
        "Hospedaje", "Suministros Oficina", "Mantenimiento", "Otros"
    ];

    useEffect(() => {
        // Cargar los proyectos operativos disponibles al iniciar
        fetch('/api/worker/projects')
            .then(res => res.json())
            .then(data => {
                if (data.projects) setProjects(data.projects);
            })
            .catch(err => console.error("Error cargando proyectos:", err));
    }, []);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            setImage(url);
            setIsCropping(true); // Activa la vista de Recorte (Cropper)
        }
    };

    const confirmCrop = async () => {
        if (!image || !croppedAreaPixels) return;
        setIsProcessing(true);
        setProgressStatus('Optimizando recorte...');

        try {
            const img = new Image();
            img.src = image;
            await new Promise((resolve) => { img.onload = resolve; });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const targetWidth = croppedAreaPixels.width;
            const targetHeight = croppedAreaPixels.height;
            const MAX_WIDTH = 2400;
            const MAX_HEIGHT = 2400;

            let finalWidth = targetWidth;
            let finalHeight = targetHeight;

            if (finalWidth > finalHeight) {
                if (finalWidth > MAX_WIDTH) {
                    finalHeight *= MAX_WIDTH / finalWidth;
                    finalWidth = MAX_WIDTH;
                }
            } else {
                if (finalHeight > MAX_HEIGHT) {
                    finalWidth *= MAX_HEIGHT / finalHeight;
                    finalHeight = MAX_HEIGHT;
                }
            }

            canvas.width = finalWidth;
            canvas.height = finalHeight;
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, finalWidth, finalHeight);

            // Dibujar solo la porción recortada
            ctx.drawImage(
                img,
                croppedAreaPixels.x,
                croppedAreaPixels.y,
                croppedAreaPixels.width,
                croppedAreaPixels.height,
                0,
                0,
                finalWidth,
                finalHeight
            );

            // Mejorar la calidad de compresión de 0.6 a 0.9 para no dañar el texto de recibos
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.9);
            setImageBase64(compressedBase64);
            setImage(compressedBase64); // Actualizar prev. con la imagen final
            setIsCropping(false);

            // Correr el OCR sobre el recorte límpio
            processImage(compressedBase64);
        } catch (e) {
            console.error(e);
            alert("Error al recortar la imagen");
            setIsProcessing(false);
        }
    };

    const processImage = async (imageUrl: string) => {
        setIsProcessing(true);
        setProgress(0);
        setResults(null);
        setIsSuccess(false);

        try {
            const worker = await createWorker('spa+eng', 1, {
                logger: (m: any) => {
                    if (m.status === 'recognizing text') {
                        setProgress(Math.round(m.progress * 100));
                        setProgressStatus('Analizando recibo...');
                    } else {
                        setProgressStatus('Inicializando motor OCR...');
                    }
                }
            } as any);

            const { data: { text } } = await worker.recognize(imageUrl);
            await worker.terminate();

            // Simple regex based extractions
            const amountMatch = text.match(/(?:total|importe|monto)[\s:\$]*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?|[0-9]+(?:,[0-9]{2})?)/i) ||
                text.match(/\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2})?|[0-9]+(?:,[0-9]{2})?)/);
            const dateMatch = text.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/);

            // Attempt to get the first non-empty line as merchant name
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3);
            const merchant = lines.length > 0 ? lines[0] : 'Desconocido';

            // Format date for native HTML date input (YYYY-MM-DD)
            let formattedDateForInput = new Date().toISOString().split('T')[0];
            if (dateMatch) {
                const parts = dateMatch[1].split(/[\/\-]/);
                if (parts.length === 3) {
                    const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
                    const month = parts[1].padStart(2, '0');
                    const day = parts[0].padStart(2, '0');
                    formattedDateForInput = `${year}-${month}-${day}`;
                }
            }

            setResults({
                amount: amountMatch ? amountMatch[1] : '',
                date: formattedDateForInput,
                merchant: merchant.length > 30 ? merchant.substring(0, 30) : merchant,
                category: CATEGORIES[0], // Default
                project_id: '' // Por defecto Ninguno
            });

        } catch (error) {
            console.error(error);
            setResults({ amount: '', date: '', merchant: '', category: CATEGORIES[0], project_id: '' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const payload = {
                ...results,
                imageBase64: imageBase64
            };

            const res = await fetch('/api/worker/receipts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok) {
                setIsSuccess(true);

                // Save to local history
                if (results) {
                    const newRecord = {
                        id: Math.random().toString(36).substring(7),
                        ...results,
                        submittedAt: new Date().toISOString()
                    };
                    const existing = localStorage.getItem('worker_history');
                    const history = existing ? JSON.parse(existing) : [];
                    localStorage.setItem('worker_history', JSON.stringify([newRecord, ...history]));
                }

                // Reset after success
                setTimeout(() => {
                    setImage(null);
                    setResults(null);
                    setIsSuccess(false);
                }, 3000);
            } else {
                throw new Error(data.error || "Error al subir recibo");
            }
        } catch (error: any) {
            console.error("Error submitting receipt:", error);
            alert("No se pudo subir el recibo: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#121D38] text-zinc-50 font-sans pb-20">
            <nav className="border-b border-[#8CC63F]/10 bg-[#1C2D54]/50 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-[#8CC63F]" />
                        <span className="font-semibold text-zinc-200">Mis Gastos</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => router.push('/worker/history')} className="p-2 text-zinc-400 hover:text-white flex items-center gap-1">
                            <History className="w-5 h-5" />
                        </button>
                        <button onClick={() => router.push('/worker/login')} className="p-2 text-zinc-400 hover:text-white">
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-xl mx-auto px-4 pt-8 space-y-8">
                {!image ? (
                    <div className="space-y-6">
                        <div className="text-center space-y-2">
                            <h1 className="text-2xl font-bold">Registrar Nuevo Gasto</h1>
                            <p className="text-zinc-400 text-sm">Sube una foto de tu boleta o recibo. El sistema extraerá los datos automáticamente (Free Tier OCR).</p>
                        </div>

                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-[#8CC63F]/20 hover:border-[#8CC63F]/50 bg-[#1C2D54]/40 hover:bg-[#8CC63F]/5 rounded-[2rem] p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all group hover:scale-[1.02]"
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImageUpload}
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                            />
                            <div className="p-4 bg-white/5 rounded-full text-zinc-400 group-hover:text-[#8CC63F] group-hover:bg-[#8CC63F]/20 transition-all">
                                <Camera className="w-10 h-10" />
                            </div>
                            <div className="text-center">
                                <p className="font-medium">Tomar foto o subir imagen</p>
                                <p className="text-xs text-zinc-500 mt-1">Soporta JPG, PNG, WEBP</p>
                            </div>
                        </div>
                    </div>
                ) : isCropping ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black h-[60vh] flex items-center justify-center">
                            <Cropper
                                image={image}
                                crop={crop}
                                zoom={zoom}
                                aspect={undefined} // Proporción libre para recibos largos
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                            />
                            {isProcessing && (
                                <div className="absolute inset-0 z-50 bg-[#121D38]/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                                    <Loader2 className="w-10 h-10 text-[#8CC63F] animate-spin mb-4" />
                                    <p className="font-medium text-[#8CC63F]">{progressStatus}</p>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3 px-2">
                            <button
                                type="button"
                                onClick={() => { setImage(null); setIsCropping(false); }}
                                className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-medium transition"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={confirmCrop}
                                className="flex-[2] bg-[#8CC63F] hover:bg-[#3EAE49] text-[#121D38] py-3 rounded-xl font-bold transition flex items-center justify-center gap-2"
                            >
                                <Crop className="w-5 h-5" /> Listo, Recortar
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black aspect-video flex items-center justify-center">
                            <img src={image} alt="Recibo" className="max-h-full max-w-full object-contain opacity-70" />

                            {isProcessing && (
                                <div className="absolute inset-0 bg-[#121D38]/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                                    <Loader2 className="w-10 h-10 text-[#8CC63F] animate-spin mb-4" />
                                    <p className="font-medium text-[#8CC63F]">{progressStatus}</p>
                                    <div className="w-full max-w-xs bg-white/10 rounded-full h-2 mt-4 overflow-hidden">
                                        <div className="bg-[#8CC63F] h-full transition-all duration-300" style={{ width: `${progress}%` }} />
                                    </div>
                                </div>
                            )}

                            {isSuccess && (
                                <div className="absolute inset-0 bg-green-500/90 backdrop-blur-md flex flex-col items-center justify-center text-white">
                                    <CheckCircle2 className="w-16 h-16 mb-4 animate-bounce" />
                                    <h3 className="text-2xl font-bold">¡Gasto Registrado!</h3>
                                    <p className="opacity-90 mt-2">Enviado al sistema central</p>
                                </div>
                            )}
                        </div>

                        {results && !isProcessing && !isSuccess && (
                            <form onSubmit={handleSubmit} className="bg-[#1C2D54]/80 border border-[#8CC63F]/20 rounded-3xl p-6 space-y-5 shadow-xl">
                                <div className="flex items-center gap-2 text-[#8CC63F] mb-2">
                                    <UploadCloud className="w-5 h-5" />
                                    <h3 className="font-medium">Confirmar Datos Extraídos</h3>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs text-zinc-400 block mb-1">Comercio / Tienda</label>
                                        <input
                                            required
                                            value={results.merchant}
                                            onChange={e => setResults({ ...results, merchant: e.target.value })}
                                            className="w-full bg-black/40 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#8CC63F]/50"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-zinc-400 block mb-1">Fecha</label>
                                            <input
                                                type="date"
                                                required
                                                value={results.date}
                                                onChange={e => setResults({ ...results, date: e.target.value })}
                                                className="w-full bg-black/40 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#8CC63F]/50"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-zinc-400 block mb-1">Monto Total</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">$</span>
                                                <input
                                                    required
                                                    value={results.amount}
                                                    onChange={e => setResults({ ...results, amount: e.target.value })}
                                                    className="w-full bg-black/40 border border-white/10 text-white rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#8CC63F]/50"
                                                />
                                            </div>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-xs text-zinc-400 block mb-1">Categoría</label>
                                            <select
                                                required
                                                value={results.category}
                                                onChange={e => setResults({ ...results, category: e.target.value })}
                                                className="w-full bg-black/40 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#8CC63F]/50 appearance-none"
                                            >
                                                {CATEGORIES.map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-xs text-zinc-400 block mb-1">Proyecto Asignado (Opcional)</label>
                                            <select
                                                value={results.project_id}
                                                onChange={e => setResults({ ...results, project_id: e.target.value })}
                                                className="w-full bg-black/40 border border-white/10 text-zinc-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#8CC63F]/50 appearance-none"
                                            >
                                                <option value="">-- Ninguno (Gasto Genérico) --</option>
                                                {projects.map(proj => (
                                                    <option key={proj.id} value={proj.id}>{proj.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setImage(null)}
                                        className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-medium transition"
                                    >
                                        Reintentar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-[2] bg-[#8CC63F] hover:bg-[#3EAE49] text-[#121D38] py-3 rounded-xl font-bold transition flex items-center justify-center gap-2"
                                    >
                                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Subir Gasto <ChevronRight className="w-4 h-4" /></>}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
