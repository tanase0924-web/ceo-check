// api/submit.ts（フル差し替え）
import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE!;
const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const FROM = "noreply@granempathia.com";
const ADMIN = "info@granempathia.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  try {
    const { leadId, total, bucket, answers } = req.body || {};
    if (!leadId || typeof total !== "number" || !bucket || !answers) {
      return res.status(400).json({ error: "invalid payload" });
    }

    // 1) リードを取得
    const leadRes = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${leadId}&select=id,name,email,phone`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
    });
    if (!leadRes.ok) return res.status(500).json({ error: "lead fetch failed" });
    const leads = await leadRes.json();
    const lead = leads?.[0];
    if (!lead?.email) return res.status(400).json({ error: "lead not found or no email" });

    // 2) 回答を保存
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: "return=representation"
      },
      body: JSON.stringify([{
        lead_id: leadId,
        total,
        bucket,
        answers
      }])
    });
    if (!insertRes.ok) return res.status(500).json({ error: await insertRes.text() });
    const [row] = await insertRes.json();

    // 3) メール送信（Resend）
    const subjectUser  = "経営者向け10問チェックの結果";
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

    // ユーザーへ
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: FROM,
        to: [lead.email],
        subject: subjectUser,
        html: userHtml
      })
    });

    // 管理者へ
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: FROM,
        to: [ADMIN],
        subject: subjectAdmin,
        html: adminHtml
      })
    });

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "unknown error" });
  }
}
