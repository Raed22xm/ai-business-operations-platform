"use client";

import { useState } from "react";
import { DeleteCustomerDialog } from "@/app/customers/delete-customer-dialog";
import { EditCustomerForm } from "@/app/customers/edit-customer-form";
import { customerDetailsHref, type Customer } from "@/lib/customers";

export function CustomerTable({
  customers,
  listSearch,
  listPage,
}: {
  customers: Customer[];
  listSearch: string;
  listPage: number;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const editing = customers.find((customer) => customer.id === editingId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      {editing ? (
        <EditCustomerForm
          key={editing.id}
          customer={editing}
          onCancel={() => setEditingId(null)}
        />
      ) : null}
      {deleting ? (
        <DeleteCustomerDialog
          key={deleting.id}
          customer={deleting}
          listSearch={listSearch}
          listPage={listPage}
          soleRowOnPage={customers.length === 1}
          onClose={() => setDeleting(null)}
        />
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Name
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Email
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Phone
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Company
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-4 py-3">
                  <a
                    href={customerDetailsHref(
                      customer.id,
                      listSearch || null,
                      listPage > 1 ? listPage : null,
                    )}
                    className="font-medium text-zinc-950 underline underline-offset-4 dark:text-zinc-50"
                  >
                    {customer.name}
                  </a>
                </td>
                <td className="px-4 py-3">{customer.email}</td>
                <td className="px-4 py-3">
                  <OptionalValue value={customer.phone} />
                </td>
                <td className="px-4 py-3">
                  <OptionalValue value={customer.company} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      aria-label={`Edit ${customer.name}`}
                      onClick={() => setEditingId(customer.id)}
                      className="rounded-full border border-zinc-300 px-3 py-1 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${customer.name}`}
                      onClick={() => setDeleting(customer)}
                      className="rounded-full border border-red-700 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-400 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OptionalValue({ value }: { value: string | null }) {
  if (!value) {
    return <span className="text-zinc-400">—</span>;
  }

  return value;
}
