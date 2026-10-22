const TOKEN_ERRORS: Record<string, string> = {
  FundsUnavailable: "The account does not have enough free balance for this call.",
  OnlyProvider: "This call would remove the account's only provider.",
  BelowMinimum: "The account would be left below the existential deposit.",
  CannotCreate: "The receiving account cannot be created.",
  UnknownAsset: "The asset is unknown.",
  Frozen: "The asset or account is frozen.",
  Unsupported: "This balance operation is not supported.",
  CannotCreateHold: "A hold cannot be created for this account.",
  NotExpendable: "The account cannot pay this amount and stay alive.",
  Blocked: "The account is blocked.",
};

export function plainChainError(text: string): string {
  const named = text.match(/"token"\s*:\s*"([A-Za-z]+)"/)?.[1];
  if (named && TOKEN_ERRORS[named]) return TOKEN_ERRORS[named];
  for (const [name, sentence] of Object.entries(TOKEN_ERRORS)) {
    if (text.includes(name)) return sentence;
  }
  return text;
}
