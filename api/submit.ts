// api/submit.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUPABASE_URL   = process.env.SUPABASE_URL!;
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE!;
const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const FROM_EMAIL     = process.env.FROM_EMAIL!; // 例: noreply@granempathia.com

async function saveResponse(payload: any) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Prefer": "return=representation"
    },
    body: JSON.stringify([payload])
  });
  if (!r.ok) throw new Error(await r.text());
  const [row] = await r.json();
  return row;
}

async function sendMail(to: string, subject: string, html: string) {
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html })
    });
  } catch (e) {
    console.error("resend error:", e);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { leadId, total, bucket, answers, leadEmail, leadName } = req.body || {};
    if (!leadId || typeof total !== "number" || !bucket || typeof answers !== "object") {
      return res.status(400).json({ error: "invalid payload" });
    }

    // 1) 保存
    const saved = await saveResponse({ lead_id: leadId, total, bucket, answers });

    // 2) メール（失敗してもUIは止めない）
    const max = Array.isArray(answers) ? answers.length * 2 : 20;
    const html = [
      `<p>${leadName || "ご担当者"} 様</p>`,
      `<p>経営者向け10問チェックの結果です。</p>`,
      `<p><b>総合点:</b> ${total} / ${max}<br/><b>判定:</b> ${bucket}</p>`,
      `<p>※このメールに心当たりがない場合は破棄してください。</p>`
    ].join("");
    if (leadEmail) await sendMail(leadEmail, "経営者向け10問チェックの結果", html);

    return res.status(200).json({ ok: true, id: saved.id });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "unknown error" });
  }
}
