import { INTMAX402Config } from "./types"

// Remove characters that could break the WWW-Authenticate header format
function sanitize(value: string): string {
  return value.replace(/["\\]|\r|\n/g, "")
}

export function buildWWWAuthenticate(nonce: string, config: INTMAX402Config): string {
  let header = `INTMAX402 realm="intmax402", nonce="${nonce}", mode="${config.mode}"`
  if (config.serverAddress) header += `, serverAddress="${sanitize(config.serverAddress)}"`
  if (config.amount) header += `, amount="${sanitize(config.amount)}"`
  if (config.tokenAddress) header += `, tokenAddress="${sanitize(config.tokenAddress)}"`
  if (config.chainId) header += `, chainId="${sanitize(config.chainId)}"`
  return header
}
