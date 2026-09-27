"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EditCaseForm } from "@/app/cases/edit-case-form";
import {
  caseStatusLabel,
  formatCaseCreatedAt,
  type CustomerCase,
} from "@/lib/cases";
import { customerDetailsHref } from "@/lib/customers";

export function CaseDetails({
  work,
  customerName,
  backHref,
  backLabel,
}: {
  work: CustomerCase;
  customerName: string;
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
          <h1 className="text-3xl font-semibold tracking-tight break-words">{work.title}</h1>
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
            Edit case
          </button>
        )}
      </div>

      {notice ? (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {notice}
        </p>
      ) : null}

      {editing ? (
        <EditCaseForm
          key={work.id}
          work={work}
          customerName={customerName}
          onCancel={() => setEditing(false)}
          onSaved={(message) => {
            setEditing(false);
            setNotice(message);
            router.refresh();
          }}
        />
      ) : (
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1 sm:col-span-2">
            <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Description</dt>
            <dd className="text-sm whitespace-pre-wrap break-words">
              {work.description?.trim()
                ? work.description
                : "No description provided"}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Customer</dt>
            <dd className="text-sm">
              <a
                href={customerDetailsHref(work.customerId)}
                className="font-medium text-zinc-950 underline underline-offset-4 dark:text-zinc-50"
              >
                {customerName}
              </a>
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Status</dt>
            <dd className="text-sm"><span className="record-status" data-status={work.status}>{caseStatusLabel(work.status)}</span></dd>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Created (UTC)
            </dt>
            <dd className="text-sm">
              <time dateTime={work.createdAt}>{formatCaseCreatedAt(work.createdAt)}</time>
            </dd>
          </div>
        </dl>
      )}
    </div>
  );
}
