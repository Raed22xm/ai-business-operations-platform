import {
  caseDetailsHref,
  caseStatusLabel,
  formatCaseCreatedAt,
  type CustomerCase,
} from "@/lib/cases";

export function CustomerCasesSection({
  customerName,
  casesHref,
  cases,
  loadError,
}: {
  customerName: string;
  casesHref: string;
  cases: CustomerCase[] | null;
  loadError: string | null;
}) {
  return (
    <section aria-labelledby="customer-cases-heading" className="crm-section flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="customer-cases-heading" className="text-xl font-semibold tracking-tight">
          Cases
        </h2>
        <a
          href={casesHref}
          className="w-fit text-sm font-medium text-zinc-950 underline underline-offset-4 dark:text-zinc-50"
        >
          View all cases for {customerName}
        </a>
      </div>

      {loadError ? (
        <p role="alert" className="rounded-lg border border-red-200 px-4 py-6 text-red-700 dark:border-red-900 dark:text-red-400">
          {loadError}
        </p>
      ) : cases === null || cases.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 px-4 py-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          No cases for this customer.
        </p>
      ) : (
        <div className="crm-table-scroll">
          <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Title
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {cases.map((work) => (
                <tr key={work.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-4 py-3">
                    <a
                      href={caseDetailsHref(work.id)}
                      className="font-medium text-zinc-950 underline underline-offset-4 dark:text-zinc-50"
                    >
                      {work.title}
                    </a>
                  </td>
                  <td className="px-4 py-3"><span className="record-status" data-status={work.status}>{caseStatusLabel(work.status)}</span></td>
                  <td className="px-4 py-3">{formatCaseCreatedAt(work.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
