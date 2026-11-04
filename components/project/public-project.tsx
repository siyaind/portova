"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  isExampleProject,
  safeWebsite,
  type DirectoryEntry,
} from "@/lib/directory";
import type { CloudProject } from "@/lib/cloud-project";
import { Button, Panel, StatusPill } from "@/components/ui";
import { LaunchHealth } from "@/components/studio/launch-health";
export function PublicProject({ id }: { id: string }) {
  const [entry, setEntry] = useState<DirectoryEntry | null>(null);
  const [retry, setRetry] = useState(0);
  const [project, setProject] = useState<CloudProject | null>(null),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    setError(null); setProject(null); setEntry(null);
    void fetch(`/api/projects/${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Object.assign(Error(data.error ?? "This project could not be loaded."), { publicFailure: true });
        if (abort.signal.aborted) return;
        setProject(data.project);
        setEntry(data.directory);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.name === "TimeoutError" ? "Loading timed out. Try again." : e.publicFailure ? e.message : "Could not connect to project storage. Check your connection and try again.");
      });
    return () => abort.abort();
  }, [id, retry]);
  if (!project)
    return (
      <Panel className="p-8">
        <h1 className="text-xl font-semibold">{error ?? "Loading project…"}</h1>
        {error && <Button className="mt-4 mr-4" onClick={() => setRetry(x => x + 1)}>Retry loading project</Button>}
        <Link href="/launch" className="mt-4 inline-block text-violet">
          Create your own launch ↗
        </Link>
      </Panel>
    );
  return (
    <div className="space-y-6">
      <Panel className="space-y-5 bg-gradient-to-br from-violet/10 to-panel p-6 sm:p-9">
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="muted">V3 Testnet</StatusPill>
          <StatusPill tone="muted">
            {project.project.profile?.category ?? "Other"}
          </StatusPill>
          {isExampleProject(project.project) && (
            <StatusPill tone="warn">Example project</StatusPill>
          )}
          <StatusPill tone="muted">
            {entry?.review === "reviewed"
              ? "Profile reviewed"
              : entry?.review === "pending"
                ? "Review pending"
                : "Community published"}
          </StatusPill>
        </div>
        <div className="project-monogram" aria-hidden>
          {project.project.name.slice(0, 2).toUpperCase()}
        </div>
        <h1 className="break-words text-3xl font-semibold sm:text-5xl">
          {project.project.name}
        </h1>
        <p className="max-w-3xl whitespace-pre-wrap break-words text-base leading-8 text-muted">
          {project.description || "The creator has not added a description."}
        </p>
        <p className="text-xs leading-6 text-faint">
          Creator-provided description and links. Publishing proves control of
          the publisher wallet; it does not establish ownership of every linked
          asset. The chain checks below show those roles separately.
        </p>
        <p className="break-all font-mono text-xs text-muted">
          Publisher wallet confirmed · {project.owner}
        </p>
        {entry?.evidence && (
          <div className="rounded-xl border border-line p-4 text-sm leading-7 text-muted">
            <p>
              Chain roles checked at block {entry.evidence.block} ·{" "}
              {new Date(entry.evidence.checkedAt).toLocaleString()}
            </p>
            <p>
              Token owner:{" "}
              {entry.evidence.assetOwner === null
                ? "Not checked or not found"
                : entry.evidence.assetOwner
                  ? "Publisher matched"
                  : "Different from publisher"}
            </p>
            <p>
              Collection owner:{" "}
              {entry.evidence.collectionOwner === null
                ? "Not checked or not found"
                : entry.evidence.collectionOwner
                  ? "Publisher matched"
                  : "Different from publisher"}
            </p>
            <p className="text-xs">
              Snapshot evidence can become outdated. A reviewed profile is not a
              contract audit or endorsement.
            </p>
          </div>
        )}
        {!entry?.evidence && <p className="text-xs leading-6 text-muted">No chain role evidence is recorded for this revision. The publisher can refresh it in their workspace. Profile edits require a new check.</p>}
        {safeWebsite(project.project.profile?.website) && (
          <a
            className="inline-block text-sm text-violet"
            href={safeWebsite(project.project.profile?.website)!}
            target="_blank"
            rel="noopener noreferrer"
          >
            Visit publisher-provided website ↗
          </a>
        )}
        <p className="text-xs text-faint">
          Updated {new Date(project.updatedAt).toLocaleString()} · Revision{" "}
          {project.revision}
        </p>
        <div className="flex flex-wrap gap-3">
          {project.project.assetId && (
            <Link
              href={`/token/${project.project.assetId}`}
              className="rounded-xl border border-line px-4 py-3 text-sm"
            >
              Inspect token #{project.project.assetId}
            </Link>
          )}
          {project.project.collectionId && (
            <Link
              href={`/collection/${project.project.collectionId}`}
              className="rounded-xl border border-line px-4 py-3 text-sm"
            >
              Inspect collection #{project.project.collectionId}
            </Link>
          )}
          {project.project.poolLpToken && (
            <Link
              href={`/liquidity?pool=${encodeURIComponent(project.project.poolLpToken)}`}
              className="rounded-xl border border-line px-4 py-3 text-sm"
            >
              Inspect liquidity · LP #{project.project.poolLpToken}
            </Link>
          )}
          <Button
            onClick={() =>
              void navigator.clipboard
                .writeText(window.location.href)
                .catch(() => undefined)
            }
          >
            Copy page link
          </Button>
        </div>
      </Panel>
      <Link
        href="/workspace"
        className="inline-block text-xs text-muted underline"
      >
        Report impersonation or a misleading project through Support
      </Link>
      <details className="trust-note">
        <summary>Chain facts & launch health</summary>
        <LaunchHealth project={project.project} publicView />
      </details>
      <Link href="/explore" className="text-sm text-violet">
        ← Discover more projects
      </Link>
    </div>
  );
}
