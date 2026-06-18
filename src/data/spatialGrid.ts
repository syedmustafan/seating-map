import type { FlatSeat } from "@/types/venue";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Uniform spatial hash grid. Seats are bucketed by floor(world / cell).
 *
 * Why a grid and not a plain filter: a filter over the visible viewport is O(total)
 * on every pan/zoom frame (15000 checks). The grid makes the visible-set query
 * O(cells touched + seats returned), which at any zoom is a few hundred, so panning
 * stays cheap regardless of venue size. Build is O(total) but happens once on load.
 *
 * Cell size is a tuning knob: too small wastes memory on empty cells, too large
 * returns too many seats per query. ~6x the seat pitch is a good default.
 */
export class SpatialGrid {
  private readonly cell: number;
  private readonly buckets = new Map<string, FlatSeat[]>();

  constructor(seats: readonly FlatSeat[], cellSize: number) {
    this.cell = cellSize;
    for (const seat of seats) {
      const key = this.keyFor(seat.worldX, seat.worldY);
      const bucket = this.buckets.get(key);
      if (bucket) bucket.push(seat);
      else this.buckets.set(key, [seat]);
    }
  }

  private keyFor(x: number, y: number): string {
    return `${Math.floor(x / this.cell)},${Math.floor(y / this.cell)}`;
  }

  /** All seats whose world position falls inside `rect`. Order is not guaranteed. */
  query(rect: Rect): FlatSeat[] {
    const minCol = Math.floor(rect.x / this.cell);
    const maxCol = Math.floor((rect.x + rect.width) / this.cell);
    const minRow = Math.floor(rect.y / this.cell);
    const maxRow = Math.floor((rect.y + rect.height) / this.cell);

    const out: FlatSeat[] = [];
    const maxX = rect.x + rect.width;
    const maxY = rect.y + rect.height;
    for (let cx = minCol; cx <= maxCol; cx++) {
      for (let cy = minRow; cy <= maxRow; cy++) {
        const bucket = this.buckets.get(`${cx},${cy}`);
        if (!bucket) continue;
        // A cell straddling the rect edge holds seats both in and out of it,
        // so we still test each candidate. The grid just shrinks the candidate set.
        for (const seat of bucket) {
          if (
            seat.worldX >= rect.x &&
            seat.worldX <= maxX &&
            seat.worldY >= rect.y &&
            seat.worldY <= maxY
          ) {
            out.push(seat);
          }
        }
      }
    }
    return out;
  }

  /**
   * Nearest seat to a point, optionally filtered. Used for click hit-testing
   * (map pointer -> seat without a DOM scan) and keyboard "nearest in direction".
   * Searches outward ring by ring so we stop as soon as a match is locked in.
   */
  nearest(
    x: number,
    y: number,
    predicate: (seat: FlatSeat) => boolean = () => true,
    maxRings = 4,
  ): FlatSeat | null {
    const centerCol = Math.floor(x / this.cell);
    const centerRow = Math.floor(y / this.cell);
    let best: FlatSeat | null = null;
    let bestDist = Infinity;

    for (let ring = 0; ring <= maxRings; ring++) {
      for (let cx = centerCol - ring; cx <= centerCol + ring; cx++) {
        for (let cy = centerRow - ring; cy <= centerRow + ring; cy++) {
          // Only the outer shell of each ring is new.
          if (ring > 0 && Math.abs(cx - centerCol) !== ring && Math.abs(cy - centerRow) !== ring) {
            continue;
          }
          const bucket = this.buckets.get(`${cx},${cy}`);
          if (!bucket) continue;
          for (const seat of bucket) {
            if (!predicate(seat)) continue;
            const dx = seat.worldX - x;
            const dy = seat.worldY - y;
            const dist = dx * dx + dy * dy;
            if (dist < bestDist) {
              bestDist = dist;
              best = seat;
            }
          }
        }
      }
      // Once we have a hit, one extra ring guards against a closer seat in a
      // diagonal cell; then we can stop.
      if (best && ring > 0) break;
    }
    return best;
  }
}
