'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { X, Download, ArrowUp, ArrowDown, MousePointerClick, Layers } from 'lucide-react';
import {
    BREAKDOWN_DIMS, DIMENSION_LABEL, byTotalDesc, fillDays, fillMonths, filterRows, formatMonth, groupBy,
    statusGroup, suggestBreakdown, summarize,
    type DimKey, type DrillContext, type DrillFilters, type Group,
} from '@/utils/dashboardDrill';

const money = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`;
const compact = new Intl.NumberFormat('es-CL', { notation: 'compact', maximumFractionDigits: 1 });
const FILTER_ORDER: DimKey[] = ['month', 'day', 'category', 'docType', 'worker', 'project', 'merchant', 'status'];
const TOP_N = 8;
const PAGE = 20;

const STATUS_BADGE: Record<string, string> = {
    Aprobado: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    Reembolsado: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    Rechazado: 'bg-red-500/20 text-red-400 border-red-500/30',
    Pendiente: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

type Props = {
    rows: any[];                 // los mismos gastos que alimentan los gráficos principales
    filters: DrillFilters;
    lastClicked: DimKey;
    ctx: DrillContext;
    chartAxis: string;
    chartGrid: string;
    onDrill: (next: DrillFilters | null, clicked?: DimKey) => void;
    onOpenReceipt: (receipt: any) => void;
    onExport: (rows: any[]) => void;
};

function EvolutionTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    const g: Group = payload[0].payload;
    return (
        <div className="bg-app border border-[#8CC63F] p-3 rounded-xl shadow-xl text-xs space-y-1">
            <p className="font-bold text-white uppercase tracking-wider">{g.label}</p>
            <p className="text-brand font-semibold">Total: {money(g.total)}</p>
            <p className="text-zinc-400">{g.count} {g.count === 1 ? 'documento' : 'documentos'}</p>
            {g.count > 0 && <p className="text-zinc-500">Clic para ver el detalle</p>}
        </div>
    );
}

export default function DashboardDrillDown({ rows, filters, lastClicked, ctx, chartAxis, chartGrid, onDrill, onOpenReceipt, onExport }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimOverride, setDimOverride] = useState<DimKey | null>(null);
    const [showAll, setShowAll] = useState(false);
    const [visible, setVisible] = useState(PAGE);
    const [sort, setSort] = useState<{ col: 'date' | 'merchant' | 'amount'; dir: 'asc' | 'desc' }>({ col: 'date', dir: 'desc' });

    // Al abrir el detalle, lleva la vista hasta él.
    useEffect(() => {
        containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    // Al cambiar la selección se vuelve al desglose sugerido.
    const filtersSignature = JSON.stringify(filters);
    useEffect(() => {
        setDimOverride(null);
        setShowAll(false);
        setVisible(PAGE);
    }, [filtersSignature]);

    const selected = useMemo(() => filterRows(rows, filters, ctx), [rows, filters, ctx]);
    const summary = useMemo(() => summarize(selected), [selected]);
    const baseTotal = useMemo(() => summarize(rows).total, [rows]);
    const share = baseTotal > 0 ? (summary.total / baseTotal) * 100 : 0;

    // Desglose por categoría, comercio, colaborador… (el que más aclara lo que se pinchó).
    const suggested = suggestBreakdown(filters, lastClicked);
    const breakdownDim = dimOverride && !filters[dimOverride] ? dimOverride : suggested;
    const breakdown = useMemo(
        () => (breakdownDim ? groupBy(selected, breakdownDim, ctx, true).sort(byTotalDesc) : []),
        [selected, breakdownDim, ctx]
    );
    const breakdownMax = breakdown[0]?.total || 1;
    const shownBreakdown = showAll ? breakdown : breakdown.slice(0, TOP_N);

    // Evolución en el tiempo: por mes, o por día cuando la selección es de un solo mes.
    const monthGroups = useMemo(() => groupBy(selected, 'month', ctx), [selected, ctx]);
    const soleMonth = !filters.month && monthGroups.length === 1 ? monthGroups[0].key : null;
    const evolutionMonth = filters.month?.key ?? soleMonth;
    const evolution = useMemo(() => {
        if (filters.day) return null;
        if (evolutionMonth) {
            return fillDays(groupBy(selected, 'day', ctx), evolutionMonth).map(g => ({ ...g, short: String(Number(g.key.slice(8))) }));
        }
        return fillMonths(monthGroups).map(g => ({ ...g, short: g.label }));
    }, [selected, filters.day, evolutionMonth, monthGroups, ctx]);
    const evolutionByDay = Boolean(evolutionMonth);

    const sorted = useMemo(() => {
        const dir = sort.dir === 'asc' ? 1 : -1;
        return [...selected].sort((a, b) => {
            if (sort.col === 'amount') return (Number(a.amount || 0) - Number(b.amount || 0)) * dir;
            if (sort.col === 'merchant') return String(a.merchant || '').localeCompare(String(b.merchant || '')) * dir;
            return String(a.date || '').localeCompare(String(b.date || '')) * dir;
        });
    }, [selected, sort]);

    const addFilter = (dim: DimKey, group: Group) => {
        onDrill({ ...filters, [dim]: { key: group.key, label: group.label } }, dim);
    };

    const removeFilter = (dim: DimKey) => {
        const next = { ...filters };
        delete next[dim];
        onDrill(Object.keys(next).length ? next : null);
    };

    const toggleSort = (col: 'date' | 'merchant' | 'amount') => {
        setSort(prev => (prev.col === col ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: col === 'merchant' ? 'asc' : 'desc' }));
    };

    const SortHead = ({ col, children, className = '' }: { col: 'date' | 'merchant' | 'amount'; children: React.ReactNode; className?: string }) => (
        <th className={`px-3 py-2 font-semibold ${className}`}>
            <button type="button" onClick={() => toggleSort(col)} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-white transition-colors">
                {children}
                {sort.col === col && (sort.dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
            </button>
        </th>
    );

    const activeChips = FILTER_ORDER.filter(d => filters[d]);
    const availableDims = BREAKDOWN_DIMS.filter(d => !filters[d]);

    return (
        <div ref={containerRef} className="scroll-mt-40 bg-card-40 border border-[#8CC63F]/30 rounded-2xl p-6 shadow-xl space-y-6 animate-in fade-in duration-300">
            {/* Encabezado: qué se está viendo */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-2">
                        <Layers className="w-5 h-5 text-brand" />
                        <h2 className="text-lg font-semibold text-zinc-100">Detalle de la selección</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {activeChips.map(dim => (
                            <span key={dim} className="inline-flex items-center gap-1.5 bg-[#8CC63F]/10 border border-[#8CC63F]/40 text-brand text-xs font-semibold pl-3 pr-1.5 py-1 rounded-full max-w-full">
                                <span className="truncate">{DIMENSION_LABEL[dim]}: {filters[dim]!.label}</span>
                                <button
                                    type="button"
                                    onClick={() => removeFilter(dim)}
                                    aria-label={`Quitar filtro ${DIMENSION_LABEL[dim]}`}
                                    className="p-0.5 rounded-full hover:bg-[#8CC63F]/20 transition-colors"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </span>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onExport(sorted)}
                        disabled={sorted.length === 0}
                        className="flex items-center gap-2 px-3 py-1.5 bg-[#8CC63F]/20 hover:bg-[#8CC63F]/30 border border-[#8CC63F]/30 text-brand text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
                    >
                        <Download className="w-4 h-4" />
                        Exportar selección ({sorted.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => onDrill(null)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 text-zinc-400 hover:text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4" />
                        Cerrar
                    </button>
                </div>
            </div>

            {selected.length === 0 ? (
                <div className="py-10 text-center text-zinc-500 text-sm">No hay documentos para esta selección.</div>
            ) : (
                <>
                    {/* Resumen de la selección */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-inset-30 border border-white/5 rounded-xl p-4">
                            <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Total</p>
                            <p className="text-xl font-black text-brand">{money(summary.total)}</p>
                            <p className="text-[10px] text-zinc-500">{share.toFixed(share < 10 ? 1 : 0)}% del gasto mostrado en los gráficos</p>
                        </div>
                        <div className="bg-inset-30 border border-white/5 rounded-xl p-4">
                            <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Documentos</p>
                            <p className="text-xl font-black text-white">{summary.count}</p>
                            <p className="text-[10px] text-zinc-500">en esta selección</p>
                        </div>
                        <div className="bg-inset-30 border border-white/5 rounded-xl p-4">
                            <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Promedio</p>
                            <p className="text-xl font-black text-white">{money(summary.average)}</p>
                            <p className="text-[10px] text-zinc-500">por documento</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => summary.largest && onOpenReceipt(summary.largest)}
                            className="text-left bg-inset-30 border border-white/5 hover:border-[#8CC63F]/40 rounded-xl p-4 transition-colors"
                        >
                            <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Mayor gasto</p>
                            <p className="text-xl font-black text-white">{money(Number(summary.largest?.amount || 0))}</p>
                            <p className="text-[10px] text-zinc-500 truncate">{summary.largest?.merchant || 'Sin comercio'}</p>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        {/* Evolución en el tiempo */}
                        {evolution && evolution.length > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-zinc-200 mb-1">
                                    {evolutionByDay ? `Gasto por día · ${formatMonth(evolution[0].key.slice(0, 7))}` : 'Evolución mensual'}
                                </h3>
                                <p className="text-[11px] text-zinc-500 mb-3 flex items-center gap-1">
                                    <MousePointerClick className="w-3 h-3" />
                                    {evolutionByDay ? 'Pincha un día para ver solo sus documentos' : 'Pincha un mes para ver su detalle día a día'}
                                </p>
                                <div className="h-[260px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={evolution} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
                                            <XAxis dataKey="short" stroke={chartAxis} fontSize={11} tickLine={false} interval={evolutionByDay ? 'preserveStartEnd' : 0} />
                                            <YAxis stroke={chartAxis} fontSize={11} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => `$${compact.format(v)}`} />
                                            <RechartsTooltip content={<EvolutionTooltip />} cursor={{ fill: chartGrid }} />
                                            <Bar
                                                dataKey="total"
                                                fill="#8CC63F"
                                                radius={[4, 4, 0, 0]}
                                                style={{ cursor: 'pointer' }}
                                                onClick={(d: any) => {
                                                    const g: Group | undefined = d?.payload;
                                                    if (!g || g.count === 0) return;
                                                    addFilter(evolutionByDay ? 'day' : 'month', g);
                                                }}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* Desglose por otra dimensión */}
                        {breakdownDim && (
                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                    <h3 className="text-sm font-semibold text-zinc-200">Desglose por {DIMENSION_LABEL[breakdownDim].toLowerCase()}</h3>
                                    <div className="flex flex-wrap gap-1">
                                        {availableDims.map(d => (
                                            <button
                                                key={d}
                                                type="button"
                                                onClick={() => { setDimOverride(d); setShowAll(false); }}
                                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                                                    d === breakdownDim
                                                        ? 'bg-[#8CC63F]/10 border-[#8CC63F] text-brand'
                                                        : 'border-white/10 text-zinc-400 hover:text-white'
                                                }`}
                                            >
                                                {DIMENSION_LABEL[d]}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <p className="text-[11px] text-zinc-500 mb-3 flex items-center gap-1">
                                    <MousePointerClick className="w-3 h-3" />
                                    Pincha una barra para seguir bajando el detalle
                                </p>
                                <div className="space-y-1.5">
                                    {shownBreakdown.map(g => {
                                        const pct = summary.total > 0 ? (g.total / summary.total) * 100 : 0;
                                        return (
                                            <button
                                                key={g.key}
                                                type="button"
                                                onClick={() => addFilter(breakdownDim, g)}
                                                className="group w-full text-left rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors"
                                            >
                                                <div className="flex items-baseline justify-between gap-3 text-xs">
                                                    <span className="text-zinc-200 font-medium truncate">{g.label}</span>
                                                    <span className="shrink-0 text-zinc-400">
                                                        <span className="text-white font-semibold">{money(g.total)}</span>
                                                        <span className="ml-2 text-zinc-500">{g.count} doc. · {pct.toFixed(pct < 10 ? 1 : 0)}%</span>
                                                    </span>
                                                </div>
                                                <div className="mt-1 h-2 rounded-full bg-white/5 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-[#8CC63F] group-hover:bg-[#3EAE49] transition-colors"
                                                        style={{ width: `${Math.max((g.total / breakdownMax) * 100, 1.5)}%` }}
                                                    />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                {breakdown.length > TOP_N && (
                                    <button type="button" onClick={() => setShowAll(v => !v)} className="mt-2 text-xs font-semibold text-brand hover:text-brand-strong transition-colors">
                                        {showAll ? 'Ver solo los principales' : `Ver los ${breakdown.length} (${breakdown.length - TOP_N} más)`}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Documentos de la selección */}
                    <div>
                        <h3 className="text-sm font-semibold text-zinc-200 mb-3">Documentos ({sorted.length})</h3>
                        <div className="overflow-x-auto rounded-xl border border-white/5">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-inset-30 text-zinc-400">
                                    <tr>
                                        <SortHead col="date">Fecha</SortHead>
                                        <SortHead col="merchant">Comercio</SortHead>
                                        <th className="px-3 py-2 font-semibold uppercase tracking-wider hidden md:table-cell">Colaborador</th>
                                        <th className="px-3 py-2 font-semibold uppercase tracking-wider hidden lg:table-cell">Proyecto</th>
                                        <th className="px-3 py-2 font-semibold uppercase tracking-wider hidden lg:table-cell">Categoría</th>
                                        <th className="px-3 py-2 font-semibold uppercase tracking-wider">Estado</th>
                                        <SortHead col="amount" className="text-right">Monto</SortHead>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {sorted.slice(0, visible).map(r => {
                                        const st = statusGroup(r.status);
                                        return (
                                            <tr
                                                key={r.id}
                                                tabIndex={0}
                                                onClick={() => onOpenReceipt(r)}
                                                onKeyDown={e => { if (e.key === 'Enter') onOpenReceipt(r); }}
                                                className="cursor-pointer hover:bg-white/5 focus:bg-white/5 outline-none transition-colors"
                                            >
                                                <td className="px-3 py-2 whitespace-nowrap text-zinc-300">{r.date ? String(r.date).slice(0, 10).split('-').reverse().join('/') : '—'}</td>
                                                <td className="px-3 py-2 text-zinc-100 font-medium max-w-[180px] truncate">{r.merchant || 'Sin comercio'}</td>
                                                <td className="px-3 py-2 text-zinc-400 hidden md:table-cell">{ctx.workerName(r.worker_email)}</td>
                                                <td className="px-3 py-2 text-zinc-400 hidden lg:table-cell">{r.projects?.name || '—'}</td>
                                                <td className="px-3 py-2 text-zinc-400 hidden lg:table-cell">{r.category || '—'}</td>
                                                <td className="px-3 py-2">
                                                    <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-semibold ${STATUS_BADGE[st] || 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'}`}>{st}</span>
                                                </td>
                                                <td className="px-3 py-2 text-right font-semibold text-white whitespace-nowrap">{money(Number(r.amount || 0))}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {sorted.length > visible && (
                            <button type="button" onClick={() => setVisible(v => v + PAGE)} className="mt-3 text-xs font-semibold text-brand hover:text-brand-strong transition-colors">
                                Mostrar más ({sorted.length - visible} restantes)
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
