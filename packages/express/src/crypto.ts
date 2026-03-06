import { createHash } from "crypto";

export function verifySignature(
  signature: string,
  message: string,
  address: string
): boolean {
  try {
    // Ethereum personal_sign verification
    // The signature is an ECDSA signature over keccak256("\x19Ethereum Signed Message:\n" + len(message) + message)
    // For lightweight verification without ethers dependency, we do a basic format check
    // Full verification requires secp256k1 ecrecover

    // Validate signature format: 0x + 130 hex chars (65 bytes: r=32, s=32, v=1)
    if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) {
      return false;
    }

    // Validate address format
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return false;
    }

    // In production, use ethers.verifyMessage or secp256k1 ecrecover
    // to recover the signer address from signature and compare with claimed address.
    // This is a placeholder that validates format only.
    // TODO: Add full ECDSA verification with ethers or noble-secp256k1
    return true;
  } catch {
    return false;
  }
}
