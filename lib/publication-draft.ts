import { canonicalAccount, type CloudProject } from "./cloud-project.ts";
import { PROJECT_CATEGORIES, type ProjectProfile } from "./directory.ts";
import { TESTNET_GENESIS } from "./network.ts";

export type PublicationDraft = {
  localVersion: string | null;
  cloudRevision: number | null;
  description: string;
  published: boolean;
  profile: ProjectProfile;
};
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;

export function publicationDraftKey(account: string, projectId: string) {
  return `portova.publication-draft.v1:${TESTNET_GENESIS}:${canonicalAccount(account)}:${projectId}`;
}

export function emptyPublicationDraft(profile?: ProjectProfile): PublicationDraft {
  return {
    localVersion: null,
    cloudRevision: null,
    description: "",
    published: false,
    profile: profile ?? { category: "Other", website: "", example: false },
  };
}

export function readPublicationDraft(storage: Storage, key: string, profile?: ProjectProfile): PublicationDraft {
  const raw = storage.getItem(key);
  if (raw === null) return emptyPublicationDraft(profile);
  const value = JSON.parse(raw) as PublicationDraft;
  if (!value || typeof value.localVersion !== "string" ||
    !(value.cloudRevision === null || (Number.isSafeInteger(value.cloudRevision) && value.cloudRevision >= 0)) ||
    typeof value.description !== "string" || value.description.length > 1200 ||
    typeof value.published !== "boolean" || !value.profile ||
    !(PROJECT_CATEGORIES as readonly string[]).includes(value.profile.category) ||
    typeof value.profile.website !== "string" || value.profile.website.length > 300 ||
    typeof value.profile.example !== "boolean") {
    throw Error("The saved publication draft is invalid. Load the cloud copy before saving.");
  }
  return value;
}

// Compare browser versions as well as cloud revisions: another tab's draft must
// not be silently overwritten by a stale editor. Explicit cloud loads may replace it.
export function writePublicationDraft(storage: Storage, key: string, previous: PublicationDraft, next: PublicationDraft, replace = false): PublicationDraft {
  if (!replace && readPublicationDraft(storage, key).localVersion !== previous.localVersion)
    throw Error("Publication fields changed in another tab. Reload or load the cloud copy before editing.");
  const saved = { ...next, localVersion: crypto.randomUUID() };
  storage.setItem(key, JSON.stringify(saved));
  return saved;
}

export function cloudPublicationDraft(row: CloudProject): PublicationDraft {
  return {
    ...emptyPublicationDraft(row.project.profile),
    cloudRevision: row.revision,
    description: row.description,
    published: row.published,
  };
}

export function publicationSaveRevision(draft: PublicationDraft, cloud?: CloudProject): number | null {
  if (draft.cloudRevision === null || (cloud && cloud.revision !== draft.cloudRevision)) return null;
  return draft.cloudRevision;
}
