'use client';
import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@/utils/theme';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import {
    TrendingUp, PieChart as PieChartIcon, FileText, CheckCircle,
    Clock, XCircle, Filter, Download, CreditCard, MousePointerClick
} from 'lucide-react';
import DashboardDrillDown from './DashboardDrillDown';
import ReceiptDetailModal from './ReceiptDetailModal';
import {
    byKeyAsc, byTotalDesc, formatMonth, groupBy, statusGroup,
    type DimKey, type DrillFilters, type Group
} from '@/utils/dashboardDrill';

type KpiId = 'aprobado' | 'reembolsado' | 'pendiente' | 'total' | 'documentos';

// Cada selección viene de un gráfico (sus datos) o de una tarjeta (sus cifras); la
// tarjeta recuerda cuál es para poder marcarla y cerrar el detalle al pincharla de nuevo.
type DrillState = { filters: DrillFilters; lastClicked: DimKey; seq: number; kpi?: KpiId };

const KPI_SCOPE: Record<KpiId, { status?: string; scopeLabel?: string; shareLabel: string }> = {
    aprobado: { status: 'Aprobado', shareLabel: 'del total gasto' },
    reembolsado: { status: 'Reembolsado', shareLabel: 'del total gasto' },
    pendiente: { status: 'Pendiente', shareLabel: 'del total gasto' },
    total: { scopeLabel: 'Total gasto: aprobado + reembolsado + pendiente', shareLabel: 'del total gasto' },
    documentos: { scopeLabel: 'Todos los documentos (incluye rechazados)', shareLabel: 'de los documentos' },
};

export default function AdminDashboardCharts({ readOnly = false, canApprove = false, canManagePayments = false }: { readOnly?: boolean; canApprove?: boolean; canManagePayments?: boolean }) {
    const [receipts, setReceipts] = useState<any[]>([]);
    const [workers, setWorkers] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [drill, setDrill] = useState<DrillState | null>(null);
    const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
    const { theme } = useTheme();
    const chartAxis = theme === 'light' ? '#586174' : '#a1a1aa';
    const chartGrid = theme === 'light' ? 'rgba(21,35,63,0.08)' : 'rgba(255,255,255,0.05)';

    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterProject, setFilterProject] = useState('');
    const [filterWorker, setFilterWorker] = useState('');
    const [filterDocumentType, setFilterDocumentType] = useState('');
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [selectedStatusTab, setSelectedStatusTab] = useState('todos');

    // Recarga los gastos (por ejemplo tras asociar un comprobante desde el detalle) y
    // mantiene sincronizado el modal si está abierto.
    const fetchReceipts = async () => {
        try {
            const res = await fetch('/api/admin/receipts');
            const data = await res.json();
            if (res.ok && data.receipts) {
                setReceipts(data.receipts);
                setSelectedReceipt((prev: any) => prev ? (data.receipts.find((r: any) => r.id === prev.id) || null) : prev);
            }
        } catch (err) {
            console.error("Error fetching receipts", err);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [resReceipts, resWorkers, resCategories] = await Promise.all([
                    fetch('/api/admin/receipts'),
                    fetch('/api/admin/workers'),
                    fetch('/api/admin/categories')
                ]);
                const dataReceipts = await resReceipts.json();
                const dataWorkers = await resWorkers.json();
                const dataCategories = await resCategories.json();

                if (resReceipts.ok && dataReceipts.receipts) {
                    setReceipts(dataReceipts.receipts);
                }
                if (resWorkers.ok && dataWorkers.workers) {
                    setWorkers(dataWorkers.workers);
                }
                if (resCategories.ok && dataCategories.categories) {
                    setCategories(dataCategories.categories);
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
    const drillCtx = useMemo(() => ({ workerName: getWorkerName }), [workers]);

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

    const totalExpense = totalApproved + totalReimbursed + totalPending;

    const totalRejected = kpiFilteredReceipts
        .filter(r => r.status === 'Rechazado')
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const totalDocsCount = kpiFilteredReceipts.length;

    // Documentos que suman en "Total Gasto" (todo menos los rechazados).
    const kpiExpenseRows = kpiFilteredReceipts.filter(r => ['Aprobado', 'Reembolsado', 'Pendiente'].includes(statusGroup(r.status)));

    // Export to CSV function
    const exportCSV = (source: any[], filePrefix: string) => {
        const headers = ["Fecha", "Proveedor", "Categoria", "Proyecto", "Colaborador", "Monto", "Estado", "Tipo Documento"];

        const rows = source.map(r => {
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
        link.setAttribute("download", `${filePrefix}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportCSV = () => exportCSV(filteredReceipts, 'reporte_gastos_dashboard');

    // --- Detalle interactivo: al pinchar un dato de un gráfico se abre el desglose ---
    const handleMainSelect = (dim: DimKey, group: Group | undefined) => {
        if (!group) return;
        setDrill(prev => {
            const alreadyOpen = prev && Object.keys(prev.filters).length === 1 && prev.filters[dim]?.key === group.key;
            if (alreadyOpen) return null; // pinchar de nuevo lo cierra
            return { filters: { [dim]: { key: group.key, label: group.label } }, lastClicked: dim, seq: (prev?.seq ?? 0) + 1 };
        });
    };

    // Al pinchar una tarjeta se abre el detalle de las cifras que muestra.
    const handleKpiSelect = (kpi: KpiId) => {
        setDrill(prev => {
            if (prev?.kpi === kpi && Object.keys(prev.filters).length <= (KPI_SCOPE[kpi].status ? 1 : 0)) return null;
            const status = KPI_SCOPE[kpi].status;
            return {
                filters: status ? { status: { key: status, label: status } } : {},
                lastClicked: 'status',
                seq: (prev?.seq ?? 0) + 1,
                kpi,
            };
        });
    };

    const handleDrillChange = (next: DrillFilters | null, clicked?: DimKey) => {
        setDrill(prev => next === null ? null : { filters: next, lastClicked: clicked ?? prev?.lastClicked ?? 'month', seq: prev?.seq ?? 0, kpi: prev?.kpi });
    };

    const kpiCard = (kpi: KpiId, tone: string) =>
        `text-left w-full bg-card-40 border ${tone} rounded-2xl p-5 shadow-xl flex items-center justify-between gap-4 cursor-pointer transition-all hover:-translate-y-0.5 ${
            drill?.kpi === kpi ? 'ring-2 ring-[#8CC63F]' : ''
        }`;

    if (isLoading) {
        return (
            <div className="h-96 flex flex-col items-center justify-center text-zinc-500 border border-white/5 rounded-2xl bg-card-40 animate-pulse gap-3">
                <Filter className="w-8 h-8 text-brand animate-spin" />
                <span className="text-sm font-semibold">Cargando métricas analíticas...</span>
            </div>
        );
    }

    // --- Data Processing for BarChart (Gastos por Mes) ---
    // Gastos que alimentan los tres gráficos y el detalle: con monto y, salvo en la pestaña
    // de rechazados, sin los rechazados. Así el total de un dato pinchado coincide con su detalle.
    const shouldExcludeRechazados = selectedStatusTab !== 'rechazados';
    const chartRows = filteredReceipts.filter(r => r.amount && !(shouldExcludeRechazados && r.status === 'Rechazado'));

    // Gastos sobre los que trabaja el detalle abierto: los de las cifras de la tarjeta, o los de los gráficos.
    const drillRows = drill?.kpi ? (drill.kpi === 'documentos' ? kpiFilteredReceipts : kpiExpenseRows) : chartRows;

    const monthlyData = groupBy(chartRows, 'month', drillCtx)
        .sort(byKeyAsc)
        .map(g => ({ ...g, month: g.key }));

    const categoryData = groupBy(chartRows, 'category', drillCtx)
        .sort(byTotalDesc)
        .map(g => ({ ...g, name: g.label, value: g.total }));

    const documentTypeData = groupBy(chartRows, 'docType', drillCtx)
        .sort(byTotalDesc)
        .map(g => ({ ...g, name: g.label, value: g.total }));

    // Lo ya elegido en el detalle se resalta en los gráficos y el resto se atenúa.
    const dimmed = (dim: DimKey, key: string) => {
        const picked = drill?.filters[dim]?.key;
        return picked && picked !== key ? 0.3 : 1;
    };

    // Chart Colors
    const COLORS = ['#8CC63F', '#3EAE49', '#4DAFD6', '#F5A623', '#D0021B', '#9B9B9B', '#1C2D54'];

    // Custom Tooltip
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const value = payload[0].value;
            const name = data.label || payload[0].name || data.name;
            return (
                <div className="bg-app border border-[#8CC63F] p-3 rounded-xl shadow-xl text-xs space-y-1">
                    <p className="font-bold text-white uppercase tracking-wider">{name}</p>
                    <p className="text-brand font-semibold">Total: ${Number(value).toLocaleString('es-CL')}</p>
                    <p className="text-zinc-400">Cantidad: {data.count} {data.count === 1 ? 'documento' : 'documentos'}</p>
                    <p className="text-zinc-500">Clic para ver el detalle</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6">
            {/* Filters Row */}
            <div className="bg-card-50 p-4 rounded-xl border border-white/5 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-brand" />
                        <h3 className="font-semibold text-sm text-zinc-200">Filtros de Analíticas</h3>
                    </div>
                    <button
                        onClick={handleExportCSV}
                        disabled={filteredReceipts.length === 0}
                        className="flex items-center gap-2 px-3 py-1.5 bg-[#8CC63F]/20 hover:bg-[#8CC63F]/30 border border-[#8CC63F]/30 hover:border-[#8CC63F]/50 text-brand text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
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
                            className="bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200"
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] text-zinc-400 mb-1 uppercase tracking-wider">Desde (Fecha)</label>
                        <input
                            type="date"
                            value={filterStartDate}
                            onChange={(e) => setFilterStartDate(e.target.value)}
                            className="bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200"
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] text-zinc-400 mb-1 uppercase tracking-wider">Hasta (Fecha)</label>
                        <input
                            type="date"
                            value={filterEndDate}
                            onChange={(e) => setFilterEndDate(e.target.value)}
                            className="bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200"
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-[10px] text-zinc-400 mb-1 uppercase tracking-wider">Colaborador</label>
                        <select
                            value={filterWorker}
                            onChange={(e) => setFilterWorker(e.target.value)}
                            className="bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200"
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
                            className="bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200"
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
                            className="bg-surface border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-[#8CC63F] outline-none text-zinc-200"
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
                            ? 'bg-[#8CC63F]/10 border-[#8CC63F] text-brand'
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
                <button type="button" onClick={() => handleKpiSelect('aprobado')} aria-pressed={drill?.kpi === 'aprobado'} className={kpiCard('aprobado', 'border-blue-500/15')}>
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Monto Aprobado</p>
                        <p className="text-2xl font-black text-blue-400">${totalApproved.toLocaleString('es-CL')}</p>
                        <p className="text-[10px] text-zinc-500">Aprobado por supervisor</p>
                    </div>
                    <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 shrink-0">
                        <CheckCircle className="w-6 h-6" />
                    </div>
                </button>

                {/* Reembolsados Card */}
                <button type="button" onClick={() => handleKpiSelect('reembolsado')} aria-pressed={drill?.kpi === 'reembolsado'} className={kpiCard('reembolsado', 'border-emerald-500/15')}>
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Monto Reembolsado</p>
                        <p className="text-2xl font-black text-emerald-400">${totalReimbursed.toLocaleString('es-CL')}</p>
                        <p className="text-[10px] text-zinc-500">Monto pagado/reembolsado</p>
                    </div>
                    <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 shrink-0">
                        <CreditCard className="w-6 h-6" />
                    </div>
                </button>

                {/* Pendientes Card */}
                <button type="button" onClick={() => handleKpiSelect('pendiente')} aria-pressed={drill?.kpi === 'pendiente'} className={kpiCard('pendiente', 'border-yellow-500/15')}>
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Monto Pendiente</p>
                        <p className="text-2xl font-black text-yellow-400">${totalPending.toLocaleString('es-CL')}</p>
                        <p className="text-[10px] text-zinc-500">En revisión de supervisor</p>
                    </div>
                    <div className="p-3 bg-yellow-500/10 rounded-xl text-yellow-400 shrink-0">
                        <Clock className="w-6 h-6" />
                    </div>
                </button>

                {/* Total Gasto Card */}
                <button type="button" onClick={() => handleKpiSelect('total')} aria-pressed={drill?.kpi === 'total'} className={kpiCard('total', 'border-zinc-500/15')}>
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Total Gasto</p>
                        <p className="text-2xl font-black text-white">${totalExpense.toLocaleString('es-CL')}</p>
                        <p className="text-[10px] text-zinc-500">Aprobado + Reembolsado + Pendiente</p>
                    </div>
                    <div className="p-3 bg-zinc-500/10 rounded-xl text-zinc-400 shrink-0">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                </button>

                {/* Total Docs Card */}
                <button type="button" onClick={() => handleKpiSelect('documentos')} aria-pressed={drill?.kpi === 'documentos'} className={`${kpiCard('documentos', 'border-line')} col-span-2 md:col-span-1`}>
                    <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Total Documentos</p>
                        <p className="text-2xl font-black text-brand">{totalDocsCount}</p>
                        <p className="text-[10px] text-zinc-500">Documentos registrados</p>
                    </div>
                    <div className="p-3 bg-[#8CC63F]/10 rounded-xl text-brand shrink-0">
                        <FileText className="w-6 h-6" />
                    </div>
                </button>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Gráfico de Barras: Gastos Mensuales */}
                <div className="bg-card-40 border border-line rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center gap-2 mb-6">
                        <TrendingUp className="w-5 h-5 text-brand" />
                        <h2 className="text-lg font-semibold text-zinc-100">Gastos Mensuales</h2>
                    </div>
                    <div className="h-[300px] w-full">
                        {monthlyData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                                    <XAxis dataKey="month" stroke={chartAxis} fontSize={11} tickLine={false} tickFormatter={formatMonth} />
                                    <YAxis stroke={chartAxis} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value.toLocaleString()}`} />
                                    <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: chartGrid }} />
                                    <Bar
                                        dataKey="total"
                                        fill="#8CC63F"
                                        radius={[4, 4, 0, 0]}
                                        style={{ cursor: 'pointer' }}
                                        onClick={(_: any, index: number) => handleMainSelect('month', monthlyData[index])}
                                    >
                                        {monthlyData.map(entry => (
                                            <Cell key={`month-${entry.key}`} fill="#8CC63F" fillOpacity={dimmed('month', entry.key)} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-zinc-500 text-xs">Sin datos para graficar</div>
                        )}
                    </div>
                </div>

                {/* Gráfico Circular: Por Categoría */}
                <div className="bg-card-40 border border-line rounded-2xl p-6 shadow-xl">
                    <div className="flex items-center gap-2 mb-6">
                        <PieChartIcon className="w-5 h-5 text-brand-strong" />
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
                                        style={{ cursor: 'pointer' }}
                                        onClick={(_: any, index: number) => handleMainSelect('category', categoryData[index])}
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={dimmed('category', entry.key)} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip content={<CustomTooltip />} />
                                    <Legend
                                        wrapperStyle={{ fontSize: '10px', color: chartAxis, cursor: 'pointer' }}
                                        onClick={(e: any) => handleMainSelect('category', categoryData.find(c => c.name === e?.value))}
                                        formatter={(value) => <span style={{ color: chartAxis }}>{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-zinc-500 text-xs">Sin datos para graficar</div>
                        )}
                    </div>
                </div>

                {/* Gráfico Circular: Por Tipo de Documento */}
                <div className="bg-card-40 border border-line rounded-2xl p-6 shadow-xl">
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
                                        style={{ cursor: 'pointer' }}
                                        onClick={(_: any, index: number) => handleMainSelect('docType', documentTypeData[index])}
                                    >
                                        {documentTypeData.map((entry, index) => (
                                            <Cell key={`cell-doc-${index}`} fill={COLORS[(index + 3) % COLORS.length]} fillOpacity={dimmed('docType', entry.key)} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip content={<CustomTooltip />} />
                                    <Legend
                                        wrapperStyle={{ fontSize: '10px', color: chartAxis, cursor: 'pointer' }}
                                        onClick={(e: any) => handleMainSelect('docType', documentTypeData.find(c => c.name === e?.value))}
                                        formatter={(value) => <span style={{ color: chartAxis }}>{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-zinc-500 text-xs">Sin datos para graficar</div>
                        )}
                    </div>
                </div>
            </div>

            {drill ? (
                <DashboardDrillDown
                    key={drill.seq}
                    rows={drillRows}
                    filters={drill.filters}
                    lastClicked={drill.lastClicked}
                    scopeLabel={drill.kpi ? KPI_SCOPE[drill.kpi].scopeLabel : undefined}
                    shareLabel={drill.kpi ? KPI_SCOPE[drill.kpi].shareLabel : undefined}
                    preferredBreakdown={drill.kpi ? 'status' : undefined}
                    ctx={drillCtx}
                    chartAxis={chartAxis}
                    chartGrid={chartGrid}
                    onDrill={handleDrillChange}
                    onOpenReceipt={setSelectedReceipt}
                    onExport={(rows) => exportCSV(rows, 'detalle_seleccion_dashboard')}
                />
            ) : (
                <p className="flex items-center justify-center gap-2 text-xs text-zinc-500">
                    <MousePointerClick className="w-4 h-4" />
                    Pincha una tarjeta, una barra, un sector del gráfico o un nombre de la leyenda para ver el detalle de ese dato.
                </p>
            )}

            {selectedReceipt && (
                <ReceiptDetailModal
                    receipt={selectedReceipt}
                    readOnly={readOnly}
                    canApprove={canApprove}
                    canManagePayments={canManagePayments}
                    onClose={() => setSelectedReceipt(null)}
                    onUpdate={(updated) => {
                        // Merge para no perder relaciones anidadas (projects, payment_receipts)
                        // que el PATCH no devuelve en su respuesta.
                        setReceipts(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r));
                        setSelectedReceipt((prev: any) => prev ? { ...prev, ...updated } : updated);
                    }}
                    onDelete={(id) => {
                        setReceipts(prev => prev.filter(r => r.id !== id));
                        setSelectedReceipt(null);
                    }}
                    onRequestRefresh={fetchReceipts}
                    categories={categories}
                    projects={uniqueProjects}
                    workers={workers}
                />
            )}
        </div>
    );
}

