'use client';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, RefreshCw, Folder } from 'lucide-react';

interface Project {
    id: string;
    name: string;
    description: string;
    created_at: string;
    active: boolean;
}

export default function ProjectCrud() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    const fetchProjects = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/projects');
            const data = await res.json();
            if (data.projects) setProjects(data.projects);
        } catch (error) {
            console.error("Error fetching projects:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/admin/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description })
            });
            const data = await res.json();

            if (res.ok && data.project) {
                setProjects([data.project, ...projects]);
                setName('');
                setDescription('');
            } else {
                alert(data.error || "Error creando proyecto");
            }
        } catch (error) {
            console.error("Error saving project:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string, projectName: string) => {
        if (!confirm(`¿Estás seguro de eliminar el proyecto "${projectName}"?`)) return;

        try {
            const res = await fetch(`/api/admin/projects/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setProjects(projects.filter(p => p.id !== id));
            } else {
                const data = await res.json();
                alert(data.error || "Error eliminando proyecto");
            }
        } catch (error) {
            console.error("Error deleting project:", error);
        }
    };

    return (
        <div className="bg-[#1C2D54]/40 border border-[#8CC63F]/10 rounded-2xl p-6 shadow-xl flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <Folder className="w-5 h-5 text-[#8CC63F]" />
                    <h2 className="text-xl font-semibold">Proyectos y Clientes</h2>
                </div>
                <button
                    onClick={fetchProjects}
                    className="p-2 text-zinc-400 hover:text-white transition rounded-lg hover:bg-white/5"
                    title="Actualizar"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Crear Form */}
            <form onSubmit={handleSubmit} className="mb-6 space-y-3 bg-black/20 p-4 rounded-xl border border-white/5">
                <div>
                    <input
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nombre del Proyecto o Cliente"
                        className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#8CC63F]/50"
                    />
                </div>
                <div>
                    <input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Descripción u orden de compra (Opcional)"
                        className="w-full bg-black/40 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#8CC63F]/50"
                    />
                </div>
                <button
                    type="submit"
                    disabled={isSubmitting || !name}
                    className="w-full bg-[#8CC63F] hover:bg-[#3EAE49] text-[#121D38] py-2 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Agregar Proyecto</>}
                </button>
            </form>

            {/* Listado */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-2 min-h-[200px] max-h-[300px] custom-scrollbar">
                {isLoading && projects.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-zinc-400">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                ) : projects.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-zinc-500 text-sm italic">
                        No hay proyectos registrados aún.
                    </div>
                ) : (
                    projects.map(project => (
                        <div key={project.id} className="bg-black/30 border border-white/5 rounded-lg p-3 flex items-center justify-between group hover:border-white/10 transition">
                            <div>
                                <p className="font-medium text-sm text-zinc-200">{project.name}</p>
                                {project.description && (
                                    <p className="text-xs text-zinc-500 truncate max-w-[180px]">{project.description}</p>
                                )}
                            </div>
                            <button
                                onClick={() => handleDelete(project.id, project.name)}
                                className="p-2 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-md hover:bg-red-400/10"
                                title="Eliminar proyecto"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
