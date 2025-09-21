import { useEffect, useMemo, useRef, useState } from "react";
import "./ui.css";
import LeadForm, { Lead } from "./LeadForm";

type Choice = { label: string; score: number };
type Question = { id: string; text: string; choices: Choice[] };
type QuestionsPayload = {
  title: string;
  cutoff: number;
  questions: Question[];
};

export default function App() {
  // 設問
  const [payload, setPayload] = useState<QuestionsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // 回答（未回答は null）
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const answeredCount = useMemo(
    () => Object.values(answers).filter((v): v is number => typeof v === "number").length,
    [answers]
  );

  // リード（LeadForm が保存して id 付きで渡してくる）
  const [lead, setLead] = useState<Lead | null>(null);

  // 送信状態
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<string | null>(null); // 二重送信防止
  const submitTimes = useRef(0);

  // 合計点（全問回答済みのみ算出）
  const total: number | null = useMemo(() => {
    if (!payload) return null;
    const vals = payload.questions.map((q) => answers[q.id]); // (number | null)[]
    if (vals.some((v) => v === null)) return null;
    return (vals as number[]).reduce((acc, v) => acc + v, 0); // 初期値 0 指定
  }, [answers, payload]);

  // 判定
  const bucket: "" | "自走型" | "右腕不在型" = useMemo(() => {
    if (!payload || total === null) return "";
    return total >= payload.cutoff ? "自走型" : "右腕不在型";
  }, [payload, total]);

  // 初期ロード
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/questions.json", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as QuestionsPayload;

        const init: Record<string, number | null> = {};
        for (const q of data.questions) init[q.id] = null;

        setPayload(data);
        setAnswers(init);
        setLoadErr(null);
      } catch (e: any) {
        setLoadErr(`設問データの取得に失敗しました: ${e?.message || e}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 回答選択
  function onSelect(qid: string, score: number) {
    setAnswers((prev) => ({ ...prev, [qid]: score }));
  }

  // 未回答IDs
  function getUnansweredIds(): string[] {
    if (!payload) return [];
    return payload.questions
      .filter((q) => answers[q.id] === null)
      .map((q) => q.id);
  }

  // 提出
  async function handleSubmit() {
    if (!payload) return;

    // 二重送信防止
    if (sentAt) {
      submitTimes.current += 1;
      alert(
        `この回答はすでに送信済みです（${new Date(
          sentAt
        ).toLocaleString()}）。\n重複送信はできません。`
      );
      return;
    }

    // 未回答
    const missing = getUnansweredIds();
    if (missing.length) {
      const first = missing[0];
      alert("未回答の質問があります。すべて回答してください。");
      const el = document.querySelector<HTMLElement>(`[data-qid="${first}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (total === null) {
      alert("採点できませんでした。未回答がないかご確認ください。");
      return;
    }

    if (!lead || !lead.id) {
      alert("送信前に、上部のフォームで氏名・メール・電話を保存してください。");
      return;
    }

    // null を含まない answers を作成
    const cleanAnswers: Record<string, number> = {};
    for (const [k, v] of Object.entries(answers)) cleanAnswers[k] = v as number;

    setSending(true);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id, // ★ 重要：leadId を送る
          total,
          bucket, // "自走型" | "右腕不在型"
          answers: cleanAnswers,
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`submit API error: ${t}`);
      }

      setSentAt(new Date().toISOString());
      alert("送信が完了しました。結果をメールでお送りしました。");
    } catch (e: any) {
      alert(`送信に失敗しました：${e?.message || e}`);
    } finally {
      setSending(false);
    }
  }

  // 表示
  if (loading) {
    return (
      <main className="wrap">
        <p>読み込み中...</p>
      </main>
    );
  }
  if (loadErr || !payload) {
    return (
      <main className="wrap">
        <p style={{ color: "#ef4444" }}>{loadErr || "データがありません。"}</p>
      </main>
    );
  }

  return (
    <>
      <header className="hero">
        <span className="badge">経営者向け 10問セルフチェック</span>
        <h1 className="title">{payload.title || "経営者向け10問チェック"}</h1>
        <p className="subtitle">10問に回答 → 採点 → メールで結果をお届けします。</p>
      </header>

      <main className="wrap grid">
        {/* 進行バー */}
        <section className="card">
          <div className="toolbar">
            <div className="counter">
              進捗：{answeredCount}/{payload.questions.length}
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="progress">
                <i style={{ width: `${(answeredCount / payload.questions.length) * 100}%` }} />
              </div>
            </div>
            <button
              className="btn"
              onClick={handleSubmit}
              disabled={sending || !!sentAt}
              title={sentAt ? "すでに送信済みです" : "採点して送信"}
            >
              {sentAt ? "回答完了でメールで回答内容送信済" : sending ? "送信中..." : "採点する"}
            </button>
          </div>
          <p className="help">※ 未回答があると警告。採点後の再送信は不可（重複メール防止）。</p>
        </section>

        {/* リードフォーム（保存すると id 付きで onDone される） */}
        <section className="card">
          <LeadForm onDone={(l) => setLead(l)} current={lead || undefined} />
        </section>

        {/* 質問 */}
        {payload.questions.map((q) => (
          <section key={q.id} className="q" data-qid={q.id}>
            <h3>{q.text}</h3>
            <div className="choices">
              {q.choices.map((c, i) => (
                <label key={i} className="radio">
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === c.score}
                    onChange={() => onSelect(q.id, c.score)}
                  />
                  <span className="label">{c.label}</span>
                </label>
              ))}
            </div>
          </section>
        ))}

        {/* 結果 */}
        {total !== null && (
          <section className="card result">
            <div>
              <strong>総合点：</strong>
              {total} / {payload.questions.length * 2}
            </div>
            <div>
              <strong>判定：</strong>
              <span className={bucket === "自走型" ? "bucket-ok" : "bucket-bad"}>{bucket}</span>
              <span className="help" style={{ marginLeft: 8 }}>（カットオフ：{payload.cutoff} 点）</span>
            </div>
            <div className="help">※ 詳細はメールをご確認ください。</div>
          </section>
        )}

        <footer className="foot">© {new Date().getFullYear()} Granempathia. All rights reserved.</footer>
      </main>
    </>
  );
}
