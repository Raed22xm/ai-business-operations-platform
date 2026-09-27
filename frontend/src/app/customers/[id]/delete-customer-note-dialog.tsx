"use client";

import { useActionState, useEffect, useRef } from "react";
import { deleteCustomerNoteAction } from "@/app/customers/[id]/customer-note-actions";
import { initialDeleteCustomerNoteState } from "@/lib/customer-note-form-state";
import { notePreviewLabel, type CustomerNote } from "@/lib/customer-notes-shared";

export function DeleteCustomerNoteDialog({
  customerId,
  note,
  onClose,
  onDeleted,
}: {
  customerId: number;
  note: CustomerNote;
  onClose: () => void;
  onDeleted: (message: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const boundAction = deleteCustomerNoteAction.bind(null, customerId);
  const [state, formAction, pending] = useActionState(
    boundAction,
    initialDeleteCustomerNoteState,
  );
  const label = notePreviewLabel(note.content);
  const forThisNote = state.noteId === note.id;
  const formError = forThisNote ? state.formError : null;
  const reportedSuccess = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) {
      return;
    }

    dialog.showModal();
    dialog.querySelector<HTMLButtonElement>("[data-dialog-cancel]")?.focus();
  }, []);

  useEffect(() => {
    if (!forThisNote || state.status !== "success" || reportedSuccess.current) {
      return;
    }

    reportedSuccess.current = true;
    onDeleted(state.message ?? `${label} was deleted.`);
  }, [forThisNote, label, onDeleted, state.message, state.status]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="delete-note-title"
      aria-describedby="delete-note-description"
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
        <h2 id="delete-note-title" className="text-lg font-semibold">
          Delete {label}?
        </h2>
        <p id="delete-note-description" className="text-sm text-zinc-600 dark:text-zinc-400">
          This removes the note from this customer. Other notes stay unchanged.
        </p>
        <input type="hidden" name="id" value={note.id} />
        <input type="hidden" name="label" value={note.content} />
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
