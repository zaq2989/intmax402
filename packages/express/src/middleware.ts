import { Request, Response, NextFunction, RequestHandler } from "express";
import {
  INTMAX402Config,
  INTMAX402Mode,
  generateNonce,
  verifyNonce,
  parseAuthorization,
  buildWWWAuthenticate,
} from "@tanakayuto/intmax402-core";
import { verifySignature } from "./crypto";
import { initPaymentVerifier, verifyPayment } from "./verify-payment";

declare global {
  namespace Express {
    interface Request {
      intmax402?: {
        address: string;
        verified: boolean;
        txHash?: string;
      };
    }
  }
}

export function intmax402(config: INTMAX402Config): RequestHandler {
  // Auto-initialize payment verifier if ethPrivateKey is provided
  let initPromise: Promise<void> | null = null;
  if (config.mode === "payment" && config.ethPrivateKey) {
    console.log("[intmax402] Payment verifier initializing...");
    initPromise = initPaymentVerifier({
      eth_private_key: config.ethPrivateKey as `0x${string}`,
      environment: config.environment ?? "mainnet",
      l1_rpc_url: config.l1RpcUrl,
    });
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Wait for payment verifier initialization if in progress
      try {
        if (initPromise) {
          await initPromise;
          initPromise = null;
        }
      } catch (e) {
        res.status(503).json({
          error: 'Payment verifier temporarily unavailable',
          hint: 'INTMAX network may be experiencing issues. Please try again later.',
          protocol: 'INTMAX402',
        });
        return;
      }
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        const ip = req.ip || req.socket.remoteAddress || "unknown";
        const nonce = generateNonce(config.secret, ip, req.path, config.bindIp ?? false);
        const statusCode = config.mode === "payment" ? 402 : 401;
        res.setHeader("WWW-Authenticate", buildWWWAuthenticate(nonce, config));
        res.status(statusCode).json({
          error: config.mode === "payment" ? "Payment Required" : "Unauthorized",
          protocol: "INTMAX402",
          mode: config.mode,
        });
        return;
      }

      const credential = parseAuthorization(authHeader);
      if (!credential) {
        res.status(401).json({ error: "Invalid authorization header" });
        return;
      }

      const ip = req.ip || req.socket.remoteAddress || "unknown";
      if (!verifyNonce(credential.nonce, config.secret, ip, req.path, config.bindIp ?? false)) {
        res.status(401).json({ error: "Invalid or expired nonce" });
        return;
      }

      if (config.allowList && config.allowList.length > 0) {
        const normalizedAllowList = config.allowList.map(a => a.toLowerCase())
        if (!normalizedAllowList.includes(credential.address.toLowerCase())) {
          res.status(403).json({ error: "Address not in allow list" });
          return;
        }
      }

      const isValidSig = verifySignature(
        credential.signature,
        credential.nonce,
        credential.address
      );
      if (!isValidSig) {
        res.status(401).json({ error: "Invalid signature" });
        return;
      }

      if (config.mode === "payment") {
        if (!credential.txHash) {
          res.status(402).json({ error: "Payment transaction hash required" });
          return;
        }

        if (!config.serverAddress || !config.amount) {
          res.status(500).json({ error: "Server misconfigured: serverAddress and amount required for payment mode" });
          return;
        }

        const paymentResult = await verifyPayment(
          credential.txHash,
          config.amount,
          config.serverAddress
        );

        if (!paymentResult.valid) {
          res.status(402).json({ error: paymentResult.error || "Payment verification failed" });
          return;
        }
      }

      req.intmax402 = {
        address: credential.address,
        verified: true,
        txHash: credential.txHash,
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}
