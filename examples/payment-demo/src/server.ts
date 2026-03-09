import express from "express";
import { intmax402 } from "@tanakayuto/intmax402-express";

const PORT = Number(process.env.PORT) || 3761;
const SECRET = process.env.INTMAX402_SECRET || "payment-demo-secret";
const ETH_PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY as `0x${string}`;
const ENVIRONMENT = (process.env.INTMAX_ENV as "testnet" | "mainnet") || "testnet";

if (!ETH_PRIVATE_KEY) {
  console.error("SERVER_PRIVATE_KEY environment variable is required");
  process.exit(1);
}

const app = express();
app.use(express.json());

// Free endpoint
app.get("/free", (_req, res) => {
  res.json({ message: "Free endpoint - no payment required" });
});

// Payment-gated endpoint
// ethPrivateKey auto-initializes the INTMAX payment verifier on first request (v0.3.1+)
app.get(
  "/premium",
  intmax402({
    mode: "payment",
    secret: SECRET,
    serverAddress: process.env.INTMAX_ADDRESS, // your INTMAX address (auto-derived if omitted)
    amount: "1000", // amount in token smallest unit
    environment: ENVIRONMENT,
    ethPrivateKey: ETH_PRIVATE_KEY, // auto-initializes verifier (v0.3.1+)
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
  console.log(`Environment: ${ENVIRONMENT}`);
});
