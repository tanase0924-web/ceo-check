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

  // 警告/通知メッセージ
  const [warning, setWarning] = useState<string | null>(null);

  // 送信中フラグ
  const [sending, setSending] = useState(false);

  // 再送防止：この lead で一度でも送ったら sentAt を保持（時刻を記録）
  const sentKey = lead ? `ceo-10q-sent:${lead.id}` : "";
  const [sentAt, setSentAt] = useState<number | null>(() => {
    if (!sentKey) return null;
    const raw = localStorage.getItem(sentKey);
    return raw ? Number(raw) : null;
  });

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // リード未入力ならフォーム表示
  if (!lead) return <LeadForm onDone={setLead} />;

  // null 安全
  const questions = data?.questions ?? [];

  // 集計
  const unansweredCount = useMemo(
    () => questions.reduce((acc, q) => acc + (answers[q.id] == null ? 1 : 0), 0),
    [answers, questions]
  );
  const total = useMemo(
    () => questions.reduce((acc, q) => acc + (answers[q.id] ?? 0), 0),
    [answers, questions]
  );
  const bucket = classify(total, data?.cutoff ?? 0);

  const handleSelect = (qid: string, score: 0 | 1 | 2) => {
    setAnswers((prev) => ({ ...prev, [qid]: score }));
    setWarning(null);
  };

  const firstUnansweredId = useMemo(() => {
    const q = questions.find((q) => answers[q.id] == null);
    return q?.id || null;
  }, [answers, questions]);

  const scrollToQuestion = (qid: string) => {
    const el = document.getElementById(`q-${qid}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("need-answer");
      setTimeout(() => el.classList.remove("need-answer"), 1500);
    }
  };

  const handleSubmit = async () => {
    // data 未読込の間は何もしない
    if (!data) return;

    // すでに送信済みなら警告して終了（メールも既に送付済み）
    if (sentAt) {
      const when = new Date(sentAt).toLocaleString();
      setWarning(`この診断は既に送信済みです（${when}）。メールも送付されています。二重送信はできません。`);
      setSubmitted(true); // 結果カードは見せておく
      return;
    }

    // 未回答がある場合は採点を中止して誘導
    if (unansweredCount > 0) {
      setSubmitted(false);
      setWarning(`未回答が ${unansweredCount} 問あります。未回答を選択してから、もう一度「採点する」を押してください。`);
      if (firstUnansweredId) scrollToQuestion(firstUnansweredId);
      return;
    }

    // 初回送信
    try {
      setSending(true);
      setWarning(null);
      setSubmitted(true);

      const resp = await fetch("/api/submit", {
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

      // 成否に関わらず二重送信を抑止したいなら、成功時のみ記録するのが妥当
      if (resp.ok) {
        const now = Date.now();
        setSentAt(now);
        if (sentKey) localStorage.setItem(sentKey, String(now));
      } else {
        // サーバ側がエラーのときは sentAt は記録しない
        const txt = await resp.text();
        console.error("submit error:", txt);
        setWarning("送信に失敗しました。時間をおいて再度お試しください。");
        setSubmitted(false);
      }
    } catch (e) {
      console.error("submit failed", e);
      setWarning("送信に失敗しました。ネットワークをご確認のうえ、再度お試しください。");
      setSubmitted(false);
    } finally {
      setSending(false);
    }
  };

  const isUnanswered = (qid: string) => answers[qid] == null;

  return (
    <div style={{ padding: 20, maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 4 }}>{data?.title ?? "経営者向け10問チェック"}</h1>
      <p style={{ color: "#6b7280", marginTop: 0 }}>
        判定カットオフ: {data?.cutoff ?? 0}点
      </p>

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
          {warning.includes("未回答が") && firstUnansweredId && (
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
          )}
        </div>
      )}

      {questions.map((q) => (
        <div
          id={`q-${q.id}`}
          key={q.id}
          style={{
            marginBottom: 18,
            padding: 12,
            border: `1px solid ${isUnanswered(q.id) && warning?.includes("未回答が") ? "#EF4444" : "#E5E7EB"}`,
            borderRadius: 10,
            background: "#fff",
          }}
        >
          <p style={{ margin: "0 0 8px", fontWeight: 600 }}>
            {q.text}{" "}
            {isUnanswered(q.id) && warning?.includes("未回答が") && (
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
          disabled={sending}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: sending ? "#6b7280" : "#111",
            color: "#fff",
            fontWeight: 700,
            cursor: sending ? "not-allowed" : "pointer",
          }}
        >
          {sentAt ? "再送不可（送信済み）" : sending ? "送信中..." : "採点する"}
        </button>
        <span style={{ color: "#6b7280", fontSize: 12 }}>
          未回答: {unansweredCount} / {questions.length}
        </span>
        {sentAt && (
          <span style={{ color: "#6b7280", fontSize: 12 }}>
            送信済み: {new Date(sentAt).toLocaleString()}
          </span>
        )}
      </div>

      {submitted && !warning && data && (
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
            総合点: {total} / {questions.length * 2}
          </p>
        </div>
      )}

      <style>{`
        .need-answer {
          box-shadow: 0 0 0 3px rgba(239,68,68,0.35);
          transition: box-shadow .5s ease;
        }
      `}</style>
    </div>
  );
}
