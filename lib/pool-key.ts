export type PoolAsset = { kind: "native" } | { kind: "asset"; id: string };

type Codec = { toHuman?: () => unknown };

export function parsePoolKey(key: { args: unknown[] }): [PoolAsset, PoolAsset] | null {
  const args = key.args;
  if (args.length >= 2) {
    const left = parseAsset(args[0]);
    const right = parseAsset(args[1]);
    if (left && right) return [left, right];
  }
  const tuple = args[0] as (Codec & Record<number, Codec>) | undefined;
  if (tuple && tuple[0] && tuple[1]) {
    const left = parseAsset(tuple[0]);
    const right = parseAsset(tuple[1]);
    if (left && right) return [left, right];
  }
  const human = tuple?.toHuman?.();
  if (Array.isArray(human) && human.length >= 2) {
    const left = parseHumanAsset(human[0]);
    const right = parseHumanAsset(human[1]);
    if (left && right) return [left, right];
  }
  return null;
}

function parseAsset(codec: unknown): PoolAsset | null {
  if (!codec || typeof codec !== "object") return parseHumanAsset(codec);
  return parseHumanAsset((codec as Codec).toHuman?.());
}

function parseHumanAsset(human: unknown): PoolAsset | null {
  if (human === "Native") return { kind: "native" };
  if (human && typeof human === "object" && "WithId" in human) {
    const id = String((human as { WithId: unknown }).WithId).replace(/,/g, "");
    if (/^\d+$/.test(id)) return { kind: "asset", id };
  }
  return null;
}
