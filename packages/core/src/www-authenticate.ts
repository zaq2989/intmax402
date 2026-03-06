import { INTMAX402Config } from "./types"

export function buildWWWAuthenticate(nonce: string, config: INTMAX402Config): string {
  let header = `INTMAX402 realm="intmax402", nonce="${nonce}", mode="${config.mode}"`
  if (config.serverAddress) header += `, serverAddress="${config.serverAddress}"`
  if (config.amount) header += `, amount="${config.amount}"`
  if (config.tokenAddress) header += `, tokenAddress="${config.tokenAddress}"`
  if (config.chainId) header += `, chainId="${config.chainId}"`
  return header
}
