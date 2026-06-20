'use client';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, RefreshCw, Folder, Edit2, X, Search, PauseCircle, PlayCircle } from 'lucide-react';

interface Project {
    id: string;
    name: string;
    description: string;
    created_at: string;
    active: boolean;
}

export default function ProjectCrud() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [editingProject, setEditingProject] = useState<Project | null>(null);

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
            if (editingProject) {
                // Modo Edición
                const res = await fetch(`/api/admin/projects/${editingProject.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, description })
                });
                const data = await res.json();

                if (res.ok && data.project) {
                    setProjects(projects.map(p => p.id === editingProject.id ? data.project : p));
                    setName('');
                    setDescription('');
                    setEditingProject(null);
                } else {
                    alert(data.error || "Error editando proyecto");
                }
            } else {
                // Modo Creación
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
                if (editingProject?.id === id) {
                    handleCancelEdit();
                }
            } else {
                const data = await res.json();
                alert(data.error || "Error eliminando proyecto");
            }
        } catch (error) {
            console.error("Error deleting project:", error);
        }
    };

    const handleStartEdit = (project: Project) => {
        setEditingProject(project);
        setName(project.name);
        setDescription(project.description || '');
    };

    const handleCancelEdit = () => {
        setEditingProject(null);
        setName('');
        setDescription('');
    };

    const handleToggleActive = async (project: Project) => {
        setTogglingId(project.id);
        try {
            const res = await fetch(`/api/admin/projects/${project.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ active: !project.active, name: project.name })
            });
            const data = await res.json();
            if (res.ok && data.project) {
                setProjects(projects.map(p => p.id === project.id ? data.project : p));
            } else {
                alert(data.error || "Error al cambiar el estado del proyecto");
            }
        } catch (error) {
            console.error("Error toggling project status:", error);
        } finally {
            setTogglingId(null);
        }
    };

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="bg-[#1C2D54]/40 border border-[#8CC63F]/10 rounded-2xl p-6 shadow-xl flex flex-col h-full">
            <div className="flex items-center justify-end mb-4">
                <button
                    onClick={fetchProjects}
                    className="p-2 text-zinc-400 hover:text-white transition rounded-lg hover:bg-white/5"
                    title="Actualizar"
                >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Crear / Editar Form */}
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
                <div className="flex gap-2">
                    {editingProject && (
                        <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="w-1/3 bg-zinc-600 hover:bg-zinc-700 text-white py-2 rounded-lg font-bold text-sm transition flex items-center justify-center gap-1"
                        >
                            <X className="w-4 h-4" /> Cancelar
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={isSubmitting || !name}
                        className={`${editingProject ? 'w-2/3 bg-amber-500 hover:bg-amber-600 text-[#121D38]' : 'w-full bg-[#8CC63F] hover:bg-[#3EAE49] text-[#121D38]'} py-2 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 disabled:opacity-50`}
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : editingProject ? (
                            <><Edit2 className="w-4 h-4" /> Guardar</>
                        ) : (
                            <><Plus className="w-4 h-4" /> Agregar Proyecto</>
                        )}
                    </button>
                </div>
            </form>

            {/* Buscador */}
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                    type="text"
                    placeholder="Buscar proyecto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-[#1C2D54] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#8CC63F] text-zinc-200"
                />
            </div>

            {/* Listado */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-2 min-h-[200px] max-h-[300px] custom-scrollbar">
                {isLoading && projects.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-zinc-400">
                        <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                ) : filteredProjects.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-zinc-500 text-sm italic">
                        {searchTerm ? 'No se encontraron proyectos para la búsqueda.' : 'No hay proyectos registrados aún.'}
                    </div>
                ) : (
                    filteredProjects.map(project => (
                        <div key={project.id} className="bg-black/30 border border-white/5 rounded-lg p-3 flex items-center justify-between group hover:border-white/10 transition">
                            <div className="flex-1 min-w-0 pr-2">
                                <div className="flex items-center gap-2">
                                    <p className="font-medium text-sm text-zinc-200 truncate">{project.name}</p>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${project.active !== false ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30'}`}>
                                        {project.active !== false ? 'Activo' : 'Cerrado'}
                                    </span>
                                </div>
                                {project.description && (
                                    <p className="text-xs text-zinc-500 truncate">{project.description}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                                <button
                                    onClick={() => handleToggleActive(project)}
                                    disabled={togglingId === project.id}
                                    className={`p-1.5 rounded-md transition ${project.active !== false ? 'text-zinc-500 hover:text-orange-400 hover:bg-[#121D38]/40' : 'text-zinc-500 hover:text-green-400 hover:bg-[#121D38]/40'}`}
                                    title={project.active !== false ? "Cerrar proyecto" : "Activar proyecto"}
                                >
                                    {togglingId === project.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : project.active !== false ? (
                                        <PauseCircle className="w-4 h-4" />
                                    ) : (
                                        <PlayCircle className="w-4 h-4" />
                                    )}
                                </button>
                                <button
                                    onClick={() => handleStartEdit(project)}
                                    className="p-1.5 text-zinc-500 hover:text-amber-400 rounded-md hover:bg-amber-400/10"
                                    title="Editar proyecto"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(project.id, project.name)}
                                    className="p-1.5 text-zinc-500 hover:text-red-400 rounded-md hover:bg-red-400/10"
                                    title="Eliminar proyecto"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
