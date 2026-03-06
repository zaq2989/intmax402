import { Request, Response, NextFunction, RequestHandler } from "express";
import {
  INTMAX402Config,
  INTMAX402Mode,
  generateNonce,
  verifyNonce,
  parseAuthorization,
} from "@intmax402/core";
import { verifySignature } from "./crypto";

declare global {
  namespace Express {
    interface Request {
      intmax402?: {
        address: string;
        verified: boolean;
      };
    }
  }
}

function buildWWWAuthenticate(
  nonce: string,
  config: INTMAX402Config
): string {
  let header = `INTMAX402 realm="intmax402", nonce="${nonce}", mode="${config.mode}"`;
  if (config.serverAddress) {
    header += `, serverAddress="${config.serverAddress}"`;
  }
  if (config.amount) {
    header += `, amount="${config.amount}"`;
  }
  if (config.tokenAddress) {
    header += `, tokenAddress="${config.tokenAddress}"`;
  }
  if (config.chainId) {
    header += `, chainId="${config.chainId}"`;
  }
  return header;
}

export function intmax402(config: INTMAX402Config): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      const nonce = generateNonce(config.secret, ip, req.path);
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
    if (!verifyNonce(credential.nonce, config.secret, ip, req.path)) {
      res.status(401).json({ error: "Invalid or expired nonce" });
      return;
    }

    if (config.allowList && config.allowList.length > 0) {
      if (!config.allowList.includes(credential.address.toLowerCase())) {
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
      // In production, verify payment via intmax2-server-sdk fetchTransfers()
      // For now, trust the txHash presence as proof-of-payment placeholder
    }

    req.intmax402 = {
      address: credential.address,
      verified: true,
    };

    next();
  };
}
