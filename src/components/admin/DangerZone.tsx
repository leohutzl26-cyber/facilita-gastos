'use client';
import { useState } from 'react';
import { AlertOctagon, Trash2, ShieldAlert, Loader2, Users, FileText, Receipt } from 'lucide-react';

export default function DangerZone() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [targetFeature, setTargetFeature] = useState<'receipts' | 'projects' | 'workers' | null>(null);
    const [confirmText, setConfirmText] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const openConfirmModal = (target: 'receipts' | 'projects' | 'workers') => {
        setTargetFeature(target);
        setConfirmText('');
        setIsModalOpen(true);
    };

    const handleClean = async () => {
        if (confirmText !== 'ELIMINAR' || !targetFeature) return;

        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/clean', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target: targetFeature })
            });

            const data = await res.json();

            if (res.ok) {
                alert(`✅ Éxito: ${data.message}\nPara ver los cambios reflejados, por favor refresca la página.`);
                setIsModalOpen(false);
                setTargetFeature(null);
            } else {
                alert(`❌ Error: ${data.error}`);
            }
        } catch (error) {
            console.error('Error in clean operation:', error);
            alert('Error de red o servidor al intentar limpiar la base de datos.');
        } finally {
            setIsLoading(false);
            setConfirmText('');
        }
    };

    const targetDetails = {
        receipts: {
            title: 'Limpiar Historial de Gastos',
            description: 'Elimina permanentemente DENTRO de la base de datos TODOS los recibos e historiales registrados hasta la fecha en el sistema.',
            icon: <Receipt className="w-5 h-5" />,
            color: 'text-red-500',
            bg: 'bg-red-500/10'
        },
        projects: {
            title: 'Limpiar Proyectos',
            description: 'Advertencia: Eliminar los proyectos podría causar fallas en los Recibos históricos que dependían de ellos si no los borraste primero. Borra todos los centros de costo.',
            icon: <FileText className="w-5 h-5" />,
            color: 'text-orange-500',
            bg: 'bg-orange-500/10'
        },
        workers: {
            title: 'Limpiar Todos los Colaboradores',
            description: 'Despide y borra definitivamente a todos los usuarios del sistema (excepto a los que tengan el rol Admin). No podrán volver a entrar.',
            icon: <Users className="w-5 h-5" />,
            color: 'text-rose-500',
            bg: 'bg-rose-500/10'
        }
    };

    return (
        <div className="mt-12 bg-red-950/20 border border-red-500/30 rounded-2xl p-6 relative overflow-hidden">
            {/* Background warning pattern */}
            <div className="absolute top-0 right-0 p-8 opacity-5 transform translate-x-12 -translate-y-12 pointer-events-none">
                <AlertOctagon className="w-64 h-64 text-red-500" />
            </div>

            <div className="flex items-center gap-3 mb-6 relative z-10">
                <ShieldAlert className="w-6 h-6 text-red-500 animate-pulse" />
                <h2 className="text-xl font-bold text-red-100">Zona de Peligro</h2>
            </div>

            <p className="text-sm text-red-200/70 mb-8 max-w-2xl relative z-10">
                Las operaciones en este módulo son <strong>IRREVERSIBLES</strong>. Al hacer clic en los botones de abajo, borrarás datos de los servidores que no pueden ser recuperados fácilmente sin respaldos técnicos (backups). Procede con absoluta precaución.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                {(['receipts', 'projects', 'workers'] as const).map((key) => (
                    <div key={key} className="bg-black/40 border border-red-500/20 rounded-xl p-5 hover:border-red-500/50 transition-colors flex flex-col justify-between">
                        <div>
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${targetDetails[key].bg} ${targetDetails[key].color}`}>
                                {targetDetails[key].icon}
                            </div>
                            <h3 className="text-red-100 font-semibold mb-2">{targetDetails[key].title}</h3>
                            <p className="text-xs text-red-300/60 leading-relaxed mb-6">
                                {targetDetails[key].description}
                            </p>
                        </div>
                        <button
                            onClick={() => openConfirmModal(key)}
                            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-red-500/10 text-red-400 font-medium hover:bg-red-500 hover:text-white transition-colors border border-red-500/30 text-sm"
                        >
                            <Trash2 className="w-4 h-4" /> Ejecutar Limpieza
                        </button>
                    </div>
                ))}
            </div>

            {/* Confirmation Modal */}
            {isModalOpen && targetFeature && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#121D38]/90 backdrop-blur-md p-4">
                    <div className="bg-[#1C2D54] border border-red-500/50 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="bg-red-500 p-6 flex flex-col items-center justify-center text-center">
                            <AlertOctagon className="w-12 h-12 text-white mb-3" />
                            <h2 className="text-white text-xl font-bold">Autenticación de Borrado</h2>
                        </div>
                        <div className="p-6 space-y-6">
                            <p className="text-zinc-300 text-sm text-center">
                                Estás a punto de ejecutar: <br />
                                <strong className="text-red-400 text-base">{targetDetails[targetFeature].title}</strong>
                            </p>

                            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-center">
                                <p className="text-xs text-red-300 mb-3">Para evitar clics accidentales, escribe la palabra <strong>ELIMINAR</strong> en el cuadro de abajo para destrabar el botón.</p>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    placeholder="ELIMINAR"
                                    className="w-full text-center bg-black/40 border border-red-500/30 rounded-lg py-2 text-white focus:outline-none focus:border-red-500 tracking-widest font-mono uppercase"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => { setIsModalOpen(false); setConfirmText(''); }}
                                    className="flex-1 py-2.5 rounded-lg border border-white/10 text-zinc-300 hover:bg-white/5 font-medium transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleClean}
                                    disabled={confirmText !== 'ELIMINAR' || isLoading}
                                    className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-500 disabled:opacity-50 disabled:bg-zinc-600 disabled:text-zinc-400 transition flex justify-center items-center gap-2"
                                >
                                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
