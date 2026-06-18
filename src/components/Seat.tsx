import { memo } from "react";
import type { FlatSeat } from "@/types/venue";
import type { ColorMode } from "@/store/uiStore";
import { seatAriaLabel, seatFill, STATUS_SHAPE } from "@/components/seatVisuals";

interface SeatProps {
  seat: FlatSeat;
  selected: boolean;
  focused: boolean;
  colorMode: ColorMode;
  radius: number;
  onToggle: (seat: FlatSeat) => void;
  onActivate: (seat: FlatSeat) => void;
}

/**
 * One seat. Memoized and fed only primitive/stable props so that toggling one
 * seat does not re-render the other ~hundreds of mounted seats. The parent reads
 * `selected`/`focused` per-seat from the store, so React only re-renders the seats
 * that actually changed.
 *
 * Rendered as an SVG shape with role="button" so it keeps native focus + a11y
 * (the whole reason we virtualize SVG instead of painting to Canvas).
 */
function SeatImpl({ seat, selected, focused, colorMode, radius, onToggle, onActivate }: SeatProps) {
  const interactive = seat.status === "available";
  const fill = seatFill(seat, selected, colorMode);
  const shape = STATUS_SHAPE[seat.status];

  const common = {
    role: "button",
    tabIndex: focused ? 0 : -1,
    "aria-label": seatAriaLabel(seat, selected),
    "aria-pressed": selected,
    "aria-disabled": !interactive,
    "data-seat-id": seat.id,
    className: interactive ? "cursor-pointer outline-none" : "cursor-not-allowed outline-none",
    onClick: () => {
      onActivate(seat);
      if (interactive) onToggle(seat);
    },
    onFocus: () => onActivate(seat),
    // Stroke gives selected/focused a non-color cue and a visible focus ring.
    stroke: focused ? "#0f172a" : selected ? "#1e3a8a" : "transparent",
    strokeWidth: focused ? 2.5 : selected ? 1.5 : 0,
    fill,
    opacity: interactive ? 1 : 0.55,
  } as const;

  return renderShape(shape, seat.worldX, seat.worldY, radius, common);
}

// Presentation + a11y attributes shared by every seat shape. Intentionally omits
// `ref` so the object stays assignable to rect/circle/polygon props alike.
interface ShapeProps {
  role: "button";
  tabIndex: number;
  "aria-label": string;
  "aria-pressed": boolean;
  "aria-disabled": boolean;
  "data-seat-id": string;
  className: string;
  onClick: () => void;
  onFocus: () => void;
  stroke: string;
  strokeWidth: number;
  fill: string;
  opacity: number;
}

function renderShape(shape: string, cx: number, cy: number, r: number, props: ShapeProps) {
  switch (shape) {
    case "square":
      return <rect x={cx - r} y={cy - r} width={r * 2} height={r * 2} rx={1} {...props} />;
    case "diamond":
      return (
        <rect
          x={cx - r}
          y={cy - r}
          width={r * 2}
          height={r * 2}
          transform={`rotate(45 ${cx} ${cy})`}
          {...props}
        />
      );
    case "triangle": {
      const pts = `${cx},${cy - r} ${cx + r},${cy + r} ${cx - r},${cy + r}`;
      return <polygon points={pts} {...props} />;
    }
    case "circle":
    default:
      return <circle cx={cx} cy={cy} r={r} {...props} />;
  }
}

// Custom comparison keeps the memo tight: re-render only when something visible
// to this seat changed.
export const Seat = memo(SeatImpl, (prev, next) => {
  return (
    prev.seat === next.seat &&
    prev.selected === next.selected &&
    prev.focused === next.focused &&
    prev.colorMode === next.colorMode &&
    prev.radius === next.radius &&
    prev.onToggle === next.onToggle &&
    prev.onActivate === next.onActivate
  );
});
