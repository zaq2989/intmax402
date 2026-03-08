# @tanakayuto/intmax402-cli

Part of [intmax402](https://github.com/zaq2989/intmax402) — HTTP 402, reimagined for AI agents.

See [main README](https://github.com/zaq/intmax402) for full documentation.

## Network

By default, the CLI tests against **Ethereum mainnet** (via INTMAX ZK L2 on Scroll). Use `--testnet` flag for development.

```bash
# Test on mainnet (default)
intmax402 test http://localhost:3000/premium

# Test on testnet
intmax402 test --testnet http://localhost:3000/premium
```
