import Link from "next/link";
import { SiteNav } from "@/app/site-nav";

export default function CaseNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-10 sm:px-8">
      <SiteNav current="cases" />
      <h1 className="text-3xl font-semibold tracking-tight">Case not found</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        That case does not exist, or it may have been deleted.
      </p>
      <Link
        href="/cases"
        className="w-fit text-sm font-medium text-zinc-950 underline underline-offset-4 dark:text-zinc-50"
      >
        Back to cases
      </Link>
    </main>
  );
}
