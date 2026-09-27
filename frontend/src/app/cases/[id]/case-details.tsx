"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArchiveCaseDialog } from "@/app/cases/archive-case-dialog";
import { EditCaseForm } from "@/app/cases/edit-case-form";
import { RestoreCaseDialog } from "@/app/cases/restore-case-dialog";
import {
  caseArchiveBlockedReason,
  caseStatusLabel,
  formatCaseCreatedAt,
  isCaseArchived,
  type CaseArchiveFilter,
  type CaseListFilters,
  type CaseStatus,
  type CustomerCase,
} from "@/lib/cases-shared";
import { customerDetailsHref } from "@/lib/customers-shared";

export function CaseDetails({
  work,
  customerName,
  backHref,
  backLabel,
  hasIncompleteTasks,
  listFilters,
}: {
  work: CustomerCase;
  customerName: string;
  backHref: string;
  backLabel: string;
  hasIncompleteTasks: boolean;
  listFilters: CaseListFilters;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const archived = isCaseArchived(work);
  const archiveBlockedReason = caseArchiveBlockedReason(work, hasIncompleteTasks);
  const canArchive = archiveBlockedReason === null;
  const listArchive: CaseArchiveFilter = listFilters.archive ?? "active";
  const listStatus: CaseStatus | null = listFilters.status;
  const listSearch = listFilters.search ?? "";
  const listPage = listFilters.page ?? 1;

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
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight break-words">{work.title}</h1>
            {archived ? (
              <span className="record-status" data-status="Archived">
                Archived
              </span>
            ) : null}
          </div>
        </div>
        {editing ? null : (
          <div className="flex flex-wrap gap-2">
            {archived ? (
              <button
                type="button"
                onClick={() => {
                  setNotice(null);
                  setRestoring(true);
                }}
                className="w-fit shrink-0 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Restore
              </button>
            ) : (
              <>
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
                {canArchive ? (
                  <button
                    type="button"
                    onClick={() => {
                      setNotice(null);
                      setArchiving(true);
                    }}
                    className="w-fit shrink-0 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    Archive
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    title={archiveBlockedReason ?? undefined}
                    aria-describedby="archive-unavailable-reason"
                    className="w-fit shrink-0 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium opacity-60 disabled:cursor-not-allowed dark:border-zinc-700"
                  >
                    Archive
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {!archived && !canArchive && archiveBlockedReason ? (
        <p
          id="archive-unavailable-reason"
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          {archiveBlockedReason}
        </p>
      ) : null}

      {archived ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This case is archived and read-only. Restore it to edit the case or its tasks.
        </p>
      ) : null}

      {notice ? (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {notice}
        </p>
      ) : null}

      {archiving ? (
        <ArchiveCaseDialog
          work={work}
          listCustomerId={listFilters.customerId}
          listStatus={listStatus}
          listSearch={listSearch}
          listArchive={listArchive}
          listPage={listPage}
          returnTo="details"
          onClose={() => setArchiving(false)}
        />
      ) : null}

      {restoring ? (
        <RestoreCaseDialog
          work={work}
          listCustomerId={listFilters.customerId}
          listStatus={listStatus}
          listSearch={listSearch}
          listArchive={listArchive}
          listPage={listPage}
          returnTo="details"
          onClose={() => setRestoring(false)}
        />
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
            <dd className="text-sm">
              <span className="record-status" data-status={work.status}>
                {caseStatusLabel(work.status)}
              </span>
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Created (UTC)
            </dt>
            <dd className="text-sm">
              <time dateTime={work.createdAt}>{formatCaseCreatedAt(work.createdAt)}</time>
            </dd>
          </div>
          {archived && work.archivedAt ? (
            <div className="flex flex-col gap-1">
              <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Archived (UTC)
              </dt>
              <dd className="text-sm">
                <time dateTime={work.archivedAt}>{formatCaseCreatedAt(work.archivedAt)}</time>
              </dd>
            </div>
          ) : null}
        </dl>
      )}
    </div>
  );
}
