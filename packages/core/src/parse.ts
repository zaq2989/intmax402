import { INTMAX402Challenge, INTMAX402Credential } from "./types";

export function parseWWWAuthenticate(header: string): INTMAX402Challenge | null {
  if (!header.startsWith("INTMAX402 ")) return null;
  const params = header.slice("INTMAX402 ".length);
  const result: Record<string, string> = {};
  const regex = /(\w+)="([^"]*)"/g;
  let match;
  while ((match = regex.exec(params)) !== null) {
    result[match[1]] = match[2];
  }
  if (!result.realm || !result.nonce || !result.mode) return null;
  return {
    realm: result.realm,
    nonce: result.nonce,
    mode: result.mode as INTMAX402Challenge["mode"],
    serverAddress: result.serverAddress,
    amount: result.amount,
    tokenAddress: result.tokenAddress,
    chainId: result.chainId,
  };
}

export function parseAuthorization(header: string): INTMAX402Credential | null {
  if (!header.startsWith("INTMAX402 ")) return null;
  const params = header.slice("INTMAX402 ".length);
  const result: Record<string, string> = {};
  const regex = /(\w+)="([^"]*)"/g;
  let match;
  while ((match = regex.exec(params)) !== null) {
    result[match[1]] = match[2];
  }
  if (!result.address || !result.nonce || !result.signature) return null;

  // Fix 6: Input length validation to prevent malformed/oversized inputs
  // address: 42 chars (0x + 40 hex), nonce: 64 chars (sha256 hex), signature: 132 chars (0x + 130 hex)
  if (result.address.length !== 42) return null;
  if (result.nonce.length !== 64) return null;
  if (result.signature.length !== 132) return null;
  if (result.txHash && result.txHash.length > 128) return null;

  return {
    address: result.address,
    nonce: result.nonce,
    signature: result.signature,
    txHash: result.txHash,
  };
}
