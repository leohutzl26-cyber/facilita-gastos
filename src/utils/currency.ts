// En pesos chilenos (CLP) no existen los centavos: el punto SIEMPRE es
// separador de miles, nunca decimal. Si llega una coma con exactamente 2
// dígitos después, se interpreta como decimal y se descarta (CLP no maneja
// centavos); si trae 3 dígitos, se trata como separador de miles.
export function parseCLPAmount(value: string | number | null | undefined): number {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return Math.round(value);

    let str = String(value).trim().replace(/[^\d.,]/g, '');
    if (!str) return 0;

    const lastComma = str.lastIndexOf(',');
    if (lastComma !== -1 && str.slice(lastComma + 1).length === 2) {
        str = str.slice(0, lastComma);
    }

    const digitsOnly = str.replace(/[.,]/g, '');
    const parsed = parseInt(digitsOnly, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
}
