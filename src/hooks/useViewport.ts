import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FlatSeat } from "@/types/venue";
import type { LoadedVenue } from "@/data/loadVenue";
import type { Rect } from "@/data/spatialGrid";
import { SpatialGrid } from "@/data/spatialGrid";

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 6;
// Render seats a little outside the visible box so panning never reveals a blank
// edge before the next rAF tick catches up.
const CULL_MARGIN_RATIO = 0.15;

export interface Viewport {
  viewBox: ViewBox;
  scale: number;
  visibleSeats: FlatSeat[];
  panBy: (dxClient: number, dyClient: number) => void;
  zoomAt: (factor: number, clientX: number, clientY: number) => void;
  /** Recenter the viewBox on a world point without changing zoom. */
  centerOn: (worldX: number, worldY: number) => void;
  reset: () => void;
  /** Map a client (pixel) point to world coordinates using the current viewBox. */
  clientToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  setSvgEl: (el: SVGSVGElement | null) => void;
}

/**
 * Pan/zoom + viewport virtualization.
 *
 * The viewBox is the single source of truth for what is on screen. Pan/zoom mutate
 * it; the visible seat set is derived from it via the spatial grid. We recompute the
 * visible set on a requestAnimationFrame so a burst of pointermove events collapses
 * to at most one query per frame (the key to staying at 60fps while dragging).
 */
export function useViewport(loaded: LoadedVenue | null): Viewport {
  const mapW = loaded?.venue.map.width ?? 1000;
  const mapH = loaded?.venue.map.height ?? 1000;
  const grid = loaded?.grid ?? EMPTY_GRID;

  const [viewBox, setViewBox] = useState<ViewBox>({ x: 0, y: 0, width: mapW, height: mapH });
  const [visibleSeats, setVisibleSeats] = useState<FlatSeat[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rafRef = useRef<number | null>(null);
  // Latest viewBox kept in a ref so the rAF callback always sees current state
  // without being re-created (avoids re-subscribing the animation loop).
  const viewBoxRef = useRef(viewBox);
  viewBoxRef.current = viewBox;

  // Re-fit when a new venue loads.
  useEffect(() => {
    setViewBox({ x: 0, y: 0, width: mapW, height: mapH });
  }, [mapW, mapH]);

  const recomputeVisible = useCallback(() => {
    const vb = viewBoxRef.current;
    const mx = vb.width * CULL_MARGIN_RATIO;
    const my = vb.height * CULL_MARGIN_RATIO;
    const rect: Rect = {
      x: vb.x - mx,
      y: vb.y - my,
      width: vb.width + mx * 2,
      height: vb.height + my * 2,
    };
    setVisibleSeats(grid.query(rect));
  }, [grid]);

  // Schedule a recompute, coalescing multiple calls within one frame.
  const scheduleRecompute = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      recomputeVisible();
    });
  }, [recomputeVisible]);

  // Initial fill + whenever the grid changes.
  useEffect(() => {
    recomputeVisible();
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [recomputeVisible]);

  const setSvgEl = useCallback((el: SVGSVGElement | null) => {
    svgRef.current = el;
  }, []);

  // Convert a client pixel delta into world units (depends on current zoom).
  const worldPerPixel = useCallback(() => {
    const el = svgRef.current;
    const rectW = el?.clientWidth || viewBoxRef.current.width;
    return viewBoxRef.current.width / rectW;
  }, []);

  const panBy = useCallback(
    (dxClient: number, dyClient: number) => {
      const k = worldPerPixel();
      setViewBox((vb) => ({ ...vb, x: vb.x - dxClient * k, y: vb.y - dyClient * k }));
      scheduleRecompute();
    },
    [scheduleRecompute, worldPerPixel],
  );

  const clientToWorld = useCallback((clientX: number, clientY: number) => {
    const el = svgRef.current;
    const vb = viewBoxRef.current;
    if (!el) return { x: vb.x, y: vb.y };
    const bounds = el.getBoundingClientRect();
    const px = (clientX - bounds.left) / bounds.width;
    const py = (clientY - bounds.top) / bounds.height;
    return { x: vb.x + px * vb.width, y: vb.y + py * vb.height };
  }, []);

  const zoomAt = useCallback(
    (factor: number, clientX: number, clientY: number) => {
      const anchor = clientToWorld(clientX, clientY);
      setViewBox((vb) => {
        const baseScale = mapW / vb.width;
        const nextScale = clamp(baseScale * factor, MIN_SCALE, MAX_SCALE);
        const nextWidth = mapW / nextScale;
        const nextHeight = mapH / nextScale;
        // Keep the anchor point under the cursor: solve for new x/y so the
        // anchor's screen-fraction is unchanged.
        const fx = (anchor.x - vb.x) / vb.width;
        const fy = (anchor.y - vb.y) / vb.height;
        return {
          x: anchor.x - fx * nextWidth,
          y: anchor.y - fy * nextHeight,
          width: nextWidth,
          height: nextHeight,
        };
      });
      scheduleRecompute();
    },
    [clientToWorld, mapW, mapH, scheduleRecompute],
  );

  const centerOn = useCallback(
    (worldX: number, worldY: number) => {
      setViewBox((vb) => ({ ...vb, x: worldX - vb.width / 2, y: worldY - vb.height / 2 }));
      scheduleRecompute();
    },
    [scheduleRecompute],
  );

  const reset = useCallback(() => {
    setViewBox({ x: 0, y: 0, width: mapW, height: mapH });
    scheduleRecompute();
  }, [mapW, mapH, scheduleRecompute]);

  const scale = useMemo(() => mapW / viewBox.width, [mapW, viewBox.width]);

  return {
    viewBox,
    scale,
    visibleSeats,
    panBy,
    zoomAt,
    centerOn,
    reset,
    clientToWorld,
    setSvgEl,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

const EMPTY_GRID = new SpatialGrid([], 1);
