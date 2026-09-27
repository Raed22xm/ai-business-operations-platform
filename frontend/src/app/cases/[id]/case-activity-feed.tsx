"use client";

import { useState, useTransition } from "react";
import { loadCaseActivityAction } from "@/app/cases/[id]/case-activity-actions";
import type { CaseActivity } from "@/lib/case-activity";

export function CaseActivityFeed({
  caseId,
  initialItems,
  initialPage,
  initialTotalCount,
  initialHasMore,
  initialError,
}: {
  caseId: number;
  initialItems: CaseActivity[];
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
      const result = await loadCaseActivityAction(caseId, 1);
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
      const result = await loadCaseActivityAction(caseId, page + 1);
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
      aria-labelledby="case-activity-heading"
      className="crm-section flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="case-activity-heading"
          className="text-xl font-semibold tracking-tight"
        >
          Activity
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Product history for this case. Events are recorded from when activity
          tracking was enabled — earlier work is not backfilled.
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
          No activity yet for this case. New creates, edits, and task changes
          will appear here.
        </p>
      ) : null}

      {!error && items.length > 0 ? (
        <ol className="case-activity-list">
          {items.map((item) => (
            <li key={item.id} className="case-activity-item">
              <div className="case-activity-marker" aria-hidden="true" />
              <div className="case-activity-body">
                <p className="case-activity-description">{item.description}</p>
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
