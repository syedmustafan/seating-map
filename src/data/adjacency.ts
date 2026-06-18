import type { FlatSeat } from "@/types/venue";

/**
 * Find N contiguous available seats in a single row.
 *
 * "Contiguous" means consecutive `col` values within the same section + row.
 * We group by (section,row), sort each group by col, then slide a window of
 * size n requiring each step to advance col by exactly 1. First match wins,
 * preferring lower sections/rows for a stable, predictable result.
 */
export function findAdjacent(seats: readonly FlatSeat[], n: number): FlatSeat[] | null {
  if (n <= 0) return null;

  const rows = new Map<string, FlatSeat[]>();
  for (const seat of seats) {
    if (seat.status !== "available") continue;
    const key = `${seat.sectionId}#${seat.rowIndex}`;
    const group = rows.get(key);
    if (group) group.push(seat);
    else rows.set(key, [seat]);
  }

  const keys = [...rows.keys()].sort();
  for (const key of keys) {
    const group = rows.get(key)!;
    group.sort((a, b) => a.col - b.col);

    let runStart = 0;
    for (let i = 1; i <= group.length; i++) {
      const breaks = i === group.length || group[i]!.col !== group[i - 1]!.col + 1;
      if (breaks) {
        if (i - runStart >= n) {
          return group.slice(runStart, runStart + n);
        }
        runStart = i;
      }
    }
  }
  return null;
}
