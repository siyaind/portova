import {TESTNET_GENESIS} from './network.ts';
// Extend only after reviewing metadata/call compatibility and the wallet acceptance matrix.
export function supportedRuntime(genesis:string,name:string,version:string|number) {
  return genesis===TESTNET_GENESIS && name==='portaldot-v3' && String(version)==='3002';
}
