import type { Customer } from "@/lib/customers-shared";
import type { CustomerCase } from "@/lib/cases-shared";

export type CustomerMapNode = {
  customer: Customer;
  cases: CustomerCase[];
  activeCasesCount: number;
  hasActiveCases: boolean;
  latestCaseTitle: string | null;
};
