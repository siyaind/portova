import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

export function Button({
  variant = "ghost",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  const styles =
    variant === "primary"
      ? "bg-violet text-violet-ink shadow-[0_4px_20px_rgb(186_155_255/0.15)] hover:brightness-110 disabled:hover:brightness-100"
      : "border border-line bg-panel text-ink hover:bg-panel-2";
  return (
    <button
      type={type}
      className={`portal-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`portal-panel min-w-0 max-w-full overflow-hidden rounded-2xl border border-white/8 ${className}`}>
      {children}
    </section>
  );
}

export function PageIntro({
  eyebrow,
  title,
  body,
  as: Heading = "h1",
}: {
  eyebrow: string;
  title: string;
  body: string;
  as?: "h1" | "h2";
}) {
  return (
    <header className="page-intro rise max-w-3xl">
      <p className="page-eyebrow text-[10px] font-semibold tracking-[0.2em] text-violet uppercase">
        {eyebrow}
      </p>
      <Heading className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-[2.6rem] sm:leading-tight">
        {title}
      </Heading>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">{body}</p>
    </header>
  );
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "bad" | "muted";
  children: ReactNode;
}) {
  const toneClass = {
    ok: "bg-ok/10 text-ok border-ok/15",
    warn: "bg-warn/10 text-warn border-warn/15",
    bad: "bg-bad/10 text-bad border-bad/15",
    muted: "bg-panel-2 text-muted border-white/5",
  }[tone];
  return (
    <span
      className={`status-pill inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium ${toneClass}`}
    >
      {children}
    </span>
  );
}
