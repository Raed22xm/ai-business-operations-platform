"use client";

import { useState } from "react";
import { ArchiveCaseDialog } from "@/app/cases/archive-case-dialog";
import { DeleteCaseDialog } from "@/app/cases/delete-case-dialog";
import { EditCaseForm } from "@/app/cases/edit-case-form";
import { RestoreCaseDialog } from "@/app/cases/restore-case-dialog";
import {
  caseDetailsHref,
  caseStatusLabel,
  formatCaseCreatedAt,
  isCaseArchived,
  type CaseArchiveFilter,
  type CaseStatus,
  type CustomerCase,
} from "@/lib/cases-shared";

type NamedCustomer = {
  id: number;
  name: string;
};

export function CaseTable({
  cases,
  customers,
  filteredByCustomer,
  filteredByStatus,
  filteredBySearch,
  filteredByArchive,
  listCustomerId,
  listStatus,
  listSearch,
  listArchive,
  listPage,
}: {
  cases: CustomerCase[];
  customers: NamedCustomer[];
  filteredByCustomer: boolean;
  filteredByStatus: boolean;
  filteredBySearch: boolean;
  filteredByArchive: boolean;
  listCustomerId: number | null;
  listStatus: CaseStatus | null;
  listSearch: string;
  listArchive: CaseArchiveFilter;
  listPage: number;
}) {
  const [editing, setEditing] = useState<CustomerCase | null>(null);
  const [deleting, setDeleting] = useState<CustomerCase | null>(null);
  const [archiving, setArchiving] = useState<CustomerCase | null>(null);
  const [restoring, setRestoring] = useState<CustomerCase | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      {notice ? (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          {notice}
        </p>
      ) : null}
      {editing ? (
        <EditCaseForm
          key={editing.id}
          work={editing}
          customerName={customerName(customers, editing.customerId)}
          onCancel={() => setEditing(null)}
          onSaved={(message) => {
            setEditing(null);
            setNotice(message);
          }}
        />
      ) : null}
      {deleting ? (
        <DeleteCaseDialog
          key={deleting.id}
          work={deleting}
          listCustomerId={listCustomerId}
          listStatus={listStatus}
          listSearch={listSearch}
          listArchive={listArchive}
          listPage={listPage}
          soleRowOnPage={cases.length === 1}
          onClose={() => setDeleting(null)}
        />
      ) : null}
      {archiving ? (
        <ArchiveCaseDialog
          key={`archive-${archiving.id}`}
          work={archiving}
          listCustomerId={listCustomerId}
          listStatus={listStatus}
          listSearch={listSearch}
          listArchive={listArchive}
          listPage={listPage}
          returnTo="list"
          onClose={() => setArchiving(null)}
        />
      ) : null}
      {restoring ? (
        <RestoreCaseDialog
          key={`restore-${restoring.id}`}
          work={restoring}
          listCustomerId={listCustomerId}
          listStatus={listStatus}
          listSearch={listSearch}
          listArchive={listArchive}
          listPage={listPage}
          returnTo="list"
          onClose={() => setRestoring(null)}
        />
      ) : null}
      {cases.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 px-4 py-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          {emptyMessage(
            filteredByCustomer,
            filteredByStatus,
            filteredBySearch,
            filteredByArchive,
          )}
        </p>
      ) : (
        <div className="crm-table-scroll">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Title
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Customer
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Created
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {cases.map((work) => {
                const archived = isCaseArchived(work);
                return (
                  <tr key={work.id} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={caseDetailsHref(work.id, {
                            customerId: listCustomerId,
                            status: listStatus,
                            search: listSearch || null,
                            archive: listArchive,
                            page: listPage > 1 ? listPage : null,
                          })}
                          className="font-medium text-zinc-950 underline underline-offset-4 dark:text-zinc-50"
                        >
                          {work.title}
                        </a>
                        {archived ? (
                          <span className="record-status" data-status="Archived">
                            Archived
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">{customerName(customers, work.customerId)}</td>
                    <td className="px-4 py-3">
                      <span className="record-status" data-status={work.status}>
                        {caseStatusLabel(work.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatCaseCreatedAt(work.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        {archived ? (
                          <button
                            type="button"
                            aria-label={`Restore ${work.title}`}
                            onClick={() => setRestoring(work)}
                            className="rounded-full border border-zinc-300 px-3 py-1 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                          >
                            Restore
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              aria-label={`Edit ${work.title}`}
                              onClick={() => setEditing(work)}
                              className="rounded-full border border-zinc-300 px-3 py-1 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                            >
                              Edit
                            </button>
                            {work.status === "Closed" ? (
                              <button
                                type="button"
                                aria-label={`Archive ${work.title}`}
                                onClick={() => setArchiving(work)}
                                className="rounded-full border border-zinc-300 px-3 py-1 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                              >
                                Archive
                              </button>
                            ) : null}
                            <button
                              type="button"
                              aria-label={`Delete ${work.title}`}
                              onClick={() => setDeleting(work)}
                              className="rounded-full border border-red-700 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-950"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function emptyMessage(
  filteredByCustomer: boolean,
  filteredByStatus: boolean,
  filteredBySearch: boolean,
  filteredByArchive: boolean,
): string {
  const filterCount =
    Number(filteredByCustomer) +
    Number(filteredByStatus) +
    Number(filteredBySearch) +
    Number(filteredByArchive);
  if (filterCount >= 2) {
    return "No cases match these filters.";
  }
  if (filteredBySearch) {
    return "No cases match your search.";
  }
  if (filteredByCustomer) {
    return "No cases for this customer.";
  }
  if (filteredByStatus) {
    return "No cases with this status.";
  }
  if (filteredByArchive) {
    return "No archived cases.";
  }
  return "No cases yet.";
}

function customerName(customers: NamedCustomer[], id: number): string {
  return customers.find((customer) => customer.id === id)?.name ?? "Unknown customer";
}
