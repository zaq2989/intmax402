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
  chainId?: string;
  environment?: "mainnet" | "testnet";
  allowList?: string[];
  pricing?: Record<string, string>;
}
