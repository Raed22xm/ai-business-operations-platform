import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CustomerForm } from "@/app/customers/customer-form";
import { CustomerSearch } from "@/app/customers/customer-search";
import { CustomerTable } from "@/app/customers/customer-table";
import { FlashNotice } from "@/app/flash-notice";
import { noticeValue, withNotice } from "@/lib/flash-notice";
import { ListPagination, lastPageNumber, parsePageParam } from "@/app/list-pagination";
import { SiteNav } from "@/app/site-nav";
import {
  CUSTOMERS_PAGE_SIZE,
  customersPageHref,
  getCustomersPage,
} from "@/lib/customers";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Customers",
};

type CustomersPageProps = {
  searchParams: Promise<{
    search?: string | string[];
    page?: string | string[];
    notice?: string | string[];
  }>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const params = await searchParams;
  const search = searchValue(params.search);
  const page = parsePageParam(params.page);
  const notice = noticeValue(params.notice);
  const result = await getCustomersPage({
    search: search || undefined,
    page,
    pageSize: CUSTOMERS_PAGE_SIZE,
  });
  const lastPage = lastPageNumber(result.totalCount, result.pageSize);
  if (page > lastPage) {
    const href = customersPageHref(search || null, lastPage === 1 ? null : lastPage);
    redirect(notice ? withNotice(href, notice) : href);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10 sm:px-8">
      <SiteNav current="customers" />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Customers</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Add a customer, or edit or delete one in the list.
        </p>
      </div>
      {notice ? (
        <Suspense fallback={null}>
          <FlashNotice message={notice} />
        </Suspense>
      ) : null}
      <CustomerForm />
      <CustomerSearch key={search} initialSearch={search} />
      {result.items.length === 0 ? (
        <EmptyCustomers searching={search !== ""} />
      ) : (
        <CustomerTable
          customers={result.items}
          listSearch={search}
          listPage={page}
        />
      )}
      <ListPagination
        page={page}
        pageSize={result.pageSize}
        totalCount={result.totalCount}
        previousHref={customersPageHref(search || null, page <= 2 ? null : page - 1)}
        nextHref={customersPageHref(search || null, page + 1)}
      />
    </main>
  );
}

function EmptyCustomers({ searching }: { searching: boolean }) {
  return (
    <p className="rounded-lg border border-zinc-200 px-4 py-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
      {searching ? "No customers match your search." : "No customers yet."}
    </p>
  );
}

function searchValue(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ?? "";
}
