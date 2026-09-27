"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CaseStatus } from "@/lib/cases-shared";
import type { TaskPriority, TaskStatus } from "@/lib/tasks-shared";
import {
  isTaskDueFilter,
  isTaskPriority,
  isTaskSort,
  tasksPageHref,
  type TaskDueFilter,
  type TaskSort,
} from "@/lib/tasks-workspace-shared";

type NamedCustomer = { id: number; name: string };
type NamedCase = { id: number; customerId: number; title: string; status: CaseStatus };

const statusOptions: Array<{ value: "" | TaskStatus; label: string }> = [
  { value: "", label: "All statuses" },
  { value: "Todo", label: "To do" },
  { value: "InProgress", label: "In progress" },
  { value: "Done", label: "Done" },
];

const priorityOptions: Array<{ value: "" | TaskPriority; label: string }> = [
  { value: "", label: "All priorities" },
  { value: "High", label: "High" },
  { value: "Normal", label: "Normal" },
  { value: "Low", label: "Low" },
];

const dueOptions: Array<{ value: "" | TaskDueFilter; label: string }> = [
  { value: "", label: "Any due date" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "none", label: "No due date" },
];

const sortOptions: Array<{ value: TaskSort; label: string }> = [
  { value: "due", label: "Due date" },
  { value: "priority", label: "Priority" },
];

export function TaskFilter({
  customers,
  cases,
  selectedCustomerId,
  selectedCaseId,
  selectedStatus,
  selectedPriority,
  selectedDue,
  selectedSort,
  search,
}: {
  customers: NamedCustomer[];
  cases: NamedCase[];
  selectedCustomerId: number | null;
  selectedCaseId: number | null;
  selectedStatus: TaskStatus | null;
  selectedPriority: TaskPriority | null;
  selectedDue: TaskDueFilter | null;
  selectedSort: TaskSort;
  search: string;
}) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(search);
  const visibleCases = selectedCustomerId
    ? cases.filter((work) => work.customerId === selectedCustomerId)
    : cases;

  function push(next: {
    customerId?: number | null;
    caseId?: number | null;
    status?: TaskStatus | null;
    priority?: TaskPriority | null;
    due?: TaskDueFilter | null;
    sort?: TaskSort | null;
    search?: string | null;
  }) {
    router.push(
      tasksPageHref({
        customerId: next.customerId !== undefined ? next.customerId : selectedCustomerId,
        caseId: next.caseId !== undefined ? next.caseId : selectedCaseId,
        status: next.status !== undefined ? next.status : selectedStatus,
        priority: next.priority !== undefined ? next.priority : selectedPriority,
        due: next.due !== undefined ? next.due : selectedDue,
        sort: next.sort !== undefined ? next.sort : selectedSort,
        search: next.search !== undefined ? next.search : search || null,
      }),
    );
  }

  return (
    <form
      className="crm-filters flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        push({ search: searchValue.trim() || null });
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1">
          <label htmlFor="task-customer-filter" className="text-sm font-medium">
            Customer
          </label>
          <select
            id="task-customer-filter"
            name="customerId"
            value={selectedCustomerId ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              const customerId = value === "" ? null : Number(value);
              const caseStillValid =
                selectedCaseId !== null &&
                cases.some(
                  (work) => work.id === selectedCaseId && work.customerId === customerId,
                );
              push({
                customerId,
                caseId: caseStillValid ? selectedCaseId : null,
              });
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
          <label htmlFor="task-case-filter" className="text-sm font-medium">
            Case
          </label>
          <select
            id="task-case-filter"
            name="caseId"
            value={selectedCaseId ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              push({ caseId: value === "" ? null : Number(value) });
            }}
            className="w-full max-w-xs rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
          >
            <option value="">All cases</option>
            {visibleCases.map((work) => (
              <option key={work.id} value={work.id}>
                {work.title}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="task-status-filter" className="text-sm font-medium">
            Status
          </label>
          <select
            id="task-status-filter"
            name="status"
            value={selectedStatus ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              push({ status: value === "" ? null : (value as TaskStatus) });
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
          <label htmlFor="task-priority-filter" className="text-sm font-medium">
            Priority
          </label>
          <select
            id="task-priority-filter"
            name="priority"
            value={selectedPriority ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              push({
                priority: value === "" ? null : isTaskPriority(value) ? value : null,
              });
            }}
            className="w-full max-w-xs rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
          >
            {priorityOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="task-due-filter" className="text-sm font-medium">
            Due date
          </label>
          <select
            id="task-due-filter"
            name="due"
            value={selectedDue ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              push({ due: value === "" ? null : isTaskDueFilter(value) ? value : null });
            }}
            className="w-full max-w-xs rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
          >
            {dueOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="task-sort" className="text-sm font-medium">
            Sort by
          </label>
          <select
            id="task-sort"
            name="sort"
            value={selectedSort}
            onChange={(event) => {
              const value = event.target.value;
              push({ sort: isTaskSort(value) ? value : "due" });
            }}
            className="w-full max-w-xs rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <label htmlFor="task-search" className="text-sm font-medium">
            Search
          </label>
          <input
            id="task-search"
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
              push({
                customerId: selectedCustomerId,
                caseId: selectedCaseId,
                status: selectedStatus,
                priority: selectedPriority,
                due: selectedDue,
                sort: selectedSort,
                search: null,
              });
            }}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Clear search
          </button>
        </div>
      </div>
    </form>
  );
}
