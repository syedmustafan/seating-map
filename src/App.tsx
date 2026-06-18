import { useCallback, useEffect, useMemo, useState } from "react";
import type { LoadedVenue, VenueSource } from "@/data/loadVenue";
import { loadVenue, resolveVenueSource } from "@/data/loadVenue";
import { useViewport } from "@/hooks/useViewport";
import { useKeyboardNav } from "@/hooks/useKeyboardNav";
import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";
import { VenueMap } from "@/components/VenueMap";
import { Toolbar } from "@/components/Toolbar";
import { Legend } from "@/components/Legend";
import { SeatDetails } from "@/components/SeatDetails";
import { SelectionSummary } from "@/components/SelectionSummary";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; loaded: LoadedVenue };

export function App() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [liveMsg, setLiveMsg] = useState("");
  const reconcile = useSelectionStore((s) => s.reconcile);
  const notice = useSelectionStore((s) => s.notice);
  const theme = useUiStore((s) => s.theme);

  // Apply theme class to <html> for Tailwind's class-based dark mode.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Where the venue came from (static bundle vs backend API). Resolved once so
  // the badge and the fetch agree on the source.
  const origin = useMemo(() => resolveVenueSource(), []);

  // Load venue once, then reconcile persisted selection against fresh statuses.
  useEffect(() => {
    let cancelled = false;
    loadVenue(origin)
      .then((loaded) => {
        if (cancelled) return;
        const removed = reconcile(loaded.byId);
        if (removed.length > 0) {
          setLiveMsg(`${removed.length} previously selected seat(s) are no longer available.`);
        }
        setState({ kind: "ready", loaded });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({ kind: "error", message: err instanceof Error ? err.message : "Unknown error" });
      });
    return () => {
      cancelled = true;
    };
  }, [reconcile, origin]);

  const announce = useCallback((msg: string) => setLiveMsg(msg), []);

  if (state.kind === "loading") {
    return <Centered>Loading venue…</Centered>;
  }
  if (state.kind === "error") {
    return <Centered>Failed to load venue: {state.message}</Centered>;
  }

  return (
    <Ready
      loaded={state.loaded}
      source={origin.source}
      announce={announce}
      liveMsg={liveMsg}
      notice={notice}
    />
  );
}

function SourceBadge({ source }: { source: VenueSource }) {
  const isApi = source === "api";
  return (
    <span
      data-testid="data-source"
      title={isApi ? "Venue loaded from the backend API" : "Venue loaded from the static bundle"}
      className={
        "rounded px-2 py-0.5 text-xs font-medium " +
        (isApi
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
          : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300")
      }
    >
      data: {isApi ? "API" : "static"}
    </span>
  );
}

function Ready({
  loaded,
  source,
  announce,
  liveMsg,
  notice,
}: {
  loaded: LoadedVenue;
  source: VenueSource;
  announce: (msg: string) => void;
  liveMsg: string;
  notice: string | null;
}) {
  // Viewport + keyboard nav are owned here so the Toolbar (zoom/find) and the
  // VenueMap share one viewport instance.
  const viewport = useViewport(loaded);
  const nav = useKeyboardNav(loaded);

  return (
    <div className="flex h-screen w-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex flex-col gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-bold">{loaded.venue.name}</h1>
          <div className="flex items-center gap-2">
            <SourceBadge source={source} />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {loaded.seats.length.toLocaleString()} seats
            </span>
          </div>
        </div>
        <Toolbar loaded={loaded} viewport={viewport} announce={announce} />
        {notice && (
          <p role="status" className="text-sm font-medium text-amber-700 dark:text-amber-400">
            {notice}
          </p>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Map fills remaining space. min-h-0 lets the SVG shrink in flex column. */}
        <main className="relative min-h-0 flex-1">
          <VenueMap loaded={loaded} viewport={viewport} nav={nav} announce={announce} />
        </main>

        {/* Side panel on desktop; bottom sheet (scrollable, capped height) on mobile. */}
        <aside className="flex max-h-[45vh] flex-col gap-3 overflow-y-auto border-t border-slate-200 p-3 dark:border-slate-800 md:max-h-none md:w-80 md:border-l md:border-t-0">
          <Legend />
          <SeatDetails loaded={loaded} />
          <SelectionSummary />
        </aside>
      </div>

      {/* Polite live region: focus + selection announcements for screen readers. */}
      <div aria-live="polite" className="sr-only">
        {liveMsg}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-white text-slate-700 dark:bg-slate-950 dark:text-slate-200">
      {children}
    </div>
  );
}
