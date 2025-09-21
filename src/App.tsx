// src/App.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import LeadForm from "./LeadForm";

// ---------- Types ----------
type Choice = { label: string; score: number };
type Question = { id: string; text: string; choices: Choice[] };
type QuestionsPayload = {
  title: string;
  cutoff: number;
  questions: Question[];
};

type Lead = { id: string; name: string; email: string; phone?: string | null };

// ---------- Component ----------
export default function App() {
  // 設問データ
  const [payload, setPayload] = useState<QuestionsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // 回答
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const answeredCount = useMemo(
    () => Object.values(answers).filter((v) => typeof v === "number").length,
    [answers]
  );

  // リード（個人情報）
  const [lead, setLead] = useState<Lead | null>(null);

  // 採点／送信状態
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<string | null>(null); // 二重送信防止
  const submitTimes = useRef(0);

  // 結果
  const total = useMemo(() => {
    if (!payload) return null;
    // すべて数値になったら合計を返す。未回答がある場合は null を返す。
    const vals = payload.questions.map((q) => answers[q.id]);
    if (vals.some((v) => typeof v !== "number")) return null;
    return vals.reduce((acc, v) => acc + (v as number), 0);
  }, [answers, payload]);

  const bucket = useMemo(() => {
    if (!payload || total === null) return "";
    // 仕様：cutoff 以上 → 「自走型」、未満 → 「右腕不在型」
    return total >= payload.cutoff ? "自走型" : "右腕不在型";
  }, [payload, total]);

  // ---------- 初期ロード ----------
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

  // ---------- 変更ハンドラ ----------
  function onSelect(qid: string, score: number) {
    setAnswers((prev) => ({ ...prev, [qid]: score }));
  }

  // ---------- 未回答チェック ----------
  function getUnansweredIds(): string[] {
    if (!payload) return [];
    return payload.questions
      .filter((q) => typeof answers[q.id] !== "number")
      .map((q) => q.id);
  }

  // ---------- 提出 ----------
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

    // 未回答の警告
    const missing = getUnansweredIds();
    if (missing.length) {
      const first = missing[0];
      alert("未回答の質問があります。すべて回答してください。");
      // 最初の未回答までスクロール
      const el = document.querySelector<HTMLElement>(`[data-qid="${first}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // 採点
    const sum = Object.values(answers).reduce((acc, v) => acc + (v as number), 0);
    const resultBucket = sum >= payload.cutoff ? "自走型" : "右腕不在型";

    // リード必須
    if (!lead) {
      alert("送信前に、上部のフォームで氏名・メール・電話をご入力ください。");
      return;
    }

    setSending(true);
    try {
      // 1) リードはすでに保存済み（LeadForm から）。念のため存在チェック。
      if (!lead.id) throw new Error("lead_id が取得できませんでした。");

      // 2) 回答送信（保存＋メール送付）
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          total: sum,
          bucket: resultBucket,
          answers,
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

  // ---------- レンダリング ----------
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
      {/* ヒーロー */}
      <header className="hero">
        <span className="badge">経営者向け 10問セルフチェック</span>
        <h1 className="title">{payload.title || "経営者向け10問チェック"}</h1>
        <p className="subtitle">10問に回答 → 採点 → メールで結果をお届けします。</p>
      </header>

      <main className="wrap grid">
        {/* 進行バー & アクション */}
        <section className="card">
          <div className="toolbar">
            <div className="counter">
              進捗：{answeredCount}/{payload.questions.length}
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="progress">
                <i
                  style={{
                    width: `${
                      (answeredCount / payload.questions.length) * 100
                    }%`,
                  }}
                />
              </div>
            </div>

            <button
              className="btn"
              onClick={handleSubmit}
              disabled={sending || !!sentAt}
              title={sentAt ? "すでに送信済みです" : "採点して送信"}
            >
              {sentAt
                ? "回答完了でメールで回答内容送信済"
                : sending
                ? "送信中..."
                : "採点する"}
            </button>
          </div>

          <p className="help">
            ※ 未回答があると警告します。採点後の再送信は不可（重複メール防止）。
          </p>
        </section>

        {/* リードフォーム（氏名/メール/電話） */}
        <section className="card">
          <LeadForm
            onSaved={(l) => setLead(l)}
            current={lead || undefined}
          />
        </section>

        {/* 質問一覧 */}
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
                  {/* 点数は表示しない（依頼どおり） */}
                  <span className="label">{c.label}</span>
                </label>
              ))}
            </div>
          </section>
        ))}

        {/* 結果（採点後） */}
        {total !== null && (
          <section className="card result">
            <div>
              <strong>総合点：</strong>
              {total} / {payload.questions.length * 2}
            </div>
            <div>
              <strong>判定：</strong>
              <span
                className={
                  bucket === "自走型"
                    ? "bucket-ok"
                    : bucket === "要改善"
                    ? "bucket-warn"
                    : "bucket-bad"
                }
              >
                {bucket}
              </span>
              <span className="help" style={{ marginLeft: 8 }}>
                （カットオフ：{payload.cutoff} 点）
              </span>
            </div>
            <div className="help">
              ※ 詳細なフィードバックはメールをご確認ください。
            </div>
          </section>
        )}

        <footer className="foot">
          © {new Date().getFullYear()} Granempathia. All rights reserved.
        </footer>
      </main>
    </>
  );
}
