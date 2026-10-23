import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-lg py-10">
      <p className="text-xs font-medium tracking-[0.14em] text-violet uppercase">
        404
      </p>
      <h1 className="mt-2 text-2xl font-semibold">This page is not in the shell</h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        The route does not exist. Financial data is not implied by a missing page.
      </p>
      <Link
        href="/overview"
        className="mt-5 inline-flex rounded-lg border border-line px-3 py-2 text-sm hover:bg-panel"
      >
        Back to overview
      </Link>
    </div>
  );
}
