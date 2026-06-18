import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "@/App";
import { useSelectionStore } from "@/store/selectionStore";
import type { Venue } from "@/types/venue";

// A tiny venue so every seat is inside the initial viewBox (all rendered, no culling
// surprises). One sold seat to test non-selectable handling.
const venue: Venue = {
  venueId: "it",
  name: "Integration Theater",
  map: { width: 300, height: 200 },
  sections: [
    {
      id: "s1",
      label: "Lower Bowl A",
      transform: { x: 20, y: 20, scale: 1 },
      rows: [
        {
          index: 1,
          seats: [
            { id: "A-1-1", col: 1, x: 0, y: 0, priceTier: 1, status: "available" },
            { id: "A-1-2", col: 2, x: 30, y: 0, priceTier: 2, status: "available" },
            { id: "A-1-3", col: 3, x: 60, y: 0, priceTier: 3, status: "sold" },
          ],
        },
      ],
    },
  ],
};

function mockFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => venue,
    })) as unknown as typeof fetch,
  );
}

beforeEach(() => {
  localStorage.clear();
  useSelectionStore.setState({ selected: [], notice: null });
  mockFetch();
  // jsdom: SVG layout APIs used by pointer math.
  if (!Element.prototype.getBoundingClientRect.toString().includes("native")) {
    Element.prototype.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 300, height: 200, right: 300, bottom: 200 }) as DOMRect;
  }
});

async function renderApp() {
  render(<App />);
  // Wait for the venue to load and seats to render.
  await screen.findByRole("application");
  await screen.findByLabelText(/seat 1, price 50, available/i);
}

describe("App integration", () => {
  it("renders all seats in the viewport with aria-labels", async () => {
    await renderApp();
    expect(
      screen.getByLabelText(/Section Lower Bowl A, row 1, seat 1, price 50, available/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/seat 3, price 120, sold/i)).toBeInTheDocument();
  });

  it("click selects a seat and a second click deselects it", async () => {
    const user = userEvent.setup();
    await renderApp();
    const seat1 = screen.getByLabelText(/seat 1, price 50, available/i);

    await user.click(seat1);
    expect(useSelectionStore.getState().has("A-1-1")).toBe(true);
    // The seat now appears as a line item in the summary (a $50 entry).
    const summary = screen.getByRole("region", { name: /selection summary/i });
    expect(within(summary).getByText(/Lower Bowl A · row 1 · seat 1/)).toBeInTheDocument();
    expect(within(summary).getAllByText("$50").length).toBeGreaterThan(0);

    await user.click(screen.getByLabelText(/seat 1, price 50, available, selected/i));
    expect(useSelectionStore.getState().has("A-1-1")).toBe(false);
  });

  it("updates the subtotal across multiple selections", async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByLabelText(/seat 1, price 50, available/i));
    await user.click(screen.getByLabelText(/seat 2, price 80, available/i));

    const summary = screen.getByRole("region", { name: /selection summary/i });
    expect(within(summary).getByText("$130")).toBeInTheDocument();
  });

  it("does not select a sold seat", async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByLabelText(/seat 3, price 120, sold/i));
    expect(useSelectionStore.getState().selected).toHaveLength(0);
  });

  it("keyboard: focus map, arrow to a seat, Enter selects", async () => {
    const user = userEvent.setup();
    await renderApp();

    const map = screen.getByRole("application");
    map.focus();
    // First arrow seeds focus on the first visible seat; second moves right.
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(useSelectionStore.getState().selected.length).toBeGreaterThan(0);
    });
  });

  it("restores persisted selection across a remount (reload)", async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByLabelText(/seat 1, price 50, available/i));
    expect(useSelectionStore.getState().has("A-1-1")).toBe(true);

    // Simulate reload: tear down React, rehydrate store from localStorage.
    cleanupDom();
    act(() => {
      useSelectionStore.persist.rehydrate();
    });
    await renderApp();

    expect(useSelectionStore.getState().has("A-1-1")).toBe(true);
    expect(screen.getByLabelText(/seat 1, price 50, available, selected/i)).toBeInTheDocument();
  });
});

function cleanupDom() {
  document.body.innerHTML = "";
}
