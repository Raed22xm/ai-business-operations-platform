"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExportCsvButton } from "@/app/export-csv-button";
import {
  casesExportHref,
  casesPageHref,
  type CaseArchiveFilter,
  type CaseStatus,
} from "@/lib/cases-shared";

type FilterCustomer = {
  id: number;
  name: string;
};

const statusOptions: Array<{ value: "" | CaseStatus; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "Open", label: "Open" },
  { value: "InProgress", label: "In progress" },
  { value: "Closed", label: "Closed" },
];

const archiveOptions: Array<{ value: CaseArchiveFilter; label: string }> = [
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];

export function CaseFilter({
  customers,
  selectedCustomerId,
  selectedStatus,
  selectedArchive,
  selectedFromDate = "",
  selectedToDate = "",
  search,
}: {
  customers: FilterCustomer[];
  selectedCustomerId: number | null;
  selectedStatus: CaseStatus | null;
  selectedArchive: CaseArchiveFilter;
  selectedFromDate?: string;
  selectedToDate?: string;
  search: string;
}) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(search);
  const [fromDate, setFromDate] = useState(selectedFromDate);
  const [toDate, setToDate] = useState(selectedToDate);

  return (
    <div className="flex flex-col gap-3">
      <form
        className="crm-filters flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          router.push(
            casesPageHref(
              selectedCustomerId,
              selectedStatus,
              searchValue.trim() || null,
              null,
              selectedArchive,
              fromDate.trim() || null,
              toDate.trim() || null,
            ),
          );
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-col gap-1">
            <label htmlFor="customer-filter" className="text-sm font-medium">
              Customer
            </label>
            <select
              id="customer-filter"
              name="customerId"
              value={selectedCustomerId ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                const customerId = value === "" ? null : Number(value);
                router.push(
                  casesPageHref(
                    customerId,
                    selectedStatus,
                    search || null,
                    null,
                    selectedArchive,
                    fromDate.trim() || null,
                    toDate.trim() || null,
                  ),
                );
              }}
              className="w-full max-w-xs rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
            >
              <option value="">All customers</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="status-filter" className="text-sm font-medium">
              Status
            </label>
            <select
              id="status-filter"
              name="status"
              value={selectedStatus ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                const status = value === "" ? null : (value as CaseStatus);
                router.push(
                  casesPageHref(
                    selectedCustomerId,
                    status,
                    search || null,
                    null,
                    selectedArchive,
                    fromDate.trim() || null,
                    toDate.trim() || null,
                  ),
                );
              }}
              className="w-full max-w-xs rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
            >
              {statusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="archive-filter" className="text-sm font-medium">
              Archive
            </label>
            <select
              id="archive-filter"
              name="archive"
              value={selectedArchive}
              onChange={(event) => {
                const archive = event.target.value as CaseArchiveFilter;
                router.push(
                  casesPageHref(
                    selectedCustomerId,
                    selectedStatus,
                    search || null,
                    null,
                    archive,
                    fromDate.trim() || null,
                    toDate.trim() || null,
                  ),
                );
              }}
              className="w-full max-w-xs rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
            >
              {archiveOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
            <label htmlFor="case-search" className="text-sm font-medium">
              Search
            </label>
            <input
              id="case-search"
              name="search"
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Title or description"
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
            />
          </div>
          <div className="flex flex-col gap-1 sm:w-40">
            <label htmlFor="case-from-date" className="text-sm font-medium">
              From date
            </label>
            <input
              id="case-from-date"
              name="fromDate"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
            />
          </div>
          <div className="flex flex-col gap-1 sm:w-40">
            <label htmlFor="case-to-date" className="text-sm font-medium">
              To date
            </label>
            <input
              id="case-to-date"
              name="toDate"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchValue("");
                setFromDate("");
                setToDate("");
                router.push(
                  casesPageHref(selectedCustomerId, selectedStatus, null, null, selectedArchive),
                );
              }}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Clear
            </button>
          </div>
        </div>
      </form>
      <ExportCsvButton
        href={casesExportHref(
          selectedCustomerId,
          selectedStatus,
          search || null,
          selectedArchive,
          selectedFromDate || null,
          selectedToDate || null,
        )}
        resourceLabel="Cases"
      />
    </div>
  );
}
