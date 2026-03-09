import { INTMAX402Client } from "@tanakayuto/intmax402-client";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3761";
const CLIENT_PRIVATE_KEY = process.env.CLIENT_PRIVATE_KEY;
if (!CLIENT_PRIVATE_KEY) {
  console.error("Error: CLIENT_PRIVATE_KEY environment variable is required");
  console.error("Generate one with: intmax402 keygen");
  process.exit(1);
}
const PRIVATE_KEY = CLIENT_PRIVATE_KEY as string;
const ENVIRONMENT = (process.env.INTMAX_ENV as "testnet" | "mainnet") || "testnet";

async function main() {
  const client = new INTMAX402Client({
    privateKey: PRIVATE_KEY,
    environment: ENVIRONMENT,
  });

  // Initialize payment capability (logs into INTMAX L2 network)
  // For testnet: fund your wallet at https://testnet.intmax.io
  // For mainnet: deposit ETH at https://app.intmax.io
  console.log(`Initializing client with payment support (${ENVIRONMENT})...`);
  await client.initPayment();
  console.log(`Client Ethereum address: ${client.getAddress()}`);
  console.log(`Client INTMAX L2 address: ${client.getIntMaxAddress()}`);

  // Access free endpoint
  console.log("\n--- Accessing free endpoint ---");
  const freeRes = await client.fetch(`${SERVER_URL}/free`);
  console.log(`Status: ${freeRes.status}`);
  console.log(`Response: ${JSON.stringify(await freeRes.json())}`);

  // Access payment-gated endpoint
  // The client automatically handles the full flow:
  //   1. GET /premium → 402 with payment challenge
  //   2. Send INTMAX transfer to server's address
  //   3. Retry GET with Authorization + txHash
  //   4. Receive 200 with result
  console.log("\n--- Accessing payment-gated endpoint ---");
  console.log("This will automatically send payment and include proof...");
  const premiumRes = await client.fetch(`${SERVER_URL}/premium`);
  console.log(`Status: ${premiumRes.status}`);
  console.log(`Response: ${JSON.stringify(await premiumRes.json())}`);
}

main().catch(console.error);
