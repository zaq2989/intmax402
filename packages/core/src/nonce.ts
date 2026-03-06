import { createHmac, timingSafeEqual } from "crypto";

const WINDOW_MS = 30_000; // 30 second windows

function getTimeWindow(): number {
  return Math.floor(Date.now() / WINDOW_MS);
}

/**
 * Generate a stateless nonce.
 * Time-windowed + path-bound. IP binding is optional (disabled by default for agent compatibility).
 */
export function generateNonce(
  secret: string,
  ip: string,
  path: string,
  bindIp = false  // ← false = AIエージェント対応（IP変動OK）
): string {
  const window = getTimeWindow();
  const data = bindIp
    ? `${window}:${ip}:${path}`
    : `${window}:${path}`;
  return createHmac("sha256", secret).update(data).digest("hex");
}

/**
 * Verify a nonce. Checks current and previous window for clock skew tolerance.
 * Uses timingSafeEqual to prevent timing attacks.
 */
export function verifyNonce(
  nonce: string,
  secret: string,
  ip: string,
  path: string,
  bindIp = false
): boolean {
  const window = getTimeWindow();
  // Check current and previous window (allows up to ~60s of clock skew)
  for (const w of [window, window - 1]) {
    const data = bindIp
      ? `${w}:${ip}:${path}`
      : `${w}:${path}`;
    const expected = createHmac("sha256", secret).update(data).digest("hex");

    // Fix 4: Use timingSafeEqual to prevent timing attacks
    // Both expected and nonce must be valid hex strings of the same length
    if (
      expected.length === nonce.length &&
      /^[0-9a-f]+$/i.test(nonce) &&
      timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(nonce, "hex"))
    ) {
      return true;
    }
  }
  return false;
}
