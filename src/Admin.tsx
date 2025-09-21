import { useEffect, useMemo, useState } from "react";

type Lead = { id: string; created_at: string; name: string; email: string; phone?: string | null };
type Resp = {
  id: string;
  created_at: string;
  lead_id: string;
  total: number;
  bucket: string;
  answers: Record<string, unknown>;
  leads?: { id: string; name: string; email: string; phone?: string | null };
};

function toCSV(rows: any[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","));
  return [headers.join(","), ...lines].join("\n");
}

export default function Admin() {
  // 認証情報（Basic認証）
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");

  // フィルタ
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(100);

  // データ
  const [leads, setLeads] = useState<Lead[]>([]);
  const [resps, setResps] = useState<Resp[]>([]);
  const [tab, setTab] = useState<"responses" | "leads">("responses");

  // 状態
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const auth = "Basic " + btoa(`${user}:${pass}`);
      const qs = `?limit=${encodeURIComponent(String(limit))}` + (q ? `&q=${encodeURIComponent(q)}` : "");

      const [r1, r2] = await Promise.all([
        fetch(`/api/admin/leads${qs}`, { headers: { Authorization: auth } }),
        fetch(`/api/admin/responses${qs}`, { headers: { Authorization: auth } }),
      ]);

      if (r1.status === 401 || r2.status === 401) throw new Error("認証に失敗しました（ユーザー名/パスワードを確認）");

      const j1 = await r1.json();
      const j2 = await r2.json();

      if (!r1.ok) throw new Error(j1?.error || "leads取得に失敗しました");
      if (!r2.ok) throw new Error(j2?.error || "responses取得に失敗しました");

      setLeads(j1.rows || []);
      setResps(j2.rows || []);
    } catch (e: any) {
      setErr(e?.message || "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  // Enterで検索
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (document.activeElement as HTMLElement)?.tagName === "INPUT") load();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [user, pass, q, limit]);

  const csvRows = useMemo(() => {
    if (tab === "leads") {
      return leads.map(l => ({
        id: l.id,
        created_at: l.created_at,
        name: l.name,
        email: l.email,
        phone: l.phone ?? "",
      }));
    }
    return resps.map(r => ({
      id: r.id,
      created_at: r.created_at,
      total: r.total,
      bucket: r.bucket,
      lead_id: r.lead_id,
      name: r.leads?.name ?? "",
      email: r.leads?.email ?? "",
      phone: r.leads?.phone ?? "",
      answers: JSON.stringify(r.answers || {}),
    }));
  }, [tab, leads, resps]);

  function downloadCSV() {
    const csv = toCSV(csvRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tab}-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ maxWidth: 1140, margin: "24px auto", padding: 16 }}>
      <h1 style={{ marginBottom: 12 }}>管理ダッシュボード</h1>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <input placeholder="Admin User" value={user} onChange={e => setUser(e.target.value)} />
        <input placeholder="Admin Pass" type="password" value={pass} onChange={e => setPass(e.target.value)} />
        <button onClick={load}>認証して読み込み</button>

        <input
          placeholder="検索（名前/メール/電話/判定/点数）"
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ marginLeft: 8, minWidth: 280 }}
        />
        <input
          type="number"
          min={1}
          max={500}
          value={limit}
          onChange={e => setLimit(Math.max(1, Math.min(500, Number(e.target.value) || 100)))}
          style={{ width: 90 }}
          title="limit"
        />
        <button onClick={load}>検索</button>
        <button onClick={downloadCSV}>CSVエクスポート</button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <button onClick={() => setTab("responses")} style={{ fontWeight: tab === "responses" ? 700 : 400 }}>
          回答一覧
        </button>
        <button onClick={() => setTab("leads")} style={{ marginLeft: 8, fontWeight: tab === "leads" ? 700 : 400 }}>
          リード一覧
        </button>
      </div>

      {err && <div style={{ color: "#b91c1c", marginBottom: 10 }}>{err}</div>}
      {loading && <div>読み込み中...</div>}

      {!loading && tab === "responses" && (
        <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <table width="100%" cellPadding={6}>
            <thead style={{ background: "#f9fafb" }}>
              <tr>
                <th>日時</th>
                <th>氏名</th>
                <th>メール</th>
                <th>電話</th>
                <th>点数</th>
                <th>判定</th>
                <th>回答JSON</th>
              </tr>
            </thead>
            <tbody>
              {resps.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td>{r.leads?.name}</td>
                  <td>{r.leads?.email}</td>
                  <td>{r.leads?.phone}</td>
                  <td>{r.total}</td>
                  <td>{r.bucket}</td>
                  <td style={{ maxWidth: 420, whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: 12 }}>
                    {JSON.stringify(r.answers)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === "leads" && (
        <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <table width="100%" cellPadding={6}>
            <thead style={{ background: "#f9fafb" }}>
              <tr>
                <th>日時</th>
                <th>氏名</th>
                <th>メール</th>
                <th>電話</th>
                <th>lead_id</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.created_at).toLocaleString()}</td>
                  <td>{l.name}</td>
                  <td>{l.email}</td>
                  <td>{l.phone}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{l.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ color: "#6b7280", fontSize: 12, marginTop: 12 }}>
        認証は Basic（この端末のみ保持）。ユーザー/パスは Vercel の環境変数で管理。
      </p>
    </div>
  );
}
