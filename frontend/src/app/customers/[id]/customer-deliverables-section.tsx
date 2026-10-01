"use client";

import { useEffect, useState } from "react";
import {
  type CustomerDeliverable,
  type CustomerMeta,
  DELIVERABLE_CATEGORIES,
  getCustomerMeta,
  loadAllCustomerMeta,
  saveAllCustomerMeta,
} from "@/app/map/customer-meta";
import { CustomerMetaSection } from "@/app/map/customer-meta-section";

export function CustomerDeliverablesSection({
  customerId,
  customerName,
  company,
}: {
  customerId: number;
  customerName: string;
  company?: string | null;
}) {
  const [meta, setMeta] = useState<CustomerMeta | null>(null);

  useEffect(() => {
    setMeta(getCustomerMeta(customerId, customerName, company));
  }, [customerId, customerName, company]);

  if (!meta) return null;

  function handleUpdateMeta(newMeta: CustomerMeta) {
    setMeta(newMeta);
    const all = loadAllCustomerMeta();
    all[customerId] = newMeta;
    saveAllCustomerMeta(all);
  }

  return (
    <div className="crm-section flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">
          Services, Deliverables &amp; Technology
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Track what has been built for {customerName} (websites, apps, AI automations) and the tools &amp; technology applied.
        </p>
      </div>

      <CustomerMetaSection
        customerId={customerId}
        customerName={customerName}
        meta={meta}
        onUpdateMeta={handleUpdateMeta}
      />
    </div>
  );
}
