"use client";

type OverviewErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function OverviewError({ reset }: OverviewErrorProps) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Overview</h1>
      <p role="alert" className="text-sm text-danger">
        Could not load the overview. Check that the API is running, then try again.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="w-fit rounded-md border border-border bg-surface-raised px-3 py-2 text-sm font-medium text-foreground hover:border-muted"
      >
        Try again
      </button>
    </main>
  );
}
