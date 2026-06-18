import { describe, it, expect } from "vitest";
import { priceForTier, PRICE_TABLE } from "@/data/pricing";

describe("priceForTier", () => {
  it("maps known tiers", () => {
    expect(priceForTier(1)).toBe(50);
    expect(priceForTier(2)).toBe(80);
    expect(priceForTier(3)).toBe(120);
  });

  it("falls back to 0 for unknown tiers", () => {
    expect(priceForTier(99)).toBe(0);
  });

  it("table matches documented values", () => {
    expect(PRICE_TABLE).toEqual({ 1: 50, 2: 80, 3: 120 });
  });
});
