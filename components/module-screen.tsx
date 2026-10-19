import type { ReactNode } from "react";
import { PageIntro, Panel, StatusPill } from "@/components/ui";

export function ModuleScreen({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageIntro eyebrow={eyebrow} title={title} body={body} />
      {children}
    </div>
  );
}

export function LockedAction({
  label,
  reason,
}: {
  label: string;
  reason: string;
}) {
  return (
    <Panel className="p-4">
      <button
        type="button"
        disabled
        className="rounded-lg bg-violet px-3 py-2 text-sm font-medium text-violet-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        {label}
      </button>
      <p className="mt-3 text-sm leading-6 text-muted">{reason}</p>
    </Panel>
  );
}

export function FactList({
  items,
}: {
  items: { label: string; value: string; state: string }[];
}) {
  return (
    <Panel>
      <ul>
        {items.map((item) => (
          <li
            key={item.label}
            className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-sm text-muted">{item.value}</p>
            </div>
            <StatusPill tone="muted">{item.state}</StatusPill>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
