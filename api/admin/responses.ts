// api/admin/responses.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
// ESM では拡張子必須
import { assertAdminAuth } from "./_lib.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Basic認証
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

  // URL生成
  const base = SUPABASE_URL.replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(`${base}/rest/v1/responses`);
  } catch (e: any) {
    return res.status(500).json({ error: `Invalid SUPABASE_URL: ${e?.message || String(e)}` });
  }

  // columns: id, created_at, lead_id, total, bucket, answers
  // leads を埋め込み（JOIN）。検索で leads.* を使いたいので !inner を付与
  url.searchParams.set(
    "select",
    "id,created_at,lead_id,total,bucket,answers,leads!inner(id,name,email,phone)"
  );
  url.searchParams.set("order", "created_at.desc");
  url.searchParams.set("limit", String(Math.min(Number(limit) || 100, 500)));

  // 検索（氏名/メール/電話/判定bucket/合計点）
  if (q && q.trim()) {
    const needle = q.trim();
    url.searchParams.set(
      "or",
      [
        `leads.name.ilike.*${needle}*`,
        `leads.email.ilike.*${needle}*`,
        `leads.phone.ilike.*${needle}*`,
        `bucket.ilike.*${needle}*`,
        // 数値も文字列比較で簡易対応（"10" 等）
        `total.eq.${Number.isFinite(+needle) ? Number(needle) : -999999}`,
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
