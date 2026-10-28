import { parseProject, type CreatorProject } from "./project.ts";
import { decodeAddress, encodeAddress } from "@polkadot/util-crypto";
export type CloudProject = { id: string; owner: string; revision: number; project: CreatorProject; description: string; published: boolean; updatedAt: string };
export type ProjectRequest = { action: "list" } | { action: "save"; project: CreatorProject; revision: number; description: string; published: boolean };
export function canonicalAccount(address: string) { try { return encodeAddress(decodeAddress(address), 42); } catch { throw Object.assign(Error("Use a valid Substrate account."), { status: 400 }); } }
export function validateProjectRequest(value: unknown): ProjectRequest {
  if (!value || typeof value !== "object") throw Object.assign(Error("Choose a project operation."), { status: 400 });
  const input = value as Record<string, unknown>;
  if (input.action === "list") return { action: "list" };
  if (input.action !== "save") throw Object.assign(Error("Unknown project operation."), { status: 400 });
  const project = parseProject(JSON.stringify(input.project));
  if (!project?.id || !Number.isSafeInteger(input.revision) || Number(input.revision) < 0) throw Object.assign(Error("Save a valid local project before publishing."), { status: 400 });
  if (typeof input.description !== "string" || input.description.length > 1200 || /[\u0000-\u0008]/.test(input.description)) throw Object.assign(Error("Use a description of at most 1,200 characters."), { status: 400 });
  if (typeof input.published !== "boolean") throw Object.assign(Error("Choose whether the project is public."), { status: 400 });
  return { action: "save", project, revision: Number(input.revision), description: input.description.trim(), published: input.published };
}
export function projectSignMessage(origin: string, account: string, nonce: string, expires: string, digest: string, action: string) {
  return `Portova project storage\nSite: ${origin}\nAccount: ${account}\nAction: ${action}\nPayload SHA-256: ${digest}\nNonce: ${nonce}\nExpires: ${expires}\nThis authorizes only this project storage request. It is not a blockchain transaction and transfers no funds.`;
}
