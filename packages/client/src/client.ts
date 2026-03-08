import { ethers } from "ethers";
import { parseWWWAuthenticate } from "@tanakayuto/intmax402-core";
import { IntMaxNodeClient, Token } from "intmax2-server-sdk";

const RPC_URLS = {
  mainnet: "https://api.rpc.intmax.io?network=ethereum",
  testnet: "https://sepolia.gateway.tenderly.co",
} as const;

export interface INTMAX402ClientOptions {
  privateKey: string;
  environment?: "mainnet" | "testnet";
  l1RpcUrl?: string;
}

export class INTMAX402Client {
  private wallet: ethers.Wallet;
  private environment: "mainnet" | "testnet";
  private initialized: boolean = false;
  private intmaxClient: IntMaxNodeClient | null = null;

  constructor(options: INTMAX402ClientOptions) {
    // Validate private key before creating wallet
    if (!ethers.isHexString(options.privateKey, 32)) {
      throw new Error("Invalid private key: must be a 32-byte hex string (0x-prefixed)");
    }
    this.wallet = new ethers.Wallet(options.privateKey);
    this.environment = options.environment || "mainnet";
  }

  async init(): Promise<void> {
    this.initialized = true;
  }

  async initPayment(l1RpcUrl?: string): Promise<void> {
    this.intmaxClient = new IntMaxNodeClient({
      environment: this.environment,
      eth_private_key: this.wallet.privateKey as `0x${string}`,
      l1_rpc_url: l1RpcUrl || RPC_URLS[this.environment],
      loggerLevel: "warn",
    });
    await this.intmaxClient.login();
    this.initialized = true;
  }

  getAddress(): string {
    return this.wallet.address;
  }

  getIntMaxAddress(): string {
    if (!this.intmaxClient) throw new Error("Call initPayment() first");
    return this.intmaxClient.address;
  }

  getRpcUrl(): string {
    return RPC_URLS[this.environment];
  }

  async sign(nonce: string): Promise<string> {
    return await this.wallet.signMessage(nonce);
  }

  async sendPayment(
    recipientAddress: string,
    amount: string,
    token: Token
  ): Promise<{ txTreeRoot: string; transferDigest: string }> {
    if (!this.intmaxClient) {
      throw new Error("Call initPayment() before sending payments");
    }

    const result = await this.intmaxClient.broadcastTransaction([
      { address: recipientAddress, amount, token },
    ]);

    return {
      txTreeRoot: result.txTreeRoot,
      transferDigest: result.transferDigests[0],
    };
  }

  /**
   * Fetch a resource, automatically handling 401/402 INTMAX402 challenges.
   * For identity mode: GET -> 401 + nonce -> sign -> GET + Authorization -> 200
   * For payment mode: GET -> 402 + nonce + payment info -> pay + sign -> GET + Authorization (with txHash) -> 200
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

    const signature = await this.sign(challenge.nonce);

    let authHeader = `INTMAX402 address="${this.wallet.address}", nonce="${challenge.nonce}", signature="${signature}"`;

    // Payment mode: send payment and include txHash
    if (challenge.mode === "payment") {
      if (!this.intmaxClient) {
        throw new Error(
          "Payment required but intmax client not initialized. Call initPayment() first."
        );
      }

      if (!challenge.serverAddress || !challenge.amount) {
        throw new Error("Server did not provide serverAddress or amount in challenge");
      }

      // Get token list and find matching token
      const tokens = await this.intmaxClient.getTokensList();
      let paymentToken: Token;

      if (challenge.tokenAddress) {
        const found = tokens.find(
          (t) => t.contractAddress.toLowerCase() === challenge.tokenAddress!.toLowerCase()
        );
        if (!found) {
          throw new Error(`Token ${challenge.tokenAddress} not found in token list`);
        }
        paymentToken = found;
      } else {
        // Default: native token (index 0)
        paymentToken = tokens.find((t) => t.tokenIndex === 0) || tokens[0];
      }

      const { transferDigest } = await this.sendPayment(
        challenge.serverAddress,
        challenge.amount,
        paymentToken
      );

      authHeader += `, txHash="${transferDigest}"`;
    }

    return globalThis.fetch(url, {
      ...options,
      headers: {
        ...((options?.headers as Record<string, string>) || {}),
        Authorization: authHeader,
      },
    });
  }
}
