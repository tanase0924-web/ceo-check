// api/lead.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  try {
    const { name, email, phone } = req.body || {};
    if (!name || !email) return res.status(400).json({ error: "name and email are required" });

    const r = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify([{ name, email, phone: phone || null }])
    });

    if (!r.ok) return res.status(500).json({ error: await r.text() });
    const [row] = await r.json();
    res.status(200).json({ ok: true, leadId: row.id });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "unknown error" });
  }
}
