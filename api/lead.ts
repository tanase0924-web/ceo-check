// api/lead.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE!;

// 数字以外を除去
function normalizeDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

// 電話番号の形式チェック
function isValidPhone(s?: string | null) {
  if (!s) return true; // 任意項目は未入力OK
  if (!/^\+?[0-9\s-]+$/.test(s)) return false; // +, 数字, スペース, ハイフンのみ
  const digits = normalizeDigits(s);
  return digits.length >= 10 && digits.length <= 15;
}

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

    // 電話番号形式チェック
    if (!isValidPhone(phone || null)) {
      return res.status(400).json({ error: "invalid phone format" });
    }

    const r = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify([
        {
          name,
          email,
          phone: (phone && phone.trim()) ? phone.trim() : null,
        },
      ]),
    });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res
        .status(500)
        .json({ error: text || `Supabase error (${r.status})` });
    }

    const rows = (await r.json()) as Array<{
      id: string;
      name: string;
      email: string;
      phone: string | null;
    }>;

    const row = rows?.[0];
    if (!row?.id) {
      return res.status(500).json({ error: "No row returned from Supabase" });
    }

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
