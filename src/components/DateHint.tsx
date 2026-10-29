'use client';
import { MAX_AGE_DAYS, addDaysISO, formatLongDate, todayISO, validateExpenseDate } from '@/utils/expenseDate';

// Límites para el selector de fecha: no futuro y no más antiguo que el máximo permitido.
export function dateBounds() {
    const today = todayISO();
    return { min: addDaysISO(today, -MAX_AGE_DAYS), max: today };
}

// Muestra la fecha escrita en palabras bajo el campo, para que un error de día o
// de año salte a la vista, y avisa cuando la fecha es sospechosa o inválida.
export default function DateHint({ value, note }: { value: string; note?: string | null }) {
    const check = value ? validateExpenseDate(value) : null;

    return (
        <div className="mt-1 space-y-0.5">
            {value && check && (
                <p className={`text-[11px] ${check.ok ? 'text-zinc-500' : 'text-red-400 font-semibold'}`}>
                    {check.ok ? formatLongDate(value) : check.error}
                </p>
            )}
            {check?.ok && check.warning && <p className="text-[11px] text-amber-400 font-medium">{check.warning}</p>}
            {note && <p className="text-[11px] text-amber-400 font-medium">{note}</p>}
        </div>
    );
}
