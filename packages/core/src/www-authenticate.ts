import { INTMAX402Config } from "./types"

// Remove characters that could break the WWW-Authenticate header format
function sanitize(value: string): string {
  return value.replace(/["\\]|\r|\n/g, "")
}

/** Default L1 chain IDs per environment */
const DEFAULT_CHAIN_IDS: Record<string, string> = {
  mainnet: "1",      // Ethereum mainnet (INTMAX ZK L2 on Scroll)
  testnet: "11155111", // Sepolia (INTMAX ZK L2 on Scroll Sepolia)
}

export function buildWWWAuthenticate(nonce: string, config: INTMAX402Config): string {
  let header = `INTMAX402 realm="intmax402", nonce="${nonce}", mode="${config.mode}"`
  if (config.serverAddress) header += `, serverAddress="${sanitize(config.serverAddress)}"`
  if (config.amount) header += `, amount="${sanitize(config.amount)}"`
  if (config.tokenAddress) header += `, tokenAddress="${sanitize(config.tokenAddress)}"`
  // Include chainId: explicit config takes priority, otherwise derive from environment
  const chainId = config.chainId ?? DEFAULT_CHAIN_IDS[config.environment ?? "mainnet"]
  if (chainId) header += `, chainId="${sanitize(chainId)}"`
  return header
}
