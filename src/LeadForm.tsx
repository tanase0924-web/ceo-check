import React, { useState } from "react";

type Lead = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
};

interface LeadFormProps {
  onDone: (lead: Lead) => void;
}

// メールの簡易バリデーション
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
function isValidEmail(s: string) {
  return emailRe.test((s || "").trim());
}

// 電話番号バリデーション（10〜15桁、+ - スペース許可）
const phoneRe = /^[0-9+\-\s]{10,15}$/;
function isValidPhone(s: string) {
  return phoneRe.test((s || "").trim());
}

export default function LeadForm({ onDone }: LeadFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (!name.trim()) return "氏名を入力してください";
    if (!email.trim()) return "メールアドレスを入力してください";
    if (!isValidEmail(email)) return "メールアドレスの形式が正しくありません";
    if (phone.trim() && !isValidPhone(phone)) {
      return "電話番号の形式が正しくありません（数字10〜15桁、+ - スペース可）";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "保存に失敗しました");
      }

      onDone({
        id: data.id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
      });
    } catch (e: any) {
      setError(e.message || "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="lead-form">
      <h2>ご連絡先を入力してください</h2>

      {error && <div className="error">{error}</div>}

      <div>
        <label>氏名</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
        />
      </div>

      <div>
        <label>メールアドレス</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
      </div>

      <div>
        <label>電話番号</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={loading}
        />
      </div>

      <button type="submit" disabled={loading}>
        {loading ? "保存中..." : "保存"}
      </button>
    </form>
  );
}
