"use client";

type PaginationControlsProps = {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
};

export default function PaginationControls({
  page,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
}: PaginationControlsProps) {
  if (totalPages <= 1) {
    return (
      <div className="app-muted px-6 py-4 text-sm">
        Prikazujem {totalItems} rezultatov.
      </div>
    );
  }

  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--app-border)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="app-muted text-sm">
        Prikazujem {firstItem}-{lastItem} od {totalItems}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="secondary-button h-10 px-4 text-sm disabled:opacity-40"
        >
          Previous
        </button>

        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-semibold">
          {page} / {totalPages}
        </div>

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="secondary-button h-10 px-4 text-sm disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
