"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { PROJECT_STORAGE_KEY, attachProjectObject, normalizeProject, parseProject, projectError, saveProjectVersion, type CreatorProject, type ProjectField } from "@/lib/project";
import { withBrowserLock } from "@/lib/browser-lock";
import { changeProjectRecord } from "@/lib/project-store";
type ProjectValue = {
  ready: boolean; project: CreatorProject | null; storageError: string | null;
  save(draft: CreatorProject): Promise<string | null>; clear(): Promise<string | null>;
  attach(projectId: string, field: ProjectField, id: string, actor: string): Promise<string | null>;
};
const ProjectContext = createContext<ProjectValue | null>(null);
export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false), [project, setProject] = useState<CreatorProject | null>(null), [storageError, setStorageError] = useState<string | null>(null);
  useEffect(() => {
    const load = () => {
      try {
        const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY), next = parseProject(raw);
        setProject(next); setStorageError(raw && !next ? "The saved project is invalid. Inspect or clear this browser record before saving another." : null);
      } catch { setStorageError("Project storage is unavailable. Enable browser storage to save or resume a project."); }
      setReady(true);
    };
    load();
    const sync = (event: StorageEvent) => { if (event.key === PROJECT_STORAGE_KEY || event.key === null) load(); };
    window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync);
  }, []);
  const mutate = useCallback(async (change: (current: CreatorProject | null) => CreatorProject | null, allowInvalid = false) => {
    try {
      await withBrowserLock("portova:project", () => {
        const next = changeProjectRecord(window.localStorage, PROJECT_STORAGE_KEY, change, allowInvalid);
        setProject(next); setStorageError(null);
      });
      return null;
    } catch (cause) { const message = cause instanceof Error ? cause.message : "The browser did not keep the project record."; setStorageError(message); return message; }
  }, []);
  const save = useCallback(async (draft: CreatorProject) => {
    const next = normalizeProject(draft), error = projectError(next); if (error) return error;
    return mutate(current => saveProjectVersion(current, next));
  }, [mutate]);
  const clear = useCallback(() => mutate(current => {
    if ((current?.id ?? null) !== (project?.id ?? null) || (current?.revision ?? 0) !== (project?.revision ?? 0)) throw Error("The project changed in another tab. Review it before clearing this record.");
    return null;
  }, true), [mutate, project]);
  const attach = useCallback((projectId: string, field: ProjectField, id: string, actor: string) => mutate(current => attachProjectObject(current, projectId, field, id, actor)), [mutate]);
  const value = useMemo(() => ({ ready, project, storageError, save, clear, attach }), [ready, project, storageError, save, clear, attach]);
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}
export function useProject(): ProjectValue { const value = useContext(ProjectContext); if (!value) throw Error("useProject must be used inside ProjectProvider"); return value; }
