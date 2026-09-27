import Link from "next/link";

export function ListPagination({
  page,
  pageSize,
  totalCount,
  previousHref,
  nextHref,
}: {
  page: number;
  pageSize: number;
  totalCount: number;
  previousHref: string;
  nextHref: string;
}) {
  const hasPrevious = page > 1;
  const hasNext = page * pageSize < totalCount;
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
        {totalCount === 0
          ? "0 results"
          : `Showing ${from}–${to} of ${totalCount}`}
      </p>
      <div className="flex gap-2">
        {hasPrevious ? (
          <Link
            href={previousHref}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Previous
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-400 dark:border-zinc-800 dark:text-zinc-600"
          >
            Previous
          </span>
        )}
        {hasNext ? (
          <Link
            href={nextHref}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Next
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-400 dark:border-zinc-800 dark:text-zinc-600"
          >
            Next
          </span>
        )}
      </div>
    </nav>
  );
}

export function lastPageNumber(totalCount: number, pageSize: number): number {
  if (totalCount <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(totalCount / pageSize));
}

export function parsePageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^[1-9]\d*$/.test(raw)) {
    return 1;
  }

  return Number(raw);
}
