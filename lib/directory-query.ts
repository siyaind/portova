// Shared by the public route and database integration tests. All filters are bound parameters.
export const DIRECTORY_SQL = `SELECT p.*,CASE WHEN e.revision=p.revision AND e.genesis=$1 THEN jsonb_build_object('revision',e.revision,'block',e.block_number::text,'checkedAt',e.checked_at,'assetOwner',e.facts->'assetOwner','collectionOwner',e.facts->'collectionOwner') ELSE NULL END AS evidence
FROM portova_projects p LEFT JOIN portova_project_evidence e ON e.project_id=p.id
WHERE p.published AND p.directory_status<>'hidden' AND length(trim(p.description))>=30
AND COALESCE(p.project->>'assetId','')||COALESCE(p.project->>'collectionId','')||COALESCE(p.project->>'poolLpToken','')<>''
AND p.id>$2 AND ($3='All' OR COALESCE(p.project->'profile'->>'category','Other')=$3)
AND ($7::boolean OR p.project->>'name' ILIKE $4 OR p.description ILIKE $4)
AND ($5::boolean OR (COALESCE(p.project->'profile'->>'example','false')<>'true' AND NOT (COALESCE(p.project->>'assetId','')=ANY($6::text[]))))
ORDER BY p.id LIMIT 25`;
