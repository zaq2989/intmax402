# INTMAX402 Security Considerations

## Threat Model

### In Scope
- Replay attacks on authentication tokens
- Signature forgery
- Nonce prediction
- Man-in-the-middle attacks (mitigated by HTTPS)
- Payment verification bypass

### Out of Scope
- Private key compromise on client side
- Server-side secret leakage
- DDoS attacks
- Smart contract vulnerabilities in INTMAX L2

## Security Properties

### Nonce Security
- Generated using HMAC-SHA256 (cryptographically secure)
- Time-windowed (30 seconds) to prevent replay
- Bound to client IP and request path
- Server-side generation: no client-controlled nonce input

### Signature Verification
- Uses Ethereum's `personal_sign` (EIP-191) format
- ECDSA on secp256k1 curve
- Address recovery from signature ensures authenticity

### Payment Verification
- Transaction hash verified against INTMAX L2
- Amount and recipient validation on server side
- Double-spend protection via L2 finality

## Recommendations

### For Server Operators
1. **Use HTTPS**: Always deploy behind TLS to prevent MITM
2. **Rotate secrets**: Change the HMAC secret periodically
3. **Set allow lists**: Restrict access to known addresses when possible
4. **Monitor usage**: Track authentication patterns for anomalies
5. **Use strong secrets**: Minimum 256-bit random secrets

### For Client Implementers
1. **Protect private keys**: Use secure key storage (HSM, enclave)
2. **Verify server certificates**: Don't disable TLS verification
3. **Handle 402 gracefully**: Implement proper retry logic with backoff
4. **Check payment amounts**: Verify requested amounts before paying

### Environment Variables
- `INTMAX402_SECRET`: Server HMAC secret (required in production)
- Never commit secrets to version control
- Use different secrets per environment

## Known Limitations

1. **Placeholder crypto**: Current implementation uses HMAC-based signatures instead of full ECDSA. Production deployments should use ethers.js or noble-secp256k1 for proper signature verification.
2. **Payment verification**: Currently validates txHash format only. Production should query INTMAX L2 for payment confirmation.
3. **IP-based nonce binding**: May cause issues with load balancers or proxies that change client IP. Use `X-Forwarded-For` header handling in production.
