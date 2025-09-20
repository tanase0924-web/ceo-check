import { useEffect, useState } from "react";
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
        // 回答初期化
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

  // 集計：null は 0 に寄せて数値で reduce（型エラー回避）
  const unanswered = data.questions.reduce(
    (acc, q) => acc + (answers[q.id] == null ? 1 : 0),
    0
  );
  const total = data.questions.reduce((acc, q) => {
    const v = answers[q.id];
    return acc + (v ?? 0);
  }, 0);

  const bucket = classify(total, data.cutoff);

  const handleSelect = (qid: string, score: 0 | 1 | 2) => {
    setAnswers((prev) => ({ ...prev, [qid]: score }));
  };

  const handleSubmit = async () => {
    if (unanswered > 0) {
      alert(`未回答が ${unanswered} 問あります（未回答は0点で集計します）。`);
    }
    setSubmitted(true);
    try {
      await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          leadEmail: lead.email,
          leadName: lead.name,
          total,
          bucket: bucket.type,
          answers,
        }),
      });
    } catch (e) {
      console.error("submit failed", e);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 700, margin: "0 auto" }}>
      <h1>{data.title}</h1>
      <p>判定カットオフ: {data.cutoff}点</p>

      {data.questions.map((q) => (
        <div key={q.id} style={{ marginBottom: 20 }}>
          <p>{q.text}</p>
          {q.choices.map((c, i) => (
            <label key={i} style={{ display: "block", cursor: "pointer" }}>
              <input
                type="radio"
                name={q.id}
                checked={answers[q.id] === c.score}
                onChange={() => handleSelect(q.id, c.score)}
              />
              {c.label}
            </label>
          ))}
        </div>
      ))}

      {!submitted ? (
        <button onClick={handleSubmit}>採点する</button>
      ) : (
        <div style={{ marginTop: 20, padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
          <h2>判定: {bucket.type}</h2>
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
    </div>
  );
}
