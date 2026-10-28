import "server-only";

export function redisConfigured() {
  return !!((process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL) && (process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN));
}
export async function redis<T>(...command: Array<string | number>): Promise<T> {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw Error("Redis is not configured.");
  const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(command), signal: AbortSignal.timeout(4000), cache: "no-store" });
  if (!response.ok) throw Error("Redis is temporarily unavailable.");
  const value = await response.json() as { result: T; error?: string };
  if (value.error) throw Error("Redis could not complete the request.");
  return value.result;
}
export async function rateLimit(key: string, limit: number, seconds = 60) {
  const count = await redis<number>("EVAL", "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n", 1, `portova:rate:${key}`, seconds);
  if (count > limit) throw Object.assign(Error("Too many requests. Try again in a minute."), { status: 429 });
}
export async function cached<T>(key: string, seconds: number, read: () => Promise<T>): Promise<{ value: T; cache: "hit" | "miss" | "unavailable" }> {
  let available = redisConfigured();
  if (available) try { const value = await redis<string | null>("GET", `portova:cache:v1:${key}`); if (value) return { value: JSON.parse(value) as T, cache: "hit" }; } catch { available = false; }
  const value = await read();
  if (available) try { await redis("SET", `portova:cache:v1:${key}`, JSON.stringify(value), "EX", seconds); } catch { available = false; }
  return { value, cache: available ? "miss" : "unavailable" };
}
