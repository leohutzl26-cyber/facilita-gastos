'use client';
import { useState, useEffect } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import {
    TrendingUp, PieChart as PieChartIcon, FileText, CheckCircle,
    Clock, XCircle, Filter, Download, CreditCard
} from 'lucide-react';

export default function AdminDashboardCharts() {
    const [receipts, setReceipts] = useState<any[]>([]);
    const [workers, setWorkers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [filterWorker, setFilterWorker] = useState('');
    const [filterDocumentType, setFilterDocumentType] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [selectedStatusTab, setSelectedStatusTab] = useState('todos');

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [resReceipts, resWorkers] = await Promise.all([
                    fetch('/api/admin/receipts'),
                    fetch('/api/admin/workers')
                ]);
                const dataReceipts = await resReceipts.json();
                const dataWorkers = await resWorkers.json();

                if (resReceipts.ok && dataReceipts.receipts) {
                    setReceipts(dataReceipts.receipts);
                }
                if (resWorkers.ok && dataWorkers.workers) {
                    setWorkers(dataWorkers.workers);
                }
            } catch (err) {
                console.error("Error fetching data for charts", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    // Helper: Map email to worker name
    const getWorkerName = (email: string) => {
        if (!email) return 'Desconocido';
        const worker = workers.find(w => w.email === email);
        return worker && worker.name ? worker.name : email.split('@')[0];
    };

    // Filter logic 1: KPIs Filter (ignoring selectedStatusTab to keep all counts visible)
    const kpiFilteredReceipts = receipts.filter(r => {
        const matchSearch = !searchTerm ||
            (r.merchant && r.merchant.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (r.category && r.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (r.projects && r.projects.name && r.projects.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (r.worker_email && r.worker_email.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchCategory = !filterCategory || r.category === filterCategory;
        const matchProject = !filterProject || r.project_id === filterProject;
        const matchWorker = !filterWorker || getWorkerName(r.worker_email) === filterWorker;
        const matchDocType = !filterDocumentType || (r.document_type || 'boleta').toLowerCase() === filterDocumentType.toLowerCase();

        let matchDate = true;
        if (filterStartDate) {
            matchDate = matchDate && new Date(r.date) >= new Date(filterStartDate);
        }
        if (filterEndDate) {
            matchDate = matchDate && new Date(r.date) <= new Date(filterEndDate);
        }

        return matchSearch && matchCategory && matchProject && matchWorker && matchDocType && matchDate;
    });

    // Filter logic 2: Charts Filter (KPI Filtered + Selected Status Tab)
    const filteredReceipts = kpiFilteredReceipts.filter(r => {
        if (selectedStatusTab === 'aprobados') {
            return r.status === 'Aprobado por Supervisor';
        } else if (selectedStatusTab === 'reembolsados') {
            return r.status === 'Reembolsado';
        } else if (selectedStatusTab === 'pendientes') {
            return r.status === 'Pendiente' || r.status === 'Por Visar' || !r.status;
        } else if (selectedStatusTab === 'rechazados') {
            return r.status === 'Rechazado';
        }
        return true;
    });

    // Extract unique values for filtering dropdowns dynamically from all loaded data
    const uniqueWorkerNames = Array.from(new Set(receipts.map(r => getWorkerName(r.worker_email)).filter(Boolean))) as string[];
    const uniqueProjects = Array.from(new Map(receipts.filter(r => r.projects).map(r => [r.project_id, r.projects])).values()) as any[];
    const uniqueCategories = Array.from(new Set(receipts.map(r => r.category).filter(Boolean))) as string[];
    const uniqueDocTypes = Array.from(new Set(receipts.map(r => (r.document_type || 'boleta').toLowerCase()).filter(Boolean))) as string[];

    // KPI Calculations
    const totalApproved = kpiFilteredReceipts
        .filter(r => r.status === 'Aprobado por Supervisor')
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const totalReimbursed = kpiFilteredReceipts
        .filter(r => r.status === 'Reembolsado')
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const totalPending = kpiFilteredReceipts
        .filter(r => r.status === 'Pendiente' || r.status === 'Por Visar' || !r.status)
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const totalRejected = kpiFilteredReceipts
        .filter(r => r.status === 'Rechazado')
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const totalDocsCount = kpiFilteredReceipts.length;

    // Export to CSV function
    const handleExportCSV = () => {
        const headers = ["Fecha", "Proveedor", "Categoria", "Proyecto", "Colaborador", "Monto", "Estado", "Tipo Documento"];
        
        const rows = filteredReceipts.map(r => {
            const dateStr = r.date ? new Date(r.date).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : 'N/A';
            const merchant = r.merchant || 'N/A';
            const category = r.category || 'N/A';
            const project = r.projects?.name || 'N/A';
            const worker = getWorkerName(r.worker_email);
            const amount = r.amount || 0;
            const status = r.status || 'Pendiente';
            const docType = r.document_type || 'boleta';

            return [
                `"${dateStr.replace(/"/g, '""')}"`,
                `"${merchant.replace(/"/g, '""')}"`,
                `"${category.replace(/"/g, '""')}"`,
                `"${project.replace(/"/g, '""')}"`,
                `"${worker.replace(/"/g, '""')}"`,
                amount,
                `"${status.replace(/"/g, '""')}"`,
                `"${docType.replace(/"/g, '""')}"`
            ].join(';');
        });

        const csvContent = "\uFEFF" + [headers.join(';'), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `reporte_gastos_dashboard_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (isLoading) {
        return (
            <div className="h-96 flex flex-col items-center justify-center text-zinc-500 border border-white/5 rounded-2xl bg-[#1C2D54]/40 animate-pulse gap-3">
                <Filter className="w-8 h-8 text-[#8CC63F] animate-spin" />
                <span className="text-sm font-semibold">Cargando métricas analíticas...</span>
            </div>
        );
    }

    // --- Data Processing for BarChart (Gastos por Mes) ---
    const monthlyDataMap = new Map<string, { total: number, count: number }>();
    const shouldExcludeRechazados = selectedStatusTab !== 'rechazados';

    filteredReceipts.forEach(r => {
        if (!r.amount || !r.date) return;
        if (shouldExcludeRechazados && r.status === 'Rechazado') return;

        const dateObj = new Date(r.date);
        const monthKey = `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}`;

        const current = monthlyDataMap.get(monthKey) || { total: 0, count: 0 };
        monthlyDataMap.set(monthKey, {
            total: current.total + Number(r.amount),
            count: current.count + 1
        });
    });

    const monthlyData = Array.from(monthlyDataMap, ([month, data]) => ({
        month,
        total: data.total,
        count: data.count
    })).sort((a, b) => a.month.localeCompare(b.month));


    // --- Data Processing for PieChart (Gastos por Categoría) ---
    const categoryDataMap = new Map<string, { total: number, count: number }>();
    filteredReceipts.forEach(r => {
        if (!r.amount || !r.category) return;
        if (shouldExcludeRechazados && r.status === 'Rechazado') return;

        const current = categoryDataMap.get(r.category) || { total: 0, count: 0 };
        categoryDataMap.set(r.category, {
            total: current.total + Number(r.amount),
            count: current.count + 1
        });
    });

    const categoryData = Array.from(categoryDataMap, ([name, data]) => ({
        name,
        value: data.total,
        count: data.count
    })).sort((a, b) => b.value - a.value);


    // --- Data Processing for PieChart (Gastos por Tipo de Documento) ---
    const documentTypeDataMap = new Map<string, { total: number, count: number }>();
    filteredReceipts.forEach(r => {
        if (!r.amount || !r.document_type) return;
        if (shouldExcludeRechazados && r.status === 'Rechazado') return;

        const type = r.document_type.charAt(0).toUpperCase() + r.document_type.slice(1);
        const current = documentTypeDataMap.get(type) || { total: 0, count: 0 };
        documentTypeDataMap.set(type, {
            total: current.total + Number(r.amount),
            count: current.count + 1
        });
    });

    const documentTypeData = Array.from(documentTypeDataMap, ([name, data]) => ({
        name,
        value: data.total,
        count: data.count
    })).sort((a, b) => b.value - a.value);

    // Chart Colors
    const COLORS = ['#8CC63F', '#3EAE49', '#4DAFD6', '#F5A623', '#D0021B', '#9B9B9B', '#1C2D54'];

    // Custom Tooltip
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const value = payload[0].value;
            const name = payload[0].name || data.month || data.name;
            return (
                <div className="bg-[#121D38] border border-[#8CC63F] p-3 rounded-xl shadow-xl text-xs space-y-1">
                    <p className="font-bold text-white uppercase tracking-wider">{name}</p>
                    <p className="text-[#8CC63F] font-semibold">Total: ${Number(value).toLocaleString('es-CL')}</p>
                    <p className="text-zinc-400">Cantidad: {data.count} {data.count === 1 ? 'documento' : 'documentos'}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6">
            {/* Filters Row */}
            <div className="bg-[#1C2D54]/50 p-4 rounded-xl border border-white/5 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-[#8CC63F]" />
                        <h3 className="font-semibold text-sm text-zinc-200">Filtros de Analíticas</h3>
                    </div>
                    <button
                        onClick={handleExportCSV}
                        disabled={filteredReceipts.length === 0}
                        className="flex items-center gap-2 px-3 py-1.5 bg-[#8CC63F]/20 hover:bg-[#8CC63F]/30 border border-[#8CC63F]/30 hover:border-[#8CC63F]/50 text-[#8CC63F] text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
                        title="Exportar a Excel/CSV"
                    >
                        <Download className="w-4 h-4" />
                        Exportar CSV ({filteredReceipts.length})
                    </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    <div className="flex flex-col">
                        <label className="text-[10px] text-zinc-400 mb-1 uppercase tracking-wider">Búsqueda rápida</label>
                        <input
                            type="text"
                            placeholder="Ej: Copec..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-[#1C2D54] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200"
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] text-zinc-400 mb-1 uppercase tracking-wider">Desde (Fecha)</label>
                        <input
                            type="date"
                            value={filterStartDate}
                            onChange={(e) => setFilterStartDate(e.target.value)}
                            className="bg-[#1C2D54] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200"
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] text-zinc-400 mb-1 uppercase tracking-wider">Hasta (Fecha)</label>
                        <input
                            type="date"
                            value={filterEndDate}
                            onChange={(e) => setFilterEndDate(e.target.value)}
                            className="bg-[#1C2D54] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200"
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] text-zinc-400 mb-1 uppercase tracking-wider">Colaborador</label>
                        <select
                            value={filterWorker}
                            onChange={(e) => setFilterWorker(e.target.value)}
                            className="bg-[#1C2D54] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200"
                        >
                            <option value="">Todos</option>
                            {uniqueWorkerNames.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] text-zinc-400 mb-1 uppercase tracking-wider">Proyecto</label>
                        <select
                            value={filterProject}
                            onChange={(e) => setFilterProject(e.target.value)}
                            className="bg-[#1C2D54] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200"
                        >
                            <option value="">Todos</option>
                            {uniqueProjects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] text-zinc-400 mb-1 uppercase tracking-wider">Categoría</label>
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="bg-[#1C2D54] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200"
                        >
                            <option value="">Todas</option>
                            {uniqueCategories.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Status Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-white/5 pb-4">
                <button
                    onClick={() => setSelectedStatusTab('todos')}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        selectedStatusTab === 'todos'
                            ? 'bg-[#8CC63F]/10 border-[#8CC63F] text-[#8CC63F]'
                            : 'border-white/10 text-zinc-400 hover:text-white'
                    }`}
                >
                    Todos los Estados
                </button>
                <button
                    onClick={() => setSelectedStatusTab('aprobados')}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        selectedStatusTab === 'aprobados'
                            ? 'bg-blue-500/10 border-blue-500 text-blue-400'
                            : 'border-white/10 text-zinc-400 hover:text-white'
                    }`}
                >
                    Solo Aprobados
                </button>
                <button
                    onClick={() => setSelectedStatusTab('reembolsados')}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        selectedStatusTab === 'reembolsados'
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                            : 'border-white/10 text-zinc-400 hover:text-white'
                    }`}
                >
                    Solo Pagados/Reembolsados
                </button>
                <button
                    onClick={() => setSelectedStatusTab('pendientes')}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        selectedStatusTab === 'pendientes'
                            ? 'bg-yellow-500/10 border-yellow-500 text-yellow-400'
                            : 'border-white/10 text-zinc-400 hover:text-white'
                    }`}
                >
                    Solo Pendientes
                </button>
                <button
                    onClick={() => setSelectedStatusTab('rechazados')}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        selectedStatusTab === 'rechazados'
                            ? 'bg-red-500/10 border-red-500 text-red-400'
                            : 'border-white/10 text-zinc-400 hover:text-white'
                    }`}
                >
                    Solo Rechazados
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* Aprobados Card */}
                <div className="bg-[#1C2D54]/40 border border-blue-500/15 rounded-2xl p-5 shadow-xl flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Monto Aprobado</p>
                        <p className="text-2xl font-black text-blue-400">${totalApproved.toLocaleString('es-CL')}</p>
                        <p className="text-[10px] text-zinc-500">Aprobado por supervisor</p>
                    </div>
                    <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 shrink-0">
                        <CheckCircle className="w-6 h-6" />
                    </div>
                </div>

                {/* Reembolsados Card */}
                <div className="bg-[#1C2D54]/40 border border-emerald-500/15 rounded-2xl p-5 shadow-xl flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Monto Reembolsado</p>
                        <p className="text-2xl font-black text-emerald-400">${totalReimbursed.toLocaleString('es-CL')}</p>
                        <p className="text-[10px] text-zinc-500">Monto pagado/reembolsado</p>
                    </div>
                    <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 shrink-0">
                        <CreditCard className="w-6 h-6" />
                    </div>
                </div>

                {/* Pendientes Card */}
                <div className="bg-[#1C2D54]/40 border border-yellow-500/15 rounded-2xl p-5 shadow-xl flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Monto Pendiente</p>
                        <p className="text-2xl font-black text-yellow-400">${totalPending.toLocaleString('es-CL')}</p>
                        <p className="text-[10px] text-zinc-500">En revisión de supervisor</p>
                    </div>
                    <div className="p-3 bg-yellow-500/10 rounded-xl text-yellow-400 shrink-0">
                        <Clock className="w-6 h-6" />
                    </div>
                </div>

                {/* Rechazados Card */}
                <div className="bg-[#1C2D54]/40 border border-red-500/15 rounded-2xl p-5 shadow-xl flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Monto Rechazado</p>
                        <p className="text-2xl font-black text-red-400">${totalRejected.toLocaleString('es-CL')}</p>
                        <p className="text-[10px] text-zinc-500">Rechazados por auditoría</p>
                    </div>
                    <div className="p-3 bg-red-500/10 rounded-xl text-red-400 shrink-0">
                        <XCircle className="w-6 h-6" />
                    </div>
                </div>

                {/* Total Docs Card */}
                <div className="bg-[#1C2D54]/40 border border-[#8CC63F]/15 rounded-2xl p-5 shadow-xl flex items-center justify-between gap-4 col-span-2 md:col-span-1">
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Total Documentos</p>
                        <p className="text-2xl font-black text-[#8CC63F]">{totalDocsCount}</p>
                        <p className="text-[10px] text-zinc-500">Documentos registrados</p>
                    </div>
                    <div className="p-3 bg-[#8CC63F]/10 rounded-xl text-[#8CC63F] shrink-0">
                        <FileText className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Gráfico de Barras: Gastos Mensuales */}
                <div className="bg-[#1C2D54]/40 border border-[#8CC63F]/10 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingUp className="w-5 h-5 text-[#8CC63F]" />
                        <h2 className="text-lg font-semibold text-zinc-100">Gastos Mensuales</h2>
                    </div>
                    <div className="h-[300px] w-full">
                        {monthlyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="month" stroke="#a1a1aa" fontSize={11} tickLine={false} />
                                    <YAxis stroke="#a1a1aa" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value.toLocaleString()}`} />
                                    <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                    <Bar dataKey="total" fill="#8CC63F" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-zinc-500 text-xs">Sin datos para graficar</div>
                        )}
                    </div>
                </div>

                {/* Gráfico Circular: Por Categoría */}
                <div className="bg-[#1C2D54]/40 border border-[#8CC63F]/10 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center gap-2 mb-6">
                        <PieChartIcon className="w-5 h-5 text-[#3EAE49]" />
                        <h2 className="text-lg font-semibold text-zinc-100">Distribución por Categoría</h2>
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
                                    <RechartsTooltip content={<CustomTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: '10px', color: '#a1a1aa' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-zinc-500 text-xs">Sin datos para graficar</div>
                        )}
                    </div>
                </div>

                {/* Gráfico Circular: Por Tipo de Documento */}
                <div className="bg-[#1C2D54]/40 border border-[#8CC63F]/10 rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center gap-2 mb-6">
                        <FileText className="w-5 h-5 text-[#4DAFD6]" />
                        <h2 className="text-lg font-semibold text-zinc-100">Por Documento</h2>
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
                                    <RechartsTooltip content={<CustomTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: '10px', color: '#a1a1aa' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-zinc-500 text-xs">Sin datos para graficar</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

