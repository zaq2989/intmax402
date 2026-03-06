import express from "express";
import { intmax402 } from "@intmax402/express";

const app = express();
const PORT = 3760;
const SECRET = process.env.INTMAX402_SECRET || "dev-secret-change-in-production";

// Free endpoint - no authentication required
app.get("/free", (_req, res) => {
  res.json({ message: "This endpoint is free for all!", timestamp: Date.now() });
});

// Identity-protected endpoint - requires valid signature
app.get(
  "/identity",
  intmax402({
    mode: "identity",
    secret: SECRET,
  }),
  (_req, res) => {
    res.json({
      message: "Identity verified!",
      address: _req.intmax402?.address,
      timestamp: Date.now(),
    });
  }
);

// Payment-protected endpoint - requires payment of $0.001 USDC
app.get(
  "/paid",
  intmax402({
    mode: "payment",
    secret: SECRET,
    serverAddress: "0x1234567890abcdef1234567890abcdef12345678",
    amount: "0.001",
    tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    chainId: "1",
  }),
  (_req, res) => {
    res.json({
      message: "Payment received! Here is your premium content.",
      address: _req.intmax402?.address,
      timestamp: Date.now(),
    });
  }
);

app.listen(PORT, () => {
  console.log(`intmax402 basic-express server running on http://localhost:${PORT}`);
  console.log("Endpoints:");
  console.log("  GET /free     - No auth required");
  console.log("  GET /identity - Identity verification required");
  console.log("  GET /paid     - Payment required ($0.001 USDC)");
});
