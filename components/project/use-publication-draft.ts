"use client";
import { useEffect, useRef, useState } from "react";
import type { CreatorProject } from "@/lib/project";
import type { CloudProject } from "@/lib/cloud-project";
import {
  cloudPublicationDraft, emptyPublicationDraft, publicationDraftKey,
  readPublicationDraft, writePublicationDraft, type PublicationDraft,
} from "@/lib/publication-draft";

export function usePublicationDraft(account: string | undefined, project: CreatorProject | null) {
  const key = account && project?.id ? publicationDraftKey(account, project.id) : null;
  const [state, setState] = useState<{ key: string; draft: PublicationDraft } | null>(null);
  const stateRef = useRef(state); stateRef.current = state;
  const [error, setError] = useState<string | null>(null);
  const profile = useRef(project?.profile); profile.current = project?.profile;
  useEffect(() => {
    setError(null);
    if (!key) { setState(null); return; }
    const read = () => {
      try {
        const next = { key, draft: readPublicationDraft(window.localStorage, key, profile.current) };
        stateRef.current = next; setState(next); setError(null);
      } catch {
        const next = { key, draft: emptyPublicationDraft(profile.current) };
        stateRef.current = next; setState(next);
        setError("Publication fields could not be restored. Load the cloud copy before saving. Browser storage must be available to keep changes after refresh.");
      }
    };
    read();
    const sync = (event: StorageEvent) => { if (event.key === key || event.key === null) read(); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [key]);

  const ready = !!key && state?.key === key;
  const draft = ready ? state.draft : emptyPublicationDraft(project?.profile);
  function update(patch: Partial<PublicationDraft>) {
    const previous = stateRef.current;
    if (!key || previous?.key !== key) return;
    try {
      const next = { key, draft: writePublicationDraft(window.localStorage, key, previous.draft, { ...previous.draft, ...patch }) };
      stateRef.current = next; setState(next); setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Publication fields could not be saved in this browser.");
    }
  }
  function fromCloud(row: CloudProject) {
    if (!account) return;
    const target = publicationDraftKey(account, row.id);
    const value = cloudPublicationDraft(row);
    try {
      const next = { key: target, draft: writePublicationDraft(window.localStorage, target, value, value, true) };
      stateRef.current = next; setState(next); setError(null);
    } catch {
      // Keep the trusted cloud values usable in memory, but never claim that
      // browser persistence succeeded when quota/privacy settings prevent it.
      const next = { key: target, draft: value };
      stateRef.current = next; setState(next);
      setError("Cloud fields loaded, but this browser could not keep them. Enable browser storage before editing or refreshing.");
    }
  }
  return { draft, ready, error, update, fromCloud };
}
