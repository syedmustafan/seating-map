import type { FlatSeat, Venue } from "@/types/venue";
import { priceForTier } from "@/data/pricing";
import { SpatialGrid } from "@/data/spatialGrid";

export interface LoadedVenue {
  venue: Venue;
  seats: FlatSeat[];
  byId: Map<string, FlatSeat>;
  grid: SpatialGrid;
  /** Median seat-to-seat spacing; drives the grid cell size and seat radius. */
  pitch: number;
}

/**
 * Apply a section transform to a local seat coordinate.
 * worldX = transform.x + seat.x * transform.scale  (same for y).
 */
export function toWorld(local: number, offset: number, scale: number): number {
  return offset + local * scale;
}

/** Flatten the section/row tree into a single world-space seat array. */
export function flattenVenue(venue: Venue): FlatSeat[] {
  const seats: FlatSeat[] = [];
  for (const section of venue.sections) {
    const { x: tx, y: ty, scale } = section.transform;
    for (const row of section.rows) {
      for (const seat of row.seats) {
        seats.push({
          id: seat.id,
          status: seat.status,
          priceTier: seat.priceTier,
          price: priceForTier(seat.priceTier),
          worldX: toWorld(seat.x, tx, scale),
          worldY: toWorld(seat.y, ty, scale),
          col: seat.col,
          rowIndex: row.index,
          sectionId: section.id,
          sectionLabel: section.label,
        });
      }
    }
  }
  return seats;
}

/** Estimate seat pitch from the nearest-neighbour gap of a sample of seats. */
export function estimatePitch(seats: readonly FlatSeat[]): number {
  if (seats.length < 2) return 24;
  // Sampling keeps this O(sample^2) instead of O(n^2) on 15000 seats.
  const sample = seats.slice(0, Math.min(seats.length, 200));
  let min = Infinity;
  for (let i = 0; i < sample.length; i++) {
    const a = sample[i]!;
    for (let j = i + 1; j < sample.length; j++) {
      const b = sample[j]!;
      const d = Math.hypot(a.worldX - b.worldX, a.worldY - b.worldY);
      if (d > 0 && d < min) min = d;
    }
  }
  return Number.isFinite(min) ? min : 24;
}

export function buildLoadedVenue(venue: Venue): LoadedVenue {
  const seats = flattenVenue(venue);
  const byId = new Map<string, FlatSeat>(seats.map((s) => [s.id, s]));
  const pitch = estimatePitch(seats);
  // ~6 seats per cell edge balances bucket count against seats-per-query.
  const grid = new SpatialGrid(seats, Math.max(pitch * 6, 1));
  return { venue, seats, byId, grid, pitch };
}

/** Resolve which venue file to fetch. `?venue=large` loads the perf dataset. */
export function venueUrl(search: string = window.location.search): string {
  const params = new URLSearchParams(search);
  return params.get("venue") === "large" ? "/venue.large.json" : "/venue.json";
}

/** Where the venue data comes from, surfaced to the UI as a source badge. */
export type VenueSource = "static" | "api";

export interface VenueOrigin {
  url: string;
  source: VenueSource;
}

/**
 * Decide where to load the venue from. When VITE_API_BASE_URL is set we go
 * through the backend's GET /venue (exercising its cache + rate limiter);
 * otherwise we load the bundled static file exactly as before. The env var
 * being unset is the standalone default, so behavior is unchanged with no env.
 */
export function resolveVenueSource(search: string = window.location.search): VenueOrigin {
  const base = import.meta.env.VITE_API_BASE_URL;
  if (typeof base === "string" && base.trim() !== "") {
    return { url: `${base.replace(/\/$/, "")}/venue`, source: "api" };
  }
  return { url: venueUrl(search), source: "static" };
}

/**
 * Narrow an unknown JSON payload to a Venue. Both the static file and the API
 * return the same shape, so they are validated identically here before use.
 */
export function assertVenue(data: unknown, url: string): Venue {
  if (
    typeof data !== "object" ||
    data === null ||
    !Array.isArray((data as { sections?: unknown }).sections) ||
    typeof (data as { map?: unknown }).map !== "object"
  ) {
    throw new Error(`Malformed venue payload from ${url}: missing sections or map.`);
  }
  return data as Venue;
}

export async function loadVenue(
  origin: VenueOrigin = resolveVenueSource(),
): Promise<LoadedVenue> {
  const { url } = origin;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load venue from ${url}: ${res.status} ${res.statusText}`);
  }
  const venue = assertVenue(await res.json(), url);
  return buildLoadedVenue(venue);
}
