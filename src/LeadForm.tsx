// src/LeadForm.tsx
import { useEffect, useState } from "react";

export type Lead = {
  id?: string;
  name: string;
  email: string;
  phone?: string | null;
};

type Props = {
  onDone: (lead: Lead) => void;
  current?: Lead; // ← 追加：App から渡す既存リード（任意）
};

// 数字以外を除去
function normalizeDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

// 電話番号の形式チェック（任意項目）
function isValidPhone(s: string) {
  if (!s) return true;
  if (!/^\+?[0-9\s-]+$/.test(s)) return false; // + / 数字 / スペース / - のみ
  const digits = normalizeDigits(s);
  return digits.length >= 10 && digits.length <= 15;
}

export default function LeadForm({ onDone, current }: Props) {
  // current があればそれで初期化
  const [name, setName] = useState(current?.name ?? "");
  const [email, setEmail] = useState(current?.email ?? "");
  const [phone, setPhone] = useState(current?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // current が更新されたらフォームも同期
  useEffect(() => {
    if (!current) return;
    setName(current.name ?? "");
    setEmail(current.email ?? "");
    setPhone(current.phone ?? "");
  }, [current]);

  function validate(): string | null {
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
    if (!isValidPhone(phone || "")) {
      setMsg("電話番号の形式が正しくありません（数字・ハイフン・スペース・+のみ、桁数10〜15桁）");
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const body = {
        name: name.trim(),
        email: email.trim(),
        phone: (phone || "").trim() || null,
      };

      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "保存に失敗しました");

      // API は { id } もしくは { leadId } を返す想定
      const id: string | undefined = data?.id ?? data?.leadId;
      if (!id) {
        setMsg("保存は完了しましたが、ID を取得できませんでした。");
        onDone({ ...body });
        return;
      }

      setMsg("保存しました");
      onDone({ ...body, id });
    } catch (e: any) {
      setMsg(`保存に失敗しました: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>ご連絡先</h3>

      <div style={{ display: "grid", gap: 12 }}>
        <label className="field">
          <div className="field-label">氏名 <span className="req">*</span></div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：田中 太郎"
          />
        </label>

        <label className="field">
          <div className="field-label">メールアドレス <span className="req">*</span></div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="例：tanaka@example.com"
          />
        </label>

        <label className="field">
          <div className="field-label">電話番号（任意）</div>
          <input
            type="tel"
            value={phone || ""}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="例：090-1234-5678"
          />
        </label>
      </div>

      {msg && <p className="help" style={{ color: "#ef4444", marginTop: 8 }}>{msg}</p>}

      <div style={{ marginTop: 12 }}>
        <button onClick={save} disabled={saving} className="btn">
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </div>
  );
}
