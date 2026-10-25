"use client";
import { useEffect, useRef, useState } from "react";
type Draft = Record<string, string | boolean>;
export function useGuidedDraft(projectId: string | undefined, kind: string, values: Draft, restore: (draft: Draft) => void) {
  const key = projectId ? `portova.launch-form.v1:${projectId}:${kind}` : null;
  const apply = useRef(restore); apply.current = restore;
  const [loaded, setLoaded] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!key) return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw && raw.length < 50_000) {
        const value = JSON.parse(raw);
        if (value && typeof value === "object" && !Array.isArray(value)) apply.current(Object.fromEntries(Object.entries(value).filter(([, entry]) => typeof entry === "string" || typeof entry === "boolean")) as Draft);
      }
    } catch { setError("The form draft could not be restored. Review every field before signing."); }
    setLoaded(key);
  }, [key]);
  const serialized = JSON.stringify(values);
  useEffect(() => {
    if (!key || loaded !== key) return;
    const timer = window.setTimeout(() => { try { window.localStorage.setItem(key, serialized); setError(null); } catch { setError("This form draft could not be saved. Keep this page open until you finish."); } }, 250);
    return () => window.clearTimeout(timer);
  }, [key, loaded, serialized]);
  return { ready: !key || loaded === key, error };
}
