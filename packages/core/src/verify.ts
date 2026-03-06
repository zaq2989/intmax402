import { createHmac } from "crypto";

function getTimeWindow(): number {
  return Math.floor(Date.now() / 30000);
}

export function verifyNonce(nonce: string, secret: string, ip: string, path: string): boolean {
  const currentWindow = getTimeWindow();
  for (const offset of [0, -1]) {
    const data = `${currentWindow + offset}:${ip}:${path}`;
    const expected = createHmac("sha256", secret).update(data).digest("hex");
    if (nonce === expected) return true;
  }
  return false;
}
