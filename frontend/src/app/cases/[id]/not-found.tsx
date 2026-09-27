import Link from "next/link";

export default function CaseNotFound() {
  return (
    <main className="crm-page">
      <h1 className="text-3xl font-semibold tracking-tight">Case not found</h1>
      <p className="text-muted">
        That case does not exist, or it may have been deleted.
      </p>
      <Link
        href="/cases"
        className="w-fit text-sm font-medium text-primary underline underline-offset-4 hover:text-primary-hover"
      >
        Back to cases
      </Link>
    </main>
  );
}
