export type INTMAX402Mode = "identity" | "payment";

export interface INTMAX402Challenge {
  realm: string;
  nonce: string;
  mode: INTMAX402Mode;
  serverAddress?: string;
  amount?: string;
  tokenAddress?: string;
  chainId?: string;
}

export interface INTMAX402Credential {
  address: string;
  nonce: string;
  signature: string;
  txHash?: string;
}

export interface INTMAX402Config {
  mode: INTMAX402Mode;
  secret: string;
  serverAddress?: string;
  amount?: string;
  tokenAddress?: string;
  /**
   * L1 chain ID for the INTMAX network.
   * - Mainnet (default): `"1"` (Ethereum mainnet, INTMAX ZK L2 on Scroll)
   * - Testnet: `"11155111"` (Sepolia, INTMAX ZK L2 on Scroll Sepolia)
   * If omitted, chainId is auto-derived from the `environment` field.
   */
  chainId?: string;
  /**
   * Network environment. Defaults to `"mainnet"`.
   * - `"mainnet"`: Ethereum mainnet + Scroll (chain IDs: L1=1, L2=534352)
   * - `"testnet"`: Sepolia + Scroll Sepolia (chain IDs: L1=11155111, L2=534351)
   */
  environment?: "mainnet" | "testnet";
  /** Optional L1 RPC URL override. If not set, uses the INTMAX public RPC. */
  l1RpcUrl?: string;
  allowList?: string[];
  pricing?: Record<string, string>;
  /** Bind nonce to client IP. Default false (recommended for AI agents). */
  bindIp?: boolean;
}
