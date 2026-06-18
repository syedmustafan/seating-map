import { describe, it, expect, beforeEach } from "vitest";
import {
  useSelectionStore,
  selectSubtotal,
  selectTierBreakdown,
  MAX_SEATS,
} from "@/store/selectionStore";
import type { FlatSeat } from "@/types/venue";

function seat(id: string, tier = 1, status: FlatSeat["status"] = "available"): FlatSeat {
  const price = tier === 1 ? 50 : tier === 2 ? 80 : 120;
  return {
    id,
    col: 1,
    rowIndex: 1,
    status,
    priceTier: tier,
    price,
    worldX: 0,
    worldY: 0,
    sectionId: "s",
    sectionLabel: "A",
  };
}

beforeEach(() => {
  useSelectionStore.getState().clear();
  localStorage.clear();
});

describe("selection store", () => {
  it("toggles a seat on and off", () => {
    const s = useSelectionStore.getState();
    s.toggle(seat("a"));
    expect(useSelectionStore.getState().has("a")).toBe(true);
    useSelectionStore.getState().toggle(seat("a"));
    expect(useSelectionStore.getState().has("a")).toBe(false);
  });

  it("refuses to select non-available seats and sets a notice", () => {
    useSelectionStore.getState().toggle(seat("x", 1, "sold"));
    expect(useSelectionStore.getState().has("x")).toBe(false);
    expect(useSelectionStore.getState().notice).toMatch(/not available/i);
  });

  it(`caps selection at ${MAX_SEATS} and surfaces a non-blocking notice`, () => {
    for (let i = 0; i < MAX_SEATS; i++) useSelectionStore.getState().toggle(seat(`s${i}`));
    expect(useSelectionStore.getState().selected).toHaveLength(MAX_SEATS);

    useSelectionStore.getState().toggle(seat("overflow"));
    expect(useSelectionStore.getState().selected).toHaveLength(MAX_SEATS);
    expect(useSelectionStore.getState().has("overflow")).toBe(false);
    expect(useSelectionStore.getState().notice).toMatch(/maximum 8/i);
  });

  it("computes subtotal and per-tier breakdown", () => {
    const s = useSelectionStore.getState();
    s.toggle(seat("a", 1)); // 50
    s.toggle(seat("b", 3)); // 120
    s.toggle(seat("c", 1)); // 50
    const state = useSelectionStore.getState();
    expect(selectSubtotal(state)).toBe(220);
    const bd = selectTierBreakdown(state);
    expect(bd.get(1)).toEqual({ count: 2, total: 100 });
    expect(bd.get(3)).toEqual({ count: 1, total: 120 });
  });

  it("selectMany respects the cap and ignores non-available seats", () => {
    useSelectionStore.getState().selectMany([seat("a"), seat("b", 1, "held"), seat("c")]);
    const sel = useSelectionStore.getState().selected.map((s) => s.id);
    expect(sel).toEqual(["a", "c"]);
  });

  describe("reconcile (persisted-seat reconciliation on load)", () => {
    it("drops seats that are no longer available and reports them", () => {
      const s = useSelectionStore.getState();
      s.toggle(seat("keep"));
      s.toggle(seat("gone"));

      // Fresh venue: "gone" is now sold, "keep" still available.
      const byId = new Map<string, FlatSeat>([
        ["keep", seat("keep", 1, "available")],
        ["gone", seat("gone", 1, "sold")],
      ]);
      const removed = useSelectionStore.getState().reconcile(byId);

      expect(removed).toEqual(["gone"]);
      expect(useSelectionStore.getState().selected.map((x) => x.id)).toEqual(["keep"]);
      expect(useSelectionStore.getState().notice).toMatch(/no longer available/i);
    });

    it("drops seats that vanished from the venue entirely", () => {
      useSelectionStore.getState().toggle(seat("ghost"));
      const removed = useSelectionStore.getState().reconcile(new Map());
      expect(removed).toEqual(["ghost"]);
      expect(useSelectionStore.getState().selected).toHaveLength(0);
    });
  });

  it("persists selection to localStorage", () => {
    useSelectionStore.getState().toggle(seat("a"));
    const raw = localStorage.getItem("seating-selection");
    expect(raw).toBeTruthy();
    expect(raw).toContain('"a"');
  });
});
