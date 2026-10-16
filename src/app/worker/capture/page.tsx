'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Image as ImageIcon, Loader2, UploadCloud, CheckCircle2, ChevronRight, LogOut, Receipt, History, Crop, Sparkles, WifiOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import ThemeToggle from '@/components/ThemeToggle';
import OfflineStatus from '@/components/worker/OfflineStatus';
import { useOfflineQueue } from '@/utils/useOfflineQueue';
import {
    cacheGet,
    cacheSet,
    forgetCurrentUser,
    removeFromQueue,
    requestOfflineWarmup,
    submitReceipt,
    type QueuedReceipt,
    type SubmitOutcome,
} from '@/utils/offlineQueue';

export default function WorkerCapture() {
    const router = useRouter();
    const [image, setImage] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressStatus, setProgressStatus] = useState('');

    const queue = useOfflineQueue();

    const handleLogout = async () => {
        if (queue.pendingCount > 0 && !confirm(`Tienes ${queue.pendingCount} gasto(s) guardado(s) sin enviar. Si cierras sesión no se enviarán hasta que vuelvas a ingresar con esta cuenta. ¿Cerrar sesión de todas formas?`)) {
            return;
        }
        try {
            await createClient().auth.signOut();
        } catch {
            // sin conexión: igual se sale de la pantalla
        }
        forgetCurrentUser();
        router.push('/worker/login');
    };

    const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

    const [results, setResults] = useState<{
        date: string;
        amount: string;
        merchant: string;
        merchant_rut?: string;
        document_type?: string;
        document_number?: string;
        category: string;
        project_id: string; // Nuevo campo
        location?: string; // Phase 2: Geolocation
    } | null>(null);

    const [categories, setCategories] = useState<{ id: string; name: string; color: string }[]>([]);

    // Initial load for categories
    useEffect(() => {
        const fetchCategories = async () => {
            const cached = await cacheGet<{ id: string; name: string; color: string }[]>('categories');
            if (cached) setCategories(cached);
            try {
                const res = await fetch('/api/worker/categories');
                const data = await res.json();
                if (res.ok && data.categories) {
                    setCategories(data.categories);
                    cacheSet('categories', data.categories);
                }
            } catch {
                // sin conexión: se usan las categorías guardadas
            }
        };

        fetchCategories();
    }, []);

    // Active projects fetch
    useEffect(() => {
        const fetchProjects = async () => {
            const cached = await cacheGet<{ id: string; name: string }[]>('projects');
            if (cached) setProjects(cached);
            try {
                const res = await fetch('/api/worker/projects');
                const data = await res.json();
                if (res.ok && data.projects) {
                    setProjects(data.projects);
                    cacheSet('projects', data.projects);
                }
            } catch {
                // sin conexión: se usan los proyectos guardados
            }
        };

        fetchProjects();
    }, []);

    // Con conexión, deja guardadas las pantallas para poder abrir la app sin señal.
    useEffect(() => {
        if (queue.online) requestOfflineWarmup();
    }, [queue.online]);

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

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [submitOutcome, setSubmitOutcome] = useState<SubmitOutcome | null>(null);
    const [ocrNotice, setOcrNotice] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsProcessing(true);
        setProgressStatus('Procesando la imagen original...');

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

            // Send directly to the AI
            processImage(compressedBase64);
        } catch (error) {
            console.error(error);
            setIsProcessing(false);
            alert("Hubo un error al preparar la imagen.");
        }
    };

    const emptyResults = () => ({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        merchant: '',
        merchant_rut: '',
        document_type: 'boleta',
        document_number: '',
        category: categories.length > 0 ? categories[0].name : 'Otros',
        project_id: '',
        location: ''
    });

    // El GPS funciona sin internet, así que se captura con o sin lectura de IA.
    const captureLocation = () => {
        if (!('geolocation' in navigator)) return;
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const loc = `https://www.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`;
                setResults(prev => prev ? { ...prev, location: loc } : null);
            },
            (error) => {
                console.warn("Geolocation Error:", error.message);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    };

    const enterManually = (notice: string) => {
        setOcrNotice(notice);
        setResults(emptyResults());
        captureLocation();
    };

    const processImage = async (imageUrl: string) => {
        setIsProcessing(true);
        setProgress(0);
        setResults(null);
        setIsSuccess(false);
        setOcrNotice(null);

        // Sin conexión la IA no puede leer la boleta: se pasa directo al llenado manual.
        if (!navigator.onLine) {
            enterManually('Sin conexión: la IA no puede leer la boleta. Completa los datos a mano; el gasto se enviará solo cuando vuelva la señal.');
            setIsProcessing(false);
            return;
        }

        setProgressStatus('IA analizando recibo...');

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30000);
        try {
            const res = await fetch('/api/worker/ocr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: imageUrl }),
                signal: controller.signal
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Error al procesar la imagen con IA");
            }

            const { merchant, merchant_rut, document_type, document_number, date, amount, category } = data.data;

            // Aseguramos formato YYYY-MM-DD para el input type="date"
            let formattedDateForInput = new Date().toISOString().split('T')[0];
            if (date && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                formattedDateForInput = date;
            }

            // Intentar matchear la categoría extraída con las existentes (o usar la primera como fallback)
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
                project_id: '', // Por defecto Ninguno
                location: ''
            });

            captureLocation();
        } catch (error: any) {
            console.error(error);
            enterManually('No se pudo leer la boleta con la IA (sin conexión o sin respuesta). Completa los datos a mano.');
        } finally {
            clearTimeout(timer);
            setIsProcessing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!results) return;
        setIsSubmitting(true);

        try {
            // El gasto se guarda primero en el teléfono y luego se intenta enviar:
            // si falla la señal, no se pierde y se reenvía solo.
            const outcome: SubmitOutcome = await submitReceipt({ ...results, imageBase64 });

            if (outcome.kind === 'rejected') {
                alert("No se pudo subir el recibo: " + outcome.message);
                return;
            }

            setSubmitOutcome(outcome);
            setIsSuccess(true);

            setTimeout(() => {
                setImage(null);
                setResults(null);
                setOcrNotice(null);
                setIsSuccess(false);
            }, outcome.kind === 'sent' ? 3000 : 4500);

            if (outcome.kind === 'sent') queue.syncNow();
        } catch (error) {
            console.error("Error saving receipt:", error);
            alert("No se pudo guardar el gasto en tu teléfono. Revisa que tengas espacio disponible e inténtalo de nuevo.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Carga un gasto guardado de vuelta en el formulario para corregirlo.
    const editQueuedReceipt = async (item: QueuedReceipt) => {
        const { imageBase64: savedImage, ...fields } = item.payload;
        const isPdf = !!savedImage && savedImage.startsWith('data:application/pdf');
        setImageBase64(savedImage);
        setImage(savedImage ? (isPdf ? 'PDF_DOCUMENT_PLACEHOLDER' : savedImage) : 'PDF_DOCUMENT_PLACEHOLDER');
        setResults({ ...emptyResults(), ...fields, project_id: fields.project_id ?? '' });
        setOcrNotice(null);
        setIsSuccess(false);
        await removeFromQueue(item.id);
    };

    return (
        <div className="min-h-screen bg-app text-zinc-50 font-sans pb-20">
            <nav className="border-b border-line bg-card-50 backdrop-blur-xl sticky top-0 z-50">
                <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-brand" />
                        <span className="font-semibold text-zinc-200">Mis Gastos</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <ThemeToggle showLabel={false} className="p-2" />
                        <button onClick={() => router.push('/worker/history')} className="p-2 text-zinc-400 hover:text-white flex items-center gap-1">
                            <History className="w-5 h-5" />
                        </button>
                        <button onClick={handleLogout} className="p-2 text-zinc-400 hover:text-white">
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-xl mx-auto px-4 pt-8 space-y-8">
                <OfflineStatus queue={queue} onEdit={editQueuedReceipt} />

                {!image ? (
                    <div className="space-y-6">
                        <div className="text-center space-y-2">
                            <h1 className="text-2xl font-bold flex items-center justify-center gap-2">Registrar Nuevo Gasto <Sparkles className="w-5 h-5 text-yellow-400" /></h1>
                            <p className="text-zinc-400 text-sm">Sube una foto de tu recibo. Nuestra Inteligencia Artificial (Gemini) extraerá los datos con alta precisión automáticamente.</p>
                        </div>

                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-line-strong hover:border-[#8CC63F]/50 bg-card-40 hover:bg-[#8CC63F]/5 rounded-[2rem] p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all group hover:scale-[1.02]"
                        >
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImageUpload}
                                accept="image/*,application/pdf"
                                className="hidden"
                            />
                            <div className="p-4 bg-white/5 rounded-full text-zinc-400 group-hover:text-brand group-hover:bg-[#8CC63F]/20 transition-all">
                                <Camera className="w-10 h-10" />
                            </div>
                            <div className="text-center">
                                <p className="font-medium">Tomar foto o subir imagen/PDF</p>
                                <p className="text-xs text-zinc-500 mt-1">Soporta JPG, PNG, WEBP, PDF</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="relative aspect-video sm:aspect-square md:aspect-video bg-inset-40 rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                            {image === 'PDF_DOCUMENT_PLACEHOLDER' ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400">
                                    <Receipt className="w-16 h-16 mb-4 opacity-50" />
                                    <p className="font-medium text-zinc-300">Documento PDF Cargado</p>
                                </div>
                            ) : (
                                <img src={image} alt="Recibo" className="w-full h-full object-contain opacity-80" />
                            )}

                            {isProcessing && (
                                <div className="absolute inset-0 bg-app/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                                    <Loader2 className="w-10 h-10 text-brand animate-spin mb-4" />
                                </div>
                            )}

                            {isSuccess && (
                                <div className="absolute inset-0 bg-green-500/90 backdrop-blur-md flex flex-col items-center justify-center text-on-accent">
                                    <CheckCircle2 className="w-16 h-16 mb-4 animate-bounce" />
                                    <h3 className="text-2xl font-bold">
                                        {submitOutcome?.kind === 'queued' ? '¡Gasto Guardado!' : '¡Gasto Registrado!'}
                                    </h3>
                                    <p className="opacity-90 mt-2 px-6 text-center">
                                        {submitOutcome?.kind !== 'queued'
                                            ? 'Enviado al sistema central'
                                            : submitOutcome.reason === 'auth'
                                                ? 'Quedó guardado en tu teléfono. Inicia sesión de nuevo para enviarlo.'
                                                : 'Quedó guardado en tu teléfono y se enviará solo cuando vuelva la señal.'}
                                    </p>
                                </div>
                            )}
                        </div>

                        {results && !isProcessing && !isSuccess && (
                            <form onSubmit={handleSubmit} className="bg-surface/80 border border-line-strong rounded-3xl p-6 space-y-5 shadow-xl">
                                <div className="flex items-center gap-2 text-brand mb-2">
                                    <UploadCloud className="w-5 h-5" />
                                    <h3 className="font-medium">{ocrNotice ? 'Completar Datos del Gasto' : 'Confirmar Datos Extraídos'}</h3>
                                </div>

                                {ocrNotice && (
                                    <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl p-3 text-xs">
                                        <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
                                        <p>{ocrNotice}</p>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-zinc-400 block mb-1">Comercio / Tienda</label>
                                            <input
                                                required
                                                value={results.merchant}
                                                onChange={e => setResults({ ...results, merchant: e.target.value })}
                                                className="w-full bg-inset-40 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#8CC63F]/50"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-zinc-400 block mb-1">RUT Proveedor</label>
                                            <input
                                                value={results.merchant_rut}
                                                onChange={e => setResults({ ...results, merchant_rut: e.target.value })}
                                                placeholder="Ej: 76.123.456-K"
                                                className="w-full bg-inset-40 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#8CC63F]/50"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-zinc-400 block mb-1">Fecha</label>
                                            <input
                                                type="date"
                                                required
                                                value={results.date}
                                                onChange={e => setResults({ ...results, date: e.target.value })}
                                                className="w-full bg-inset-40 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#8CC63F]/50"
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
                                                    className="w-full bg-inset-40 border border-white/10 text-white rounded-xl pl-8 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#8CC63F]/50"
                                                />
                                            </div>
                                        </div>
                                        <div className="col-span-2 md:col-span-1">
                                            <label className="text-xs text-zinc-400 block mb-1">Categoría</label>
                                            <select
                                                required
                                                value={results.category}
                                                onChange={e => setResults({ ...results, category: e.target.value })}
                                                className="w-full bg-inset-40 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#8CC63F]/50 appearance-none"
                                            >
                                                {categories.length === 0 && <option value="Otros">Otros</option>}
                                                {categories.map(cat => (
                                                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-span-2 md:col-span-1">
                                            <label className="text-xs text-zinc-400 block mb-1">Tipo de Documento</label>
                                            <select
                                                required
                                                value={results.document_type || 'boleta'}
                                                onChange={e => setResults({ ...results, document_type: e.target.value })}
                                                className="w-full bg-inset-40 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#8CC63F]/50 appearance-none"
                                            >
                                                <option value="boleta">Boleta</option>
                                                <option value="factura">Factura</option>
                                                <option value="boleta de honorarios">Boleta de Honorarios</option>
                                                <option value="comprobante de pago">Comprobante de Pago</option>
                                                <option value="otro">Otro</option>
                                            </select>
                                        </div>
                                        <div className="col-span-2 md:col-span-1">
                                            <label className="text-xs text-zinc-400 block mb-1">Nº Documento / Folio</label>
                                            <input
                                                value={results.document_number || ''}
                                                onChange={e => setResults({ ...results, document_number: e.target.value })}
                                                placeholder="Ej: 1459"
                                                className="w-full bg-inset-40 border border-white/10 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#8CC63F]/50"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-xs text-zinc-400 block mb-1">Proyecto Asignado (Opcional)</label>
                                            <select
                                                value={results.project_id}
                                                onChange={e => setResults({ ...results, project_id: e.target.value })}
                                                className="w-full bg-inset-40 border border-white/10 text-zinc-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#8CC63F]/50 appearance-none"
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
                                        onClick={() => { setImage(null); setOcrNotice(null); }}
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
