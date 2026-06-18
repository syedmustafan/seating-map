# Interactive Event Seating Map

A production-quality, accessible, high-performance interactive seating map. Load a venue, render every seat at its absolute coordinates inside an SVG, and select up to 8 seats by mouse, keyboard, or touch. The selection survives a reload, stays smooth at roughly 60fps for arenas of about 15000 seats, and meets WCAG 2.1 AA.

## Run it

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

Other scripts:

```bash
pnpm typecheck        # tsc --noEmit (strict)
pnpm lint             # eslint, zero warnings allowed
pnpm test             # vitest unit + RTL integration
pnpm test:e2e         # playwright smoke test (boots the dev server)
pnpm build            # tsc -b && vite build
pnpm gen:venue        # writes public/venue.large.json (~15000 seats)
```

Load the large generated venue for performance testing with the `?venue=large` query param: `http://localhost:5173/?venue=large`.

## Backend integration (optional, default off)

By default the app is fully standalone: with no environment set it fetches the bundled `public/venue.json` exactly as the brief specifies, and a header badge reads **`data: static`**. Set `VITE_API_BASE_URL` (see `.env.example`) and the venue loader instead fetches `${base}/venue` from the companion [user-data-api](https://github.com/syedmustafan/user-data-api) backend — exercising a real full-stack path through that backend's LRU cache and rate limiter — and the badge flips to **`data: API`**. Both paths validate the response identically (`assertVenue` in `src/data/loadVenue.ts`), so the rest of the app is unchanged. To try it:

```bash
cp .env.example .env.local     # VITE_API_BASE_URL=http://localhost:4000
pnpm dev                       # backend must be running on :4000
```

This integration is additive and does not affect the standalone submission: remove the env var (or the `.env.local`) and the app silently falls back to the static file. `.env.local` is gitignored; only `.env.example` is committed.

## Architecture and trade-offs

This is a pure client SPA, so it uses **Vite + React, not Next**. There is no server data, no SEO surface, and no SSR requirement: the venue is a static JSON file fetched on load and everything else is local interaction. Next would add an SSR/runtime layer that buys nothing here and complicates the build. Vite gives instant dev startup and a small static bundle that any CDN can serve.

The headline challenge is **15000 seats at 60fps**, solved with **viewport virtualization (culling)** rather than mounting 15000 DOM nodes. On load the venue tree is flattened once into a single typed `FlatSeat[]` with world coordinates precomputed (section transforms applied as `worldX = transform.x + seat.x * transform.scale`), and the seats are bucketed into a **uniform spatial hash grid** keyed by `floor(world / cell)`. Pan and zoom only mutate the SVG `viewBox`; the visible seat set is then queried from the grid in `O(visible)` instead of filtering all 15000 every frame. The query is throttled with `requestAnimationFrame` so a burst of pointer-move events collapses to at most one recompute per frame. At any moment only a few hundred seats are mounted, so React reconciliation stays cheap. Each `Seat` is `React.memo` and subscribes only to its own `selected` flag via a Zustand selector, so toggling one seat re-renders that seat alone, not the map.

**Virtualized SVG was chosen specifically to keep performance and accessibility together.** Because seats are real SVG nodes, each visible seat keeps a native focusable element with its own `aria-label`, a roving tabindex, and `aria-pressed`/`aria-disabled` state. The escape hatch beyond roughly 50000 seats is **Canvas plus an accessible DOM overlay**: Canvas wins on raw pixel throughput but loses native a11y, so you must rebuild focus management, hit-testing, and labelling against an invisible DOM layer. That complexity is not worth it at 15000 seats, where virtualized SVG comfortably hits frame budget while staying accessible for free.

**State** lives in a small **Zustand** store with the `persist` middleware. Zustand was chosen for minimal boilerplate and, more importantly, selector subscriptions: a seat subscribes to `s.selected.some(x => x.id === id)` and re-renders only when that boolean flips, which is what keeps a 15000-seat map cheap. `persist` gives versioned `localStorage` for free. **Tailwind CSS** handles styling with consistent, WCAG-friendly tokens and class-based dark mode; SVG fills are set via attributes rather than classes because updating a `fill` attribute on hundreds of nodes is cheaper than swapping classes. A separate non-persisted UI store holds view modes (heat-map, theme, active seat).

### Pricing

Price is derived from `priceTier` via a table in `src/data/pricing.ts`: **tier 1 = $50, tier 2 = $80, tier 3 = $120**. Unknown tiers fall back to $0.

## Accessibility (WCAG 2.1 AA)

- **Roving tabindex**: exactly one seat is tabbable at a time; arrow keys move focus to the nearest seat in that direction using world coordinates (works through section transforms). Enter or Space toggles selection.
- **`aria-label` per seat**, e.g. `Section Lower Bowl A, row 1, seat 2, price 80, available`. Selected seats append `, selected`; non-available seats are `aria-disabled`.
- A visually hidden `aria-live="polite"` region announces the focused seat and selection changes (`Seat A-1-02 selected, 3 of 8`).
- Visible focus ring via `:focus-visible`; `prefers-reduced-motion` is respected globally.
- **Color is never the only signal**: each status also has a distinct shape (available = circle, reserved = square, sold = diamond, held = triangle), and the legend documents both. Status and tier palettes were picked for AA contrast against the map background in both light and dark themes.

## Performance notes

Verified with the 15000-seat generated venue (`pnpm gen:venue`, then `?venue=large`) in the Chrome DevTools Performance panel: pan/zoom interactions stay within frame budget because only the visible few hundred seats are mounted and the visible-set recompute is rAF-throttled and grid-backed. Click hit-testing maps pointer coordinates to a seat through the spatial grid, never a DOM scan.

## Stretch goals included

- **Heat-map toggle**: recolor seats by price tier instead of status.
- **Find 3 together**: selects the first run of three contiguous available seats (consecutive `col` in one row) and recenters on them. Algorithm in `src/data/adjacency.ts`.
- **Dark mode** meeting AA contrast in both themes.
- **Pinch-to-zoom and two-finger pan** via Pointer Events (scale about the pointer midpoint).

## Incomplete / TODOs

- No WebSocket live status updates (deliberately skipped per brief). The reconciliation path already handles statuses changing between sessions, so wiring a simulated feed would mostly be a UI animation concern.
- The keyboard "nearest in direction" heuristic weights cross-axis drift to prefer same-row/column movement; it is good for grid-like layouts but could be smarter for heavily curved seating bowls.
- One Playwright smoke test covers select-three-and-reload; broader e2e coverage (keyboard, mobile gestures) is left as a follow-up.

## Project layout

```
src/
  types/venue.ts              Venue/Seat types + FlatSeat
  data/loadVenue.ts           fetch + flatten + transform + build grid
  data/spatialGrid.ts         uniform spatial hash grid (query + nearest)
  data/pricing.ts             priceTier -> price
  data/adjacency.ts           find N contiguous available seats
  store/selectionStore.ts     zustand + persist, max 8, subtotal, reconcile
  store/uiStore.ts            color mode, theme, active seat
  hooks/useViewport.ts        pan/zoom, viewBox, rAF-throttled culling
  hooks/useKeyboardNav.ts     roving focus, arrow adjacency
  components/VenueMap.tsx      SVG, viewBox, pointer + touch handlers
  components/Seat.tsx          memoized seat (shape by status, color by mode)
  components/SeatDetails.tsx   section/row/seat/price/status panel
  components/SelectionSummary.tsx  list + per-tier breakdown + subtotal
  components/Legend.tsx        status/price legend with shape glyphs
  components/Toolbar.tsx       zoom, heat-map, find-3, theme controls
  App.tsx, main.tsx
public/venue.json             small sample venue
scripts/genVenue.ts           generates the ~15000-seat perf venue
```
