import { ethers } from "ethers";

/**
 * Verify an Ethereum personal_sign signature.
 * Recovers the signer address from the signature and compares with claimed address.
 */
export function verifySignature(
  signature: string,
  message: string,
  claimedAddress: string
): boolean {
  try {
    // Recover signer address using ethers.verifyMessage (Ethereum personal_sign)
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === claimedAddress.toLowerCase();
  } catch {
    return false;
  }
}
