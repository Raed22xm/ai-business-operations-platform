import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CaseFilter } from "@/app/cases/case-filter";
import { CaseForm } from "@/app/cases/case-form";
import { CaseTable } from "@/app/cases/case-table";
import { FlashNotice } from "@/app/flash-notice";
import { noticeValue, withNotice } from "@/lib/flash-notice";
import { ListPagination, lastPageNumber, parsePageParam } from "@/app/list-pagination";
import {
  CASES_PAGE_SIZE,
  casesPageHref,
  getCasesPage,
  type CaseStatus,
} from "@/lib/cases";
import { getCustomers } from "@/lib/customers";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cases",
};

type CasesPageProps = {
  searchParams: Promise<{
    customerId?: string | string[];
    status?: string | string[];
    search?: string | string[];
    page?: string | string[];
    notice?: string | string[];
  }>;
};

export default async function CasesPage({ searchParams }: CasesPageProps) {
  const params = await searchParams;
  const customers = await getCustomers();
  const selectedCustomerId = selectedCustomerIdValue(params.customerId, customers);
  const selectedStatus = selectedStatusValue(params.status);
  const search = searchValue(params.search);
  const page = parsePageParam(params.page);
  const notice = noticeValue(params.notice);
  const result = await getCasesPage({
    customerId: selectedCustomerId ?? undefined,
    status: selectedStatus ?? undefined,
    search: search || undefined,
    page,
    pageSize: CASES_PAGE_SIZE,
  });
  const lastPage = lastPageNumber(result.totalCount, result.pageSize);
  if (page > lastPage) {
    const href = casesPageHref(
      selectedCustomerId,
      selectedStatus,
      search || null,
      lastPage === 1 ? null : lastPage,
    );
    redirect(notice ? withNotice(href, notice) : href);
  }

  const namedCustomers = customers.map((customer) => ({ id: customer.id, name: customer.name }));

  return (
    <main className="crm-page">
      <div className="crm-page-heading">
        <h1 className="text-3xl font-semibold tracking-tight">Cases</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Add a case, or edit or delete one in the list.
        </p>
      </div>
      {notice ? (
        <Suspense fallback={null}>
          <FlashNotice message={notice} />
        </Suspense>
      ) : null}
      <div className="crm-list-layout">
        <div className="crm-create-column">{customers.length === 0 ? <NoCustomers /> : <CaseForm customers={namedCustomers} />}</div>
        <section className="crm-records-panel" aria-label="Cases list">
          <CaseFilter
            key={`${selectedCustomerId ?? ""}-${selectedStatus ?? ""}-${search}`}
            customers={namedCustomers}
            selectedCustomerId={selectedCustomerId}
            selectedStatus={selectedStatus}
            search={search}
          />
          <CaseTable
            cases={result.items}
            customers={namedCustomers}
            filteredByCustomer={selectedCustomerId !== null}
            filteredByStatus={selectedStatus !== null}
            filteredBySearch={search !== ""}
            listCustomerId={selectedCustomerId}
            listStatus={selectedStatus}
            listSearch={search}
            listPage={page}
          />
          <ListPagination
            page={page}
            pageSize={result.pageSize}
            totalCount={result.totalCount}
            previousHref={casesPageHref(
              selectedCustomerId,
              selectedStatus,
              search || null,
              page <= 2 ? null : page - 1,
            )}
            nextHref={casesPageHref(
              selectedCustomerId,
              selectedStatus,
              search || null,
              page + 1,
            )}
          />
        </section>
      </div>
    </main>
  );
}

function NoCustomers() {
  return (
    <p className="rounded-lg border border-zinc-200 px-4 py-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
      Add a customer before creating a case.{" "}
      <Link href="/customers" className="font-medium text-zinc-950 underline underline-offset-4 dark:text-zinc-50">
        Go to customers
      </Link>
    </p>
  );
}

function selectedCustomerIdValue(
  value: string | string[] | undefined,
  customers: Array<{ id: number }>,
): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^[1-9]\d*$/.test(raw)) {
    return null;
  }

  const id = Number(raw);
  return customers.some((customer) => customer.id === id) ? id : null;
}

function selectedStatusValue(value: string | string[] | undefined): CaseStatus | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "Open" || raw === "InProgress" || raw === "Closed") {
    return raw;
  }

  return null;
}

function searchValue(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? "";
}
