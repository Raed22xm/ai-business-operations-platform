"use client";

import { useActionState, useEffect, useRef } from "react";
import { deleteCustomerAction } from "@/app/customers/actions";
import { initialDeleteCustomerState } from "@/lib/customer-form-state";
import type { Customer } from "@/lib/customers";

export function DeleteCustomerDialog({
  customer,
  listSearch,
  listPage,
  soleRowOnPage,
  onClose,
}: {
  customer: Customer;
  listSearch: string;
  listPage: number;
  soleRowOnPage: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(
    deleteCustomerAction,
    initialDeleteCustomerState,
  );
  const forThisCustomer = state.customerId === customer.id;
  const formError = forThisCustomer ? state.formError : null;

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
      aria-labelledby="delete-customer-title"
      aria-describedby="delete-customer-description"
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
        <h2 id="delete-customer-title" className="text-lg font-semibold">
          Delete {customer.name}?
        </h2>
        <p id="delete-customer-description" className="text-sm text-zinc-600 dark:text-zinc-400">
          This removes {customer.name} from the customer list.
        </p>
        <input type="hidden" name="id" value={customer.id} />
        <input type="hidden" name="name" value={customer.name} />
        <input type="hidden" name="listSearch" value={listSearch} />
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
