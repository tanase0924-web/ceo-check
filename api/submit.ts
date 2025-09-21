// api/submit.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUPABASE_URL     = process.env.SUPABASE_URL!;
const SERVICE_KEY      = process.env.SUPABASE_SERVICE_ROLE!;
const RESEND_API_KEY   = process.env.RESEND_API_KEY!;
const FROM_EMAIL       = process.env.FROM_EMAIL!;           // 例: noreply@granempathia.com
const ADMIN_EMAIL      = process.env.ADMIN_EMAIL || "";     // 例: tanase0924@gmail.com

type SubmitBody = {
  leadId: string;
  total: number;
  bucket: string;                  // 自走型 / 右腕不在型
  answers: Record<string, unknown>;
  leadEmail?: string;
  leadName?: string;
  leadPhone?: string;
};

async function saveResponse(payload: {
  lead_id: string;
  total: number;
  bucket: string;
  answers: Record<string, unknown>;
}) {
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
  return row as { id: string };
}

async function sendMail(to: string, subject: string, html: string) {
  if (!to) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html })
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = (req.body || {}) as SubmitBody;

    // --- validate ---
    if (!body.leadId || typeof body.total !== "number" || !body.bucket || typeof body.answers !== "object") {
      return res.status(400).json({ error: "invalid payload" });
    }

    // --- save to Supabase ---
    const saved = await saveResponse({
      lead_id: body.leadId,
      total: body.total,
      bucket: body.bucket,
      answers: body.answers
    });

    // --- send emails (best-effort, don't block UX) ---
    try {
      const max = Math.max(1, Object.keys(body.answers || {}).length) * 2;
      const userHtml = [
        `<p>${body.leadName || "ご担当者"} 様</p>`,
        `<p>経営者向け10問チェックの結果です。</p>`,
        `<p><b>総合点:</b> ${body.total} / ${max}<br/><b>判定:</b> ${body.bucket}</p>`,
        `<p>※このメールに心当たりがない場合は破棄してください。</p>`
      ].join("");

      if (body.leadEmail) {
        await sendMail(body.leadEmail, "経営者向け10問チェックの結果", userHtml);
      }

      if (ADMIN_EMAIL) {
        const pretty = `<pre>${JSON.stringify(body.answers, null, 2)}</pre>`;
        const adminHtml = [
          `<p>新しい診断結果が登録されました。</p>`,
          `<p><b>氏名:</b> ${body.leadName || "-"}<br/>`,
          `<b>メール:</b> ${body.leadEmail || "-"}<br/>`,
          `<b>電話:</b> ${body.leadPhone || "-"}</p>`,
          `<p><b>総合点:</b> ${body.total} / ${max}<br/><b>判定:</b> ${body.bucket}</p>`,
          `<p><b>lead_id:</b> ${body.leadId}<br/><b>response_id:</b> ${saved.id}</p>`,
          `<details><summary>回答詳細</summary>${pretty}</details>`
        ].join("");
        await sendMail(ADMIN_EMAIL, "【通知】新規診断結果が登録されました", adminHtml);
      }
    } catch (e) {
      console.error("mail failed:", e);
      // メール失敗はUXを止めない
    }

    return res.status(200).json({ ok: true, id: saved.id });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e?.message || "unknown error" });
  }
}
