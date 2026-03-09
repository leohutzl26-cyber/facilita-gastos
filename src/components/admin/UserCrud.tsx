'use client';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Mail, Lock, UserCheck, KeyRound, Loader2 } from 'lucide-react';

type Worker = {
    id: string;
    name: string;
    email: string;
};

export default function UserCrud() {
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingWorkers, setIsFetchingWorkers] = useState(true);
    const [error, setError] = useState('');
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [isResetting, setIsResetting] = useState<string | null>(null);

    useEffect(() => {
        fetchWorkers();
    }, []);

    const fetchWorkers = async () => {
        setIsFetchingWorkers(true);
        try {
            const res = await fetch('/api/admin/workers');
            const data = await res.json();
            if (res.ok && data.workers) {
                setWorkers(data.workers);
            }
        } catch (err) {
            console.error('Failed to fetch workers:', err);
        } finally {
            setIsFetchingWorkers(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await fetch('/api/admin/workers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName, email: newEmail })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Error al crear trabajador');

            const newWorker = {
                id: data.user.id,
                name: newName,
                email: newEmail,
            };
            setWorkers([...workers, newWorker]);
            setIsAdding(false);
            setNewName('');
            setNewEmail('');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = (id: string) => {
        // Todo: Connect to real delete endpoint
        setWorkers(workers.filter(w => w.id !== id));
    };

    const handleResetPassword = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro de que deseas forzar el reinicio de clave para ${name}? Esto la devolverá a "123456" y obligará al colaborador a cambiarla en su próximo acceso.`)) return;

        setIsResetting(id);
        try {
            const res = await fetch(`/api/admin/workers/${id}/reset-password`, {
                method: 'POST',
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Error al reiniciar contraseña');

            alert(`¡Exito! La contraseña temporal de ${name} vuelve a ser 123456.`);
        } catch (err: any) {
            console.error(err);
            alert("Falló el reinicio: " + err.message);
        } finally {
            setIsResetting(null);
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <p className="text-zinc-400 text-sm">Administra las cuentas de tus colaboradores.</p>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="bg-[#8CC63F] hover:bg-[#3EAE49] text-[#121D38] px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition"
                >
                    {isAdding ? 'Cancelar' : <><Plus className="w-4 h-4" /> Nuevo Colaborador</>}
                </button>
            </div>

            {isAdding && (
                <form onSubmit={handleCreate} className="bg-black/20 p-4 rounded-xl mb-6 border border-white/5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Nombre Completo</label>
                            <input required value={newName} onChange={e => setNewName(e.target.value)} type="text" className="w-full bg-[#1C2D54] border border-white/10 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#8CC63F] outline-none" placeholder="Ej. Ana Silva" />
                        </div>
                        <div>
                            <label className="text-xs text-zinc-400 block mb-1">Correo Electrónico</label>
                            <input required value={newEmail} onChange={e => setNewEmail(e.target.value)} type="email" className="w-full bg-[#1C2D54] border border-white/10 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#8CC63F] outline-none" placeholder="ana@empresa.com" />
                        </div>
                    </div>
                    {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
                    <button disabled={isLoading} type="submit" className="w-full bg-white text-black hover:bg-zinc-200 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50">
                        {isLoading ? 'Creando...' : 'Crear Colaborador (Clave será 123456)'}
                    </button>
                </form>
            )}

            {isFetchingWorkers ? (
                <div className="text-center py-8 text-zinc-500 text-sm">
                    Cargando colaboradores desde la base de datos...
                </div>
            ) : (
                <div className="space-y-3">
                    {workers.map(worker => (
                        <div key={worker.id} className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/50 border border-white/5 hover:bg-zinc-900 transition group">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#8CC63F]/20 text-[#8CC63F] flex items-center justify-center font-bold">
                                    {worker.name.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-medium text-sm text-zinc-200">{worker.name}</p>
                                    <div className="flex items-center gap-1 text-xs text-zinc-500">
                                        <Mail className="w-3 h-3" /> {worker.email}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleResetPassword(worker.id, worker.name)}
                                    disabled={isResetting === worker.id}
                                    title="Forzar reinicio de contraseña"
                                    className="p-2 text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition disabled:opacity-50"
                                >
                                    {isResetting === worker.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                                </button>
                                <button onClick={() => handleDelete(worker.id)} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {workers.length === 0 && (
                        <div className="text-center py-8 text-zinc-500 text-sm">
                            No hay colaboradores registrados.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
