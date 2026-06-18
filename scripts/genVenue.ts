/**
 * Generates a ~15000-seat venue for performance testing.
 * Run: pnpm gen:venue  ->  writes public/venue.large.json
 * Load it in the app with ?venue=large.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Row, Seat, SeatStatus, Section, Venue } from "../src/types/venue.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SEAT_PITCH = 24; // world units between adjacent seats
const ROW_PITCH = 30;

// Deterministic PRNG (mulberry32) so generated venues are reproducible.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickStatus(rand: () => number): SeatStatus {
  const r = rand();
  // Realistic mix: most available, a tail of reserved/sold/held.
  if (r < 0.78) return "available";
  if (r < 0.88) return "reserved";
  if (r < 0.96) return "sold";
  return "held";
}

function priceTierForRow(rowIndex: number, totalRows: number): number {
  // Closer rows (lower index) are pricier.
  const frac = rowIndex / totalRows;
  if (frac < 0.33) return 3;
  if (frac < 0.66) return 2;
  return 1;
}

function buildVenue(targetSeats: number): Venue {
  const rand = mulberry32(1337);

  // Lay sections out in a 3-wide grid of "stands" around the arena.
  const sectionsAcross = 3;
  const sectionLabels = [
    "Lower Bowl A",
    "Lower Bowl B",
    "Lower Bowl C",
    "Upper Bowl A",
    "Upper Bowl B",
    "Upper Bowl C",
    "End North",
    "End South",
    "VIP",
  ];

  const seatsPerSection = Math.ceil(targetSeats / sectionLabels.length);
  const seatsPerRow = 40;
  const rowsPerSection = Math.ceil(seatsPerSection / seatsPerRow);

  const sectionWidth = seatsPerRow * SEAT_PITCH + 80;
  const sectionHeight = rowsPerSection * ROW_PITCH + 80;

  const sections: Section[] = sectionLabels.map((label, i) => {
    const gx = i % sectionsAcross;
    const gy = Math.floor(i / sectionsAcross);
    const transform = {
      x: gx * sectionWidth + 60,
      y: gy * sectionHeight + 60,
      scale: label === "VIP" ? 1.2 : 1, // VIP rendered slightly larger to exercise transforms
    };

    const rows: Row[] = [];
    for (let r = 0; r < rowsPerSection; r++) {
      const seats: Seat[] = [];
      const tier = priceTierForRow(r, rowsPerSection);
      for (let c = 0; c < seatsPerRow; c++) {
        seats.push({
          id: `${label.replace(/\s+/g, "")}-R${r + 1}-S${c + 1}`,
          col: c + 1,
          x: c * SEAT_PITCH,
          y: r * ROW_PITCH,
          priceTier: tier,
          status: pickStatus(rand),
        });
      }
      rows.push({ index: r + 1, seats });
    }
    return { id: `sec-${i + 1}`, label, transform, rows };
  });

  const totalSeats = sections.reduce(
    (n, s) => n + s.rows.reduce((m, row) => m + row.seats.length, 0),
    0,
  );

  const mapWidth = sectionsAcross * sectionWidth + 120;
  const mapHeight = Math.ceil(sectionLabels.length / sectionsAcross) * sectionHeight + 120;

  // eslint-disable-next-line no-console
  console.log(`Generated ${totalSeats} seats across ${sections.length} sections.`);

  return {
    venueId: "gen-arena-15k",
    name: "Generated Arena (perf test)",
    map: { width: Math.round(mapWidth), height: Math.round(mapHeight) },
    sections,
  };
}

const venue = buildVenue(15000);
const outDir = resolve(__dirname, "../public");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "venue.large.json");
writeFileSync(outPath, JSON.stringify(venue));
// eslint-disable-next-line no-console
console.log(`Wrote ${outPath}`);
