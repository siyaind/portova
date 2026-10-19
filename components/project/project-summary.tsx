"use client";

import Link from "next/link";
import { Panel } from "@/components/ui";
import { shortAddress } from "@/lib/format";
import { useProject } from "@/components/project/project-provider";

export function ProjectSummary() {
  const { ready, project } = useProject();

  return (
    <Panel className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">Creator project</h2>
        <Link href="/studio" className="text-sm text-blue hover:underline">
          Creator studio
        </Link>
      </div>
      {!ready ? <p className="mt-2 text-sm text-muted">Reading the local project record…</p> : null}
      {ready && !project ? (
        <p className="mt-2 text-sm leading-6 text-muted">
          No off-chain project is stored in this browser.
        </p>
      ) : null}
      {project ? (
        <div className="mt-3 space-y-2 text-sm">
          <p className="font-medium">{project.name}</p>
          <p className="text-xs leading-5 text-faint">Stored in this browser. The chain has no project object.</p>
          <ul className="space-y-1 text-muted">
            <li>
              Token{" "}
              {project.assetId ? (
                <Link href={`/token/${project.assetId}`} className="text-blue hover:underline">
                  #{project.assetId}
                </Link>
              ) : (
                "is not linked"
              )}
            </li>
            <li>
              Collection{" "}
              {project.collectionId ? (
                <Link href={`/collection/${project.collectionId}`} className="text-blue hover:underline">
                  #{project.collectionId}
                </Link>
              ) : (
                "is not linked"
              )}
            </li>
            <li>
              Pool{" "}
              {project.poolLpToken ? (
                <Link href="/liquidity" className="text-blue hover:underline">
                  LP #{project.poolLpToken}
                </Link>
              ) : (
                "is not linked"
              )}
            </li>
            <li>
              Proceeds{" "}
              {project.proceeds ? (
                <Link href="/treasury" className="font-mono text-blue hover:underline">
                  {shortAddress(project.proceeds)}
                </Link>
              ) : (
                "account is not linked"
              )}
            </li>
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}
