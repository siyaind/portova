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
      ? "bg-violet text-violet-ink shadow-[0_0_24px_rgb(141_125_255/0.28)] hover:brightness-110 disabled:hover:brightness-100"
      : "border border-line bg-panel text-ink hover:bg-panel-2";
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
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
    <section className={`min-w-0 max-w-full overflow-hidden rounded-2xl border border-white/10 bg-panel/80 shadow-[0_20px_60px_rgb(0_0_0/0.28)] backdrop-blur-md ${className}`}>
      {children}
    </section>
  );
}

export function PageIntro({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <header className="rise max-w-2xl">
      <p className="text-xs font-medium tracking-[0.14em] text-violet uppercase">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted">{body}</p>
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
    ok: "bg-ok/15 text-ok",
    warn: "bg-warn/15 text-warn",
    bad: "bg-bad/15 text-bad",
    muted: "bg-panel-2 text-muted",
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toneClass}`}
    >
      {children}
    </span>
  );
}
