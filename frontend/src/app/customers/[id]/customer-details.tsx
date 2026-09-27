"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EditCustomerForm } from "@/app/customers/edit-customer-form";
import {
  formatCustomerCreatedAt,
  type Customer,
} from "@/lib/customers-shared";

export function CustomerDetails({
  customer,
  backHref,
  backLabel,
}: {
  customer: Customer;
  backHref: string;
  backLabel: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="crm-details-card flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <a
            href={backHref}
            className="w-fit text-sm font-medium text-zinc-600 underline underline-offset-4 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            {backLabel}
          </a>
          <h1 className="text-3xl font-semibold tracking-tight break-words">{customer.name}</h1>
        </div>
        {editing ? null : (
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setEditing(true);
            }}
            className="w-fit shrink-0 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Edit customer
          </button>
        )}
      </div>

      {notice ? (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {notice}
        </p>
      ) : null}

      {editing ? (
        <EditCustomerForm
          key={customer.id}
          customer={customer}
          onCancel={() => setEditing(false)}
          onSaved={(message) => {
            setEditing(false);
            setNotice(message);
            router.refresh();
          }}
        />
      ) : (
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Email</dt>
            <dd className="text-sm break-words">{customer.email}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Phone</dt>
            <dd className="text-sm">
              <OptionalText value={customer.phone} empty="No phone provided" />
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Company</dt>
            <dd className="text-sm break-words">
              <OptionalText value={customer.company} empty="No company provided" />
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Created (UTC)
            </dt>
            <dd className="text-sm">
              <time dateTime={customer.createdAt}>
                {formatCustomerCreatedAt(customer.createdAt)}
              </time>
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}

function OptionalText({ value, empty }: { value: string | null; empty: string }) {
  if (!value?.trim()) {
    return <span className="text-zinc-500 dark:text-zinc-400">{empty}</span>;
  }

  return value;
}
