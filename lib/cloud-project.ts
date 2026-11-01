import { parseProject, type CreatorProject } from "./project.ts";
import { decodeAddress, encodeAddress } from "@polkadot/util-crypto";
import type { WorkspaceCommand } from "./plans.ts";
export type CloudProject = {
  role?: "owner" | "editor" | "viewer";
  id: string;
  owner: string;
  revision: number;
  project: CreatorProject;
  description: string;
  published: boolean;
  updatedAt: string;
  directoryStatus?: string;
};
export type ProjectRequest =
  | WorkspaceCommand
  | { action: "list" }
  | {
      action: "save";
      project: CreatorProject;
      revision: number;
      description: string;
      published: boolean;
    };
export function canonicalAccount(address: string) {
  try {
    return encodeAddress(decodeAddress(address), 42);
  } catch {
    throw Object.assign(Error("Use a valid Substrate account."), {
      status: 400,
    });
  }
}
export function validateProjectRequest(value: unknown): ProjectRequest {
  if (!value || typeof value !== "object")
    throw Object.assign(Error("Choose a project operation."), { status: 400 });
  const input = value as Record<string, unknown>;
  if (input.action === "list") return { action: "list" };
  if (input.action === "pilot") return { action: "pilot" };
  const fail = () => {
    throw Object.assign(Error("Invalid workspace request."), { status: 400 });
  };
  if (input.action === "billing") return { action: "billing" };
  if (input.action === "checkout")
    return input.plan === "pro" || input.plan === "team"
      ? { action: "checkout", plan: input.plan }
      : fail();
  if (input.action === "support") {
    if (
      !["pilot", "support", "abuse", "deletion"].includes(
        String(input.category),
      ) ||
      typeof input.message !== "string" ||
      input.message.trim().length < 10 ||
      input.message.length > 2000
    )
      return fail();
    return {
      action: "support",
      category: input.category as "pilot",
      message: input.message.trim(),
    };
  }
  if (
    [
      "dashboard",
      "verify",
      "submit-review",
      "invite",
      "accept",
      "revoke",
      "transfer",
      "accept-transfer",
      "delete",
    ].includes(String(input.action))
  ) {
    if (
      typeof input.projectId !== "string" ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(input.projectId)
    )
      return fail();
    const base = { action: input.action, projectId: input.projectId };
    if (input.action === "verify" || input.action === "submit-review")
      return { ...base, action: input.action };
    if (input.action === "invite") {
      if (
        typeof input.account !== "string" ||
        !["viewer", "editor"].includes(String(input.role))
      )
        return fail();
      return {
        ...base,
        action: "invite",
        account: canonicalAccount(input.account),
        role: input.role as "viewer" | "editor",
      };
    }
    if (input.action === "transfer" || input.action === "revoke") {
      if (typeof input.account !== "string") return fail();
      return {
        ...base,
        action: input.action,
        account: canonicalAccount(input.account),
      };
    }
    if (input.action === "dashboard") {
      if (
        input.before !== undefined &&
        (!Number.isSafeInteger(input.before) || Number(input.before) < 1)
      )
        return fail();
      return {
        ...base,
        action: "dashboard",
        ...(input.before !== undefined ? { before: Number(input.before) } : {}),
      };
    }
    return {
      ...base,
      action: input.action as "accept" | "accept-transfer" | "delete",
    };
  }
  if (input.action !== "save")
    throw Object.assign(Error("Unknown project operation."), { status: 400 });
  const project = parseProject(JSON.stringify(input.project));
  if (
    !project?.id ||
    !Number.isSafeInteger(input.revision) ||
    Number(input.revision) < 0
  )
    throw Object.assign(
      Error("Save a valid local project before publishing."),
      { status: 400 },
    );
  if (
    typeof input.description !== "string" ||
    input.description.length > 1200 ||
    /[\u0000-\u0008]/.test(input.description)
  )
    throw Object.assign(
      Error("Use a description of at most 1,200 characters."),
      { status: 400 },
    );
  if (typeof input.published !== "boolean")
    throw Object.assign(Error("Choose whether the project is public."), {
      status: 400,
    });
  return {
    action: "save",
    project,
    revision: Number(input.revision),
    description: input.description.trim(),
    published: input.published,
  };
}
export function projectSignMessage(
  origin: string,
  account: string,
  nonce: string,
  expires: string,
  digest: string,
  action: string,
) {
  return `Portova project storage\nSite: ${origin}\nAccount: ${account}\nAction: ${action}\nPayload SHA-256: ${digest}\nNonce: ${nonce}\nExpires: ${expires}\nThis authorizes only this project storage request. It is not a blockchain transaction and transfers no funds.`;
}
