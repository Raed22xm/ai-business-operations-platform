"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { loadCustomerActivityAction } from "@/app/customers/[id]/customer-activity-actions";
import type { CustomerActivity } from "@/lib/customer-activity";

export function CustomerActivityFeed({
  customerId,
  initialItems,
  initialPage,
  initialTotalCount,
  initialHasMore,
  initialError,
}: {
  customerId: number;
  initialItems: CustomerActivity[];
  initialPage: number;
  initialTotalCount: number;
  initialHasMore: boolean;
  initialError: string | null;
}) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(initialPage);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [error, setError] = useState(initialError);
  const [pending, startTransition] = useTransition();

  function reload() {
    startTransition(async () => {
      const result = await loadCustomerActivityAction(customerId, 1);
      if (result.status === "error") {
        setItems([]);
        setPage(0);
        setTotalCount(0);
        setHasMore(false);
        setError(result.message);
        return;
      }
      setError(null);
      setItems(result.items);
      setPage(result.page);
      setTotalCount(result.totalCount);
      setHasMore(result.hasMore);
    });
  }

  function loadMore() {
    startTransition(async () => {
      const result = await loadCustomerActivityAction(customerId, page + 1);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setError(null);
      setItems((current) => [...current, ...result.items]);
      setPage(result.page);
      setTotalCount(result.totalCount);
      setHasMore(result.hasMore);
    });
  }

  return (
    <section
      aria-labelledby="customer-activity-heading"
      className="crm-section flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="customer-activity-heading"
          className="text-xl font-semibold tracking-tight"
        >
          Activity Timeline
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Chronological audit trail across all cases, tasks, and responses for this customer.
        </p>
      </div>

      {error ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-red-200 px-4 py-6 dark:border-red-900">
          <p role="alert" className="text-red-700 dark:text-red-400">
            {error}
          </p>
          <button
            type="button"
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            disabled={pending}
            onClick={reload}
          >
            Try again
          </button>
        </div>
      ) : null}

      {!error && items.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 px-4 py-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          No activity recorded yet for this customer&apos;s cases.
        </p>
      ) : null}

      {!error && items.length > 0 ? (
        <ol className="case-activity-list">
          {items.map((item) => (
            <li key={item.id} className="case-activity-item">
              <div className="case-activity-marker" aria-hidden="true" />
              <div className="case-activity-body">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="case-activity-description font-medium">
                    {item.description}
                  </span>
                  {item.caseTitle ? (
                    <Link
                      href={`/cases/${item.caseId}`}
                      className="inline-flex items-center text-xs text-emerald-400 hover:text-emerald-300 hover:underline"
                    >
                      Case: {item.caseTitle}
                    </Link>
                  ) : null}
                </div>
                <p className="case-activity-meta">
                  <time dateTime={item.occurredAt}>
                    {formatOccurredAt(item.occurredAt)}
                  </time>
                  {item.actorName ? <span> · {item.actorName}</span> : null}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {!error && hasMore ? (
        <button
          type="button"
          className="workspace-button small-button self-start"
          disabled={pending}
          onClick={loadMore}
        >
          {pending ? "Loading…" : "Load more"}
        </button>
      ) : null}

      {!error && totalCount > 0 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Showing {items.length} of {totalCount}{" "}
          {totalCount === 1 ? "event" : "events"}
        </p>
      ) : null}
    </section>
  );
}

function formatOccurredAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`;
}
