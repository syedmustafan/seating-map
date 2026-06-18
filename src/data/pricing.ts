// Price table per tier. Documented in the README.
// Kept as plain data so the loader and tests share one source of truth.
export const PRICE_TABLE: Readonly<Record<number, number>> = {
  1: 50,
  2: 80,
  3: 120,
};

const FALLBACK_PRICE = 0;

/** priceTier -> price. Unknown tiers fall back to 0 (and are easy to spot in the UI). */
export function priceForTier(tier: number): number {
  return PRICE_TABLE[tier] ?? FALLBACK_PRICE;
}
