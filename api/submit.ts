// api/submit.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE!;
const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const FROM = "noreply@granempathia.com";
const ADMIN = "info@granempathia.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { leadId, total, bucket, answers } = req.body || {};
    if (!leadId || total === undefined || !bucket) {
      return res.status(400).json({ error: "invalid payload" });
    }

    // --- Supabase 保存 ---
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify([{ lead_id: leadId, total, bucket, answers }]),
    });

    if (!resp.ok) {
      return res.status(500).json({ error: await resp.text() });
    }
    const [row] = await resp.json();

    // --- リード情報を取得 ---
    const leadRes = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });
    if (!leadRes.ok) {
      return res.status(500).json({ error: "failed to fetch lead" });
    }
    const [lead] = await leadRes.json();

    // --- メール本文 ---
    const subjectUser = "経営者向け10問チェックの結果";
    const subjectAdmin = "【通知】新規診断結果が登録されました";

    const userHtml = `
      <p>${lead.name || ""} 様</p>
      <p>経営者向け10問チェックの結果です。</p>
      <p><b>総合点：</b>${total}</p>
      <p><b>判定：</b>${bucket}</p>
      <p>※このメールに心当たりがない場合は破棄してください。</p>
    `;

    const adminHtml = `
      <p>新しい診断結果が登録されました。</p>
      <p><b>氏名：</b>${lead.name || ""}<br/>
      <b>メール：</b>${lead.email}<br/>
      <b>電話：</b>${lead.phone || ""}</p>
      <p><b>総合点：</b>${total}<br/>
      <b>判定：</b>${bucket}<br/>
      <b>lead_id：</b>${lead.id}<br/>
      <b>response_id：</b>${row?.id}</p>
      <pre style="white-space:pre-wrap">${JSON.stringify(answers, null, 2)}</pre>
    `;

    // --- ユーザーへメール ---
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM,
        to: [lead.email],
        subject: subjectUser,
        html: userHtml,
      }),
    });

    // --- 管理者へ通知メール ---
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM,
        to: [ADMIN],
        subject: subjectAdmin,
        html: adminHtml,
      }),
    });

    return res.status(200).json({ ok: true, responseId: row.id });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "unknown error" });
  }
}
