// Release policy: proposed pricing remains visible, checkout stays off.
export const CHECKOUT_RELEASE_ENABLED = false;
export const PLANS = {
  free: {
    name: "Explorer",
    priceUsdc: 0,
    projects: 3,
    collaborators: 0,
    history: false,
  },
  pro: {
    name: "Pro",
    priceUsdc: 19,
    projects: 20,
    collaborators: 0,
    history: true,
  },
  team: {
    name: "Team",
    priceUsdc: 49,
    projects: 100,
    collaborators: 10,
    history: true,
  },
} as const;
export type Plan = keyof typeof PLANS;
export function effectivePlan(
  plan: string | null | undefined,
  status: string | null | undefined,
  periodEnd: string | null | undefined,
  now = Date.now(),
): Plan {
  return (plan === "pro" || plan === "team") &&
    status === "active" &&
    !!periodEnd &&
    Date.parse(periodEnd) > now
    ? plan
    : "free";
}
export type WorkspaceCommand =
  | { action: "pilot" }
  | { action: "verify" | "submit-review"; projectId: string }
  | { action: "dashboard"; projectId: string; before?: number }
  | {
      action: "invite";
      projectId: string;
      account: string;
      role: "viewer" | "editor";
    }
  | { action: "accept" | "revoke"; projectId: string; account?: string }
  | { action: "transfer"; projectId: string; account: string }
  | { action: "accept-transfer" | "delete"; projectId: string }
  | {
      action: "support";
      category: "pilot" | "support" | "abuse" | "deletion";
      message: string;
    }
  | { action: "checkout"; plan: "pro" | "team" }
  | { action: "billing" };
