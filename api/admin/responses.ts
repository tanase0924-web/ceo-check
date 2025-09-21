// api/admin/responses.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
// ★ ESM なので拡張子必須
import { assertAdminAuth } from "./_lib.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 認証
  try {
    assertAdminAuth(req);
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // 環境変数チェック
  if (!SUPABASE_URL) return res.status(500).json({ error: "SUPABASE_URL is missing" });
  if (!SERVICE_KEY)  return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE is missing" });

  const { q, limit = "100" } = req.query as { q?: string; limit?: string };

  const base = SUPABASE_URL.replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(`${base}/rest/v1/responses`);
  } catch (e: any) {
    return res.status(500).json({ error: `Invalid SUPABASE_URL: ${e?.message || String(e)}` });
  }

  // リード情報と紐づけて取得するため、lead_id と join
  url.searchParams.set(
    "select",
    "id,created_at,lead_id,question_id,answer,score,leads(name,email)"
  );
  url.searchParams.set("order", "created_at.desc");
  url.searchParams.set("limit", String(Math.min(Number(limit) || 100, 500)));

  if (q && q.trim()) {
    url.searchParams.set(
      "or",
      [
        `answer.ilike.*${q}*`,
        `leads.name.ilike.*${q}*`,
        `leads.email.ilike.*${q}*`,
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
    const text = await r.text();
    return res.status(500).json({ error: `supabase error: ${text}` });
  }

  const rows = await r.json();
  return res.status(200).json({ rows });
}
