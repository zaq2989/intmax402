import { ethers } from "ethers";
import { parseWWWAuthenticate } from "@tanakayuto/intmax402-core";

const RPC_URLS = {
  mainnet: "https://api.rpc.intmax.io?network=ethereum",
  testnet: "https://sepolia.gateway.tenderly.co",
} as const;

export interface INTMAX402ClientOptions {
  privateKey: string;
  environment?: "mainnet" | "testnet";
}

export class INTMAX402Client {
  private wallet: ethers.Wallet;
  private environment: "mainnet" | "testnet";
  private initialized: boolean = false;

  constructor(options: INTMAX402ClientOptions) {
    this.wallet = new ethers.Wallet(options.privateKey);
    this.environment = options.environment || "testnet";
  }

  async init(): Promise<void> {
    // In production: IntMaxNodeClient.login() (~7s one-time)
    this.initialized = true;
  }

  getAddress(): string {
    return this.wallet.address;
  }

  getRpcUrl(): string {
    return RPC_URLS[this.environment];
  }

  /**
   * Sign a nonce using Ethereum personal_sign (compatible with ethers.verifyMessage).
   */
  async sign(nonce: string): Promise<string> {
    return await this.wallet.signMessage(nonce);
  }

  /**
   * Fetch a resource, automatically handling 401/402 INTMAX402 challenges.
   * Flow: GET → 401/402 + nonce → sign → GET + Authorization → 200
   */
  async fetch(url: string, options?: RequestInit): Promise<Response> {
    const initialResponse = await globalThis.fetch(url, options);

    if (initialResponse.status !== 401 && initialResponse.status !== 402) {
      return initialResponse;
    }

    const wwwAuth = initialResponse.headers.get("www-authenticate");
    if (!wwwAuth) return initialResponse;

    const challenge = parseWWWAuthenticate(wwwAuth);
    if (!challenge) return initialResponse;

    // Sign the nonce
    const signature = await this.sign(challenge.nonce);

    // Build authorization header
    const authHeader = `INTMAX402 address="${this.wallet.address}", nonce="${challenge.nonce}", signature="${signature}"`;

    // Retry with credentials
    return globalThis.fetch(url, {
      ...options,
      headers: {
        ...((options?.headers as Record<string, string>) || {}),
        Authorization: authHeader,
      },
    });
  }
}
