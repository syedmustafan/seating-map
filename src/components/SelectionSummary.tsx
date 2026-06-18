import {
  MAX_SEATS,
  selectSubtotal,
  selectTierBreakdown,
  useSelectionStore,
} from "@/store/selectionStore";

/** Selected-seat list, per-tier breakdown, subtotal, and remove buttons. */
export function SelectionSummary() {
  const selected = useSelectionStore((s) => s.selected);
  const remove = useSelectionStore((s) => s.remove);
  const clear = useSelectionStore((s) => s.clear);
  const subtotal = useSelectionStore(selectSubtotal);
  const breakdown = useSelectionStore(selectTierBreakdown);

  return (
    <section aria-label="Selection summary" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">
          Selection ({selected.length}/{MAX_SEATS})
        </h2>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="text-xs text-slate-500 underline hover:text-slate-700 dark:text-slate-400"
          >
            Clear all
          </button>
        )}
      </div>

      {selected.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No seats selected yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {selected.map((seat) => (
            <li
              key={seat.id}
              className="flex items-center justify-between rounded-md bg-slate-100 px-2 py-1 text-sm dark:bg-slate-800"
            >
              <span className="text-slate-800 dark:text-slate-200">
                {seat.sectionLabel} · row {seat.rowIndex} · seat {seat.col}
                <span className="ml-2 text-slate-500 dark:text-slate-400">${seat.price}</span>
              </span>
              <button
                type="button"
                onClick={() => remove(seat.id)}
                aria-label={`Remove seat ${seat.id} from selection`}
                className="ml-2 rounded px-1.5 text-slate-500 hover:bg-slate-200 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500 dark:hover:bg-slate-700"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {breakdown.size > 0 && (
        <div className="mt-1 border-t border-slate-200 pt-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400">
          {[...breakdown.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([tier, { count, total }]) => (
              <div key={tier} className="flex justify-between">
                <span>
                  Tier {tier} × {count}
                </span>
                <span>${total}</span>
              </div>
            ))}
        </div>
      )}

      <div className="mt-1 flex justify-between border-t border-slate-200 pt-2 font-semibold dark:border-slate-700">
        <span className="text-slate-900 dark:text-slate-100">Subtotal</span>
        <span className="text-slate-900 dark:text-slate-100">${subtotal}</span>
      </div>
    </section>
  );
}
