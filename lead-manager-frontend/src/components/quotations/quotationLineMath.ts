/**
 * Shared quotation line math — supports negative qty (returns / replacement credits).
 */

export type QuotationLineInput = {
  quantity?: number | string | null;
  rate?: number | string | null;
  discount_percent?: number | string | null;
  discount_amount?: number | string | null;
  gst_rate?: number | string | null;
};

export function parseQuotationLineQuantity(raw: unknown, fallback = 1): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Zero is invalid; negative qty is allowed for return / replacement lines. */
export function isValidQuotationLineQuantity(qty: number): boolean {
  return Number.isFinite(qty) && qty !== 0;
}

export function computeQuotationLineAmounts(item: QuotationLineInput) {
  const qty = parseQuotationLineQuantity(item.quantity, 1);
  const rate = Number(item.rate) || 0;
  const gross = Math.round(qty * rate * 100) / 100;

  let discPercent = Number(item.discount_percent) || 0;
  let discAmt = Number(item.discount_amount) || 0;

  if (discPercent !== 0) {
    discAmt = Math.round(((gross * discPercent) / 100) * 100) / 100;
  } else if (discAmt !== 0 && gross !== 0) {
    discPercent = Math.round(((discAmt / gross) * 100) * 100) / 100;
  } else {
    discPercent = 0;
    discAmt = 0;
  }

  const taxable = Math.round((gross - discAmt) * 100) / 100;
  const gstRate = Number(item.gst_rate) || 0;
  const gstAmt = Math.round(((taxable * gstRate) / 100) * 100) / 100;
  const lineTotal = Math.round((taxable + gstAmt) * 100) / 100;

  return {
    qty,
    rate,
    gross,
    discPercent,
    discAmt,
    taxable,
    gstRate,
    gstAmt,
    lineTotal,
  };
}

export function computeQuotationTotals(items: QuotationLineInput[]) {
  const computedItems = items.map((item) => {
    const amounts = computeQuotationLineAmounts(item);
    return { item, ...amounts };
  });

  const totalGross =
    Math.round(computedItems.reduce((acc, it) => acc + it.gross, 0) * 100) / 100;
  const totalDiscount =
    Math.round(computedItems.reduce((acc, it) => acc + it.discAmt, 0) * 100) / 100;
  const subtotal =
    Math.round(computedItems.reduce((acc, it) => acc + it.taxable, 0) * 100) / 100;
  const totalGst =
    Math.round(computedItems.reduce((acc, it) => acc + it.gstAmt, 0) * 100) / 100;
  const rawGrandTotal = subtotal + totalGst;
  const grandTotal = Math.round(rawGrandTotal);
  const roundOff = Math.round((grandTotal - rawGrandTotal) * 100) / 100;

  return {
    computedItems,
    totalGross,
    totalDiscount,
    subtotal,
    totalGst,
    roundOff,
    grandTotal,
  };
}
