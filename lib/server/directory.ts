import "server-only";
import { database } from "./project-db";
import { chainApi } from "./chain";
import { readAssetProfile } from "@/lib/chain-read";
import { readCollectionProfile } from "@/lib/nfts";
import { sameAccount } from "@/lib/withdrawal";
import { TESTNET_GENESIS } from "@/lib/network";
import {
  isExampleProject,
  safeWebsite,
  type DirectoryEntry,
} from "@/lib/directory";
import type { CreatorProject } from "@/lib/project";

export function directoryEntry(row: Record<string, unknown>): DirectoryEntry {
  const project = row.project as CreatorProject;
  const evidence = row.evidence as DirectoryEntry["evidence"];
  return {
    id: String(row.id),
    name: project.name,
    description: String(row.description),
    category: project.profile?.category ?? "Other",
    website: safeWebsite(project.profile?.website) ?? "",
    example: isExampleProject(project),
    owner: String(row.owner),
    revision: Number(row.revision),
    updatedAt: String(row.updated_at),
    assetId: project.assetId,
    collectionId: project.collectionId,
    poolLpToken: project.poolLpToken,
    review:
      row.directory_status === "reviewed" &&
      row.review_revision === row.revision
        ? "reviewed"
        : row.directory_status === "pending"
          ? "pending"
          : "unreviewed",
    evidence: evidence ?? null,
  };
}
export async function verifyProjectRoles(projectId: string, account: string) {
  const sql = database();
  const [row] =
    await sql`SELECT * FROM portova_projects WHERE id=${projectId} AND owner=${account}`;
  if (!row)
    throw Object.assign(
      Error("Only the publisher can refresh role evidence."),
      { status: 403 },
    );
  const project = row.project as CreatorProject,
    api = await chainApi();
  const hash = await api.rpc.chain.getFinalizedHead(),
    at = await api.at(hash),
    header = await api.rpc.chain.getHeader(hash);
  const [asset, collection] = await Promise.all([
    project.assetId
      ? readAssetProfile(at as unknown as typeof api, project.assetId)
      : null,
    project.collectionId
      ? readCollectionProfile(at as unknown as typeof api, project.collectionId)
      : null,
  ]);
  const facts = {
    assetOwner:
      project.assetId && asset?.found
        ? sameAccount(asset.owner, account)
        : null,
    collectionOwner:
      project.collectionId && collection?.found
        ? sameAccount(collection.owner, account)
        : null,
  };
  const rows =
    await sql`INSERT INTO portova_project_evidence(project_id,revision,genesis,block_number,facts)
    SELECT id,revision,${TESTNET_GENESIS},${header.number.toString()},${JSON.stringify(facts)}::jsonb
    FROM portova_projects WHERE id=${projectId} AND owner=${account} AND revision=${row.revision}
    ON CONFLICT(project_id) DO UPDATE SET revision=EXCLUDED.revision,genesis=EXCLUDED.genesis,block_number=EXCLUDED.block_number,checked_at=now(),facts=EXCLUDED.facts
    WHERE portova_project_evidence.revision<EXCLUDED.revision OR (portova_project_evidence.revision=EXCLUDED.revision AND portova_project_evidence.block_number<=EXCLUDED.block_number)
    RETURNING revision,block_number,checked_at,facts`;
  if (!rows.length)
    throw Object.assign(
      Error("The project changed. Load it again before checking roles."),
      { status: 409 },
    );
  return {
    message: `Roles checked at finalized block ${header.number}. Evidence describes this snapshot, not an endorsement.`,
    facts,
  };
}
