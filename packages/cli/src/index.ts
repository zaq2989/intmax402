#!/usr/bin/env node

import minimist from "minimist";
import chalk from "chalk";
import { ethers } from "ethers";
import { parseWWWAuthenticate } from "@tanakayuto/intmax402-core";

const argv = minimist(process.argv.slice(2), {
  string: ["mode"],
  boolean: ["help"],
  alias: { h: "help" },
  default: { mode: "identity" },
});

const command = argv._[0];

async function main() {
  if (argv.help || !command) {
    printHelp();
    return;
  }

  switch (command) {
    case "test":
      await testCommand(argv._[1], argv.mode as string);
      break;
    case "keygen":
      keygenCommand();
      break;
    default:
      console.error(chalk.red(`Unknown command: ${command}`));
      printHelp();
      process.exit(1);
  }
}

async function testCommand(url?: string, mode: string = "identity") {
  if (!url) {
    console.error(chalk.red("Usage: intmax402 test <url> [--mode identity|payment]"));
    process.exit(1);
  }

  // Validate URL: only http:// and https:// are allowed (SSRF prevention)
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      console.error(chalk.red("Error: Only http:// and https:// URLs are supported"));
      process.exit(1);
    }
  } catch {
    console.error(chalk.red(`Error: Invalid URL: ${url}`));
    process.exit(1);
  }

  console.log(`Testing: ${chalk.cyan(url)}\n`);

  const startTime = Date.now();

  // Generate a random wallet for testing
  const wallet = ethers.Wallet.createRandom();
  const privateKey = wallet.privateKey;
  const address = wallet.address;

  // Step 1: Initial GET → expect 401
  process.stdout.write(`  ${chalk.yellow("①")} GET ${new URL(url).pathname} → `);
  let res1: Response;
  try {
    res1 = await fetch(url);
  } catch (err: any) {
    console.log(chalk.red(`error: ${err.message}`));
    process.exit(1);
  }

  const statusColor = res1.status === 401 || res1.status === 402 ? chalk.yellow : chalk.green;
  console.log(statusColor(`${res1.status}`));

  if (res1.status !== 401 && res1.status !== 402) {
    console.log(chalk.yellow("  (No 402/401 challenge received. Endpoint may not be protected.)"));
    return;
  }

  // Step 2: Parse nonce
  const wwwAuth = res1.headers.get("www-authenticate");
  if (!wwwAuth) {
    console.error(chalk.red("  No WWW-Authenticate header found."));
    process.exit(1);
  }

  const challenge = parseWWWAuthenticate(wwwAuth);
  if (!challenge) {
    console.error(chalk.red("  Failed to parse WWW-Authenticate challenge."));
    process.exit(1);
  }

  const nonceShort = challenge.nonce.slice(0, 16) + "...";
  console.log(`  ${chalk.yellow("②")} nonce: ${chalk.dim(nonceShort)} (${challenge.realm})`);

  // Step 3: Sign
  console.log(`  ${chalk.yellow("③")} Signing with wallet: ${chalk.dim(address.slice(0, 8) + "...")}`);

  let authHeader: string;

  if (mode === "payment") {
    // Payment mode: include a mock txHash
    const mockTxHash = "0x" + Buffer.alloc(32).fill(0xab).toString("hex");
    // Sign only the nonce (same format as server expects)
    const signature = await wallet.signMessage(challenge.nonce);
    authHeader = `INTMAX402 address="${address}",nonce="${challenge.nonce}",signature="${signature}",txHash="${mockTxHash}"`;
  } else {
    // Identity mode: sign just the nonce
    const signature = await wallet.signMessage(challenge.nonce);
    authHeader = `INTMAX402 address="${address}",nonce="${challenge.nonce}",signature="${signature}"`;
  }

  // Step 4: Retry with Authorization
  process.stdout.write(`  ${chalk.yellow("④")} GET ${new URL(url).pathname} + Authorization → `);
  let res2: Response;
  try {
    res2 = await fetch(url, {
      headers: { Authorization: authHeader },
    });
  } catch (err: any) {
    console.log(chalk.red(`error: ${err.message}`));
    process.exit(1);
  }

  const elapsed = Date.now() - startTime;

  if (res2.ok) {
    console.log(`${chalk.green(String(res2.status))} ${chalk.green("✅")}`);
  } else {
    console.log(`${chalk.red(String(res2.status))} ${chalk.red("❌")}`);
    const body = await res2.text().catch(() => "");
    if (body) console.log(chalk.dim(`  ${body.slice(0, 200)}`));
  }

  console.log();
  console.log(`${chalk.bold("Address:")} ${address}`);
  console.log(`${chalk.bold("Time:")} ${elapsed}ms`);

  if (!res2.ok) {
    process.exit(1);
  }
}

function keygenCommand() {
  const wallet = ethers.Wallet.createRandom();

  console.log("\nGenerated wallet:");
  console.log(`  ${chalk.bold("Address:")}     ${chalk.green(wallet.address)}`);
  console.log(`  ${chalk.bold("Private Key:")} ${chalk.yellow(wallet.privateKey)}`);
  console.log();
  console.log(chalk.red("⚠ Use for testing only. Never use in production."));
}

function printHelp() {
  console.log(`${chalk.bold("intmax402")} - HTTP 402 Payment Gate CLI Tool`);
  console.log();
  console.log(chalk.bold("Usage:"));
  console.log(`  intmax402 ${chalk.cyan("test")} <url> [--mode identity|payment]`);
  console.log(`                     Test 402 flow against a URL`);
  console.log(`  intmax402 ${chalk.cyan("keygen")}               Generate a test Ethereum wallet`);
  console.log(`  intmax402 ${chalk.cyan("--help")}               Show this help message`);
  console.log();
  console.log(chalk.bold("Examples:"));
  console.log(`  intmax402 test http://localhost:3760/identity`);
  console.log(`  intmax402 test http://localhost:3760/paid --mode payment`);
  console.log(`  intmax402 keygen`);
}

main().catch((err) => {
  console.error(chalk.red("Error:"), err.message);
  process.exit(1);
});
