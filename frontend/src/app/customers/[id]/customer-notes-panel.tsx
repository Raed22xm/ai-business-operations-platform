"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CreateCustomerNoteForm } from "@/app/customers/[id]/create-customer-note-form";
import { DeleteCustomerNoteDialog } from "@/app/customers/[id]/delete-customer-note-dialog";
import { EditCustomerNoteForm } from "@/app/customers/[id]/edit-customer-note-form";
import { loadCustomerNotesAction } from "@/app/customers/[id]/customer-note-actions";
import {
  formatNoteTimestamp,
  type CustomerNote,
} from "@/lib/customer-notes-shared";

export function CustomerNotesPanel({
  customerId,
  initialItems,
  initialPage,
  initialTotalCount,
  initialHasMore,
  initialError,
}: {
  customerId: number;
  initialItems: CustomerNote[];
  initialPage: number;
  initialTotalCount: number;
  initialHasMore: boolean;
  initialError: string | null;
}) {
  const notesHeadingRef = useRef<HTMLHeadingElement>(null);
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(initialPage);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [error, setError] = useState(initialError);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<{
    note: CustomerNote;
    returnFocus: HTMLElement | null;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [focusNotesHeading, setFocusNotesHeading] = useState(false);
  const [pending, startTransition] = useTransition();

  function reload() {
    startTransition(async () => {
      const result = await loadCustomerNotesAction(customerId, 1);
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
      const result = await loadCustomerNotesAction(customerId, page + 1);
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

  function closeDeleteDialog() {
    const returnFocus = deleting?.returnFocus ?? null;
    setDeleting(null);
    queueMicrotask(() => {
      if (returnFocus?.isConnected) {
        returnFocus.focus();
      }
    });
  }

  function handleNoteDeleted(message: string) {
    setDeleting(null);
    setNotice(message);
    setFocusNotesHeading(true);
    reload();
  }

  useEffect(() => {
    if (!focusNotesHeading) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      notesHeadingRef.current?.focus();
      setFocusNotesHeading(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusNotesHeading, items]);

  return (
    <section
      aria-labelledby="customer-notes-heading"
      className="crm-section flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="customer-notes-heading"
          ref={notesHeadingRef}
          tabIndex={-1}
          className="text-xl font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          Notes
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Internal plain-text notes for this customer. Not included in CSV exports or AI
          summaries.
        </p>
      </div>

      {notice ? (
        <p role="status" aria-live="polite" className="text-sm text-green-700 dark:text-green-400">
          {notice}
        </p>
      ) : null}

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
          No notes yet for this customer.
        </p>
      ) : null}

      {!error && items.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {items.map((note) => (
            <li
              key={note.id}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              {editingId === note.id ? (
                <EditCustomerNoteForm
                  customerId={customerId}
                  note={note}
                  onCancel={() => setEditingId(null)}
                  onSaved={(message) => {
                    setEditingId(null);
                    setNotice(message);
                    reload();
                  }}
                />
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-sm whitespace-pre-wrap break-words">{note.content}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    <span>{note.authorName}</span>
                    <span> · </span>
                    <time dateTime={note.createdAt}>
                      {formatNoteTimestamp(note.createdAt)}
                    </time>
                    {note.updatedAt ? (
                      <>
                        <span> · Edited </span>
                        <time dateTime={note.updatedAt}>
                          {formatNoteTimestamp(note.updatedAt)}
                        </time>
                      </>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      aria-label={`Edit note by ${note.authorName}`}
                      onClick={() => {
                        setNotice(null);
                        setEditingId(note.id);
                      }}
                      className="rounded-full border border-zinc-300 px-3 py-1 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete note by ${note.authorName}`}
                      onClick={(event) => {
                        setNotice(null);
                        setDeleting({
                          note,
                          returnFocus: event.currentTarget,
                        });
                      }}
                      className="rounded-full border border-red-700 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
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
          {totalCount === 1 ? "note" : "notes"}
        </p>
      ) : null}

      {error ? null : (
        <CreateCustomerNoteForm
          customerId={customerId}
          onCreated={(message) => {
            setNotice(message);
            reload();
          }}
        />
      )}

      {deleting ? (
        <DeleteCustomerNoteDialog
          customerId={customerId}
          note={deleting.note}
          onClose={closeDeleteDialog}
          onDeleted={handleNoteDeleted}
        />
      ) : null}
    </section>
  );
}
