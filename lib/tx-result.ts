export function txResultMessage(
  status: "signing" | "submitted" | "included" | "finalized" | "failed",
  error?: string | null,
): string {
  if (status === "failed") return error || "The transaction failed.";
  if (status === "finalized") return "Finalized.";
  if (status === "included") {
    return error || "Included. Finalization was not reported before the wait ended.";
  }
  if (status === "submitted") {
    return error || "Submitted. Inclusion was not reported. This is not a final result.";
  }
  return "Waiting for the wallet.";
}
