import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-muted/30 px-6 py-16">
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 size-136 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-3xl"
      />
      <section className="relative w-full max-w-xl rounded-3xl border bg-card p-8 text-center shadow-sm sm:p-12">
        <Link
          href="/dashboard"
          className="mx-auto mb-8 flex w-fit items-center gap-2 font-bold tracking-tight"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            N
          </span>
          <span>NeoStats</span>
        </Link>

        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary-foreground">
          Error 404
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          This page wandered off.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-pretty leading-7 text-muted-foreground">
          The address may be incorrect, or the page may have moved. Your
          projects and tasks are still safe.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/80"
          >
            Go to dashboard
          </Link>
          <Link
            href="/projects"
            className="inline-flex h-10 items-center justify-center rounded-lg border bg-background px-5 text-sm font-medium transition hover:bg-muted"
          >
            Browse projects
          </Link>
        </div>
      </section>
    </main>
  );
}
