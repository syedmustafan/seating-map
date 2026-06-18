import { useUiStore } from "@/store/uiStore";
import { PRICE_TABLE } from "@/data/pricing";
import { STATUS_COLORS, STATUS_SHAPE, TIER_COLORS } from "@/components/seatVisuals";
import type { SeatStatus } from "@/types/venue";

const STATUSES: SeatStatus[] = ["available", "reserved", "sold", "held"];

/** Small inline SVG glyph that mirrors the seat shapes (the non-color signal). */
function Glyph({ shape, fill }: { shape: string; fill: string }) {
  const r = 6;
  const c = 8;
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true">
      {shape === "square" && <rect x={c - r} y={c - r} width={r * 2} height={r * 2} fill={fill} />}
      {shape === "diamond" && (
        <rect
          x={c - r}
          y={c - r}
          width={r * 2}
          height={r * 2}
          transform={`rotate(45 ${c} ${c})`}
          fill={fill}
        />
      )}
      {shape === "triangle" && (
        <polygon points={`${c},${c - r} ${c + r},${c + r} ${c - r},${c + r}`} fill={fill} />
      )}
      {(shape === "circle" || !shape) && <circle cx={c} cy={c} r={r} fill={fill} />}
    </svg>
  );
}

export function Legend() {
  const colorMode = useUiStore((s) => s.colorMode);

  return (
    <section aria-label="Legend" className="text-xs text-slate-700 dark:text-slate-300">
      <h2 className="mb-1 font-semibold text-slate-900 dark:text-slate-100">Legend</h2>
      {colorMode === "status" ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {STATUSES.map((status) => (
            <li key={status} className="flex items-center gap-1.5 capitalize">
              <Glyph shape={STATUS_SHAPE[status]} fill={STATUS_COLORS[status]} />
              {status}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <Glyph shape="circle" fill={STATUS_COLORS.selected} />
            selected
          </li>
        </ul>
      ) : (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(PRICE_TABLE).map(([tier, price]) => (
            <li key={tier} className="flex items-center gap-1.5">
              <Glyph shape="circle" fill={TIER_COLORS[Number(tier)] ?? "#64748b"} />
              Tier {tier} (${price})
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
