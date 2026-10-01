import { Suspense } from "react";
import { getCustomers } from "@/lib/customers";
import { getCases } from "@/lib/cases";
import type { CustomerMapNode } from "./types";
import { CustomerMapView } from "./customer-map-view";
import "./map.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customer Map · Operations Hub" };

export default async function MapPage() {
  return (
    <Suspense fallback={<MapPageSkeleton />}>
      <MapDataFetcher />
    </Suspense>
  );
}

async function MapDataFetcher() {
  const [customers, cases] = await Promise.all([
    getCustomers().catch(() => []),
    getCases().catch(() => []),
  ]);

  const nodes: CustomerMapNode[] = customers.map((customer) => {
    const customerCases = cases.filter((work) => work.customerId === customer.id);
    const activeCases = customerCases.filter((work) => work.status !== "Closed");
    return {
      customer,
      cases: customerCases,
      activeCasesCount: activeCases.length,
      hasActiveCases: activeCases.length > 0,
      latestCaseTitle: customerCases.length > 0 ? customerCases[0].title : null,
    };
  });

  return <CustomerMapView nodes={nodes} />;
}

function MapPageSkeleton() {
  return (
    <div className="map-page-container">
      <div className="map-header-skeleton animate-pulse">
        <div className="h-8 w-48 bg-slate-800 rounded mb-2" />
        <div className="h-4 w-72 bg-slate-800/60 rounded" />
      </div>
      <div className="map-canvas-skeleton animate-pulse">
        <div className="h-[520px] w-full bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-center">
          <span className="text-slate-400 text-sm">Loading customer network map…</span>
        </div>
      </div>
    </div>
  );
}
