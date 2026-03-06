import express from "express";
import { intmax402, initPaymentVerifier, getPaymentVerifierAddress } from "@tanakayuto/intmax402-express";

const PORT = Number(process.env.PORT) || 3761;
const SECRET = process.env.INTMAX402_SECRET || "payment-demo-secret";
const ETH_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY as `0x${string}`;
const ENVIRONMENT = (process.env.INTMAX_ENV as "testnet" | "mainnet") || "testnet";

async function main() {
  if (!ETH_PRIVATE_KEY) {
    console.error("SERVER_PRIVATE_KEY environment variable is required");
    process.exit(1);
  }

  // Initialize payment verifier (login to INTMAX network)
  console.log("Initializing payment verifier...");
  await initPaymentVerifier({
    eth_private_key: ETH_PRIVATE_KEY,
    environment: ENVIRONMENT,
    l1_rpc_url: "https://sepolia.gateway.tenderly.co",
  });

  const serverAddress = getPaymentVerifierAddress();
  console.log(`Server INTMAX address: ${serverAddress}`);

  const app = express();
  app.use(express.json());

  // Free endpoint
  app.get("/free", (_req, res) => {
    res.json({ message: "Free endpoint - no payment required" });
  });

  // Payment-gated endpoint
  app.get(
    "/premium",
    intmax402({
      mode: "payment",
      secret: SECRET,
      serverAddress,
      amount: "1000", // amount in token smallest unit
    }),
    (_req, res) => {
      res.json({
        message: "Payment verified! Here is your premium content.",
        paidBy: _req.intmax402?.address,
        txHash: _req.intmax402?.txHash,
        timestamp: Date.now(),
      });
    }
  );

  app.listen(PORT, () => {
    console.log(`Payment demo server running on http://localhost:${PORT}`);
    console.log("Endpoints:");
    console.log("  GET /free    - No payment required");
    console.log("  GET /premium - Payment required (1000 units)");
  });
}

main().catch(console.error);
