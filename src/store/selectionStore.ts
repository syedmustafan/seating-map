import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { FlatSeat } from "@/types/venue";

export const MAX_SEATS = 8;

interface SelectionState {
  /**
   * Ordered selection. We keep full FlatSeat snapshots (not just ids) so the
   * summary can render section/row/price without re-walking the venue, and so a
   * reload can show a meaningful list before reconciliation runs.
   * Insertion order is preserved by JS object/array semantics.
   */
  selected: FlatSeat[];
  /** Transient, non-blocking message (e.g. "Maximum 8 seats"). */
  notice: string | null;

  has: (id: string) => boolean;
  toggle: (seat: FlatSeat) => void;
  remove: (id: string) => void;
  clear: () => void;
  selectMany: (seats: FlatSeat[]) => void;
  setNotice: (notice: string | null) => void;
  /**
   * Drop persisted seats that are no longer available in the freshly fetched
   * venue (statuses change between sessions). Returns the ids that were removed
   * so the UI can announce them.
   */
  reconcile: (byId: Map<string, FlatSeat>) => string[];
}

export const useSelectionStore = create<SelectionState>()(
  persist(
    (set, get) => ({
      selected: [],
      notice: null,

      has: (id) => get().selected.some((s) => s.id === id),

      toggle: (seat) => {
        const { selected } = get();
        const exists = selected.some((s) => s.id === seat.id);
        if (exists) {
          set({ selected: selected.filter((s) => s.id !== seat.id), notice: null });
          return;
        }
        if (seat.status !== "available") {
          set({ notice: "That seat is not available." });
          return;
        }
        if (selected.length >= MAX_SEATS) {
          set({ notice: `Maximum ${MAX_SEATS} seats.` });
          return;
        }
        set({ selected: [...selected, seat], notice: null });
      },

      remove: (id) =>
        set((state) => ({ selected: state.selected.filter((s) => s.id !== id), notice: null })),

      clear: () => set({ selected: [], notice: null }),

      selectMany: (seats) => {
        const { selected } = get();
        const existing = new Set(selected.map((s) => s.id));
        const additions = seats.filter((s) => s.status === "available" && !existing.has(s.id));
        if (selected.length + additions.length > MAX_SEATS) {
          set({ notice: `Maximum ${MAX_SEATS} seats.` });
          return;
        }
        set({ selected: [...selected, ...additions], notice: null });
      },

      setNotice: (notice) => set({ notice }),

      reconcile: (byId) => {
        const { selected } = get();
        const removed: string[] = [];
        const kept: FlatSeat[] = [];
        for (const seat of selected) {
          const fresh = byId.get(seat.id);
          if (fresh && fresh.status === "available") {
            // Re-bind to the fresh object so prices/positions stay authoritative.
            kept.push(fresh);
          } else {
            removed.push(seat.id);
          }
        }
        if (removed.length > 0) {
          set({
            selected: kept,
            notice: `${removed.length} seat${removed.length > 1 ? "s" : ""} no longer available and ${
              removed.length > 1 ? "were" : "was"
            } removed.`,
          });
        }
        return removed;
      },
    }),
    {
      name: "seating-selection",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Only persist the selection itself; notice is transient.
      partialize: (state) => ({ selected: state.selected }),
    },
  ),
);

/** Derived subtotal selector. Pass to useSelectionStore to subscribe narrowly. */
export const selectSubtotal = (state: SelectionState): number =>
  state.selected.reduce((sum, seat) => sum + seat.price, 0);

/** Per-tier breakdown: tier -> { count, total }. */
export const selectTierBreakdown = (
  state: SelectionState,
): Map<number, { count: number; total: number }> => {
  const map = new Map<number, { count: number; total: number }>();
  for (const seat of state.selected) {
    const entry = map.get(seat.priceTier) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += seat.price;
    map.set(seat.priceTier, entry);
  }
  return map;
};
