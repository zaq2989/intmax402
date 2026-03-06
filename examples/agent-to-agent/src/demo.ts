import express from "express";
import { intmax402 } from "@tanakayuto/intmax402-express";
import { INTMAX402Client } from "@tanakayuto/intmax402-client";

const SECRET = "agent-demo-secret";
const PORT = 3761;

// Agent B: Server providing an API
const app = express();

app.get(
  "/api/data",
  intmax402({
    mode: "identity",
    secret: SECRET,
  }),
  (_req, res) => {
    res.json({
      data: "Classified information from Agent B",
      requestedBy: _req.intmax402?.address,
      timestamp: Date.now(),
    });
  }
);

async function main() {
  // Start Agent B's server
  const server = app.listen(PORT, async () => {
    console.log(`Agent B (server) listening on http://localhost:${PORT}`);
    console.log("");

    // Agent A: Client consuming the API
    console.log("Agent A: Initializing client...");
    const client = new INTMAX402Client({
      privateKey: "0x" + "ab".repeat(32),
      environment: "testnet",
    });
    await client.init();
    console.log(`Agent A: Address = ${client.getAddress()}`);
    console.log("");

    // Agent A calls Agent B's protected API
    console.log("Agent A: Calling Agent B's /api/data...");
    const response = await client.fetch(`http://localhost:${PORT}/api/data`);
    console.log(`Agent A: Response status = ${response.status}`);

    if (response.ok) {
      const body = await response.json();
      console.log("Agent A: Received data:", JSON.stringify(body, null, 2));
    } else {
      console.log("Agent A: Failed:", await response.text());
    }

    server.close();
    console.log("\nDemo complete.");
  });
}

main().catch(console.error);
