import { describe, it, expect } from "vitest";
import { flattenVenue, toWorld, buildLoadedVenue } from "@/data/loadVenue";
import type { Venue } from "@/types/venue";

const venue: Venue = {
  venueId: "t",
  name: "Test",
  map: { width: 500, height: 500 },
  sections: [
    {
      id: "s1",
      label: "Lower Bowl A",
      transform: { x: 100, y: 50, scale: 2 },
      rows: [
        {
          index: 1,
          seats: [
            { id: "A-1-1", col: 1, x: 0, y: 0, priceTier: 1, status: "available" },
            { id: "A-1-2", col: 2, x: 10, y: 5, priceTier: 3, status: "sold" },
          ],
        },
      ],
    },
  ],
};

describe("toWorld", () => {
  it("applies offset + scale", () => {
    expect(toWorld(0, 100, 2)).toBe(100);
    expect(toWorld(10, 100, 2)).toBe(120);
  });
});

describe("flattenVenue", () => {
  it("flattens rows/sections and applies the section transform", () => {
    const seats = flattenVenue(venue);
    expect(seats).toHaveLength(2);

    const a = seats[0]!;
    expect(a.id).toBe("A-1-1");
    expect(a.worldX).toBe(100); // 100 + 0*2
    expect(a.worldY).toBe(50); // 50 + 0*2
    expect(a.sectionLabel).toBe("Lower Bowl A");
    expect(a.rowIndex).toBe(1);

    const b = seats[1]!;
    expect(b.worldX).toBe(120); // 100 + 10*2
    expect(b.worldY).toBe(60); // 50 + 5*2
  });

  it("derives price from priceTier", () => {
    const seats = flattenVenue(venue);
    expect(seats[0]!.price).toBe(50); // tier 1
    expect(seats[1]!.price).toBe(120); // tier 3
  });
});

describe("buildLoadedVenue", () => {
  it("builds a byId map and a queryable grid", () => {
    const loaded = buildLoadedVenue(venue);
    expect(loaded.byId.get("A-1-1")?.worldX).toBe(100);
    const found = loaded.grid.query({ x: 90, y: 40, width: 100, height: 100 });
    expect(found.map((s) => s.id).sort()).toEqual(["A-1-1", "A-1-2"]);
  });
});
