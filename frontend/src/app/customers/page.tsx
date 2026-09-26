import { CustomerForm } from "@/app/customers/customer-form";
import { CustomerTable } from "@/app/customers/customer-table";
import { getCustomers } from "@/lib/customers";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Customers",
};

export default async function CustomersPage() {
  const customers = await getCustomers();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10 sm:px-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Customers</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Add a customer, or edit or delete one in the list.
        </p>
      </div>
      <CustomerForm />
      {customers.length === 0 ? <EmptyCustomers /> : <CustomerTable customers={customers} />}
    </main>
  );
}

function EmptyCustomers() {
  return (
    <p className="rounded-lg border border-zinc-200 px-4 py-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
      No customers yet.
    </p>
  );
}
