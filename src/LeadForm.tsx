import { useState } from "react";

export type Lead = {
  id: string;
  name: string;
  email: string;
  phone?: string;
};

export default function LeadForm({ onDone }: { onDone: (lead: Lead) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!name || !email) {
      setError("名前とメールは必須です。");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone }),
      });
      const data = await res.json();
      if (!res.ok || !data.leadId) throw new Error(data.error || "保存に失敗しました");
      const lead: Lead = { id: data.leadId, name, email, phone };
      localStorage.setItem("ceo-check-lead", JSON.stringify(lead));
      onDone(lead);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 500, margin: "40px auto", padding: 20, border: "1px solid #ddd", borderRadius: 8 }}>
      <h2>ご連絡先を入力してください</h2>
      <div style={{ display: "grid", gap: 10 }}>
        <input placeholder="名前 (必須)" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="メール (必須)" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="電話 (任意)" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <button onClick={handleSubmit} disabled={loading} style={{ marginTop: 15 }}>
        {loading ? "送信中..." : "次へ進む"}
      </button>
    </div>
  );
}
