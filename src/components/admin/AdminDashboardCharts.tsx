'use client';
import { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, PieChart as PieChartIcon, FileText } from 'lucide-react';

export default function AdminDashboardCharts() {
    const [receipts, setReceipts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchReceipts = async () => {
            try {
                const res = await fetch('/api/admin/receipts');
                const data = await res.json();
                if (res.ok && data.receipts) {
                    setReceipts(data.receipts);
                }
            } catch (err) {
                console.error("Error fetching receipts for charts", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchReceipts();
    }, []);

    if (isLoading) {
        return (
            <div className="h-64 flex items-center justify-center text-zinc-500 border border-white/5 rounded-2xl bg-[#1C2D54]/40 animate-pulse">
                Cargando métricas...
            </div>
        );
    }

    if (receipts.length === 0) {
        return null; // Return nothing if no data to chart
    }

    // --- Data Processing for BarChart (Gastos por Mes) ---
    // Agrupar por mes-año, ej: "2024-03" -> Monto
    const monthlyDataMap = new Map();
    receipts.forEach(r => {
        if (!r.amount || !r.date || r.status === 'Rechazado') return; // Excluir rechazados
        const dateObj = new Date(r.date);
        const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
        
        const currentAmount = monthlyDataMap.get(monthKey) || 0;
        monthlyDataMap.set(monthKey, currentAmount + Number(r.amount));
    });

    // Convert map to array and sort chronologically
    const monthlyData = Array.from(monthlyDataMap, ([month, total]) => ({ month, total }))
        .sort((a, b) => a.month.localeCompare(b.month));


    // --- Data Processing for PieChart (Gastos por Categoría) ---
    const categoryDataMap = new Map();
    receipts.forEach(r => {
        if (!r.amount || !r.category || r.status === 'Rechazado') return;
        const currentAmount = categoryDataMap.get(r.category) || 0;
        categoryDataMap.set(r.category, currentAmount + Number(r.amount));
    });

    const categoryData = Array.from(categoryDataMap, ([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    // --- Data Processing for MODO DOCUMENTO ---
    const documentTypeDataMap = new Map();
    receipts.forEach(r => {
        if (!r.amount || !r.document_type || r.status === 'Rechazado') return;
        const type = r.document_type.charAt(0).toUpperCase() + r.document_type.slice(1);
        const currentAmount = documentTypeDataMap.get(type) || 0;
        documentTypeDataMap.set(type, currentAmount + Number(r.amount));
    });

    const documentTypeData = Array.from(documentTypeDataMap, ([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    // Colores corporativos y variaciones para el PieChart
    const COLORS = ['#8CC63F', '#3EAE49', '#1C2D54', '#4DAFD6', '#F5A623', '#D0021B', '#9B9B9B'];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8 mt-6">
            {/* Gráfico de Barras: Gastos Mensuales */}
            <div className="bg-[#1C2D54]/40 border border-[#8CC63F]/10 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-2 mb-6">
                    <TrendingUp className="w-5 h-5 text-[#8CC63F]" />
                    <h2 className="text-xl font-semibold text-zinc-100">Gastos Mensuales (Aprobados/Pendientes)</h2>
                </div>
                <div className="h-[300px] w-full">
                    {monthlyData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                                <XAxis dataKey="month" stroke="#a1a1aa" fontSize={12} tickLine={false} />
                                <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value.toLocaleString()}`} />
                                <RechartsTooltip 
                                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                    contentStyle={{ backgroundColor: '#121D38', borderColor: '#8CC63F', color: '#fff', borderRadius: '8px' }}
                                    formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Total']}
                                />
                                <Bar dataKey="total" fill="#8CC63F" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-zinc-500">Sin datos suficientes</div>
                    )}
                </div>
            </div>

            {/* Gráfico Circular: Por Categoría */}
            <div className="bg-[#1C2D54]/40 border border-[#8CC63F]/10 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-2 mb-6">
                    <PieChartIcon className="w-5 h-5 text-[#3EAE49]" />
                    <h2 className="text-xl font-semibold text-zinc-100">Distribución por Categoría</h2>
                </div>
                <div className="h-[300px] w-full">
                    {categoryData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="rgba(0,0,0,0)"
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip 
                                    contentStyle={{ backgroundColor: '#121D38', borderColor: '#8CC63F', color: '#fff', borderRadius: '8px' }}
                                    formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Total']}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px', color: '#a1a1aa' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-zinc-500">Sin datos suficientes</div>
                    )}
                </div>
            </div>

            {/* Gráfico Circular: Por Tipo de Documento */}
            <div className="bg-[#1C2D54]/40 border border-[#8CC63F]/10 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-2 mb-6">
                    <FileText className="w-5 h-5 text-[#4DAFD6]" />
                    <h2 className="text-xl font-semibold text-zinc-100">Por Documento</h2>
                </div>
                <div className="h-[300px] w-full">
                    {documentTypeData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={documentTypeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="rgba(0,0,0,0)"
                                >
                                    {documentTypeData.map((entry, index) => (
                                        <Cell key={`cell-doc-${index}`} fill={COLORS[(index + 3) % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip 
                                    contentStyle={{ backgroundColor: '#121D38', borderColor: '#8CC63F', color: '#fff', borderRadius: '8px' }}
                                    formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Total']}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px', color: '#a1a1aa' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-zinc-500">Sin datos suficientes</div>
                    )}
                </div>
            </div>
        </div>
    );
}
