"use client";
import { useEffect, useRef, type RefObject } from "react";
export function useModalFocus(open: boolean, panel: RefObject<HTMLElement | null>, dismiss: () => void) {
  const close = useRef(dismiss); close.current = dismiss;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null, overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => {
      const closed = Array.from(panel.current?.querySelectorAll("details:not([open])") ?? []);
      return Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex="0"]') ?? []).filter(element => element.getClientRects().length > 0 && !closed.some(details => details.contains(element) && !details.querySelector("summary")?.contains(element)));
    };
    const first = () => focusable()[0]?.focus();
    first();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close.current(); }
      if (event.key !== "Tab") return;
      const items = focusable(), start = items[0], end = items.at(-1);
      if (!start) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === start || !panel.current?.contains(document.activeElement))) { event.preventDefault(); end?.focus(); }
      else if (!event.shiftKey && (document.activeElement === end || !panel.current?.contains(document.activeElement))) { event.preventDefault(); start.focus(); }
    };
    const onFocus = (event: FocusEvent) => { if (!panel.current?.contains(event.target as Node)) first(); };
    document.addEventListener("keydown", onKey); document.addEventListener("focusin", onFocus);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("focusin", onFocus); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, [open, panel]);
}
