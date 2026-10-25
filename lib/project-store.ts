import { parseProject, type CreatorProject } from "./project.ts";
export type ProjectStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void };
export function changeProjectRecord(storage: ProjectStorage, key: string, change: (current: CreatorProject | null) => CreatorProject | null, allowInvalid = false) {
  const raw = storage.getItem(key), current = parseProject(raw);
  if (raw && !current && !allowInvalid) throw Error("The stored project is invalid. Clear it explicitly before replacing it.");
  const next = change(current);
  if (next) storage.setItem(key, JSON.stringify(next)); else storage.removeItem(key);
  return next;
}
