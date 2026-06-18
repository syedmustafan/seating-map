import type { FlatSeat, SeatStatus } from "@/types/venue";
import type { ColorMode } from "@/store/uiStore";

// Status colors. Mirrors tailwind.config seat tokens; kept here too because SVG
// fills are set via attributes, not classes, for cheaper updates on 100s of nodes.
export const STATUS_COLORS: Record<SeatStatus | "selected", string> = {
  available: "#16a34a",
  reserved: "#d97706",
  sold: "#9ca3af",
  held: "#7c3aed",
  selected: "#2563eb",
};

// Heat-map palette by tier (tier 1 cheapest -> tier 3 priciest).
export const TIER_COLORS: Record<number, string> = {
  1: "#0ea5e9", // sky
  2: "#f59e0b", // amber
  3: "#ef4444", // red
};

export const STATUS_LABEL: Record<SeatStatus, string> = {
  available: "available",
  reserved: "reserved",
  sold: "sold",
  held: "held",
};

/**
 * Shape is a second, non-color signal (WCAG: color is never the only cue).
 * - available: circle
 * - reserved: square
 * - sold: diamond (rotated square)
 * - held: triangle
 */
export type SeatShape = "circle" | "square" | "diamond" | "triangle";

export const STATUS_SHAPE: Record<SeatStatus, SeatShape> = {
  available: "circle",
  reserved: "square",
  sold: "diamond",
  held: "triangle",
};

export function seatFill(seat: FlatSeat, selected: boolean, mode: ColorMode): string {
  if (selected) return STATUS_COLORS.selected;
  if (mode === "heatmap") return TIER_COLORS[seat.priceTier] ?? "#64748b";
  return STATUS_COLORS[seat.status];
}

export function seatAriaLabel(seat: FlatSeat, selected: boolean): string {
  const base = `Section ${seat.sectionLabel}, row ${seat.rowIndex}, seat ${seat.col}, price ${seat.price}, ${STATUS_LABEL[seat.status]}`;
  return selected ? `${base}, selected` : base;
}
