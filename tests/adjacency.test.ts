import { describe, it, expect } from "vitest";
import { findAdjacent } from "@/data/adjacency";
import type { FlatSeat } from "@/types/venue";

function seat(partial: Partial<FlatSeat> & { id: string; col: number }): FlatSeat {
  return {
    status: "available",
    priceTier: 1,
    price: 50,
    worldX: 0,
    worldY: 0,
    rowIndex: 1,
    sectionId: "s1",
    sectionLabel: "A",
    ...partial,
  };
}

describe("findAdjacent", () => {
  it("finds N consecutive available seats in one row", () => {
    const seats = [seat({ id: "1", col: 1 }), seat({ id: "2", col: 2 }), seat({ id: "3", col: 3 })];
    const found = findAdjacent(seats, 3);
    expect(found?.map((s) => s.id)).toEqual(["1", "2", "3"]);
  });

  it("requires consecutive cols (a gap breaks the run)", () => {
    const seats = [
      seat({ id: "1", col: 1 }),
      seat({ id: "2", col: 2 }),
      seat({ id: "4", col: 4 }), // gap at col 3
    ];
    expect(findAdjacent(seats, 3)).toBeNull();
    expect(findAdjacent(seats, 2)?.map((s) => s.id)).toEqual(["1", "2"]);
  });

  it("skips non-available seats", () => {
    const seats = [
      seat({ id: "1", col: 1 }),
      seat({ id: "2", col: 2, status: "sold" }),
      seat({ id: "3", col: 3 }),
      seat({ id: "4", col: 4 }),
    ];
    // 1 is alone; 3-4 are a run of 2.
    expect(findAdjacent(seats, 2)?.map((s) => s.id)).toEqual(["3", "4"]);
  });

  it("does not cross section/row boundaries", () => {
    const seats = [
      seat({ id: "a1", col: 1, sectionId: "s1", rowIndex: 1 }),
      seat({ id: "b1", col: 2, sectionId: "s2", rowIndex: 1 }),
    ];
    expect(findAdjacent(seats, 2)).toBeNull();
  });

  it("returns null when N is not satisfiable", () => {
    expect(findAdjacent([seat({ id: "1", col: 1 })], 2)).toBeNull();
    expect(findAdjacent([], 1)).toBeNull();
  });
});
