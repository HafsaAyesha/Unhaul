/** 'PKR 1,800' style. Returns '' when price or currency is missing; never shows a guessed 0. */
export function formatPrice(price: number | null, currency: string | null): string {
  if (price === null || !currency || !Number.isFinite(price) || price < 0) return '';
  const whole = Number.isInteger(price);
  const amount = price.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
  return `${currency.toUpperCase()} ${amount}`;
}
