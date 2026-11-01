import { createHash } from "node:crypto";
const hash = (value) => createHash("sha256").update(value).digest("hex");
export function migrationChecksums(source) {
  const normalized = source.replace(/\r\n/g, "\n");
  return {
    canonical: hash(normalized),
    compatible: new Set([
      hash(source),
      hash(normalized),
      hash(normalized.replace(/\n/g, "\r\n")),
    ]),
  };
}
