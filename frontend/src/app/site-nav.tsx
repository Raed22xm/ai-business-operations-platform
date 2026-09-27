import Link from "next/link";

export function SiteNav({
  current,
}: {
  current: "overview" | "customers" | "cases";
}) {
  return (
    <nav
      aria-label="Sections"
      className="flex flex-wrap gap-x-4 gap-y-2 text-sm"
    >
      <Link
        href="/"
        aria-current={current === "overview" ? "page" : undefined}
        className={linkClass(current === "overview")}
      >
        Overview
      </Link>
      <Link
        href="/customers"
        aria-current={current === "customers" ? "page" : undefined}
        className={linkClass(current === "customers")}
      >
        Customers
      </Link>
      <Link
        href="/cases"
        aria-current={current === "cases" ? "page" : undefined}
        className={linkClass(current === "cases")}
      >
        Cases
      </Link>
    </nav>
  );
}

function linkClass(active: boolean): string {
  return active
    ? "font-semibold text-zinc-950 dark:text-zinc-50"
    : "text-zinc-600 underline underline-offset-4 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50";
}
