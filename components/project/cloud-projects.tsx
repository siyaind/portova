"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { stringToHex } from "@polkadot/util";
import { useProject } from "@/components/project/project-provider";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { Button, Panel } from "@/components/ui";
import { canonicalAccount, projectSignMessage, validateProjectRequest, type CloudProject, type ProjectRequest } from "@/lib/cloud-project";
import { sameAccount } from "@/lib/withdrawal";

async function requestJson(path: string, body: unknown) {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  const data = await response.json(); if (!response.ok) throw Error(data.error ?? "Project storage is unavailable."); return data;
}
export function CloudProjects() {
  const stored = useProject(), wallet = useSubstrateWallet();
  const [available, setAvailable] = useState<boolean | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<CloudProject[]>([]), [description, setDescription] = useState(""), [published, setPublished] = useState(false);
  const current = useRef({ wallet: wallet.selected, draft: JSON.stringify(stored.project), description, published, alive: true });
  current.current = { ...current.current, wallet: wallet.selected, draft: JSON.stringify(stored.project), description, published };
  const lock = useRef(false);
  const [loadedRevisions, setLoadedRevisions] = useState<Record<string, number>>({});
  useEffect(() => { current.current.alive = true; return () => { current.current.alive = false; }; }, []);
  useEffect(() => { void fetch("/api/projects/status", { cache: "no-store" }).then(r => r.json()).then(data => setAvailable(data.available === true)).catch(() => setAvailable(false)); }, []);
  useEffect(() => { setRows([]); setLoadedRevisions({}); setDescription(""); setPublished(false); }, [wallet.selected?.address]);
  const cloud = rows.find(row => row.id === stored.project?.id);
  useEffect(() => { setDescription(cloud?.description ?? ""); setPublished(cloud?.published ?? false); }, [stored.project?.id, cloud?.revision]);
  async function execute(payload: ProjectRequest) {
    if (!wallet.selected) { await wallet.connect(); return; }
    if (lock.current) return; lock.current = true; setBusy(true); setMessage(null);
    const origin = { ...current.current }, signer = wallet.selected, walletVersion = wallet.getVersion();
    const valid = () => current.current.alive && wallet.getVersion() === walletVersion && sameAccount(current.current.wallet?.address, signer.address) && current.current.wallet?.source === signer.source && (payload.action === "list" || (current.current.draft === origin.draft && current.current.description === origin.description && current.current.published === origin.published));
    try {
      const normalized = validateProjectRequest(payload);
      const challenge = await requestJson("/api/projects/challenge", { account: signer.address, payload: normalized });
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(normalized)))), b => b.toString(16).padStart(2, "0")).join("");
      const expected = projectSignMessage(window.location.origin, canonicalAccount(signer.address), challenge.id, challenge.expires, digest, payload.action);
      if (challenge.message !== expected || !valid()) throw Error("The wallet or project changed. Review again before signing.");
      const { web3FromSource } = await import("@polkadot/extension-dapp");
      const extension = await web3FromSource(signer.source);
      if (!extension.signer?.signRaw) throw Error("This wallet cannot sign project-storage messages.");
      const signature = await extension.signer.signRaw({ address: signer.address, data: stringToHex(expected), type: "bytes" });
      if (!valid()) throw Error("The wallet or project changed. The signed storage request was discarded.");
      const result = await requestJson("/api/projects/commit", { id: challenge.id, signature: signature.signature });
      if (!valid()) return;
      if (payload.action === "list") { setRows(result.projects); setMessage(`Loaded ${result.projects.length} cloud projects. Choose one below.`); }
      else { setLoadedRevisions(old => ({ ...old, [result.project.id]: result.project.revision })); setRows(old => [result.project, ...old.filter(row => row.id !== result.project.id)]); setMessage(result.project.published ? "Saved. Your public project link is ready below." : "Saved privately. Only this wallet can load it."); }
    } catch (cause) { if (current.current.alive) setMessage(cause instanceof Error ? cause.message : "Project storage failed."); }
    finally { lock.current = false; if (current.current.alive) setBusy(false); }
  }
  async function load(row: CloudProject) {
    const error = await stored.restore(row.project); if (error) { setMessage(error); return; }
    setLoadedRevisions(old => ({ ...old, [row.id]: row.revision })); setDescription(row.description); setPublished(row.published); setMessage("Cloud project loaded into this browser. Review its links in Studio.");
  }
  return <Panel className="space-y-4 p-5">
    <h2 className="text-lg font-semibold">Keep your project. Share your launch.</h2>
    <p className="text-sm leading-6 text-muted">Save across devices with a wallet-signed message. No transaction or gas fee. Local drafts are sent only when you choose Save to cloud.</p>
    {available === false && <p role="status" className="text-sm text-warn">Cloud storage is awaiting server configuration. Local projects and chain features remain available.</p>}
    <label className="block text-sm">Project description<textarea maxLength={1200} value={description} onChange={e => setDescription(e.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-line bg-bg p-3 text-sm" placeholder="Who is this project for, and what can they do with it?" /></label>
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} className="mt-1" /><span>Publish a shareable page<span className="mt-1 block text-xs leading-6 text-muted">Makes the saved name, description, wallet address and linked object IDs public. Uncheck and save to make the page private again.</span></span></label>
    <div className="flex flex-wrap gap-3"><Button disabled={busy || !available || !stored.project?.id || (!!cloud && loadedRevisions[cloud.id] === undefined)} onClick={() => stored.project && void execute({ action: "save", project: stored.project, revision: loadedRevisions[stored.project.id!] ?? 0, description, published })}>{busy ? "Waiting for your storage request…" : "Save to cloud"}</Button><Button disabled={busy || !available} onClick={() => void execute({ action: "list" })}>Load my cloud projects</Button></div>
    {cloud && loadedRevisions[cloud.id] === undefined && <p className="text-sm text-warn">This project already exists in the cloud. Choose Use on this device before editing and saving its next revision.</p>}
    {message && <p role="status" className="text-sm leading-6 text-muted">{message}</p>}
    {rows.length > 0 && <ul className="space-y-3">{rows.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4"><div><p className="font-medium">{row.project.name}</p><p className="text-xs text-muted">Revision {row.revision} · {row.published ? "Public" : "Private"}</p></div><div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={() => void load(row)}>Use on this device</Button>{row.published && <Link className="self-center text-sm text-violet" href={`/projects/${row.id}`}>Open public page ↗</Link>}</div></li>)}</ul>}
    <p className="text-xs leading-6 text-faint">Loading a project replaces this browser&apos;s current project record. Chain objects and receipt history remain intact. If another device saved first, load its version before editing again.</p>
  </Panel>;
}
