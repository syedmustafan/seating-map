import { describe, it, expect } from "vitest";
import { SpatialGrid } from "@/data/spatialGrid";
import type { FlatSeat } from "@/types/venue";

function seat(
  id: string,
  x: number,
  y: number,
  status: FlatSeat["status"] = "available",
): FlatSeat {
  return {
    id,
    col: 0,
    rowIndex: 0,
    status,
    priceTier: 1,
    price: 50,
    worldX: x,
    worldY: y,
    sectionId: "s",
    sectionLabel: "A",
  };
}

const seats = [
  seat("origin", 0, 0),
  seat("near", 10, 10),
  seat("far", 1000, 1000),
  seat("sold", 12, 12, "sold"),
];

describe("SpatialGrid.query", () => {
  it("returns only seats inside the rect", () => {
    const grid = new SpatialGrid(seats, 50);
    const ids = grid.query({ x: -5, y: -5, width: 40, height: 40 }).map((s) => s.id);
    expect(ids.sort()).toEqual(["near", "origin", "sold"]);
    expect(ids).not.toContain("far");
  });

  it("returns nothing for an empty region", () => {
    const grid = new SpatialGrid(seats, 50);
    expect(grid.query({ x: 5000, y: 5000, width: 10, height: 10 })).toHaveLength(0);
  });
});

describe("SpatialGrid.nearest", () => {
  it("finds the closest seat to a point", () => {
    const grid = new SpatialGrid(seats, 50);
    expect(grid.nearest(1, 1)?.id).toBe("origin");
    expect(grid.nearest(11, 11)?.id).toBe("near");
  });

  it("honours a predicate (e.g. only available)", () => {
    const grid = new SpatialGrid(seats, 50);
    const hit = grid.nearest(12, 12, (s) => s.status === "available");
    expect(hit?.status).toBe("available");
  });
});
