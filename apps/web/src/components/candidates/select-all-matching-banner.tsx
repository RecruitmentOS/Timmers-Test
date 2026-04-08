"use client";

/**
 * SelectAllMatchingBanner
 *
 * Renders above the candidate list when the user has selected every row
 * on the current page. Offers a switch to the "select all matching the
 * filter" mode (by-filter bulk path).
 *
 * This component is the ONLY place that uses the "Selecteer alle N" copy.
 * It is deliberately dumb — the parent page owns both
 * `isAllMatchingSelected` and the filter state.
 */
type Props = {
  pageSize: number;
  totalMatching: number;
  isAllMatchingSelected: boolean;
  onSelectAllMatching: () => void;
  onClearSelection: () => void;
};

export function SelectAllMatchingBanner({
  pageSize,
  totalMatching,
  isAllMatchingSelected,
  onSelectAllMatching,
  onClearSelection,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      {isAllMatchingSelected ? (
        <>
          <span>
            Alle <strong>{totalMatching}</strong> resultaten geselecteerd.
          </span>
          <button
            type="button"
            onClick={onClearSelection}
            className="font-medium underline underline-offset-2 hover:text-amber-950"
          >
            Wissen
          </button>
        </>
      ) : (
        <>
          <span>
            Alle <strong>{pageSize}</strong> op deze pagina geselecteerd.
          </span>
          <button
            type="button"
            onClick={onSelectAllMatching}
            className="font-medium underline underline-offset-2 hover:text-amber-950"
          >
            Selecteer alle {totalMatching} resultaten →
          </button>
        </>
      )}
    </div>
  );
}
