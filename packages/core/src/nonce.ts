import { createHmac } from "crypto";

function getTimeWindow(): number {
  return Math.floor(Date.now() / 30000);
}

export function generateNonce(secret: string, ip: string, path: string): string {
  const window = getTimeWindow();
  const data = `${window}:${ip}:${path}`;
  return createHmac("sha256", secret).update(data).digest("hex");
}
