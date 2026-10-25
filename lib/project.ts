import { checkAddress } from "@polkadot/util-crypto";
import type { PoolView } from "@/lib/pools";
import { SS58_PREFIX } from "./network.ts";
import { sameAccount } from "./withdrawal.ts";

export const PROJECT_STORAGE_KEY = "portova.creator-project.v1";

const U32_MAX = BigInt("4294967295");

export type CreatorProject = {
  id?: string;
  revision?: number;
  launch?: { kind: "token" | "nft"; liquidity: boolean };
  name: string;
  assetId: string;
  collectionId: string;
  poolLpToken: string;
  /** Browser-local balance/withdrawal reference; does not establish project revenue or a payment route. */
  proceeds: string;
};

export type StageKind =
  | "not-started"
  | "reading"
  | "on-chain"
  | "missing"
  | "unavailable"
  | "local"
  | "disabled";

export function blankProject(): CreatorProject {
  return { name: "", assetId: "", collectionId: "", poolLpToken: "", proceeds: "" };
}

export function normalizeProject(input: CreatorProject): CreatorProject {
  return {
    ...(typeof input.id === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(input.id) ? { id: input.id } : {}),
    ...(Number.isSafeInteger(input.revision) && input.revision! >= 0 ? { revision: input.revision } : {}),
    ...(input.launch && ["token", "nft"].includes(input.launch.kind) && typeof input.launch.liquidity === "boolean" ? { launch: { kind: input.launch.kind, liquidity: input.launch.kind === "token" && input.launch.liquidity } } : {}),
    name: input.name.trim(),
    assetId: input.assetId.trim(),
    collectionId: input.collectionId.trim(),
    poolLpToken: input.poolLpToken.trim(),
    proceeds: input.proceeds.trim(),
  };
}

export function isProceedsAddress(value: string): boolean {
  if (!value) return false;
  try {
    return checkAddress(value, SS58_PREFIX)[0];
  } catch {
    return false;
  }
}

function idError(label: string, value: string): string | null {
  if (value === "") return null;
  if (!/^\d+$/.test(value) || BigInt(value) > U32_MAX) {
    return `${label} must be a whole number up to 4294967295.`;
  }
  return null;
}

export function projectError(project: CreatorProject): string | null {
  if (!project.name) return "Enter a project name. The name stays in this browser.";
  if (project.name.length > 48) return "Use a project name of 48 characters or fewer.";
  if (/[\u0000-\u001f]/.test(project.name)) return "The project name cannot contain a line break.";
  return (
    idError("Asset id", project.assetId) ??
    idError("Collection id", project.collectionId) ??
    idError("Pool LP token", project.poolLpToken) ??
    (project.proceeds !== "" && !isProceedsAddress(project.proceeds)
      ? "The proceeds account must be an SS58 address for prefix 42."
      : null)
  );
}

export function parseProject(raw: string | null): CreatorProject | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<CreatorProject>;
    const project = normalizeProject({
      id: value.id, revision: value.revision, launch: value.launch,
      name: typeof value.name === "string" ? value.name : "",
      assetId: typeof value.assetId === "string" ? value.assetId : "",
      collectionId: typeof value.collectionId === "string" ? value.collectionId : "",
      poolLpToken: typeof value.poolLpToken === "string" ? value.poolLpToken : "",
      proceeds: typeof value.proceeds === "string" ? value.proceeds : "",
    });
    return projectError(project) ? null : project;
  } catch {
    return null;
  }
}

export type ProjectField = "assetId" | "collectionId" | "poolLpToken";
export function saveProjectVersion(current: CreatorProject | null, next: CreatorProject): CreatorProject {
  if ((current?.id ?? null) !== (next.id ?? null) || (current?.revision ?? 0) !== (next.revision ?? 0)) throw Error("The project was updated in another tab. Reload the current project before saving this draft.");
  return { ...next, id: current?.id ?? crypto.randomUUID(), revision: (current?.revision ?? 0) + 1 };
}
export function attachProjectObject(project: CreatorProject | null, expectedId: string, field: ProjectField, objectId: string, actor: string): CreatorProject {
  if (!project || project.id !== expectedId) throw Error("The project changed while the transaction was open. Its receipt is saved; link the object in Studio.");
  if (idError("Object ID", objectId) || !objectId) throw Error("The finalized object ID is invalid.");
  if (project[field] && project[field] !== objectId) throw Error("The project already links a different object. Review the saved receipt and update Studio explicitly.");
  if (!isProceedsAddress(actor) || (project.proceeds && !sameAccount(project.proceeds, actor))) throw Error("This transaction belongs to another account. Review the linked account in Studio before attaching it.");
  if (project[field] === objectId && project.proceeds) return project;
  return { ...project, [field]: objectId, proceeds: project.proceeds || actor, revision: (project.revision ?? 0) + 1 };
}

export function linkedIdStage(
  id: string,
  online: "connecting" | "live" | "unavailable",
  read: "pending" | "ready" | "error",
  found: boolean,
): StageKind {
  if (!id) return "not-started";
  if (online === "connecting" || (online === "live" && read === "pending")) return "reading";
  if (online === "unavailable" || read === "error") return "unavailable";
  return found ? "on-chain" : "missing";
}

export function poolStage(
  id: string,
  online: "connecting" | "live" | "unavailable",
  pools: PoolView[] | null,
): StageKind {
  if (!id) return "not-started";
  if (online === "connecting") return "reading";
  if (online === "unavailable" || pools === null) return "unavailable";
  return pools.some((pool) => pool.lpToken === id) ? "on-chain" : "missing";
}

export function stageLabel(kind: StageKind): string {
  switch (kind) {
    case "not-started":
      return "Not started";
    case "reading":
      return "Reading";
    case "on-chain":
      return "On chain";
    case "missing":
      return "Not on chain";
    case "unavailable":
      return "Unavailable";
    case "local":
      return "In this browser";
    case "disabled":
      return "Disabled";
  }
}

export function stageTone(kind: StageKind): "ok" | "warn" | "muted" {
  if (kind === "on-chain") return "ok";
  if (kind === "missing" || kind === "disabled" || kind === "reading") return "warn";
  return "muted";
}
