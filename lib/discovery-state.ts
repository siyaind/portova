export type DiscoveryState = { loading: boolean; complete: boolean; scanned: number; error: string | null; blockHash?: string; fetchedAt?: number; blockNumber?: string };
export const emptyDiscovery = (): DiscoveryState => ({ loading: false, complete: false, scanned: 0, error: null });
export function discoveryLabel(state: DiscoveryState): string {
  if (state.complete) return `${state.scanned} checked · Complete`;
  if (state.error) return `${state.scanned} checked · Partial — ${state.error}`;
  return `${state.scanned} checked · ${state.loading ? "Loading pages…" : "Waiting for discovery"}`;
}
