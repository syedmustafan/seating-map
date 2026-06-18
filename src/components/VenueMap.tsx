import { useCallback, useEffect, useRef } from "react";
import type { FlatSeat } from "@/types/venue";
import type { LoadedVenue } from "@/data/loadVenue";
import type { Viewport } from "@/hooks/useViewport";
import type { KeyboardNav } from "@/hooks/useKeyboardNav";
import type { ColorMode } from "@/store/uiStore";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";
import { Seat } from "@/components/Seat";

interface VenueMapProps {
  loaded: LoadedVenue;
  // viewport + nav are owned by App so zoom controls can share the same state.
  viewport: Viewport;
  nav: KeyboardNav;
  /** Announce a string to the polite live region (owned by App). */
  announce: (msg: string) => void;
}

// One active pointer = drag-to-pan. Two = pinch-zoom (stretch).
interface PointerSnapshot {
  x: number;
  y: number;
}

export function VenueMap({ loaded, viewport, nav, announce }: VenueMapProps) {
  const toggle = useSelectionStore((s) => s.toggle);
  const colorMode = useUiStore((s) => s.colorMode);
  const setActiveSeat = useUiStore((s) => s.setActiveSeat);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const pointers = useRef<Map<number, PointerSnapshot>>(new Map());
  const dragMoved = useRef(false);
  const pinchDist = useRef<number | null>(null);

  // Seat radius stays constant in world units; the viewBox handles visual scaling.
  const seatRadius = Math.max(loaded.pitch * 0.38, 2);

  const onActivate = useCallback(
    (seat: FlatSeat) => {
      setActiveSeat(seat.id);
      nav.setFocusedId(seat.id);
      announce(
        `Section ${seat.sectionLabel}, row ${seat.rowIndex}, seat ${seat.col}, ${seat.status}, price ${seat.price}`,
      );
    },
    [announce, nav, setActiveSeat],
  );

  // --- Pointer pan / pinch ---------------------------------------------------

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragMoved.current = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchDist.current = Math.hypot(a!.x - b!.x, a!.y - b!.y);
    }
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const prev = pointers.current.get(e.pointerId);
      if (!prev) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.current.size >= 2 && pinchDist.current !== null) {
        // Pinch zoom about the midpoint of the two active pointers.
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        const midX = (a!.x + b!.x) / 2;
        const midY = (a!.y + b!.y) / 2;
        const factor = dist / pinchDist.current;
        if (Number.isFinite(factor) && factor > 0) {
          viewport.zoomAt(factor, midX, midY);
        }
        pinchDist.current = dist;
        dragMoved.current = true;
        return;
      }

      // Single-pointer drag = pan.
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) dragMoved.current = true;
      viewport.panBy(dx, dy);
    },
    [viewport],
  );

  const endPointer = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchDist.current = null;
  }, []);

  // Wheel zoom (desktop). passive:false so we can preventDefault the page scroll.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      viewport.zoomAt(factor, e.clientX, e.clientY);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [viewport]);

  // --- Keyboard --------------------------------------------------------------

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<SVGSVGElement>) => {
      const dirMap: Record<string, "up" | "down" | "left" | "right"> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      };
      const dir = dirMap[e.key];
      if (dir) {
        e.preventDefault();
        // Seed focus from the first visible seat if nothing is focused yet.
        if (!nav.focusedId) {
          nav.ensureFocus(viewport.visibleSeats[0]);
          return;
        }
        const moved = nav.move(dir);
        if (moved) {
          ensureSeatVisible(moved, viewport);
          setActiveSeat(moved.id);
          announce(seatLiveText(moved));
          // Focus the actual DOM node next frame (it may have just mounted).
          requestAnimationFrame(() => focusSeatEl(svgRef.current, moved.id));
        }
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const seat = nav.focusedId ? loaded.byId.get(nav.focusedId) : undefined;
        if (seat && seat.status === "available") {
          toggle(seat);
          const after = useSelectionStore.getState().selected;
          const picked = after.some((s) => s.id === seat.id);
          announce(`Seat ${seat.id} ${picked ? "selected" : "deselected"}, ${after.length} of 8`);
        }
      }
    },
    [announce, loaded, nav, setActiveSeat, toggle, viewport],
  );

  const setRef = useCallback(
    (el: SVGSVGElement | null) => {
      svgRef.current = el;
      viewport.setSvgEl(el);
    },
    [viewport],
  );

  const { x, y, width, height } = viewport.viewBox;

  return (
    <svg
      ref={setRef}
      viewBox={`${x} ${y} ${width} ${height}`}
      className="h-full w-full touch-none select-none bg-slate-100 dark:bg-slate-900"
      role="application"
      aria-label="Seating map. Use arrow keys to move between seats and Enter or Space to select."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      {viewport.visibleSeats.map((seat) => (
        <SeatBinding
          key={seat.id}
          seat={seat}
          focused={nav.focusedId === seat.id}
          colorMode={colorMode}
          radius={seatRadius}
          onToggle={toggle}
          onActivate={onActivate}
        />
      ))}
    </svg>
  );
}

/**
 * Thin wrapper that subscribes ONLY to this seat's selected flag. This is the key
 * to not re-rendering the whole map when one seat toggles: the binding re-renders,
 * the memoized Seat re-renders, every other seat stays put.
 */
function SeatBinding(props: {
  seat: FlatSeat;
  focused: boolean;
  colorMode: ColorMode;
  radius: number;
  onToggle: (seat: FlatSeat) => void;
  onActivate: (seat: FlatSeat) => void;
}) {
  const selected = useSelectionStore(
    useCallback((s) => s.selected.some((x) => x.id === props.seat.id), [props.seat.id]),
  );
  return <Seat {...props} selected={selected} />;
}

// --- helpers -----------------------------------------------------------------

function seatLiveText(seat: FlatSeat): string {
  return `Section ${seat.sectionLabel}, row ${seat.rowIndex}, seat ${seat.col}, ${seat.status}, price ${seat.price}`;
}

function focusSeatEl(svg: SVGSVGElement | null, id: string) {
  const el = svg?.querySelector<SVGElement>(`[data-seat-id="${CSS.escape(id)}"]`);
  el?.focus();
}

/** If a keyboard-focused seat is near/outside the viewport edge, recenter on it. */
function ensureSeatVisible(seat: FlatSeat, viewport: Viewport) {
  const vb = viewport.viewBox;
  const pad = vb.width * 0.1;
  const outside =
    seat.worldX < vb.x + pad ||
    seat.worldX > vb.x + vb.width - pad ||
    seat.worldY < vb.y + pad ||
    seat.worldY > vb.y + vb.height - pad;
  if (outside) viewport.centerOn(seat.worldX, seat.worldY);
}
