import { useCallback } from "react";
import type { LoadedVenue } from "@/data/loadVenue";
import type { Viewport } from "@/hooks/useViewport";
import { findAdjacent } from "@/data/adjacency";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";

interface ToolbarProps {
  loaded: LoadedVenue;
  viewport: Viewport;
  announce: (msg: string) => void;
}

const btn =
  "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700";

export function Toolbar({ loaded, viewport, announce }: ToolbarProps) {
  const colorMode = useUiStore((s) => s.colorMode);
  const toggleColorMode = useUiStore((s) => s.toggleColorMode);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const selectMany = useSelectionStore((s) => s.selectMany);
  const setNotice = useSelectionStore((s) => s.setNotice);

  // Zoom about the center of the current view.
  const zoomCenter = useCallback(
    (factor: number) => {
      const vb = viewport.viewBox;
      // zoomAt takes client coords; the SVG fills its container, so center-ish is fine.
      const el = document.querySelector("svg");
      const rect = el?.getBoundingClientRect();
      const cx = rect ? rect.left + rect.width / 2 : vb.x;
      const cy = rect ? rect.top + rect.height / 2 : vb.y;
      viewport.zoomAt(factor, cx, cy);
    },
    [viewport],
  );

  const findThree = useCallback(() => {
    const found = findAdjacent(loaded.seats, 3);
    if (!found) {
      setNotice("No 3 adjacent available seats found.");
      announce("No 3 adjacent available seats found.");
      return;
    }
    selectMany(found);
    viewport.centerOn(found[1]!.worldX, found[1]!.worldY);
    announce(`Selected 3 adjacent seats in ${found[0]!.sectionLabel}, row ${found[0]!.rowIndex}.`);
  }, [announce, loaded.seats, selectMany, setNotice, viewport]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={btn} onClick={() => zoomCenter(1.25)} aria-label="Zoom in">
        Zoom +
      </button>
      <button type="button" className={btn} onClick={() => zoomCenter(0.8)} aria-label="Zoom out">
        Zoom −
      </button>
      <button type="button" className={btn} onClick={viewport.reset}>
        Reset view
      </button>
      <button
        type="button"
        className={btn}
        onClick={toggleColorMode}
        aria-pressed={colorMode === "heatmap"}
      >
        {colorMode === "heatmap" ? "Status colors" : "Price heat-map"}
      </button>
      <button type="button" className={btn} onClick={findThree}>
        Find 3 together
      </button>
      <button
        type="button"
        className={btn}
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? "Light" : "Dark"} mode
      </button>
    </div>
  );
}
