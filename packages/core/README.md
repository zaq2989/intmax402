# @tanakayuto/intmax402-core

Part of [intmax402](https://github.com/zaq2989/intmax402) — HTTP 402, reimagined for AI agents.

See [main README](https://github.com/zaq2989/intmax402) for full documentation.

## Network

By default, intmax402 operates on **Ethereum mainnet** via INTMAX ZK L2 (Scroll).

| Environment | L1 Chain | L2 Chain | L1 Chain ID |
|---|---|---|---|
| `mainnet` (default) | Ethereum mainnet | Scroll | `1` |
| `testnet` | Sepolia | Scroll Sepolia | `11155111` |

The `chainId` is automatically included in `WWW-Authenticate` headers based on the configured environment, so clients always know which chain to use.
