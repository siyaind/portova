export function objectSubjects(section: string, args: Record<string, unknown>) {
  const subjects = new Set<string>();
  const id = (value: unknown) => { try { const n=BigInt(String(value)); return n>=0n && n<=4294967295n ? n.toString() : null; } catch { return null; } };
  for (const [name,value] of Object.entries(args)) {
    const key=name.replace(/_/g,"").toLowerCase();
    if ((section === "assets" && ["id","assetid"].includes(key)) || (section === "poolAssets" && ["id","assetid"].includes(key))) {
      const n=id(value); if(n!==null) subjects.add(`${section==="assets"?"asset":"lp"}:${n}`);
    }
    if (section==="nfts" && ["collection","collectionid"].includes(key)) { const n=id(value); if(n!==null) subjects.add(`collection:${n}`); }
    if(section==="assetConversion") {
      const walk=(v:unknown):void=>{ if(Array.isArray(v)) { v.forEach(walk); return; } if(v && typeof v==="object") for(const [k,x] of Object.entries(v)) { if(k.toLowerCase()==="withid") { const n=id(x); if(n!==null) subjects.add(`asset:${n}`); } else walk(x); } };
      walk(value);
      if (["lptoken","lptokenid","liquiditytokenid"].includes(key)) {const n=id(value);if(n!==null)subjects.add(`lp:${n}`);}
    }
  }
  return [...subjects];
}
export type MonitorFacts = { issuer?: string | null; owner?: string | null; status?: string | null; reserve1?: string | null; reserve2?: string | null; assetId?:string; collectionId?:string; poolId?:string };
export function changedFacts(previous: MonitorFacts | null, current: MonitorFacts) {
  const changes: Array<{kind:string;message:string}> = [];
  if (!previous) return changes;
  if (previous.assetId === current.assetId && current.assetId) for(const key of ["issuer","status"] as const) if(previous[key]!=null && current[key]!=null && previous[key]!==current[key]) changes.push({kind:key,message:`Token ${key} changed from ${previous[key]} to ${current[key]}. Review current authority before signing.`});
  if (previous.collectionId===current.collectionId && current.collectionId && previous.owner && current.owner && previous.owner!==current.owner) changes.push({kind:"owner",message:"Collection ownership changed. Review the linked collection authority."});
  if (previous.poolId===current.poolId && current.poolId) for(const key of ["reserve1","reserve2"] as const) {
    const old=previous[key], next=current[key];
    if(old!=null && next!=null && BigInt(old)>0n && BigInt(next)*100n<=BigInt(old)*80n) changes.push({kind:key,message:`A pool reserve fell by at least 20% between monitored snapshots (${old} to ${next} base units). Swaps can also change reserves; inspect the pool.`});
  }
  return changes;
}
