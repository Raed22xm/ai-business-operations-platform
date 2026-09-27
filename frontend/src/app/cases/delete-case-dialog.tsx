"use client";

import { useActionState, useEffect, useRef } from "react";
import { deleteCaseAction } from "@/app/cases/actions";
import { initialDeleteCaseState } from "@/lib/case-form-state";
import type { CaseArchiveFilter, CaseStatus, CustomerCase } from "@/lib/cases-shared";

export function DeleteCaseDialog({
  work,
  listCustomerId,
  listStatus,
  listSearch,
  listArchive,
  listPage,
  soleRowOnPage,
  onClose,
}: {
  work: CustomerCase;
  listCustomerId: number | null;
  listStatus: CaseStatus | null;
  listSearch: string;
  listArchive: CaseArchiveFilter;
  listPage: number;
  soleRowOnPage: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(deleteCaseAction, initialDeleteCaseState);
  const forThisCase = state.caseId === work.id;
  const formError = forThisCase ? state.formError : null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) {
      return;
    }

    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("[data-dialog-cancel]")?.focus();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="delete-case-title"
      aria-describedby="delete-case-description"
      onCancel={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }

        onClose();
      }}
      className="w-[min(100%,24rem)] rounded-lg border border-zinc-200 bg-white p-5 text-zinc-900 shadow-lg backdrop:bg-zinc-950/40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
    >
      <form action={formAction} className="flex flex-col gap-4">
        <h2 id="delete-case-title" className="text-lg font-semibold">
          Delete {work.title}?
        </h2>
        <p id="delete-case-description" className="text-sm text-zinc-600 dark:text-zinc-400">
          This removes {work.title} from the case list.
        </p>
        <input type="hidden" name="id" value={work.id} />
        <input type="hidden" name="title" value={work.title} />
        <input type="hidden" name="listCustomerId" value={listCustomerId ?? ""} />
        <input type="hidden" name="listStatus" value={listStatus ?? ""} />
        <input type="hidden" name="listSearch" value={listSearch} />
        <input type="hidden" name="listArchive" value={listArchive} />
        <input type="hidden" name="listPage" value={listPage} />
        <input type="hidden" name="soleRow" value={soleRowOnPage ? "1" : "0"} />
        {formError ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {formError}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full border border-red-700 px-4 py-2 text-sm font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-400 dark:text-red-400"
          >
            {pending ? "Deleting…" : "Delete"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            data-dialog-cancel
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}
