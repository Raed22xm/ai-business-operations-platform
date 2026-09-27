import Link from "next/link";

export default function CustomerNotFound() {
  return (
    <main className="crm-page">
      <h1 className="text-3xl font-semibold tracking-tight">Customer not found</h1>
      <p className="text-muted">
        That customer does not exist, or it may have been deleted.
      </p>
      <Link
        href="/customers"
        className="w-fit text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover"
      >
        Back to customers
      </Link>
    </main>
  );
}
