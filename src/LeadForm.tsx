// src/LeadForm.tsx
import { useEffect, useState } from "react";

export type Lead = {
  id?: string;
  name: string;
  email: string;
  phone?: string | null;
};

type Props = {
  onDone: (lead: Lead) => void;   // 保存後、id を含めて親に返す
  current?: Lead;                 // 既存の値（任意）
};

export default function LeadForm({ onDone, current }: Props) {
  const [name, setName]   = useState(current?.name ?? "");
  const [email, setEmail] = useState(current?.email ?? "");
  const [phone, setPhone] = useState(current?.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(current?.id ?? null);

  // current が変わったときにフォームへ反映
  useEffect(() => {
    if (!current) return;
    setName(current.name ?? "");
    setEmail(current.email ?? "");
    setPhone(current.phone ?? "");
    if (current.id) setSavedId(current.id);
  }, [current]);

  function validate(): string | null {
    if (!name.trim()) return "氏名は必須です。";
    if (!email.trim()) return "メールアドレスは必須です。";
    // 超ざっくりな email バリデーション
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      return "メールアドレスの形式が正しくありません。";
    }
    return null;
  }

  async function save() {
    const v = validate();
    if (v) {
      setMsg(v);
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const body = {
        name: name.trim(),
        email: email.trim(),
        phone: (phone || "").trim(),
      };

      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `HTTP ${res.status}`);
      }

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        json = {};
      }

      // 返却パターンのどれでも拾う
      const newId: string | undefined =
        json?.id ?? json?.lead?.id ?? json?.data?.id;

      if (!newId) {
        // id が取れなかった場合でも onDone を呼ぶ（API 実装差異の保険）
        setMsg("保存は完了しましたが、ID を取得できませんでした。");
        onDone({ ...body, id: undefined });
        return;
      }

      setSavedId(newId);
      setMsg("保存しました。続けて設問に回答してください。");

      // 親へ「id 付き」で返す
      onDone({
        id: newId,
        name: body.name,
        email: body.email,
        phone: body.phone,
      });
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

      <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? "保存中..." : savedId ? "更新する" : "保存して設問に進む"}
        </button>
        {savedId && (
          <span className="help">登録済み: {email}（ID: {savedId.slice(0, 8)}…）</span>
        )}
      </div>

      {msg && <div className="help" style={{ marginTop: 6 }}>{msg}</div>}
    </div>
  );
}
