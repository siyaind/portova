import { chainApi } from "@/lib/server/chain";
import { cached, clientLimit } from "@/lib/server/redis";
import { canonicalAccount } from "@/lib/cloud-project";
import { apiError } from "@/lib/server/http";
import { TESTNET_GENESIS } from "@/lib/network";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const raw = new URL(request.url).searchParams.get("address") ?? "";
    if (raw.length > 64)
      throw Object.assign(Error("Use a valid Substrate account."), {
        status: 400,
      });
    const account = canonicalAccount(raw);
    await clientLimit(request, "account-read", 60);
    const result = await cached(
      `account:${TESTNET_GENESIS}:${account}`,
      15,
      async () => {
        const api = await chainApi(),
          hash = await api.rpc.chain.getFinalizedHead(),
          at = await api.at(hash),
          header = await api.rpc.chain.getHeader(hash);
        const record = (await at.query.system.account(account)) as unknown as {
          data: {
            free: { toString(): string };
            reserved: { toString(): string };
          };
        };
        return {
          account,
          block: header.number.toString(),
          free: record.data.free.toString(),
          reserved: record.data.reserved.toString(),
          genesis: TESTNET_GENESIS,
        };
      },
    );
    return Response.json(result.value, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (cause) {
    return apiError(cause);
  }
}
