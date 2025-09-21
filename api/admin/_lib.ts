// api/admin/_lib.ts
import type { VercelRequest } from "@vercel/node";

export function assertAdminAuth(req: VercelRequest) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) {
    throw new Error("unauthorized");
  }
  const b64 = header.slice(6);
  const [user, pass] = Buffer.from(b64, "base64").toString("utf8").split(":");
  const ADMIN_USER = process.env.ADMIN_USER || "";
  const ADMIN_PASS = process.env.ADMIN_PASS || "";
  if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
    throw new Error("unauthorized");
  }
}
