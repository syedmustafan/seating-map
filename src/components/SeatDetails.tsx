import { useSelectionStore } from "@/store/selectionStore";
import { useUiStore } from "@/store/uiStore";
import type { LoadedVenue } from "@/data/loadVenue";
import { STATUS_LABEL } from "@/components/seatVisuals";

interface SeatDetailsProps {
  loaded: LoadedVenue;
}

/** Panel showing the active (clicked or focused) seat's section, row, price, status. */
export function SeatDetails({ loaded }: SeatDetailsProps) {
  const activeSeatId = useUiStore((s) => s.activeSeatId);
  const toggle = useSelectionStore((s) => s.toggle);
  const selected = useSelectionStore((s) =>
    activeSeatId ? s.selected.some((x) => x.id === activeSeatId) : false,
  );

  const seat = activeSeatId ? loaded.byId.get(activeSeatId) : undefined;

  if (!seat) {
    return (
      <div className="rounded-lg border border-slate-200 p-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Click or focus a seat to see details.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
      <h2 className="mb-2 font-semibold text-slate-900 dark:text-slate-100">Seat details</h2>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-700 dark:text-slate-300">
        <dt className="text-slate-500 dark:text-slate-400">Section</dt>
        <dd>{seat.sectionLabel}</dd>
        <dt className="text-slate-500 dark:text-slate-400">Row</dt>
        <dd>{seat.rowIndex}</dd>
        <dt className="text-slate-500 dark:text-slate-400">Seat</dt>
        <dd>{seat.col}</dd>
        <dt className="text-slate-500 dark:text-slate-400">Tier</dt>
        <dd>{seat.priceTier}</dd>
        <dt className="text-slate-500 dark:text-slate-400">Price</dt>
        <dd>${seat.price}</dd>
        <dt className="text-slate-500 dark:text-slate-400">Status</dt>
        <dd className="capitalize">{STATUS_LABEL[seat.status]}</dd>
      </dl>
      {seat.status === "available" ? (
        <button
          type="button"
          onClick={() => toggle(seat)}
          className="mt-3 w-full rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
        >
          {selected ? "Remove from selection" : "Add to selection"}
        </button>
      ) : (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          This seat is {STATUS_LABEL[seat.status]} and cannot be selected.
        </p>
      )}
    </div>
  );
}
