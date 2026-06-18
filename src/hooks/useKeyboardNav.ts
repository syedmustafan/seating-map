import { useCallback, useEffect, useRef, useState } from "react";
import type { FlatSeat } from "@/types/venue";
import type { LoadedVenue } from "@/data/loadVenue";

type Direction = "up" | "down" | "left" | "right";

export interface KeyboardNav {
  /** The single seat id that owns tabindex=0 (roving tabindex). */
  focusedId: string | null;
  setFocusedId: (id: string | null) => void;
  /** Move focus to the nearest seat in a direction; returns the new seat. */
  move: (dir: Direction) => FlatSeat | null;
  /** Ensure a sane initial focus target exists. */
  ensureFocus: (fallback: FlatSeat | undefined) => void;
}

/**
 * Roving-tabindex keyboard navigation over world coordinates.
 *
 * Only one seat is tabbable at a time; arrows move focus to the nearest seat in
 * that direction. "Nearest in direction" is computed against world coords (not DOM
 * order) so it works through section transforms and irregular layouts. We search
 * the spatial grid near the current seat and pick the closest candidate whose
 * position lies in the requested half-plane, weighting cross-axis drift so focus
 * tends to stay in the same row/column.
 */
export function useKeyboardNav(loaded: LoadedVenue | null): KeyboardNav {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const focusedRef = useRef<string | null>(null);
  focusedRef.current = focusedId;

  // Reset focus when the venue changes.
  useEffect(() => {
    setFocusedId(null);
  }, [loaded]);

  const ensureFocus = useCallback((fallback: FlatSeat | undefined) => {
    if (focusedRef.current) return;
    if (fallback) setFocusedId(fallback.id);
  }, []);

  const move = useCallback(
    (dir: Direction): FlatSeat | null => {
      if (!loaded) return null;
      const current = focusedRef.current ? loaded.byId.get(focusedRef.current) : undefined;
      if (!current) return null;

      const candidate = nearestInDirection(loaded, current, dir);
      if (candidate) setFocusedId(candidate.id);
      return candidate;
    },
    [loaded],
  );

  return { focusedId, setFocusedId, move, ensureFocus };
}

function nearestInDirection(loaded: LoadedVenue, from: FlatSeat, dir: Direction): FlatSeat | null {
  // Search a generous neighbourhood so we can reach the next row/seat even with
  // gaps. Radius scales with pitch.
  const radius = loaded.pitch * 12;
  const candidates = loaded.grid.query({
    x: from.worldX - radius,
    y: from.worldY - radius,
    width: radius * 2,
    height: radius * 2,
  });

  let best: FlatSeat | null = null;
  let bestScore = Infinity;
  for (const seat of candidates) {
    if (seat.id === from.id) continue;
    const dx = seat.worldX - from.worldX;
    const dy = seat.worldY - from.worldY;
    if (!inDirection(dx, dy, dir)) continue;

    // Primary axis = travel along the requested direction; cross axis is penalised
    // so focus prefers the same row (horizontal) or column (vertical).
    const along = dir === "left" || dir === "right" ? Math.abs(dx) : Math.abs(dy);
    const cross = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
    const score = along + cross * 3;
    if (score < bestScore) {
      bestScore = score;
      best = seat;
    }
  }
  return best;
}

function inDirection(dx: number, dy: number, dir: Direction): boolean {
  switch (dir) {
    case "left":
      return dx < -0.5;
    case "right":
      return dx > 0.5;
    case "up":
      return dy < -0.5;
    case "down":
      return dy > 0.5;
  }
}
