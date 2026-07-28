// Money is numeric(10,2), handled as strings to avoid float drift.

/** Normalize a numeric string/number to a canonical 2-decimal string. */
export function toMoneyString(value: string | number | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return "0.00";
  return (Math.round((n as number) * 100) / 100).toFixed(2);
}

/** Parse a money string to a number of dollars. */
export function toMoneyNumber(value: string | number | null | undefined): number {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return Number.isFinite(n) ? (n as number) : 0;
}

/** Sum a list of money strings without float drift (integer-cent accumulation). */
export function sumMoney(values: Array<string | number | null | undefined>): string {
  let cents = 0;
  for (const v of values) {
    const n = typeof v === "string" ? Number(v) : (v ?? 0);
    if (Number.isFinite(n)) cents += Math.round((n as number) * 100);
  }
  return (cents / 100).toFixed(2);
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** Format a money string/number as "$1,234.56". */
export function formatCurrency(value: string | number | null | undefined): string {
  return currencyFormatter.format(toMoneyNumber(value));
}
