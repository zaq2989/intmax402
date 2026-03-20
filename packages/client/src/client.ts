import { ethers } from "ethers";
import { parseWWWAuthenticate, INTMAX402Error, INTMAX402_ERROR_CODES } from "@tanakayuto/intmax402-core";
import { IntMaxNodeClient, Token, TokenType } from "intmax2-server-sdk";
import { privateKeyToAccount } from "viem/accounts";
import { createPaymentHeader, selectPaymentRequirements } from "x402/client";
import type { Network } from "x402/types";

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
      throw new INTMAX402Error(
        INTMAX402_ERROR_CODES.MISSING_PRIVATE_KEY,
        "Invalid private key: must be a 32-byte hex string (0x-prefixed)"
      );
    }
    this.wallet = new ethers.Wallet(options.privateKey);
    this.environment = options.environment || "mainnet";
  }

  async init(): Promise<void> {
    this.initialized = true;
  }

  async initPayment(l1RpcUrl?: string): Promise<void> {
    try {
      this.intmaxClient = new IntMaxNodeClient({
        environment: this.environment,
        eth_private_key: this.wallet.privateKey as `0x${string}`,
        l1_rpc_url: l1RpcUrl || RPC_URLS[this.environment],
        loggerLevel: "warn",
      });
      await this.intmaxClient.login();
      this.initialized = true;
    } catch (e) {
      this.intmaxClient = null;
      throw new INTMAX402Error(
        INTMAX402_ERROR_CODES.INTMAX_NETWORK_UNAVAILABLE,
        `initPayment failed: ${(e as Error).message}`,
        e
      );
    }
  }

  isPaymentInitialized(): boolean {
    return this.intmaxClient !== null && this.initialized;
  }

  getAddress(): string {
    return this.wallet.address;
  }

  getIntMaxAddress(): string {
    if (!this.intmaxClient) throw new INTMAX402Error(INTMAX402_ERROR_CODES.INTMAX_NETWORK_UNAVAILABLE, "Call initPayment() first");
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
    amountEth: number,
    token: Token
  ): Promise<{ txTreeRoot: string; transferDigest: string }> {
    if (!this.intmaxClient) {
      throw new INTMAX402Error(INTMAX402_ERROR_CODES.INTMAX_NETWORK_UNAVAILABLE, "Call initPayment() before sending payments");
    }

    // Sync before sending payment (with timeout, failure is non-fatal)
    try {
      await Promise.race([
        this.intmaxClient.sync(),
        new Promise((_, rej) =>
          setTimeout(() => rej(new Error("sync timeout")), 30000)
        ),
      ]);
    } catch (e) {
      // sync failed or timed out, continue anyway
    }

    const tryBroadcast = async () => {
      const result = await this.intmaxClient!.broadcastTransaction([
        { address: recipientAddress, amount: amountEth, token },
      ]);
      return result;
    };

    let result;
    try {
      result = await tryBroadcast();
    } catch (e) {
      // retry once after 5 seconds
      await new Promise((r) => setTimeout(r, 5000));
      try {
        result = await tryBroadcast();
      } catch (e2) {
        throw new INTMAX402Error(
          INTMAX402_ERROR_CODES.INTMAX_BROADCAST_FAILED,
          `broadcastTransaction failed after retry: ${(e2 as Error).message}`,
          e2
        );
      }
    }

    return {
      txTreeRoot: result.txTreeRoot,
      transferDigest: result.transferDigests[0],
    };
  }

  /**
   * Fetch a resource using the standard x402 protocol (HTTP 402 + X-Payment-Requirements).
   * Automatically selects the best payment requirement, creates a viem wallet client,
   * generates the X-Payment header, and retries the request.
   */
  async fetchX402(url: string, options?: RequestInit, preferredNetwork?: Network): Promise<Response> {
    const initialResponse = await globalThis.fetch(url, options);

    if (initialResponse.status !== 402) return initialResponse;

    // X-Payment-Requirements ヘッダを確認（standard x402）
    const requirementsHeader = initialResponse.headers.get("X-Payment-Requirements");
    if (!requirementsHeader) return initialResponse;

    const paymentRequirements = JSON.parse(requirementsHeader);

    // 最適なrequirementを選ぶ（preferredNetwork or 'base'）
    const selectedRequirement = selectPaymentRequirements(
      Array.isArray(paymentRequirements) ? paymentRequirements : [paymentRequirements],
      preferredNetwork ?? "base"
    );

    // x402 signer 作成（viem LocalAccount は EvmSigner を満たす）
    const signer = privateKeyToAccount(this.wallet.privateKey as `0x${string}`);

    // x402 payment header 作成
    const paymentHeader = await createPaymentHeader(signer, 1, selectedRequirement);

    // 再リクエスト
    return globalThis.fetch(url, {
      ...options,
      headers: {
        ...((options?.headers as Record<string, string>) || {}),
        "X-Payment": paymentHeader,
      },
    });
  }

  /**
   * Fetch a resource, automatically handling 401/402 INTMAX402 challenges.
   * For identity mode: GET -> 401 + nonce -> sign -> GET + Authorization -> 200
   * For payment mode: GET -> 402 + nonce + payment info -> pay + sign -> GET + Authorization (with txHash) -> 200
   * Also handles standard x402 protocol (402 + X-Payment-Requirements header).
   */
  async fetch(url: string, options?: RequestInit): Promise<Response> {
    const initialResponse = await globalThis.fetch(url, options);

    // standard x402 チェック（X-Payment-Requirements ヘッダがある場合）
    if (initialResponse.status === 402) {
      const requirementsHeader = initialResponse.headers.get("X-Payment-Requirements");
      if (requirementsHeader) {
        return this.fetchX402(url, options);
      }
    }

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
        throw new INTMAX402Error(
          INTMAX402_ERROR_CODES.INTMAX_NETWORK_UNAVAILABLE,
          "Payment required but intmax client not initialized. Call initPayment() first."
        );
      }

      if (!challenge.serverAddress || !challenge.amount) {
        throw new INTMAX402Error(INTMAX402_ERROR_CODES.INVALID_CONFIG, "Server did not provide serverAddress or amount in challenge");
      }

      // Get token list and find matching token
      const tokens = await this.intmaxClient.getTokensList();
      let paymentToken: Token;

      if (challenge.tokenAddress) {
        const found = tokens.find(
          (t) => t.contractAddress.toLowerCase() === challenge.tokenAddress!.toLowerCase()
        );
        if (!found) {
          throw new INTMAX402Error(INTMAX402_ERROR_CODES.INVALID_CONFIG, `Token ${challenge.tokenAddress} not found in token list`);
        }
        paymentToken = found;
      } else {
        // Default: native token (index 0)
        paymentToken = tokens.find((t) => t.tokenIndex === 0) || tokens[0];
      }

      // Fix: getTokensList() doesn't set tokenType for native token
      if (paymentToken.tokenIndex === 0) {
        paymentToken = { ...paymentToken, tokenType: TokenType.NATIVE };
      }

      // Convert amount from wei string to ETH number
      const amountEth = Number(challenge.amount) / 1e18;

      const { transferDigest } = await this.sendPayment(
        challenge.serverAddress,
        amountEth,
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
