import { TESTNET_GENESIS } from "./network.ts";
import type { CreatorProject } from "./project.ts";

export const PROJECT_CATEGORIES = [
  "Community",
  "Gaming",
  "Collectibles",
  "DeFi",
  "Developer tools",
  "Other",
] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];
export type ProjectProfile = {
  category: ProjectCategory;
  website: string;
  example: boolean;
};
// Explicit identities of our rehearsal assets. Names are never used as evidence.
export const PORTOVA_EXAMPLE_ASSETS = ["5151", "9192", "9193", "9194"] as const;
export function isExampleAsset(id: string, genesis = TESTNET_GENESIS) {
  return (
    genesis === TESTNET_GENESIS &&
    (PORTOVA_EXAMPLE_ASSETS as readonly string[]).includes(id)
  );
}
export function isExampleProject(project: CreatorProject) {
  return project.profile?.example === true || isExampleAsset(project.assetId);
}
export function safeWebsite(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 300) return null;
  if (!value.trim()) return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function directoryReady(project: CreatorProject, description: string) {
  return (
    description.trim().length >= 30 &&
    !!(project.assetId || project.collectionId || project.poolLpToken)
  );
}
export type RoleEvidence = {
  revision: number;
  block: string;
  checkedAt: string;
  assetOwner: boolean | null;
  collectionOwner: boolean | null;
};
export type DirectoryEntry = {
  id: string;
  name: string;
  description: string;
  category: string;
  website: string;
  example: boolean;
  owner: string;
  revision: number;
  updatedAt: string;
  assetId: string;
  collectionId: string;
  poolLpToken: string;
  review: "unreviewed" | "pending" | "reviewed";
  evidence: RoleEvidence | null;
};
