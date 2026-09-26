"use client";

import { useActionState, useState } from "react";
import { updateCustomerAction } from "@/app/customers/actions";
import {
  initialCustomerFormState,
  type CustomerField,
} from "@/lib/customer-form-state";
import type { Customer } from "@/lib/customers";

const fields: Array<{
  name: CustomerField;
  label: string;
  type: string;
  required: boolean;
  autoComplete: string;
}> = [
  { name: "name", label: "Name", type: "text", required: true, autoComplete: "name" },
  { name: "email", label: "Email", type: "email", required: true, autoComplete: "email" },
  { name: "phone", label: "Phone", type: "tel", required: false, autoComplete: "tel" },
  { name: "company", label: "Company", type: "text", required: false, autoComplete: "organization" },
];

export function EditCustomerForm({
  customer,
  onCancel,
}: {
  customer: Customer;
  onCancel: () => void;
}) {
  const updateAction = updateCustomerAction.bind(null, customer.id);
  const [state, formAction, pending] = useActionState(
    updateAction,
    initialCustomerFormState,
  );
  const [values, setValues] = useState(valuesFrom(customer));

  return (
    <form
      action={formAction}
      noValidate
      aria-labelledby="edit-customer-heading"
      className="grid gap-4 rounded-lg border border-zinc-200 p-4 sm:grid-cols-2 dark:border-zinc-800"
    >
      <h2 id="edit-customer-heading" className="text-lg font-semibold sm:col-span-2">
        Edit {customer.name}
      </h2>
      {fields.map((field) => {
        const error = state.fieldErrors[field.name];
        const errorId = `edit-${field.name}-error`;
        const inputId = `edit-${field.name}`;

        return (
          <div key={field.name} className="flex flex-col gap-1">
            <label htmlFor={inputId} className="text-sm font-medium">
              {field.label}
              {field.required ? (
                <span aria-hidden="true" className="text-red-700 dark:text-red-400">
                  {" "}
                  *
                </span>
              ) : null}
            </label>
            <input
              id={inputId}
              name={field.name}
              type={field.type}
              required={field.required}
              autoComplete={field.autoComplete}
              value={values[field.name]}
              onChange={(event) =>
                setValues((current) => ({ ...current, [field.name]: event.target.value }))
              }
              disabled={pending}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700"
            />
            {error ? (
              <p id={errorId} role="alert" className="text-sm text-red-700 dark:text-red-400">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
      <div className="flex flex-col items-start gap-3 sm:col-span-2">
        {state.status === "success" && state.message ? (
          <p role="status" className="text-sm text-green-700 dark:text-green-400">
            {state.message}
          </p>
        ) : null}
        {state.formError ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-400">
            {state.formError}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

function valuesFrom(customer: Customer): Record<CustomerField, string> {
  return {
    name: customer.name,
    email: customer.email,
    phone: customer.phone ?? "",
    company: customer.company ?? "",
  };
}
