'use client';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Mail, Lock, UserCheck, KeyRound, Loader2, PlayCircle, PauseCircle, ShieldCheck, Search, Users, Glasses } from 'lucide-react';

type Worker = {
    id: string;
    name: string;
    email: string;
    is_suspended?: boolean;
    role?: string;
};

const ROLE_OPTIONS = [
    { value: 'colaborador', label: 'Colaborador' },
    { value: 'revisor', label: 'Revisor' },
    { value: 'admin', label: 'Administrador' },
];

export default function UserCrud({ readOnly = false }: { readOnly?: boolean }) {
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingWorkers, setIsFetchingWorkers] = useState(true);
    const [error, setError] = useState('');
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [isResetting, setIsResetting] = useState<string | null>(null);
    const [isToggling, setIsToggling] = useState<string | null>(null);
    const [isTogglingRole, setIsTogglingRole] = useState<string | null>(null);

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

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro de que deseas ELIMINAR permanentemente a ${name}? Esta acción no se puede deshacer.`)) return;

        try {
            const res = await fetch(`/api/admin/workers/${id}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al eliminar usuario');
            }

            // Actualizar la lista en el frontend solo si el backend confirmó la eliminación
            setWorkers(workers.filter(w => w.id !== id));
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        }
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

    const handleToggleStatus = async (id: string, name: string) => {
        setIsToggling(id);
        try {
            const res = await fetch(`/api/admin/workers/${id}/toggle-status`, {
                method: 'POST',
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Error al cambiar estado del colaborador');

            // Update local state without refetching fully
            setWorkers(workers.map(w =>
                w.id === id ? { ...w, is_suspended: data.is_suspended } : w
            ));

        } catch (err: any) {
            console.error(err);
            alert("Falló el cambio de estado: " + err.message);
        } finally {
            setIsToggling(null);
        }
    };

    const handleSetRole = async (id: string, name: string, newRole: string) => {
        const label = ROLE_OPTIONS.find(r => r.value === newRole)?.label || newRole;
        if (!confirm(`¿Cambiar el rol de ${name} a "${label}"?`)) return;

        setIsTogglingRole(id);
        try {
            const res = await fetch(`/api/admin/workers/${id}/set-role`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Error al cambiar rol del usuario');

            setWorkers(workers.map(w =>
                w.id === id ? { ...w, role: data.role } : w
            ));

        } catch (err: any) {
            console.error(err);
            alert("Falló el cambio de rol: " + err.message);
        } finally {
            setIsTogglingRole(null);
        }
    };

    const filteredWorkers = workers.filter(w =>
        w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalWorkers = workers.length;
    const activeWorkers = workers.filter(w => !w.is_suspended).length;
    const adminWorkers = workers.filter(w => w.role === 'admin').length;
    const revisorWorkers = workers.filter(w => w.role === 'revisor').length;

    return (
        <div>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-[#1C2D54]/40 border border-[#8CC63F]/15 rounded-2xl p-5 shadow-xl flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Colaboradores</p>
                        <p className="text-2xl font-black text-white">{totalWorkers}</p>
                        <p className="text-[10px] text-zinc-500">Total registrados</p>
                    </div>
                    <div className="p-3 bg-[#8CC63F]/10 rounded-xl text-[#8CC63F] shrink-0">
                        <Users className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-[#1C2D54]/40 border border-emerald-500/15 rounded-2xl p-5 shadow-xl flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Activos</p>
                        <p className="text-2xl font-black text-emerald-400">{activeWorkers}</p>
                        <p className="text-[10px] text-zinc-500">
                            {totalWorkers - activeWorkers > 0 ? `${totalWorkers - activeWorkers} suspendido(s)` : 'Sin suspendidos'}
                        </p>
                    </div>
                    <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 shrink-0">
                        <PlayCircle className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-[#1C2D54]/40 border border-blue-500/15 rounded-2xl p-5 shadow-xl flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Administradores</p>
                        <p className="text-2xl font-black text-blue-400">{adminWorkers}</p>
                        <p className="text-[10px] text-zinc-500">Con acceso al panel admin</p>
                    </div>
                    <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 shrink-0">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-[#1C2D54]/40 border border-purple-500/15 rounded-2xl p-5 shadow-xl flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Revisores</p>
                        <p className="text-2xl font-black text-purple-400">{revisorWorkers}</p>
                        <p className="text-[10px] text-zinc-500">Solo lectura e informes</p>
                    </div>
                    <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 shrink-0">
                        <Glasses className="w-6 h-6" />
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <p className="text-zinc-400 text-sm">Administra las cuentas de tus colaboradores.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto items-stretch sm:items-center">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                            type="text"
                            placeholder="Buscar colaborador..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-[#1C2D54] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#8CC63F] text-zinc-200"
                        />
                    </div>
                    {!readOnly && (
                        <button
                            onClick={() => setIsAdding(!isAdding)}
                            className="bg-[#8CC63F] hover:bg-[#3EAE49] text-[#121D38] px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition whitespace-nowrap"
                        >
                            {isAdding ? 'Cancelar' : <><Plus className="w-4 h-4" /> Nuevo Colaborador</>}
                        </button>
                    )}
                </div>
            </div>

            {!readOnly && isAdding && (
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
                    {filteredWorkers.map(worker => (
                        <div key={worker.id} className="flex items-center justify-between p-4 rounded-xl bg-zinc-900/50 border border-white/5 hover:bg-zinc-900 transition group">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#8CC63F]/20 text-[#8CC63F] flex items-center justify-center font-bold">
                                    {worker.name.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-medium text-sm text-zinc-200">{worker.name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <div className="flex items-center gap-1 text-xs text-zinc-500">
                                            <Mail className="w-3 h-3" /> {worker.email}
                                        </div>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${worker.is_suspended ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-green-500/20 text-green-400 border border-green-500/30'}`}>
                                            {worker.is_suspended ? 'Suspendido' : 'Activo'}
                                        </span>
                                        {worker.role === 'admin' && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                                                <ShieldCheck className="w-3 h-3" /> Admin
                                            </span>
                                        )}
                                        {worker.role === 'revisor' && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-1">
                                                <Glasses className="w-3 h-3" /> Revisor
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {readOnly ? null : (
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <select
                                        value={worker.role || 'colaborador'}
                                        onChange={(e) => handleSetRole(worker.id, worker.name, e.target.value)}
                                        disabled={isTogglingRole === worker.id}
                                        title="Cambiar rol"
                                        className="bg-[#1C2D54] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-[#8CC63F] disabled:opacity-50"
                                    >
                                        {ROLE_OPTIONS.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => handleToggleStatus(worker.id, worker.name)}
                                        disabled={isToggling === worker.id}
                                        title={worker.is_suspended ? "Reactivar acceso" : "Suspender acceso"}
                                        className={`p-2 rounded-lg transition disabled:opacity-50 ${worker.is_suspended
                                            ? 'text-green-500 hover:text-green-400 hover:bg-green-500/10'
                                            : 'text-orange-500 hover:text-orange-400 hover:bg-orange-500/10'
                                            }`}
                                    >
                                        {isToggling === worker.id ? <Loader2 className="w-4 h-4 animate-spin" /> :
                                            worker.is_suspended ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={() => handleResetPassword(worker.id, worker.name)}
                                        disabled={isResetting === worker.id}
                                        title="Forzar reinicio de contraseña"
                                        className="p-2 text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition disabled:opacity-50"
                                    >
                                        {isResetting === worker.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                                    </button>
                                    <button onClick={() => handleDelete(worker.id, worker.name)} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition" title="Eliminar Trabajador">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                    {filteredWorkers.length === 0 && (
                        <div className="text-center py-8 text-zinc-500 text-sm">
                            {searchTerm ? 'No se encontraron colaboradores que coincidan con la búsqueda.' : 'No hay colaboradores registrados.'}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
