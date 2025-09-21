// api/admin/leads.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
// ★ VercelのESM解決では拡張子必須
import { assertAdminAuth } from "./_lib.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Basic 認証
  try {
    assertAdminAuth(req);
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // 環境変数チェック（Invocation Failedの原因を可視化）
  if (!SUPABASE_URL) return res.status(500).json({ error: "SUPABASE_URL is missing" });
  if (!SERVICE_KEY)  return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE is missing" });

  const { q, limit = "100" } = req.query as { q?: string; limit?: string };

  // URL生成（末尾スラッシュを除去して安全に連結）
  const base = SUPABASE_URL.replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(`${base}/rest/v1/leads`);
  } catch (e: any) {
    return res.status(500).json({ error: `Invalid SUPABASE_URL: ${e?.message || String(e)}` });
  }

  url.searchParams.set("select", "id,created_at,name,email,phone");
  url.searchParams.set("order", "created_at.desc");
  url.searchParams.set("limit", String(Math.min(Number(limit) || 100, 500)));

  // 簡易検索（部分一致）
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

  // Supabase REST呼び出し（Service Roleでサーバ側からのみ使用）
  const r = await fetch(url.toString(), {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      // RLSを無視できるが、publicスキーマ読み取りだけに使うこと
    },
  });

  if (!r.ok) {
    const text = await r.text();
    return res.status(500).json({ error: `supabase error: ${text}` });
  }

  const rows = await r.json();
  return res.status(200).json({ rows });
}
