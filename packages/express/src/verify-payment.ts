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
// Value is expiry timestamp (ms), or PENDING (-1) while verification is in progress
const PENDING = -1;
const usedTxHashes = new Map<string, number>();
const TX_HASH_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function cleanupExpiredHashes(): void {
  const now = Date.now();
  for (const [hash, expiry] of usedTxHashes) {
    // Skip PENDING entries (active verifications)
    if (expiry === PENDING) continue;
    if (now > expiry) {
      usedTxHashes.delete(hash);
    }
  }
}

// Start periodic cleanup (Fix 5: Map periodic cleanup)
const cleanupInterval = setInterval(cleanupExpiredHashes, 60 * 60 * 1000); // 1 hour
cleanupInterval.unref(); // Don't prevent process exit

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

  // Replay prevention: check if txHash was already used (or pending)
  cleanupExpiredHashes();
  if (usedTxHashes.has(txHash)) {
    return { valid: false, error: "Transaction already used" };
  }

  // Fix 1: Mark as PENDING immediately to prevent race conditions
  usedTxHashes.set(txHash, PENDING);

  try {
    // Fix 3: Fetch up to 200 transfers using pagination
    let response = await client.fetchTransfers({ cursor: null, limit: 100 });
    let transfers = [...response.items];

    // Check next page if not found yet and more items exist
    if (!transfers.find((tx) => tx.digest === txHash) && response.pagination?.has_more && response.pagination?.next_cursor != null) {
      const response2 = await client.fetchTransfers({ cursor: response.pagination.next_cursor as any, limit: 100 });
      transfers = transfers.concat(response2.items);
    }

    // Find matching transaction by digest
    const match = transfers.find((tx) => tx.digest === txHash);
    if (!match) {
      // Fix 1: Rollback on validation failure
      usedTxHashes.delete(txHash);
      return { valid: false, error: "Transaction not found in recent transfers" };
    }

    // Verify recipient matches server address
    if (match.to?.toLowerCase() !== serverAddress.toLowerCase()) {
      // Fix 1: Rollback on validation failure
      usedTxHashes.delete(txHash);
      return { valid: false, error: "Recipient does not match server address" };
    }

    // Fix 2: Verify amount using BigInt comparison (allows >= expectedAmount)
    if (BigInt(match.amount) < BigInt(expectedAmount)) {
      // Fix 1: Rollback on validation failure
      usedTxHashes.delete(txHash);
      return { valid: false, error: `Amount mismatch: expected ${expectedAmount}, got ${match.amount}` };
    }

    // Verify token if specified
    if (tokenIndex !== undefined && match.tokenIndex !== tokenIndex) {
      // Fix 1: Rollback on validation failure
      usedTxHashes.delete(txHash);
      return { valid: false, error: `Token mismatch: expected index ${tokenIndex}, got ${match.tokenIndex}` };
    }

    // Fix 1: Mark as used with proper expiry (replace PENDING)
    usedTxHashes.set(txHash, Date.now() + TX_HASH_TTL_MS);

    return { valid: true };
  } catch (err) {
    // Fix 1: Rollback on error so the tx can be retried
    usedTxHashes.delete(txHash);
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
