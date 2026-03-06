import { createHash, createHmac, sign } from "crypto";
import { parseWWWAuthenticate, INTMAX402Challenge } from "@intmax402/core";

const RPC_URLS = {
  mainnet: "https://api.rpc.intmax.io?network=ethereum",
  testnet: "https://sepolia.gateway.tenderly.co",
} as const;

export interface INTMAX402ClientOptions {
  privateKey: string;
  environment?: "mainnet" | "testnet";
}

export class INTMAX402Client {
  private privateKey: string;
  private environment: "mainnet" | "testnet";
  private address: string;
  private initialized: boolean = false;

  constructor(options: INTMAX402ClientOptions) {
    this.privateKey = options.privateKey;
    this.environment = options.environment || "testnet";
    this.address = this.deriveAddress(options.privateKey);
  }

  private deriveAddress(privateKey: string): string {
    // Derive a deterministic address from private key using hash
    // In production, use secp256k1 to derive the actual Ethereum address
    const hash = createHash("sha256").update(privateKey).digest("hex");
    return "0x" + hash.slice(0, 40);
  }

  async init(): Promise<void> {
    // In production, this would call IntMaxNodeClient.login()
    // which takes ~7 seconds for initial setup
    this.initialized = true;
  }

  getAddress(): string {
    return this.address;
  }

  getRpcUrl(): string {
    return RPC_URLS[this.environment];
  }

  async sign(nonce: string): Promise<string> {
    // Sign the nonce using the private key
    // In production, use secp256k1 to create an Ethereum personal_sign signature
    // For now, create an HMAC-based signature as placeholder
    const message = `\x19Ethereum Signed Message:\n${nonce.length}${nonce}`;
    const sig = createHmac("sha256", this.privateKey).update(message).digest("hex");
    // Pad to 65 bytes (130 hex chars) to match Ethereum signature format
    const padded = sig.padEnd(130, "0");
    return "0x" + padded;
  }

  async fetch(url: string, options?: RequestInit): Promise<Response> {
    // First request - expect 401/402
    const initialResponse = await globalThis.fetch(url, options);

    if (initialResponse.status !== 401 && initialResponse.status !== 402) {
      return initialResponse;
    }

    const wwwAuth = initialResponse.headers.get("www-authenticate");
    if (!wwwAuth) {
      return initialResponse;
    }

    const challenge = parseWWWAuthenticate(wwwAuth);
    if (!challenge) {
      return initialResponse;
    }

    // Sign the nonce
    const signature = await this.sign(challenge.nonce);

    // Build authorization header
    let authHeader = `INTMAX402 address="${this.address}", nonce="${challenge.nonce}", signature="${signature}"`;

    // If payment mode, would need to send payment first and include txHash
    // For now, just include the signature

    // Retry with credentials
    const retryOptions = {
      ...options,
      headers: {
        ...((options?.headers as Record<string, string>) || {}),
        Authorization: authHeader,
      },
    };

    return globalThis.fetch(url, retryOptions);
  }
}
