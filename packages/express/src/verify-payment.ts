import { IntMaxNodeClient } from "intmax2-server-sdk";

export interface PaymentVerificationConfig {
  eth_private_key: `0x${string}`;
  environment: "testnet" | "mainnet";
  l1_rpc_url?: string;
}

export interface VerifyPaymentResult {
  valid: boolean;
  error?: string;
}

// Singleton IntMaxNodeClient
let client: IntMaxNodeClient | null = null;
let loginPromise: Promise<void> | null = null;

// Used txHash tracking with TTL for replay prevention
const usedTxHashes = new Map<string, number>();
const TX_HASH_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function cleanupExpiredHashes(): void {
  const now = Date.now();
  for (const [hash, expiry] of usedTxHashes) {
    if (now > expiry) {
      usedTxHashes.delete(hash);
    }
  }
}

export async function initPaymentVerifier(
  config: PaymentVerificationConfig
): Promise<void> {
  if (client && client.isLoggedIn) return;
  if (loginPromise) {
    await loginPromise;
    return;
  }

  client = new IntMaxNodeClient({
    environment: config.environment,
    eth_private_key: config.eth_private_key,
    l1_rpc_url: config.l1_rpc_url,
    loggerLevel: "warn",
  });

  loginPromise = client.login().then(() => {
    loginPromise = null;
  });
  await loginPromise;
}

export function getPaymentVerifierAddress(): string {
  if (!client) throw new Error("Payment verifier not initialized. Call initPaymentVerifier() first.");
  return client.address;
}

export async function verifyPayment(
  txHash: string,
  expectedAmount: string,
  serverAddress: string,
  tokenIndex?: number
): Promise<VerifyPaymentResult> {
  if (!client || !client.isLoggedIn) {
    return { valid: false, error: "Payment verifier not initialized" };
  }

  // Replay prevention: check if txHash was already used
  cleanupExpiredHashes();
  if (usedTxHashes.has(txHash)) {
    return { valid: false, error: "Transaction already used" };
  }

  try {
    // Fetch recent transfers (incoming)
    const response = await client.fetchTransfers({ cursor: null, limit: 50 });
    const transfers = response.items;

    // Find matching transaction by digest
    const match = transfers.find((tx) => tx.digest === txHash);
    if (!match) {
      return { valid: false, error: "Transaction not found in recent transfers" };
    }

    // Verify recipient matches server address
    if (match.to?.toLowerCase() !== serverAddress.toLowerCase()) {
      return { valid: false, error: "Recipient does not match server address" };
    }

    // Verify amount (compare as BigInt-safe string)
    if (match.amount !== expectedAmount) {
      return { valid: false, error: `Amount mismatch: expected ${expectedAmount}, got ${match.amount}` };
    }

    // Verify token if specified
    if (tokenIndex !== undefined && match.tokenIndex !== tokenIndex) {
      return { valid: false, error: `Token mismatch: expected index ${tokenIndex}, got ${match.tokenIndex}` };
    }

    // Mark as used (replay prevention)
    usedTxHashes.set(txHash, Date.now() + TX_HASH_TTL_MS);

    return { valid: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Payment verification failed: ${message}` };
  }
}

// For testing: reset state
export function _resetPaymentVerifier(): void {
  client = null;
  loginPromise = null;
  usedTxHashes.clear();
}
