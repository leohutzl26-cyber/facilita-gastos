'use client';
import { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Edit2, Loader2, AlertTriangle, AlertCircle } from 'lucide-react';

type Category = {
    id: string;
    name: string;
    color?: string;
    max_amount_alert?: number;
};

export default function CategoryCrud() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [error, setError] = useState('');
    
    const [newName, setNewName] = useState('');
    const [newMaxAmount, setNewMaxAmount] = useState<string>('');

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        setIsFetching(true);
        try {
            const res = await fetch('/api/admin/categories');
            const data = await res.json();
            if (res.ok && data.categories) {
                setCategories(data.categories);
            }
        } catch (err) {
            console.error('Failed to fetch categories:', err);
        } finally {
            setIsFetching(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        const amountNum = parseFloat(newMaxAmount);

        try {
            const res = await fetch('/api/admin/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: newName, 
                    color: '#8CC63F', // Default green
                    max_amount_alert: isNaN(amountNum) || amountNum <= 0 ? null : amountNum 
                })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Error al crear categoría');

            setCategories([...categories, data.category]);
            setIsAdding(false);
            setNewName('');
            setNewMaxAmount('');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        // En una app real de base de datos relacional, borrar categorías usadas romperá recibos si no hay CASCADE o SET NULL.
        // Asumiendo que es preventivo:
        if (!confirm(`¿Estás seguro de que deseas ELIMINAR la categoría '${name}'? Si hay gastos vinculados, prodrían quedar sin categoría.`)) return;

        try {
            const res = await fetch(`/api/admin/categories/${id}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al eliminar categoría');
            }

            setCategories(categories.filter(c => c.id !== id));
        } catch (err: any) {
            alert(`Error: ${err.message}`);
        }
    };

    return (
        <div className="bg-[#1C2D54]/40 border border-[#8CC63F]/10 rounded-2xl p-6 shadow-xl h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-[#8CC63F]" />
                    <h2 className="text-xl font-semibold text-zinc-100">Categorías y Alertas</h2>
                </div>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="p-2 bg-[#8CC63F]/10 text-[#8CC63F] hover:bg-[#8CC63F] hover:text-[#121D38] rounded-xl transition"
                    title="Añadir Categoría"
                >
                    {isAdding ? <Settings className="w-4 h-4 transition-transform rotate-90" /> : <Plus className="w-4 h-4" />}
                </button>
            </div>

            {isAdding && (
                <form onSubmit={handleCreate} className="bg-black/20 p-4 rounded-xl mb-4 border border-white/5 space-y-3">
                    <div>
                        <label className="text-[10px] text-zinc-400 mb-1 uppercase tracking-wider block">Nombre Categoría</label>
                        <input required value={newName} onChange={e => setNewName(e.target.value)} type="text" className="w-full bg-[#1C2D54] border border-white/10 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#8CC63F] outline-none text-white" placeholder="Ej. Combustible" />
                    </div>
                    <div>
                        <label className="text-[10px] text-zinc-400 mb-1 uppercase tracking-wider block">Tope Máximo Alerta ($)</label>
                        <div className="flex items-center gap-2">
                            <span className="text-zinc-500">$</span>
                            <input value={newMaxAmount} onChange={e => setNewMaxAmount(e.target.value)} type="number" min="0" className="w-full bg-[#1C2D54] border border-white/10 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-[#8CC63F] outline-none text-white" placeholder="Ej. 15000 (Opcional)" />
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-1">Si el recibo supera este valor, generará una alerta de supervisor al revisar.</p>
                    </div>
                    {error && <p className="text-red-400 text-xs">{error}</p>}
                    <button disabled={isLoading} type="submit" className="w-full bg-[#8CC63F] text-[#121D38] hover:bg-[#3EAE49] py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50">
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Guardar Categoría'}
                    </button>
                </form>
            )}

            <div className="flex-1 overflow-y-auto pr-2 space-y-2 max-h-[300px]">
                {isFetching ? (
                    <div className="text-center py-4 text-zinc-500 text-sm">Cargando categorías...</div>
                ) : categories.length === 0 ? (
                    <div className="text-center py-4 text-zinc-500 text-sm flex flex-col items-center">
                        <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                        No existen categorías definidas
                    </div>
                ) : (
                    categories.map(cat => (
                        <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/40 border border-white/5 hover:bg-zinc-900/80 transition group">
                            <div className="flex flex-col">
                                <span className="font-medium text-sm text-zinc-200">{cat.name}</span>
                                {cat.max_amount_alert ? (
                                    <span className="text-[10px] text-orange-400 flex items-center gap-1 mt-0.5">
                                        <AlertTriangle className="w-3 h-3" /> Tope: ${cat.max_amount_alert.toLocaleString()}
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-zinc-500 mt-0.5">Sin tope de alerta</span>
                                )}
                            </div>
                            <button onClick={() => handleDelete(cat.id, cat.name)} className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition opacity-0 group-hover:opacity-100" title="Eliminar">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
