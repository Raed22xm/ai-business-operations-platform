"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { casesPageHref, type CaseStatus } from "@/lib/cases";

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

export function CaseFilter({
  customers,
  selectedCustomerId,
  selectedStatus,
  search,
}: {
  customers: FilterCustomer[];
  selectedCustomerId: number | null;
  selectedStatus: CaseStatus | null;
  search: string;
}) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(search);

  return (
    <form
      className="crm-filters flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(
          casesPageHref(selectedCustomerId, selectedStatus, searchValue.trim() || null),
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
              router.push(casesPageHref(customerId, selectedStatus, search || null));
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
              router.push(casesPageHref(selectedCustomerId, status, search || null));
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
              router.push(casesPageHref(selectedCustomerId, selectedStatus, null));
            }}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Clear
          </button>
        </div>
      </div>
    </form>
  );
}
