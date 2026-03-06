#!/usr/bin/env node

import { randomBytes } from "crypto";
import { parseAuthorization, parseWWWAuthenticate } from "@intmax402/core";
import { INTMAX402Client } from "@intmax402/client";

const [, , command, ...args] = process.argv;

async function main() {
  switch (command) {
    case "test":
      await testCommand(args[0]);
      break;
    case "keygen":
      keygenCommand();
      break;
    case "verify":
      verifyCommand(args[0]);
      break;
    default:
      printUsage();
  }
}

async function testCommand(url?: string) {
  if (!url) {
    console.error("Usage: intmax402 test <url>");
    process.exit(1);
  }

  console.log(`Testing INTMAX402 flow against ${url}...\n`);

  // Step 1: Initial request
  console.log("Step 1: Sending initial request...");
  const response = await fetch(url);
  console.log(`  Status: ${response.status}`);

  if (response.status !== 401 && response.status !== 402) {
    console.log("  No 402 challenge received. Endpoint may not be protected.");
    return;
  }

  const wwwAuth = response.headers.get("www-authenticate");
  if (!wwwAuth) {
    console.error("  No WWW-Authenticate header found.");
    return;
  }

  console.log(`  WWW-Authenticate: ${wwwAuth}`);
  const challenge = parseWWWAuthenticate(wwwAuth);
  if (!challenge) {
    console.error("  Failed to parse challenge.");
    return;
  }

  console.log(`  Mode: ${challenge.mode}`);
  console.log(`  Nonce: ${challenge.nonce}`);

  // Step 2: Generate key and sign
  console.log("\nStep 2: Generating key and signing...");
  const privateKey = "0x" + randomBytes(32).toString("hex");
  const client = new INTMAX402Client({ privateKey });
  await client.init();

  console.log(`  Address: ${client.getAddress()}`);
  const signature = await client.sign(challenge.nonce);
  console.log(`  Signature: ${signature.slice(0, 20)}...`);

  // Step 3: Retry with credentials
  console.log("\nStep 3: Retrying with credentials...");
  const retryResponse = await client.fetch(url);
  console.log(`  Status: ${retryResponse.status}`);

  if (retryResponse.ok) {
    const body = await retryResponse.text();
    console.log(`  Response: ${body.slice(0, 200)}`);
  } else {
    console.log(`  Response: ${await retryResponse.text()}`);
  }
}

function keygenCommand() {
  const privateKey = "0x" + randomBytes(32).toString("hex");
  const client = new INTMAX402Client({ privateKey });
  console.log("Generated test keypair:");
  console.log(`  Private Key: ${privateKey}`);
  console.log(`  Address:     ${client.getAddress()}`);
}

function verifyCommand(header?: string) {
  if (!header) {
    console.error("Usage: intmax402 verify <authorization-header>");
    process.exit(1);
  }

  const credential = parseAuthorization(header);
  if (!credential) {
    console.error("Failed to parse Authorization header.");
    process.exit(1);
  }

  console.log("Parsed credential:");
  console.log(`  Address:   ${credential.address}`);
  console.log(`  Nonce:     ${credential.nonce}`);
  console.log(`  Signature: ${credential.signature.slice(0, 20)}...`);
  if (credential.txHash) {
    console.log(`  TX Hash:   ${credential.txHash}`);
  }
}

function printUsage() {
  console.log("intmax402 CLI - HTTP 402 Payment Gate Test Tool");
  console.log("");
  console.log("Usage:");
  console.log("  intmax402 test <url>       Test 402 flow against a URL");
  console.log("  intmax402 keygen           Generate a test ETH keypair");
  console.log("  intmax402 verify <header>  Parse an Authorization header");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
