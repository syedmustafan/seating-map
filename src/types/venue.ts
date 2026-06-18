// Venue data model. Mirrors public/venue.json exactly.

export type SeatStatus = "available" | "reserved" | "sold" | "held";

export interface Seat {
  id: string;
  col: number;
  x: number;
  y: number;
  priceTier: number;
  status: SeatStatus;
}

export interface Row {
  index: number;
  seats: Seat[];
}

export interface Section {
  id: string;
  label: string;
  transform: { x: number; y: number; scale: number };
  rows: Row[];
}

export interface Venue {
  venueId: string;
  name: string;
  map: { width: number; height: number };
  sections: Section[];
}

/**
 * A seat flattened to world space with everything the UI needs precomputed.
 * We never re-walk the section/row tree at render time; this is the unit of work.
 */
export interface FlatSeat {
  id: string;
  status: SeatStatus;
  priceTier: number;
  price: number;
  // World-space coordinates (section transform already applied).
  worldX: number;
  worldY: number;
  col: number;
  rowIndex: number;
  sectionId: string;
  sectionLabel: string;
}
