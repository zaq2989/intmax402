# Agent-to-Agent Demo

Demonstrates **AI agent autonomous authentication** — Agent A (client) calls Agent B (server) without any human intervention. Both agents operate independently using wallet-based identity.

## What This Demo Shows

- Agent B starts an Express server with identity-mode protection on `GET /api/data`
- Agent A generates a random ephemeral wallet, initializes an INTMAX402Client, and calls Agent B
- The entire authentication handshake (401 → sign → retry) happens automatically
- No API keys, no manual credential exchange — just wallets

This is the core value proposition of intmax402: AI agents can discover and authenticate with each other using only an Ethereum private key.

## How It Works

```
Agent A (client)                Agent B (server)
      │── GET /api/data ──────────>  │
      │<─ 401 + nonce ─────────────  │
      │  signMessage(nonce) ──       │
      │── GET /api/data + sig ─────> │
      │<─ 200 + data ──────────────  │
```

## Setup

```bash
# From the monorepo root:
pnpm install
pnpm build
```

## Run

```bash
cd examples/agent-to-agent
node dist/index.js
```

Expected output:
```
Agent B (server) listening on http://localhost:3762

Agent A: Initializing client...
Agent A: Address = 0xf39Fd... (randomly generated each run)

Agent A: Calling Agent B's /api/data...
Agent A: Response status = 200
Agent A: Received data: {
  "data": "Classified information from Agent B",
  "requestedBy": "0xf39Fd...",
  "timestamp": 1234567890123
}

Demo complete.
```

## Key Files

- `src/index.ts` — Both agents in one file: Agent B starts first, then Agent A connects

## Notes

- Agent A's wallet is randomly generated on each run (no persistent identity)
- For production agent-to-agent flows, agents should use persistent private keys
- Payment mode can be layered on top — see [payment-demo](../payment-demo/) for reference

## Related Docs

- [Identity Mode Guide](../../docs/identity-mode.md)
- [Getting Started](../../docs/getting-started.md)
