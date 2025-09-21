import type { VercelRequest, VercelResponse } from "@vercel/node";
import { assertAdminAuth } from "./_lib";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Basic 認証チェック
    assertAdminAuth(req);
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { q, limit = "100" } = req.query as { q?: string; limit?: string };

  // Supabase REST API を叩く
  const url = new URL(`${SUPABASE_URL}/rest/v1/leads`);
  url.searchParams.set("select", "id,created_at,name,email,phone");
  url.searchParams.set("order", "created_at.desc");
  url.searchParams.set("limit", String(Math.min(Number(limit) || 100, 500)));

  // 検索（name/email/phone に部分一致）
  if (q && q.trim()) {
    url.searchParams.set(
      "or",
      [
        `name.ilike.*${q}*`,
        `email.ilike.*${q}*`,
        `phone.ilike.*${q}*`,
      ].join(",")
    );
  }

  const r = await fetch(url.toString(), {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });

  if (!r.ok) {
    return res.status(500).json({ error: await r.text() });
  }

  const rows = await r.json();
  return res.status(200).json({ rows });
}
