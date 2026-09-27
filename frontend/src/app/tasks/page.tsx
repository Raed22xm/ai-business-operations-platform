import { redirect } from "next/navigation";
import { ListPagination, lastPageNumber, parsePageParam } from "@/app/list-pagination";
import { TaskFilter } from "@/app/tasks/task-filter";
import { TaskTable } from "@/app/tasks/task-table";
import { getCases } from "@/lib/cases";
import { getCustomers } from "@/lib/customers";
import type { TaskPriority, TaskStatus } from "@/lib/tasks-shared";
import {
  TASKS_PAGE_SIZE,
  getTasksPage,
  isTaskDueFilter,
  isTaskPriority,
  isTaskSort,
  tasksPageHref,
  type TaskDueFilter,
  type TaskSort,
} from "@/lib/tasks-workspace";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tasks",
};

type TasksPageProps = {
  searchParams: Promise<{
    search?: string | string[];
    customerId?: string | string[];
    caseId?: string | string[];
    status?: string | string[];
    priority?: string | string[];
    due?: string | string[];
    sort?: string | string[];
    page?: string | string[];
  }>;
};

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const params = await searchParams;
  const [customers, cases] = await Promise.all([getCustomers(), getCases()]);
  const selectedCustomerId = selectedIdValue(
    params.customerId,
    customers.map((customer) => customer.id),
  );
  const selectedCaseId = selectedIdValue(
    params.caseId,
    cases
      .filter((work) => selectedCustomerId === null || work.customerId === selectedCustomerId)
      .map((work) => work.id),
  );
  const selectedStatus = selectedStatusValue(params.status);
  const selectedPriority = selectedPriorityValue(params.priority);
  const selectedDue = selectedDueValue(params.due);
  const selectedSort = selectedSortValue(params.sort);
  const search = searchValue(params.search);
  const page = parsePageParam(params.page);

  const result = await getTasksPage({
    search: search || undefined,
    customerId: selectedCustomerId ?? undefined,
    caseId: selectedCaseId ?? undefined,
    status: selectedStatus ?? undefined,
    priority: selectedPriority ?? undefined,
    due: selectedDue ?? undefined,
    sort: selectedSort,
    page,
    pageSize: TASKS_PAGE_SIZE,
  });

  const lastPage = lastPageNumber(result.totalCount, result.pageSize);
  if (page > lastPage) {
    redirect(
      tasksPageHref({
        search: search || null,
        customerId: selectedCustomerId,
        caseId: selectedCaseId,
        status: selectedStatus,
        priority: selectedPriority,
        due: selectedDue,
        sort: selectedSort,
        page: lastPage === 1 ? null : lastPage,
      }),
    );
  }

  const filtered =
    selectedCustomerId !== null ||
    selectedCaseId !== null ||
    selectedStatus !== null ||
    selectedPriority !== null ||
    selectedDue !== null ||
    selectedSort !== "due" ||
    search !== "";

  return (
    <main className="crm-page">
      <div className="crm-page-heading">
        <h1 className="text-3xl font-semibold tracking-tight">Tasks</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Browse tasks across cases. Edit or delete a task from its case details.
        </p>
      </div>
      <section className="crm-records-panel" aria-label="Tasks list">
        <TaskFilter
          key={`${selectedCustomerId ?? ""}-${selectedCaseId ?? ""}-${selectedStatus ?? ""}-${selectedPriority ?? ""}-${selectedDue ?? ""}-${selectedSort}-${search}`}
          customers={customers.map((customer) => ({ id: customer.id, name: customer.name }))}
          cases={cases.map((work) => ({
            id: work.id,
            customerId: work.customerId,
            title: work.title,
            status: work.status,
          }))}
          selectedCustomerId={selectedCustomerId}
          selectedCaseId={selectedCaseId}
          selectedStatus={selectedStatus}
          selectedPriority={selectedPriority}
          selectedDue={selectedDue}
          selectedSort={selectedSort}
          search={search}
        />
        <TaskTable tasks={result.items} filtered={filtered} />
        <ListPagination
          page={page}
          pageSize={result.pageSize}
          totalCount={result.totalCount}
          previousHref={tasksPageHref({
            search: search || null,
            customerId: selectedCustomerId,
            caseId: selectedCaseId,
            status: selectedStatus,
            priority: selectedPriority,
            due: selectedDue,
            sort: selectedSort,
            page: page <= 2 ? null : page - 1,
          })}
          nextHref={tasksPageHref({
            search: search || null,
            customerId: selectedCustomerId,
            caseId: selectedCaseId,
            status: selectedStatus,
            priority: selectedPriority,
            due: selectedDue,
            sort: selectedSort,
            page: page + 1,
          })}
        />
      </section>
    </main>
  );
}

function selectedIdValue(
  value: string | string[] | undefined,
  allowed: number[],
): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^[1-9]\d*$/.test(raw)) {
    return null;
  }

  const id = Number(raw);
  return allowed.includes(id) ? id : null;
}

function selectedStatusValue(value: string | string[] | undefined): TaskStatus | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "Todo" || raw === "InProgress" || raw === "Done") {
    return raw;
  }

  return null;
}

function selectedPriorityValue(value: string | string[] | undefined): TaskPriority | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return isTaskPriority(raw) ? raw : null;
}

function selectedDueValue(value: string | string[] | undefined): TaskDueFilter | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return isTaskDueFilter(raw) ? raw : null;
}

function selectedSortValue(value: string | string[] | undefined): TaskSort {
  const raw = Array.isArray(value) ? value[0] : value;
  return isTaskSort(raw) ? raw : "due";
}

function searchValue(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? "";
}
