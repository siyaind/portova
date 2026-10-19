"use client";

import Link from "next/link";
import { ProceedsFigure } from "@/components/project/proceeds-figure";
import { useProject } from "@/components/project/project-provider";
import { Button, PageIntro, Panel } from "@/components/ui";

export function TreasuryScreen() {
  const { ready, project } = useProject();

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Treasury"
        title="Proceeds account"
        body="The treasury figure is the System.Account free balance of the proceeds account on the local project. Sale proceeds stay in that account. This page does not submit a transfer and does not add funds to a pool."
      />
      <Panel className="space-y-3 p-4">
        <h2 className="text-sm font-medium">Linked account</h2>
        {!ready ? <p className="text-sm text-muted">Reading the local project record…</p> : null}
        {ready && !project ? (
          <p className="text-sm leading-6 text-muted">
            No project has linked an account.{" "}
            <Link href="/studio" className="text-blue hover:underline">
              Create one in Creator Studio
            </Link>
            .
          </p>
        ) : null}
        {project ? (
          <div className="space-y-2 text-sm leading-6 text-muted">
            <p>
              {project.name} is stored in this browser.{" "}
              <Link href="/studio" className="text-blue hover:underline">
                Edit the project
              </Link>
              .
            </p>
            <ProceedsFigure address={project.proceeds} />
          </div>
        ) : null}
      </Panel>
      <Panel className="p-4">
        <h2 className="text-sm font-medium">Withdraw</h2>
        <Button type="button" variant="primary" className="mt-3" disabled>
          Withdraw
        </Button>
        <p className="mt-3 text-sm leading-6 text-muted">
          A withdrawal would be balances.transfer, signed by the proceeds account. That call is not in this phase.
          Nothing on this page moves funds into a pool.
        </p>
      </Panel>
    </div>
  );
}
