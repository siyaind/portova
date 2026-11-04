"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signedProjectRequest } from "@/lib/project-client";
import { useProject } from "@/components/project/project-provider";
import { useSubstrateWallet } from "@/components/wallet/substrate-wallet";
import { Button, Panel } from "@/components/ui";
import { type CloudProject, type ProjectRequest } from "@/lib/cloud-project";
import { sameAccount } from "@/lib/withdrawal";
import { usePublicationDraft } from "@/components/project/use-publication-draft";
import { publicationSaveRevision } from "@/lib/publication-draft";
import {
  PROJECT_CATEGORIES,
  directoryReady,
  type ProjectProfile,
} from "@/lib/directory";

export function CloudProjects({
  workspaceProjects,
}: { workspaceProjects?: CloudProject[] } = {}) {
  const stored = useProject(),
    wallet = useSubstrateWallet();
  const [available, setAvailable] = useState<boolean | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<CloudProject[]>([]);
  const publication = usePublicationDraft(wallet.selected?.address, stored.project);
  const { description, published, profile } = publication.draft;
  const current = useRef({
    wallet: wallet.selected,
    draft: JSON.stringify(stored.project),
    description,
    published,
    profile: JSON.stringify(profile),
    publication: JSON.stringify(publication.draft),
    alive: true,
  });
  current.current = {
    ...current.current,
    wallet: wallet.selected,
    draft: JSON.stringify(stored.project),
    description,
    published,
    profile: JSON.stringify(profile),
    publication: JSON.stringify(publication.draft),
  };
  const lock = useRef(false);
  useEffect(() => {
    current.current.alive = true;
    return () => {
      current.current.alive = false;
    };
  }, []);
  useEffect(() => {
    if (workspaceProjects) setRows(workspaceProjects);
  }, [workspaceProjects]);
  useEffect(() => {
    void fetch("/api/projects/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setAvailable(data.available === true))
      .catch(() => setAvailable(false));
  }, []);
  useEffect(() => {
    setRows([]);
  }, [wallet.selected?.address]);
  const cloud = rows.find((row) => row.id === stored.project?.id);
  const saveRevision = publicationSaveRevision(publication.draft, cloud);
  async function execute(payload: ProjectRequest) {
    if (!wallet.selected) {
      await wallet.connect();
      return;
    }
    if (payload.action === "save" && (!publication.ready || publication.error || saveRevision === null || payload.revision !== saveRevision)) {
      setMessage("Load your cloud projects, then use the existing cloud copy before saving. This protects its description and publication setting.");
      return;
    }
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage(null);
    const origin = { ...current.current },
      signer = wallet.selected,
      walletVersion = wallet.getVersion();
    const valid = () =>
      current.current.alive &&
      wallet.getVersion() === walletVersion &&
      sameAccount(current.current.wallet?.address, signer.address) &&
      current.current.wallet?.source === signer.source &&
      (payload.action === "list" ||
        (current.current.draft === origin.draft &&
          current.current.description === origin.description &&
          current.current.published === origin.published &&
          current.current.profile === origin.profile &&
          current.current.publication === origin.publication));
    try {
      const result = await signedProjectRequest(payload, signer, valid);
      if (!valid()) return;
      if (payload.action === "list") {
        setRows(result.projects);
        // A signed list is required before treating an unknown browser draft as
        // a new cloud project. Existing records must be explicitly loaded.
        if (current.current.draft === origin.draft && publication.draft.cloudRevision === null &&
          !result.projects.some((row: CloudProject) => row.id === stored.project?.id)) {
          publication.update({ cloudRevision: 0 });
        }
        setMessage(
          `Loaded ${result.projects.length} cloud projects. Choose one below.`,
        );
      } else if (payload.action === "save") {
        publication.fromCloud(result.project);
        setRows((old) => [
          result.project,
          ...old.filter((row) => row.id !== result.project.id),
        ]);
        setMessage(
          result.project.published
            ? "Saved. Your public project link is ready below."
            : "Saved privately. Only authorized workspace members can load it.",
        );
      } else {
        setMessage(result.message);
      }
    } catch (cause) {
      if (current.current.alive)
        setMessage(
          cause instanceof Error ? cause.message : "Project storage failed.",
        );
    } finally {
      lock.current = false;
      if (current.current.alive) setBusy(false);
    }
  }
  async function load(row: CloudProject) {
    if (!wallet.selected || lock.current) return;
    const version = wallet.getVersion();
    const error = await stored.restore(row.project);
    if (error) {
      setMessage(error);
      return;
    }
    if (wallet.getVersion() !== version) return;
    publication.fromCloud(row);
    setMessage(
      "Cloud project loaded into this browser. Review its links in Studio.",
    );
  }
  return (
    <div id="project-publishing">
      <Panel className="space-y-4 p-5">
        <h2 className="text-lg font-semibold">Project profile & publication</h2>
        <p className="text-sm leading-6 text-muted">
          Save across devices with a wallet-signed message. No transaction or
          gas fee. Local drafts are sent only when you choose Save to cloud.
        </p>
        {available === false && (
          <p role="status" className="text-sm text-warn">
            Cloud storage is awaiting server configuration. Local projects and
            chain features remain available.
          </p>
        )}
        {!stored.project && (
          <p className="text-sm leading-7 text-muted">
            Choose{" "}
            <Link href="/import" className="text-violet underline">
              Bring an existing project
            </Link>{" "}
            or{" "}
            <Link href="/launch" className="text-violet underline">
              Start a launch
            </Link>{" "}
            to create a project record.
          </p>
        )}
        {stored.project && (
          <fieldset disabled={busy || !publication.ready || !wallet.selected} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="product-field">
                Category
                <select
                  value={profile.category}
                  onChange={(e) =>
                    publication.update({ profile: {
                      ...profile,
                      category: e.target.value as ProjectProfile["category"],
                    } })
                  }
                >
                  {PROJECT_CATEGORIES.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className="product-field">
                Project website · optional
                <input
                  maxLength={300}
                  placeholder="https://your-project.com"
                  value={profile.website}
                  onChange={(e) =>
                    publication.update({ profile: { ...profile, website: e.target.value } })
                  }
                />
              </label>
            </div>
            <label className="block text-sm">
              Project description
              <textarea
                maxLength={1200}
                value={description}
                onChange={(e) => publication.update({ description: e.target.value })}
                className="mt-2 min-h-24 w-full rounded-xl border border-line bg-bg p-3 text-sm"
                placeholder="Who is this project for, and what can they do with it?"
              />
            </label>
            <label className="example-toggle">
              <input
                type="checkbox"
                checked={profile.example}
                onChange={(e) =>
                  publication.update({ profile: { ...profile, example: e.target.checked } })
                }
              />{" "}
              This is an example or demonstration project
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => publication.update({ published: e.target.checked })}
                className="mt-1"
              />
              <span>
                Publish a shareable page
                <span className="mt-1 block text-xs leading-6 text-muted">
                  Makes the saved name, description, website, category,
                  publisher wallet and linked object IDs public. Uncheck and
                  save to make the page private again.
                </span>
              </span>
            </label>
          </fieldset>
        )}
        {published &&
          stored.project &&
          !directoryReady(stored.project, description) && (
            <p className="text-sm leading-6 text-muted">
              Your shareable page can be saved now. To appear in Discover, add
              at least 30 characters describing the project and link a token,
              collection or pool.
            </p>
          )}
        <div className="flex flex-wrap gap-3">
          {stored.project && (
            <Button
              disabled={
                busy ||
                !available ||
                !stored.project.id ||
                !publication.ready ||
                !!publication.error ||
                saveRevision === null
              }
              onClick={() =>
                stored.project &&
                void execute({
                  action: "save",
                  project: { ...stored.project, profile },
                  revision: saveRevision!,
                  description,
                  published,
                })
              }
            >
              {busy ? "Waiting for your storage request…" : "Save to cloud"}
            </Button>
          )}
          <Button
              disabled={busy || !available}
              onClick={() => void execute({ action: "list" })}
            >
              Load my cloud projects
          </Button>
        </div>
        {cloud && (
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <span className="text-xs text-muted">
              Profile status: {cloud.directoryStatus ?? "unreviewed"}
            </span>
            <Button
              disabled={busy || !available}
              onClick={() =>
                void execute({ action: "verify", projectId: cloud.id })
              }
            >
              Refresh chain role evidence
            </Button>
            <Button
              disabled={
                busy ||
                !available ||
                !cloud.published ||
                !directoryReady(cloud.project, cloud.description)
              }
              onClick={() =>
                void execute({ action: "submit-review", projectId: cloud.id })
              }
            >
              Request profile review
            </Button>
          </div>
        )}
        {stored.project && saveRevision === null && (
          <p className="text-sm text-warn">
            {cloud
              ? "Choose Use on this device to load this cloud revision before editing and saving."
              : "Load my cloud projects before the first save on this device. If this project already exists, choose Use on this device to restore its publication fields."}
          </p>
        )}
        {publication.error && <p role="alert" className="text-sm text-warn">{publication.error}</p>}
        {stored.project && publication.ready && !publication.error && (
          <p className="text-xs leading-6 text-faint">Publication fields are kept in this browser for the selected wallet and project. Save to cloud to update the shared profile.</p>
        )}
        {message && (
          <p role="status" className="text-sm leading-6 text-muted">
            {message}
          </p>
        )}
        {rows.length > 0 && (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4"
              >
                <div>
                  <p className="font-medium">{row.project.name}</p>
                  <p className="text-xs text-muted">
                    Revision {row.revision} ·{" "}
                    {row.published ? "Public" : "Private"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button disabled={busy} onClick={() => void load(row)}>
                    Use on this device
                  </Button>
                  {row.published && (
                    <Link
                      className="self-center text-sm text-violet"
                      href={`/projects/${row.id}`}
                    >
                      Open public page ↗
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {rows.length > 0 && (
          <p className="text-xs leading-6 text-faint">
            Loading a project replaces this browser&apos;s current project
            record. Chain objects and receipt history remain intact. If another
            device saved first, load its version before editing again.
          </p>
        )}
      </Panel>
    </div>
  );
}
