"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExportCsvButton } from "@/app/export-csv-button";
import { customersExportHref, customersPageHref } from "@/lib/customers-shared";

export function CustomerSearch({
  initialSearch,
  initialFromDate = "",
  initialToDate = "",
}: {
  initialSearch: string;
  initialFromDate?: string;
  initialToDate?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialSearch);
  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(initialToDate);

  return (
    <div className="flex flex-col gap-3">
      <form
        className="crm-filters flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          router.push(
            customersPageHref(
              value.trim() || null,
              null,
              fromDate.trim() || null,
              toDate.trim() || null,
            ),
          );
        }}
      >
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <label htmlFor="customer-search" className="text-sm font-medium">
            Search
          </label>
          <input
            id="customer-search"
            name="search"
            type="search"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Name, email, or company"
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
          />
        </div>
        <div className="flex flex-col gap-1 sm:w-40">
          <label htmlFor="customer-from-date" className="text-sm font-medium">
            From date
          </label>
          <input
            id="customer-from-date"
            name="fromDate"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
          />
        </div>
        <div className="flex flex-col gap-1 sm:w-40">
          <label htmlFor="customer-to-date" className="text-sm font-medium">
            To date
          </label>
          <input
            id="customer-to-date"
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
              setValue("");
              setFromDate("");
              setToDate("");
              router.push(customersPageHref(null));
            }}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Clear
          </button>
        </div>
      </form>
      <ExportCsvButton
        href={customersExportHref(
          initialSearch || null,
          initialFromDate || null,
          initialToDate || null,
        )}
        resourceLabel="Customers"
      />
    </div>
  );
}
