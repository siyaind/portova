export function applyChainSnapshot<T>(
  ticket: number,
  current: number,
  cancelled: boolean,
  value: T,
  write: (value: T) => void,
): boolean {
  if (cancelled || ticket !== current) return false;
  write(value);
  return true;
}
