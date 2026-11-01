"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { useProject } from "@/components/project/project-provider";
import { CryptoBilling } from "@/components/project/crypto-billing";
import { CloudProjects } from "@/components/project/cloud-projects";
import { PilotAccess } from "@/components/project/pilot-access";
import { Button, Panel, PageIntro } from "@/components/ui";
import { signedProjectRequest } from "@/lib/project-client";
import type { ProjectRequest, CloudProject } from "@/lib/cloud-project";
import { sameAccount } from "@/lib/withdrawal";
type Dashboard = {
  role: string;
  capabilities: { history: boolean };
  audit: Array<{
    id: number;
    actor: string;
    action: string;
    created_at: string;
  }>;
  members: Array<{ account: string; role: string; accepted: boolean }>;
  alerts: Array<{ kind: string; message: string; block_number: number }>;
  events: Array<{
    height: number;
    tx_hash: string;
    call: string;
    success: boolean;
  }>;
  indexer: { height: number; start_height: number; updated_at: string } | null;
  snapshot: {
    block_number: number;
    updated_at: string;
    facts: Record<string, unknown>;
  } | null;
};
export function OperationsWorkspace({
  pricing = false,
}: {
  pricing?: boolean;
}) {
  const wallet = useSubstrateWallet(),
    stored = useProject();
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [projects, setProjects] = useState<CloudProject[]>([]),
    [selected, setSelected] = useState(""),
    [dashboard, setDashboard] = useState<Dashboard | null>(null),
    [plan, setPlan] = useState("free");
  const [invitations, setInvitations] = useState<
      Array<{ projectId: string; name: string; role: string }>
    >([]),
    [transfers, setTransfers] = useState<
      Array<{ projectId: string; name: string }>
    >([]);
  const [account, setAccount] = useState(""),
    [role, setRole] = useState<"viewer" | "editor">("viewer"),
    [confirm, setConfirm] = useState(false);
  const [category, setCategory] = useState<
      "pilot" | "support" | "abuse" | "deletion"
    >("pilot"),
    [support, setSupport] = useState("");
  const [tickets, setTickets] = useState<
    Array<{
      id: string;
      status: string;
      response: string | null;
      category: string;
    }>
  >([]);
  const mounted = useRef(true),
    lock = useRef(false),
    context = useRef("");
  context.current = JSON.stringify({
    selected,
    account,
    role,
    confirm,
    category,
    support,
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    void fetch("/api/projects/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((x) => {
        setReady(x.available === true);
      })
      .catch(() => setReady(false));
  }, []);
  useEffect(() => {
    setProjects([]);
    setDashboard(null);
    setInvitations([]);
    setTransfers([]);
    setTickets([]);
    setSelected("");
    setPlan("free");
    setMessage("");
  }, [wallet.selected?.address]);
  async function execute(payload: ProjectRequest) {
    if (!wallet.selected) {
      await wallet.connect();
      return;
    }
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    const signer = wallet.selected,
      version = wallet.getVersion(),
      origin = context.current;
    const valid = () =>
      mounted.current &&
      wallet.getVersion() === version &&
      context.current === origin;
    try {
      const result = await signedProjectRequest(payload, signer, valid);
      if (!valid()) return;
      if (payload.action === "list") {
        setProjects(result.projects);
        setPlan(result.plan);
        setInvitations(result.invitations ?? []);
        setTransfers(result.transfers ?? []);
        setTickets(result.tickets ?? []);
        setMessage(
          result.projects.length
            ? "Workspace list refreshed. Choose a project below."
            : "No saved workspaces yet. Bring an existing project or start a launch.",
        );
      } else if (payload.action === "dashboard") {
        setDashboard((old) =>
          payload.before && old
            ? { ...result, audit: [...old.audit, ...result.audit] }
            : result,
        );
      } else {
        setMessage(
          result.message ??
            (result.ticket
              ? `Request ${result.ticket} saved.`
              : "Request completed. Refresh your workspace to see the result."),
        );
        if (
          ["delete", "accept-transfer", "revoke", "invite"].includes(
            payload.action,
          )
        )
          setDashboard(null);
      }
    } catch (cause) {
      if (mounted.current)
        setMessage(cause instanceof Error ? cause.message : "Request failed.");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const current = projects.find((p) => p.id === selected),
    owner = !!(
      current &&
      wallet.selected &&
      sameAccount(current.owner, wallet.selected.address)
    );
  function exportReport() {
    if (!dashboard || !current) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            project: current,
            report: dashboard,
            coverage:
              "Object-related calls from the indexed finalized range, latest 100 events. Not project revenue.",
            exportedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `portova-${current.id}-report.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  if (pricing)
    return (
      <div className="space-y-6">
        <PageIntro
          eyebrow="Plans & pilot"
          title="Start free. Grow with your team."
          body="Explore the proposed plans, or activate the free pilot to test project operations. Crypto checkout remains disabled."
        />
        <CryptoBilling />
        <PilotAccess />
        <Link className="text-sm text-muted underline" href="/service">
          Service & privacy information
        </Link>
      </div>
    );
  return (
    <div className="space-y-6">
      <section className="product-heading">
        <div>
          <p className="product-eyebrow">My workspace</p>
          <h1>Your project, in focus.</h1>
          <p>Manage your profiles, monitor changes and work with your team.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="product-primary" href="/launch">
            Start a launch ↗
          </Link>
          <Link className="product-secondary" href="/import">
            Bring a project
          </Link>
        </div>
      </section>
      <PilotAccess />
      <Panel className="space-y-4 p-5">
        <h2 className="text-lg font-semibold">Open your saved workspaces</h2>
        <p className="text-sm leading-7 text-muted">
          Load projects and accepted invitations using a wallet-signed message.
          Your workspace stays private until you publish a profile.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Button
            disabled={!ready || busy}
            onClick={() => void execute({ action: "list" })}
          >
            {busy ? "Waiting for your signed request…" : "Load my workspaces"}
          </Button>
          <Link className="text-sm text-violet" href="/studio">
            Edit linked project details ↗
          </Link>
        </div>
        <p className="text-xs text-muted">
          {ready
            ? "Cloud services connected."
            : "Cloud services are temporarily unavailable."}{" "}
          Loaded access tier: {plan}.
        </p>
      </Panel>
      {message && (
        <p
          role="status"
          className="rounded-xl border border-line p-4 text-sm leading-7"
        >
          {message}
        </p>
      )}
      {invitations.map((invite) => (
        <Panel
          key={invite.projectId}
          className="flex flex-wrap items-center justify-between gap-3 p-5"
        >
          <p>
            {invite.name} invited you as {invite.role}
          </p>
          <Button
            disabled={busy}
            onClick={() =>
              void execute({ action: "accept", projectId: invite.projectId })
            }
          >
            Accept invitation
          </Button>
        </Panel>
      ))}
      {transfers.map((transfer) => (
        <Panel key={transfer.projectId} className="space-y-3 p-5">
          <p>
            Accept ownership of workspace {transfer.name}? This does not
            transfer chain assets. Existing collaborators will be removed.
          </p>
          <Button
            disabled={busy}
            onClick={() =>
              void execute({
                action: "accept-transfer",
                projectId: transfer.projectId,
              })
            }
          >
            Accept workspace ownership
          </Button>
        </Panel>
      ))}
      {projects.length > 0 && (
        <Panel className="space-y-4 p-5">
          <h2 className="text-lg font-semibold">Project operations</h2>
          <label className="block text-sm">
            Cloud project
            <select
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setDashboard(null);
                setConfirm(false);
              }}
              className="mt-2 h-12 w-full rounded-xl border border-line bg-bg px-3"
            >
              <option value="">
                Load your workspaces, then choose a project
              </option>
              {projects.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.project.name} · {p.role ?? "owner"}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-3">
            <Button
              disabled={!selected || busy}
              onClick={() =>
                void execute({ action: "dashboard", projectId: selected })
              }
            >
              Read activity & alerts
            </Button>
            <Button
              disabled={!current || busy}
              onClick={() =>
                current &&
                void stored
                  .restore(current.project)
                  .then((error) =>
                    setMessage(
                      error ??
                        "Project loaded. Open Studio to review its links.",
                    ),
                  )
              }
            >
              Use in Studio
            </Button>
            <Link className="self-center text-sm text-violet" href="/studio">
              Open Studio ↗
            </Link>
            <Button
              disabled={
                !dashboard || !current || !dashboard.capabilities.history
              }
              onClick={exportReport}
            >
              Export current report
            </Button>
          </div>
          {dashboard && (
            <div className="space-y-5 border-t border-line pt-5">
              <p className="text-xs text-muted">
                Role: {dashboard.role}.{" "}
                {dashboard.indexer
                  ? `Indexed from block ${dashboard.indexer.start_height} through ${dashboard.indexer.height}; updated ${new Date(dashboard.indexer.updated_at).toLocaleString()}.`
                  : "Indexer not initialized; historical coverage is unavailable."}{" "}
                {dashboard.snapshot
                  ? `Latest project monitor: block ${dashboard.snapshot.block_number}, ${new Date(dashboard.snapshot.updated_at).toLocaleString()}.`
                  : "No monitored project snapshot yet."}
              </p>
              <h3 className="font-medium">Monitored changes</h3>
              {dashboard.alerts.length ? (
                dashboard.alerts.map((a, i) => (
                  <p key={i} className="text-sm leading-6 text-warn">
                    Block {a.block_number}: {a.message}
                  </p>
                ))
              ) : (
                <p className="text-sm text-muted">
                  No stored alerts in this response. This does not prove the
                  project is safe; checks may not have run.
                </p>
              )}
              <h3 className="font-medium">Related onchain activity</h3>
              <p className="text-xs leading-6 text-faint">
                Latest 100 calls matching linked object IDs within the indexed
                range. Batched calls may contain several actions. Object
                association does not establish sales or project revenue. Indexed
                events are available during an active pilot or Pro/Team access.
              </p>
              {dashboard.events.map((event, i) => (
                <div
                  key={i}
                  className="flex flex-wrap justify-between gap-3 rounded-xl border border-line p-3 text-xs"
                >
                  <span>
                    {event.call} · Block {event.height} ·{" "}
                    {event.success ? "Extrinsic succeeded" : "Extrinsic failed"}
                  </span>
                  <Link
                    href={`/activity?hash=${event.tx_hash}`}
                    className="text-violet"
                  >
                    Inspect receipt ↗
                  </Link>
                </div>
              ))}
              <h3 className="font-medium">Workspace audit trail</h3>
              {dashboard.audit.map((a) => (
                <p
                  key={a.id}
                  className="break-all text-xs leading-6 text-muted"
                >
                  {new Date(a.created_at).toLocaleString()} · {a.action} ·{" "}
                  {a.actor}
                </p>
              ))}
              {dashboard.audit.length > 0 &&
                dashboard.audit.length % 50 === 0 && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void execute({
                        action: "dashboard",
                        projectId: selected,
                        before: dashboard.audit.at(-1)!.id,
                      })
                    }
                  >
                    Load older audit entries
                  </Button>
                )}
            </div>
          )}
        </Panel>
      )}
      {owner && (
        <details className="trust-note">
          <summary>Collaborators & workspace settings</summary>
          <Panel className="mt-4 space-y-4 p-5">
            <h2 className="text-lg font-semibold">Workspace access</h2>
            <p className="text-xs leading-6 text-muted">
              Team and active pilot owners can invite viewers or editors.
              Editors can update project details; only owners can change
              publication or access. Invitations expire after seven days and
              require acceptance.
            </p>
            <label className="block text-sm">
              Recipient wallet
              <input
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-line bg-bg px-3"
              />
            </label>
            <label className="block text-sm">
              Invitation role
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "viewer" | "editor")}
                className="ml-3 rounded-lg border border-line bg-bg p-3"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
            </label>
            <Button
              disabled={busy || !account}
              onClick={() =>
                void execute({
                  action: "invite",
                  projectId: selected,
                  account,
                  role,
                })
              }
            >
              Send wallet invitation
            </Button>
            {dashboard?.members.map((member) => (
              <div
                key={member.account}
                className="flex flex-wrap gap-3 border-t border-line pt-3"
              >
                <p className="break-all text-xs">
                  {member.account} · {member.role} ·{" "}
                  {member.accepted ? "Accepted" : "Pending"}
                </p>
                <Button
                  disabled={busy}
                  onClick={() =>
                    void execute({
                      action: "revoke",
                      projectId: selected,
                      account: member.account,
                    })
                  }
                >
                  Revoke access
                </Button>
              </div>
            ))}
            <label className="flex gap-3 text-sm leading-6">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
              />
              <span>
                I understand that deleting this cloud project is permanent, and
                transferring workspace ownership will remove my access after
                acceptance. Neither action changes chain ownership. Export
                records first.
              </span>
            </label>
            <div className="flex flex-wrap gap-3">
              <Button
                disabled={!confirm || !account || busy}
                onClick={() =>
                  void execute({
                    action: "transfer",
                    projectId: selected,
                    account,
                  })
                }
              >
                Offer ownership to recipient
              </Button>
              <Button
                disabled={!confirm || busy}
                onClick={() =>
                  void execute({ action: "delete", projectId: selected })
                }
              >
                Delete cloud project
              </Button>
            </div>
          </Panel>
        </details>
      )}
      <CloudProjects workspaceProjects={projects} />
      <details id="pilot-request" className="trust-note">
        <summary>Support & project reporting</summary>
        <div>
          <Panel className="space-y-4 p-5">
            <h2 className="text-lg font-semibold">
              Pilot, support & reporting
            </h2>
            <p className="text-xs leading-6 text-muted">
              Send a private request linked to your wallet. Do not include seed
              phrases, private keys, payment details or other secrets. Load
              workspaces later to read ticket updates.
            </p>
            <label className="block text-sm">
              Request type
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as typeof category)}
                className="ml-3 rounded-xl border border-line bg-bg p-3"
              >
                {["pilot", "support", "abuse", "deletion"].map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Request details
              <textarea
                minLength={10}
                maxLength={2000}
                value={support}
                onChange={(e) => setSupport(e.target.value)}
                className="mt-2 min-h-28 w-full rounded-xl border border-line bg-bg p-3"
              />
            </label>
            <Button
              disabled={!ready || busy || support.trim().length < 10}
              onClick={() =>
                void execute({ action: "support", category, message: support })
              }
            >
              Sign and send request
            </Button>
            {tickets.map((ticket) => (
              <p key={ticket.id} className="break-all text-sm leading-6">
                {ticket.category} · {ticket.id} · {ticket.status}
                {ticket.response && ` · ${ticket.response}`}
              </p>
            ))}
          </Panel>
        </div>
      </details>
    </div>
  );
}
