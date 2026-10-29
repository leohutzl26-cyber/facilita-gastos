/*
 * Fechas de gastos: lectura de la fecha tal como viene impresa en el documento
 * (en Chile es día/mes/año, a menudo con año de 2 dígitos) y validación de que
 * sea plausible. Es el mismo código para el servidor y para las pantallas.
 */

// Un gasto no puede ser más antiguo que esto (≈ 13 meses) ni estar en el futuro.
export const MAX_AGE_DAYS = 400;
// Pasado este tiempo la pantalla avisa para que se confirme, pero se permite.
export const WARN_AGE_DAYS = 60;
// Margen por diferencia de zona horaria entre el teléfono y el servidor.
const FUTURE_TOLERANCE_DAYS = 1;

const TIME_ZONE = 'America/Santiago';
const MS_PER_DAY = 86_400_000;

const MONTHS: Record<string, number> = {
    enero: 1, ene: 1, febrero: 2, feb: 2, marzo: 3, mar: 3, abril: 4, abr: 4,
    mayo: 5, may: 5, junio: 6, jun: 6, julio: 7, jul: 7, agosto: 8, ago: 8,
    septiembre: 9, setiembre: 9, sep: 9, sept: 9, set: 9, octubre: 10, oct: 10,
    noviembre: 11, nov: 11, diciembre: 12, dic: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

// Hoy en Chile (YYYY-MM-DD). toISOString() usa UTC y de noche ya da el día siguiente.
export function todayISO(now: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDaysISO(iso: string, days: number): string {
    return new Date(Date.parse(iso + 'T00:00:00Z') + days * MS_PER_DAY).toISOString().slice(0, 10);
}

export function isValidISODate(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function buildISO(y: number, m: number, d: number): string | null {
    const iso = `${y}-${pad(m)}-${pad(d)}`;
    return isValidISODate(iso) ? iso : null;
}

function fullYear(raw: string): number {
    const n = Number(raw);
    return raw.length <= 2 ? 2000 + n : n;
}

// Lee la fecha como está impresa. Devuelve YYYY-MM-DD o null si no la entiende.
//   "06/10/26"  "17-06-2026"  "23.06.26 19:12"  "11 de Septiembre de 2026"  "2026-10-06"
export function parsePrintedDate(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const text = raw.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!text) return null;

    // Año primero: 2026-10-06 / 2026/10/06
    let m = text.match(/(?<!\d)(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/);
    if (m) return buildISO(Number(m[1]), Number(m[2]), Number(m[3]));

    // Día/mes/año numérico (formato chileno)
    m = text.match(/(?<!\d)(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?!\d)/);
    if (m) {
        let day = Number(m[1]);
        let month = Number(m[2]);
        const year = fullYear(m[3]);
        // Si el "mes" no puede serlo pero el "día" sí, el documento viene en mes/día.
        if (month > 12 && day <= 12) [day, month] = [month, day];
        return buildISO(year, month, day);
    }

    // Con el mes en letras: "11 de septiembre de 2026", "11-sep-26", "11 sep 2026"
    m = text.match(/(?<!\d)(\d{1,2})[\s\-/.]*(?:de\s+)?([a-záéíóú]+)\.?[\s\-/.]*(?:de\s+)?(\d{4}|\d{2})(?!\d)/);
    if (m) {
        const month = MONTHS[m[2].normalize('NFD').replace(/[̀-ͯ]/g, '')];
        if (month) return buildISO(fullYear(m[3]), month, Number(m[1]));
    }
    return null;
}

export function formatLongDate(iso: string): string {
    if (!isValidISODate(iso)) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const month = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][m - 1];
    return `${d} de ${month} de ${y}`;
}

function daysAgo(iso: string, today: string): number {
    return Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(iso + 'T00:00:00Z')) / MS_PER_DAY);
}

export type DateCheck =
    | { ok: true; warning?: string }
    | { ok: false; error: string };

export function validateExpenseDate(value: unknown, today: string = todayISO()): DateCheck {
    if (!isValidISODate(value)) {
        return { ok: false, error: 'La fecha del gasto no es válida. Revísala e inténtalo de nuevo.' };
    }
    const age = daysAgo(value, today);
    const label = formatLongDate(value);

    if (age < -FUTURE_TOLERANCE_DAYS) {
        return { ok: false, error: `La fecha ${label} es posterior a hoy. Revisa el día, el mes y el año.` };
    }
    if (age > MAX_AGE_DAYS) {
        return { ok: false, error: `La fecha ${label} tiene más de un año de antigüedad. Revisa el año del documento.` };
    }
    if (age > WARN_AGE_DAYS) {
        return { ok: true, warning: `Este gasto es de hace ${age} días. Confirma que la fecha es correcta.` };
    }
    return { ok: true };
}

export type ResolvedDate = {
    date: string;                          // '' si no hay una fecha confiable
    source: 'impresa' | 'ia' | 'ninguna';
    note?: string;                         // para mostrarle al usuario
};

// Decide la fecha final a partir de lo que leyó la IA. La fecha tal como está
// impresa se interpreta con reglas fijas (no depende del modelo); la fecha en
// formato ISO que devuelve la IA solo se usa si no se pudo leer la impresa.
export function resolveReceiptDate(input: { raw?: unknown; aiDate?: unknown }, today: string = todayISO()): ResolvedDate {
    const parsed = parsePrintedDate(input.raw);
    if (parsed) {
        const check = validateExpenseDate(parsed, today);
        if (check.ok) return { date: parsed, source: 'impresa' };
        return { date: '', source: 'ninguna', note: `La IA leyó "${String(input.raw).trim()}", pero ${check.error.charAt(0).toLowerCase()}${check.error.slice(1)}` };
    }

    const check = validateExpenseDate(input.aiDate, today);
    if (check.ok) return { date: input.aiDate as string, source: 'ia' };

    const rawText = typeof input.raw === 'string' ? input.raw.trim() : '';
    return {
        date: '',
        source: 'ninguna',
        note: rawText || input.aiDate
            ? 'La IA no pudo leer una fecha confiable en este documento. Escríbela como aparece impresa.'
            : 'No se encontró una fecha en el documento. Escríbela a mano.',
    };
}
