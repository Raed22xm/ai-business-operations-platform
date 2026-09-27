import { Suspense } from "react";
import Link from "next/link";
import { DashboardLoading } from "@/app/dashboard-loading";
import { SiteNav } from "@/app/site-nav";
import { casesPageHref } from "@/lib/cases";
import { getDashboardSummary, type DashboardSummary } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Overview",
};

export default function Home() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <OverviewDashboard />
    </Suspense>
  );
}

async function OverviewDashboard() {
  const summary = await getDashboardSummary();
  const isEmpty = summary.totalCustomers === 0 && summary.totalCases === 0;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10 sm:px-8">
      <SiteNav current="overview" />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Current customer and case counts.
        </p>
      </div>

      {isEmpty ? (
        <EmptyOverview />
      ) : (
        <SummaryContent summary={summary} />
      )}
    </main>
  );
}

function SummaryContent({ summary }: { summary: DashboardSummary }) {
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="totals-heading" className="flex flex-col gap-3">
        <h2 id="totals-heading" className="text-lg font-semibold tracking-tight">
          Totals
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <Link
              href="/customers"
              className="block rounded-lg border border-zinc-200 px-4 py-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Customers</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {summary.totalCustomers}
              </p>
            </Link>
          </li>
          <li>
            <Link
              href="/cases"
              className="block rounded-lg border border-zinc-200 px-4 py-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Cases</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {summary.totalCases}
              </p>
            </Link>
          </li>
        </ul>
      </section>

      <section aria-labelledby="status-heading" className="flex flex-col gap-3">
        <h2 id="status-heading" className="text-lg font-semibold tracking-tight">
          Cases by status
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          <StatusCard
            label="Open"
            count={summary.openCases}
            href={casesPageHref(null, "Open", null)}
          />
          <StatusCard
            label="In progress"
            count={summary.inProgressCases}
            href={casesPageHref(null, "InProgress", null)}
          />
          <StatusCard
            label="Closed"
            count={summary.closedCases}
            href={casesPageHref(null, "Closed", null)}
          />
        </ul>
      </section>

      <nav aria-label="Quick links" className="flex flex-wrap gap-4 text-sm">
        <Link
          href="/customers"
          className="text-zinc-600 underline underline-offset-4 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          View customers
        </Link>
        <Link
          href="/cases"
          className="text-zinc-600 underline underline-offset-4 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          View cases
        </Link>
      </nav>
    </div>
  );
}

function StatusCard({
  label,
  count,
  href,
}: {
  label: string;
  count: number;
  href: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="block rounded-lg border border-zinc-200 px-4 py-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{count}</p>
      </Link>
    </li>
  );
}

function EmptyOverview() {
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg border border-zinc-200 px-4 py-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
        No customers or cases yet. Add a customer to get started.
      </p>
      <nav aria-label="Quick links" className="flex flex-wrap gap-4 text-sm">
        <Link
          href="/customers"
          className="text-zinc-600 underline underline-offset-4 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          View customers
        </Link>
        <Link
          href="/cases"
          className="text-zinc-600 underline underline-offset-4 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          View cases
        </Link>
      </nav>
    </div>
  );
}
