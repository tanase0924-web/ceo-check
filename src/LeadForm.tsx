import { useState } from "react";

export type Lead = {
  id?: string;       // 保存後にサーバーから付与
  name: string;
  email: string;
  phone?: string | null;
};

type Props = {
  onDone: (lead: Lead) => void;          // id を含む Lead を返す
  current?: Lead;                         // 既存値（任意）
};

export default function LeadForm({ onDone, current }: Props) {
  const [name, setName]   = useState(current?.name  ?? "");
  const [email, setEmail] = useState(current?.email ?? "");
  const [phone, setPhone] = useState(current?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    if (!name.trim() || !email.trim()) {
      setMsg("氏名とメールは必須です。");
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: (phone || "").trim() }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t);
      }
      const { id } = (await res.json()) as { id: string };
      onDone({ id, name: name.trim(), email: email.trim(), phone: (phone || "").trim() });
      setMsg("保存しました。続けて設問に回答してください。");
    } catch (e: any) {
      setMsg(`保存に失敗しました：${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>ご連絡先</h3>
      <div style={{ display: "grid", gap: 10 }}>
        <input
          placeholder="氏名 *"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="メールアドレス *"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          placeholder="電話番号（任意）"
          value={phone ?? ""}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? "保存中..." : "保存して設問に進む"}
        </button>
        {current?.id && <span className="help">登録済み: {current.email}</span>}
      </div>
      {msg && <div className="help" style={{ marginTop: 6 }}>{msg}</div>}
    </div>
  );
}
