export default function LoadingCustomers() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Customers</h1>
      <p role="status" className="text-zinc-600 dark:text-zinc-400">
        Loading customers…
      </p>
    </main>
  );
}
