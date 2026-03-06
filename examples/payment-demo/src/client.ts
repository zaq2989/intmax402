import { INTMAX402Client } from "@tanakayuto/intmax402-client";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3761";
const CLIENT_PRIVATE_KEY = process.env.CLIENT_PRIVATE_KEY;
if (!CLIENT_PRIVATE_KEY) {
  console.error("Error: CLIENT_PRIVATE_KEY environment variable is required");
  console.error("Generate one with: intmax402 keygen");
  process.exit(1);
}
const PRIVATE_KEY = CLIENT_PRIVATE_KEY as string;

async function main() {
  const client = new INTMAX402Client({
    privateKey: PRIVATE_KEY,
    environment: "testnet",
  });

  // Initialize payment capability
  console.log("Initializing client with payment support...");
  await client.initPayment("https://sepolia.gateway.tenderly.co");
  console.log(`Client address: ${client.getAddress()}`);
  console.log(`Client INTMAX address: ${client.getIntMaxAddress()}`);

  // Access free endpoint
  console.log("\n--- Accessing free endpoint ---");
  const freeRes = await client.fetch(`${SERVER_URL}/free`);
  console.log(`Status: ${freeRes.status}`);
  console.log(`Response: ${JSON.stringify(await freeRes.json())}`);

  // Access payment-gated endpoint
  console.log("\n--- Accessing payment-gated endpoint ---");
  console.log("This will automatically send payment and include proof...");
  const premiumRes = await client.fetch(`${SERVER_URL}/premium`);
  console.log(`Status: ${premiumRes.status}`);
  console.log(`Response: ${JSON.stringify(await premiumRes.json())}`);
}

main().catch(console.error);
