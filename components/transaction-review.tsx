"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useModalFocus } from "@/components/wallet/use-modal-focus";

export function TransactionReview({ title, expiresAt, onConfirm, onCancel, children }: {
  title: string; expiresAt: number; onConfirm(): void; onCancel(): void; children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(Date.now());
  useModalFocus(true, panel, onCancel);
  useEffect(() => {
    const expiry = window.setTimeout(onCancel, Math.max(0, expiresAt - Date.now()));
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { window.clearTimeout(expiry); window.clearInterval(clock); };
  }, [expiresAt, onCancel]);
  return createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
    <div ref={panel} role="dialog" aria-modal="true" aria-label={title} className="max-h-[calc(100dvh-2rem)] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl border border-violet/50 bg-panel p-5 shadow-2xl">
      <h2 className="text-lg font-semibold">{title}</h2>{children}
      <p className="text-xs text-muted">Review expires in {Math.max(0, Math.ceil((expiresAt - now) / 1000))}s. Your wallet approval is still required.</p>
      <div className="flex flex-wrap gap-3"><button className="min-h-11 rounded-xl bg-violet px-4 text-violet-ink" disabled={now >= expiresAt} onClick={() => { if (Date.now() < expiresAt) onConfirm(); else onCancel(); }}>Continue to wallet</button><button className="min-h-11 rounded-xl border border-line px-4" onClick={onCancel}>Cancel review</button></div>
    </div>
  </div>, document.body);
}
