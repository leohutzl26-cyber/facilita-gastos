// Un gasto puede pagarse en varias transferencias (por ejemplo cuando el tope
// diario de la cuenta no permite transferir todo de una vez). Por eso el estado
// real de pago de una boleta se calcula sumando lo aplicado por cada
// comprobante asociado, no por la existencia de uno solo.
export type ReceiptBalance = {
    total: number;
    paid: number;
    remaining: number;
    isPartial: boolean;
    isFullyPaid: boolean;
};

export function getReceiptBalance(receipt: any): ReceiptBalance {
    const total = Number(receipt?.amount || 0);
    const paid = (receipt?.payment_receipts || [])
        .reduce((sum: number, link: any) => sum + Number(link?.amount_applied || 0), 0);
    const remaining = Math.max(total - paid, 0);

    return {
        total,
        paid,
        remaining,
        isPartial: paid > 0 && paid < total,
        isFullyPaid: total > 0 && paid >= total,
    };
}
