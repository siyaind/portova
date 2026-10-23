export function saleResultIsCurrent(
  request: number,
  latest: number,
  requestedKey: string,
  currentKey: string,
): boolean {
  return request === latest && requestedKey === currentKey;
}
