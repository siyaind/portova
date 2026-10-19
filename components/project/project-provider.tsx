"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  PROJECT_STORAGE_KEY,
  normalizeProject,
  parseProject,
  projectError,
  type CreatorProject,
} from "@/lib/project";

type ProjectValue = {
  ready: boolean;
  project: CreatorProject | null;
  save: (draft: CreatorProject) => string | null;
  clear: () => void;
};

const ProjectContext = createContext<ProjectValue | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [project, setProject] = useState<CreatorProject | null>(null);

  useEffect(() => {
    setProject(parseProject(window.localStorage.getItem(PROJECT_STORAGE_KEY)));
    setReady(true);
  }, []);

  const save = useCallback((draft: CreatorProject) => {
    const next = normalizeProject(draft);
    const error = projectError(next);
    if (error) return error;
    try {
      window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      return "This browser did not keep the project record.";
    }
    setProject(next);
    return null;
  }, []);

  const clear = useCallback(() => {
    window.localStorage.removeItem(PROJECT_STORAGE_KEY);
    setProject(null);
  }, []);

  const value = useMemo(
    () => ({ ready, project, save, clear }),
    [ready, project, save, clear],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectValue {
  const value = useContext(ProjectContext);
  if (!value) throw new Error("useProject must be used inside ProjectProvider");
  return value;
}
