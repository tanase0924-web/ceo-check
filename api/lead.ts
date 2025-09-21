// api/lead.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(500).json({ error: "Missing SUPABASE envs" });
  }

  try {
    const { name, email, phone } = (req.body || {}) as {
      name?: string;
      email?: string;
      phone?: string | null;
    };

    if (!name || !email) {
      return res.status(400).json({ error: "name and email are required" });
    }

    const r = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "return=representation", // ← これで挿入行を返す
      },
      body: JSON.stringify([{ name, email, phone: phone || null }]),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res.status(500).json({ error: text || `Supabase error (${r.status})` });
    }

    const rows = (await r.json()) as Array<{
      id: string;
      name: string;
      email: string;
      phone: string | null;
      created_at?: string;
    }>;

    const row = rows?.[0];
    if (!row?.id) {
      return res.status(500).json({ error: "No row returned from Supabase" });
    }

    // フロントの期待に合わせて `id` を返しつつ、互換のため `leadId` も付ける
    return res.status(200).json({
      id: row.id,
      leadId: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      ok: true,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "unknown error" });
  }
}
