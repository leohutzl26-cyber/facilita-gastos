/*
 * Lógica del detalle interactivo de la pantalla Resumen: cada gráfico agrupa los
 * gastos por una dimensión (mes, categoría, comercio…) y al pinchar un dato se
 * filtra por ese valor y se vuelve a agrupar por otra dimensión.
 */

export type DimKey = 'month' | 'day' | 'category' | 'docType' | 'worker' | 'project' | 'merchant' | 'status';

// Un filtro guarda la clave (para comparar) y la etiqueta (para mostrarla).
export type DrillFilter = { key: string; label: string };
export type DrillFilters = Partial<Record<DimKey, DrillFilter>>;

export type Group = { key: string; label: string; total: number; count: number };

// Clave de los gastos que no tienen valor en la dimensión (sin categoría, sin proyecto…).
export const NONE = '__none__';

export type DrillContext = { workerName: (email: string) => string };

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export const DIMENSION_LABEL: Record<DimKey, string> = {
    month: 'Mes',
    day: 'Día',
    category: 'Categoría',
    docType: 'Documento',
    worker: 'Colaborador',
    project: 'Proyecto',
    merchant: 'Comercio',
    status: 'Estado',
};

// Dimensiones por las que se puede desglosar un grupo de gastos (el tiempo va aparte).
export const BREAKDOWN_DIMS: DimKey[] = ['category', 'merchant', 'worker', 'project', 'docType', 'status'];

export function formatMonth(key: string): string {
    const [y, m] = key.split('-');
    return `${MONTHS_SHORT[Number(m) - 1] ?? m} ${y}`;
}

export function formatDay(key: string): string {
    const [y, m, d] = key.split('-');
    return `${Number(d)} ${MONTHS_SHORT[Number(m) - 1] ?? m} ${y}`;
}

// Los estados se agrupan igual que en las tarjetas de la pantalla (Por Visar cuenta como Pendiente).
export function statusGroup(status?: string | null): string {
    if (!status || status === 'Pendiente' || status === 'Por Visar') return 'Pendiente';
    if (status === 'Aprobado por Supervisor') return 'Aprobado';
    return status;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Valor del gasto en la dimensión, o null si no lo tiene.
export function keyOf(dim: DimKey, r: any, ctx: DrillContext): string | null {
    switch (dim) {
        case 'month': {
            const d = typeof r.date === 'string' ? r.date.slice(0, 7) : '';
            return /^\d{4}-\d{2}$/.test(d) ? d : null;
        }
        case 'day': {
            const d = typeof r.date === 'string' ? r.date.slice(0, 10) : '';
            return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
        }
        case 'category': return (r.category || '').trim() || null;
        case 'docType': return (r.document_type || '').trim().toLowerCase() || null;
        case 'worker': return ctx.workerName(r.worker_email) || null;
        case 'project': return r.project_id || null;
        case 'merchant': return (r.merchant || '').trim().toUpperCase() || null;
        case 'status': return statusGroup(r.status);
    }
}

export function labelOf(dim: DimKey, key: string, r?: any): string {
    if (key === NONE) {
        return { category: 'Sin categoría', docType: 'Sin tipo', project: 'Sin proyecto', merchant: 'Sin comercio', worker: 'Desconocido', month: 'Sin fecha', day: 'Sin fecha', status: 'Pendiente' }[dim];
    }
    switch (dim) {
        case 'month': return formatMonth(key);
        case 'day': return formatDay(key);
        case 'docType': return capitalize(key);
        case 'project': return r?.projects?.name || 'Proyecto';
        default: return key;
    }
}

export function filterRows(rows: any[], filters: DrillFilters, ctx: DrillContext): any[] {
    const active = (Object.entries(filters) as [DimKey, DrillFilter][]).filter(([, f]) => f);
    if (active.length === 0) return rows;
    return rows.filter(r => active.every(([dim, f]) => (keyOf(dim, r, ctx) ?? NONE) === f.key));
}

export function groupBy(rows: any[], dim: DimKey, ctx: DrillContext, includeMissing = false): Group[] {
    const map = new Map<string, Group>();
    for (const r of rows) {
        const raw = keyOf(dim, r, ctx);
        if (raw === null && !includeMissing) continue;
        const key = raw ?? NONE;
        const current = map.get(key) || { key, label: labelOf(dim, key, r), total: 0, count: 0 };
        current.total += Number(r.amount || 0);
        current.count += 1;
        map.set(key, current);
    }
    return Array.from(map.values());
}

export const byTotalDesc = (a: Group, b: Group) => b.total - a.total;
export const byKeyAsc = (a: Group, b: Group) => a.key.localeCompare(b.key);

// Todos los días del mes (los sin gastos con total 0), para que la barra de cada día quede en su lugar.
export function fillDays(groups: Group[], monthKey: string): Group[] {
    const [y, m] = monthKey.split('-').map(Number);
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const byKey = new Map(groups.map(g => [g.key, g]));
    return Array.from({ length: days }, (_, i) => {
        const key = `${monthKey}-${String(i + 1).padStart(2, '0')}`;
        return byKey.get(key) || { key, label: labelOf('day', key), total: 0, count: 0 };
    });
}

// Todos los meses entre el primero y el último con gastos.
export function fillMonths(groups: Group[]): Group[] {
    if (groups.length === 0) return [];
    const sorted = [...groups].sort(byKeyAsc);
    const byKey = new Map(sorted.map(g => [g.key, g]));
    const [y0, m0] = sorted[0].key.split('-').map(Number);
    const [y1, m1] = sorted[sorted.length - 1].key.split('-').map(Number);
    const out: Group[] = [];
    for (let y = y0, m = m0; y < y1 || (y === y1 && m <= m1); m === 12 ? (y++, m = 1) : m++) {
        const key = `${y}-${String(m).padStart(2, '0')}`;
        out.push(byKey.get(key) || { key, label: labelOf('month', key), total: 0, count: 0 });
    }
    return out;
}

export type Summary = { total: number; count: number; average: number; largest: any | null };

export function summarize(rows: any[]): Summary {
    let total = 0;
    let largest: any | null = null;
    for (const r of rows) {
        const amount = Number(r.amount || 0);
        total += amount;
        if (!largest || amount > Number(largest.amount || 0)) largest = r;
    }
    return { total, count: rows.length, average: rows.length ? Math.round(total / rows.length) : 0, largest };
}

// Dimensión sugerida para desglosar la selección: la primera que aún no esté filtrada,
// empezando por la que más aclara lo que se acaba de pinchar.
export function suggestBreakdown(filters: DrillFilters, lastClicked: DimKey): DimKey | null {
    const preferred: Partial<Record<DimKey, DimKey[]>> = {
        month: ['category', 'worker', 'project', 'merchant', 'docType', 'status'],
        day: ['category', 'merchant', 'worker', 'project', 'docType', 'status'],
        category: ['merchant', 'worker', 'project', 'docType', 'status'],
        docType: ['category', 'merchant', 'worker', 'project', 'status'],
        worker: ['category', 'project', 'merchant', 'docType', 'status'],
        project: ['category', 'worker', 'merchant', 'docType', 'status'],
        merchant: ['category', 'worker', 'project', 'docType', 'status'],
        status: ['category', 'worker', 'project', 'merchant', 'docType'],
    };
    const order = [...(preferred[lastClicked] || []), ...BREAKDOWN_DIMS];
    return order.find(d => !filters[d]) ?? null;
}
