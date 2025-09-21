import { useState } from "react";

export type Lead = {
  id?: string;
  name: string;
  email: string;
  phone?: string | null;
};

// 数字以外を除去
function normalizeDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

// 電話番号の形式チェック
function isValidPhone(s: string) {
  if (!s) return true; // 未入力はOK（任意項目）
  if (!/^\+?[0-9\s-]+$/.test(s)) return false; // 許可文字のみ
  const digits = normalizeDigits(s);
  return digits.length >= 10 && digits.length <= 15; // 桁数チェック
}

export default function LeadForm({ onDone }: { onDone: (lead: Lead) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function validate() {
    if (!name.trim()) return "氏名を入力してください";
    if (!email.trim()) return "メールアドレスを入力してください";
    return null;
  }

  async function save() {
    const v = validate();
    if (v) {
      setMsg(v);
      return;
    }

    if (!isValidPhone(phone)) {
      setMsg("電話番号の形式が正しくありません（数字・ハイフン・スペース・+のみ、桁数10〜15桁）");
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const body = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
      };

      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存に失敗しました");

      onDone({ ...body, id: data.id || data.leadId });
      setMsg("保存しました");
    } catch (e: any) {
      setMsg(`保存に失敗しました: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <h3>ご連絡先</h3>
      <div>
        <label>
          氏名
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
      </div>
      <div>
        <label>
          メールアドレス
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
      </div>
      <div>
        <label>
          電話番号（任意）
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="例: 090-1234-5678"
          />
        </label>
      </div>
      {msg && <p style={{ color: "red" }}>{msg}</p>}
      <button onClick={save} disabled={saving} className="btn">
        {saving ? "保存中…" : "保存"}
      </button>
    </div>
  );
}
