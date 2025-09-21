import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE!;

// メール検証
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
function isValidEmail(s?: string | null) {
  return !!s && emailRe.test(s.trim());
}

// 電話番号検証
const phoneRe = /^[0-9+\-\s]{10,15}$/;
function isValidPhone(s?: string | null) {
  if (!s) return true; // 任意
  return phoneRe.test(s.trim());
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
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
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "invalid email format" });
    }
    if (!isValidPhone(phone)) {
      return res.status(400).json({ error: "invalid phone format" });
    }

    const payload = [
      {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone && phone.trim() ? phone.trim() : null,
      },
    ];

    const r = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      return res.status(500).json({ error: await r.text() });
    }

    const [row] = await r.json();
    return res.status(200).json({ ok: true, id: row.id, leadId: row.id });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "unknown error" });
  }
}
