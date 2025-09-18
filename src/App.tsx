import React, { useEffect, useMemo, useState } from "react";

type Choice = { label: string; score: 0 | 1 | 2 };
type Question = { id: string; text: string; choices: Choice[] };
type QuestionData = { title: string; cutoff: number; questions: Question[] };

type AnswerMap = Record<string, 0 | 1 | 2 | null>;

function classify(total: number, cutoff: number) {
  if (total >= cutoff) {
    return {
      type: "自走型",
      headline: "仕組みで回る土台ができています。",
      tips: ["例外対応訓練の定例化", "採用・育成の半期アップデート", "四半期ごとのボトルネック確認"],
    };
  }
  return {
    type: "右腕不在型",
    headline: "“任せる土台”づくりが先決です。",
    tips: ["R&R（役割/権限/責任）の明確化", "会議の型（結論先行・宿題締切）導入", "週次KPIの可視化"],
  };
}

export default function App() {
  const [data, setData] = useState<QuestionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitted, setSubmitted] = useState(false);

  // 設問をサーバーから取得
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/questions.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as QuestionData;
        setData(json);
        // 回答の初期化（ローカル保存の復元にも対応）
        const key = "ceo-10q-answers";
        const saved = localStorage.getItem(key);
        const init: AnswerMap =
          saved
            ? { ...Object.fromEntries(json.questions.map(q => [q.id, null])), ...JSON.parse(saved) }
            : Object.fromEntries(json.questions.map(q => [q.id, null]));
        setAnswers(init);
        setLoading(false);
      } catch (e: any) {
        setError(e?.message || "設問の取得に失敗しました");
        setLoading(false);
      }
    })();
  }, []);

  // 回答を保存
  useEffect(() => {
    if (!data) return;
    localStorage.setItem("ceo-10q-answers", JSON.stringify(answers));
  }, [answers, data]);

  if (loading) return <div style={{padding:16}}>読み込み中…</div>;
  if (error || !data) return <div style={{padding:16, color:"#b00"}}>{error || "データなし"}</div>;

  const { title, cutoff, questions } = data;

  const total = useMemo(
    () => Object.values(answers).reduce((s, v) => s + (typeof v === "number" ? v : 0), 0),
    [answers]
  );
  const unanswered = useMemo(
    () => questions.filter(q => answers[q.id] === null || answers[q.id] === undefined).length,
    [questions, answers]
  );

  const bucket = classify(total, cutoff);

  const onSelect = (qid: string, score: 0 | 1 | 2) => {
    setAnswers(a => ({ ...a, [qid]: score }));
  };

  const resetAll = () => {
    setAnswers(Object.fromEntries(questions.map(q => [q.id, null])) as AnswerMap);
    setSubmitted(false);
  };

  const copyResult = async () => {
    const lines = [
      `${title}`,
      `総合点: ${total} / ${questions.length * 2}`,
      `判定: ${bucket.type}`,
      `メモ: ${bucket.headline}`,
      `提案: ${bucket.tips.join(" / ")}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      alert("結果をコピーしました。");
    } catch {
      alert("コピーに失敗しました。手動で選択してください。");
    }
  };

  // ---- ここからUI（シンプルCSS） ----
  const card: React.CSSProperties = { background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:16 };
  const btn: React.CSSProperties  = { padding:"10px 14px", borderRadius:10, border:"1px solid #111", background:"#111", color:"#fff", fontWeight:600, cursor:"pointer" };
  const btnGhost: React.CSSProperties = { padding:"10px 14px", borderRadius:10, border:"1px solid #d1d5db", background:"#fff", color:"#111", fontWeight:600, cursor:"pointer" };

  return (
    <div style={{ fontFamily:"-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial", background:"#f6f7f8", minHeight:"100vh", color:"#111" }}>
      <div style={{ maxWidth:900, margin:"0 auto", padding:"24px 16px" }}>
        <header style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <h1 style={{ fontSize:24, fontWeight:800 }}>{title}</h1>
          <div style={{ fontSize:12, color:"#6b7280" }}>0/1/2点 × {questions.length}問（最大 {questions.length * 2}点）</div>
        </header>

        {/* 進捗 */}
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6 }}>
            <span>回答進捗</span>
            <span>{questions.length - unanswered} / {questions.length}</span>
          </div>
          <div style={{ width:"100%", height:6, background:"#e5e7eb", borderRadius:999 }}>
            <div style={{
              width:`${((questions.length - unanswered)/questions.length)*100}%`,
              height:6, background:"#111", borderRadius:999, transition:"width .2s"
            }} />
          </div>
        </div>

        {/* 問題一覧 */}
        <ol style={{ display:"grid", gap:12, margin:0, padding:0, listStyle:"none" }}>
          {questions.map((q, idx) => (
            <li key={q.id} style={card}>
              <div style={{ display:"flex", gap:12 }}>
                <div style={{ width:28, height:28, borderRadius:999, background:"#111", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700 }}>
                  {idx + 1}
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ margin:"4px 0 10px 0", fontWeight:600 }}>{q.text}</p>
                  <div style={{ display:"grid", gap:8, gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))" }}>
                    {q.choices.map((c, i) => {
                      const inputId = `${q.id}-${i}`;
                      const checked = answers[q.id] === c.score;
                      return (
                        <label key={inputId} htmlFor={inputId} style={{
                          display:"flex", alignItems:"center", gap:8, padding:"10px 12px",
                          border:"1px solid " + (checked ? "#111" : "#d1d5db"),
                          borderRadius:10, background: checked ? "#f5f5f5" : "#fff", cursor:"pointer"
                        }}>
                          <input
                            id={inputId}
                            type="radio"
                            name={q.id}
                            checked={checked}
                            onChange={() => onSelect(q.id, c.score)}
                          />
                          <span style={{ fontSize:14 }}>{c.label}</span>
                          <span style={{ marginLeft:"auto", fontSize:12, color:"#6b7280" }}>{c.score}点</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>

        {/* アクション */}
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginTop:16 }}>
          <button
            onClick={() => setSubmitted(true)}
            style={{ ...btn, opacity: unanswered>0 ? .6 : 1 }}
            disabled={unanswered > 0}
            title={unanswered>0 ? "全問に回答してください" : "採点する"}
          >
            採点する
          </button>
          <button onClick={resetAll} style={btnGhost}>リセット</button>
          <button onClick={copyResult} style={btnGhost}>結果をコピー</button>
        </div>

        {/* 結果 */}
        {submitted && (
          <section style={{ ...card, marginTop:16 }}>
            <h2 style={{ fontSize:18, fontWeight:800, margin:"0 0 8px 0" }}>結果</h2>
            <div style={{ fontSize:14, color:"#4b5563", marginBottom:8 }}>
              総合点: <span style={{ fontWeight:700, color:"#111" }}>{total}</span> / {questions.length * 2}（カットオフ {cutoff} 点）
            </div>
            <div style={{ border:"1px solid #e5e7eb", borderRadius:10, padding:12 }}>
              <div style={{ fontWeight:800, marginBottom:4 }}>判定：{bucket.type}</div>
              <p style={{ margin:"2px 0 8px 0" }}>{bucket.headline}</p>
              <ul style={{ margin:0, paddingLeft:20 }}>
                {bucket.tips.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>

            {/* ゲージ */}
            <div style={{ marginTop:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6 }}>
                <span>スコアゲージ</span>
                <span>{total} / {questions.length * 2}</span>
              </div>
              <div style={{ width:"100%", height:10, background:"#e5e7eb", borderRadius:999 }}>
                <div style={{
                  width: `${(total / (questions.length * 2)) * 100}%`,
                  height:10, background:"#111", borderRadius:999
                }} />
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
