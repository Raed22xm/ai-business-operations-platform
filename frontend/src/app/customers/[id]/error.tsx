"use client";

type CustomerDetailsErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function CustomerDetailsError({ reset }: CustomerDetailsErrorProps) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-10 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Customer</h1>
      <p role="alert" className="text-red-700 dark:text-red-400">
        Could not load this customer. Check that the API is running, then try again.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="w-fit rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Try again
      </button>
    </main>
  );
}
