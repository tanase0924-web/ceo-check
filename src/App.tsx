import { useEffect, useMemo, useState } from "react";
import LeadForm, { type Lead } from "./LeadForm";

type Choice = { label: string; score: 0 | 1 | 2 };
type Question = { id: string; text: string; choices: Choice[] };
type QuestionData = { title: string; cutoff: number; questions: Question[] };
type Answer = 0 | 1 | 2 | null;
type AnswerMap = Record<string, Answer>;

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
  // リード情報（localStorageから復元）
  const [lead, setLead] = useState<Lead | null>(() => {
    try {
      const stored = localStorage.getItem("ceo-check-lead");
      return stored ? (JSON.parse(stored) as Lead) : null;
    } catch {
      return null;
    }
  });

  // 設問データと回答
  const [data, setData] = useState<QuestionData | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitted, setSubmitted] = useState(false);

  // 警告メッセージ
  const [warning, setWarning] = useState<string | null>(null);

  // 設問ロード
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/questions.json", { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const json = (await res.json()) as QuestionData;
        if (cancelled) return;
        setData(json);
        const init: AnswerMap = Object.fromEntries(
          json.questions.map((q) => [q.id, null])
        ) as AnswerMap;
        setAnswers(init);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // リード未入力ならフォーム表示
  if (!lead) return <LeadForm onDone={setLead} />;

  if (!data) return <div style={{ padding: 16 }}>読み込み中...</div>;

  // 集計：null は 0 として加算
  const unansweredCount = useMemo(
    () => data.questions.reduce((acc, q) => acc + (answers[q.id] == null ? 1 : 0), 0),
    [answers, data.questions]
  );

  const total = useMemo(
    () => data.questions.reduce((acc, q) => acc + (answers[q.id] ?? 0), 0),
    [answers, data.questions]
  );

  const bucket = classify(total, data.cutoff);

  const handleSelect = (qid: string, score: 0 | 1 | 2) => {
    setAnswers((prev) => ({ ...prev, [qid]: score }));
    // 選び始めたら警告は消す
    setWarning(null);
  };

  // 最初の未回答IDを探す
  const firstUnansweredId = useMemo(() => {
    const q = data.questions.find((q) => answers[q.id] == null);
    return q?.id || null;
  }, [answers, data.questions]);

  // 未回答スクロール
  const scrollToQuestion = (qid: string) => {
    const el = document.getElementById(`q-${qid}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      // 一時的にハイライト
      el.classList.add("need-answer");
      setTimeout(() => el.classList.remove("need-answer"), 1500);
    }
  };

  const handleSubmit = async () => {
    if (unansweredCount > 0) {
      setSubmitted(false); // 採点は止める
      setWarning(`未回答が ${unansweredCount} 問あります。未回答を選択してから、もう一度「採点する」を押してください。`);
      if (firstUnansweredId) scrollToQuestion(firstUnansweredId);
      return;
    }

    setWarning(null);
    setSubmitted(true);

    try {
      await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          leadEmail: lead.email,
          leadName: lead.name,
          leadPhone: lead.phone ?? "",
          total,
          bucket: bucket.type,
          answers,
        }),
      });
    } catch (e) {
      console.error("submit failed", e);
    }
  };

  // 未回答かどうか
  const isUnanswered = (qid: string) => answers[qid] == null;

  return (
    <div style={{ padding: 20, maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 4 }}>{data.title}</h1>
      <p style={{ color: "#6b7280", marginTop: 0 }}>判定カットオフ: {data.cutoff}点</p>

      {warning && (
        <div
          role="alert"
          style={{
            background: "#FEF2F2",
            color: "#991B1B",
            border: "1px solid #FCA5A5",
            borderRadius: 8,
            padding: "10px 12px",
            margin: "12px 0",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {warning}
          {firstUnansweredId && (
            <>
              {" "}
              <button
                onClick={() => scrollToQuestion(firstUnansweredId)}
                style={{
                  marginLeft: 12,
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid #991B1B",
                  background: "white",
                  color: "#991B1B",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                最初の未回答へ移動
              </button>
            </>
          )}
        </div>
      )}

      {data.questions.map((q) => (
        <div
          id={`q-${q.id}`}
          key={q.id}
          style={{
            marginBottom: 18,
            padding: 12,
            border: `1px solid ${isUnanswered(q.id) && warning ? "#EF4444" : "#E5E7EB"}`,
            borderRadius: 10,
            background: "#fff",
          }}
        >
          <p style={{ margin: "0 0 8px", fontWeight: 600 }}>
            {q.text}{" "}
            {isUnanswered(q.id) && warning && (
              <span style={{ color: "#EF4444", fontSize: 12, marginLeft: 8 }}>※ 未回答</span>
            )}
          </p>
          {q.choices.map((c, i) => (
            <label key={i} style={{ display: "block", cursor: "pointer", lineHeight: "1.8" }}>
              <input
                type="radio"
                name={q.id}
                checked={answers[q.id] === c.score}
                onChange={() => handleSelect(q.id, c.score)}
                style={{ marginRight: 8 }}
              />
              {c.label}
            </label>
          ))}
        </div>
      ))}

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          onClick={handleSubmit}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          採点する
        </button>
        <span style={{ color: "#6b7280", fontSize: 12 }}>
          未回答: {unansweredCount} / {data.questions.length}
        </span>
      </div>

      {submitted && warning == null && (
        <div
          style={{
            marginTop: 20,
            padding: 16,
            border: "1px solid #ddd",
            borderRadius: 8,
            background: "#fafafa",
          }}
        >
          <h2 style={{ marginTop: 0 }}>判定: {bucket.type}</h2>
          <p>{bucket.headline}</p>
          <ul>
            {bucket.tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
          <p>
            総合点: {total} / {data.questions.length * 2}
          </p>
        </div>
      )}

      {/* 軽いハイライト用のスタイル（JSでclassを付け外し） */}
      <style>{`
        .need-answer {
          box-shadow: 0 0 0 3px rgba(239,68,68,0.35);
          transition: box-shadow .5s ease;
        }
      `}</style>
    </div>
  );
}
