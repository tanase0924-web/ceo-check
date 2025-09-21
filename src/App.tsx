// src/App.tsx
import { useMemo, useState } from "react";
import "./ui.css";

type Question = {
  id: string;
  text: string;
  options: { label: string; value: number }[];
};

type Lead = {
  name: string;
  email: string;
  phone: string;
};

// ダミーの設問（必要に応じて差し替え可）
const questions: Question[] = [
  { id: "q1", text: "経営方針を明文化している", options: [{ label: "はい", value: 1 }, { label: "いいえ", value: 0 }] },
  { id: "q2", text: "幹部に意思決定を委譲している", options: [{ label: "はい", value: 1 }, { label: "いいえ", value: 0 }] },
  { id: "q3", text: "定例で振り返りをしている", options: [{ label: "はい", value: 2 }, { label: "いいえ", value: 0 }] },
  { id: "q4", text: "部下の育成計画を持っている", options: [{ label: "はい", value: 2 }, { label: "いいえ", value: 0 }] },
  { id: "q5", text: "売上に依存しない仕組みを持つ", options: [{ label: "はい", value: 2 }, { label: "いいえ", value: 0 }] },
  { id: "q6", text: "社内に代替可能人材がいる", options: [{ label: "はい", value: 1 }, { label: "いいえ", value: 0 }] },
  { id: "q7", text: "業務マニュアルが整備されている", options: [{ label: "はい", value: 2 }, { label: "いいえ", value: 0 }] },
  { id: "q8", text: "幹部候補が育っている", options: [{ label: "はい", value: 2 }, { label: "いいえ", value: 0 }] },
  { id: "q9", text: "財務データを定期的に確認している", options: [{ label: "はい", value: 1 }, { label: "いいえ", value: 0 }] },
  { id: "q10", text: "経営理念を周知している", options: [{ label: "はい", value: 1 }, { label: "いいえ", value: 0 }] },
];

export default function App() {
  // 編集用ドラフト（非null）
  const [leadDraft, setLeadDraft] = useState<Lead>({ name: "", email: "", phone: "" });
  // 確定後にセット（null: まだ未確定）
  const [lead, setLead] = useState<Lead | null>(null);

  // 回答（未回答は null）
  const [answers, setAnswers] = useState<Record<string, number | null>>(
    Object.fromEntries(questions.map((q) => [q.id, null]))
  );

  const [submitted, setSubmitted] = useState(false);

  const total: number | null = useMemo(() => {
    const vals = Object.values(answers); // (number | null)[]
    if (vals.some((v) => v === null)) return null;
    // 初期値 0 を渡して acc の null 警告を回避
    return (vals as number[]).reduce((acc, v) => acc + v, 0);
  }, [answers]);

  const bucket = useMemo(() => {
    if (total === null) return "";
    // 閾値は仮。必要に応じて調整 or JSONから取得に差し替え
    if (total >= 15) return "自走型";
    if (total >= 10) return "要改善";
    return "右腕不在型";
  }, [total]);

  async function handleSubmit() {
    if (submitted) {
      alert("すでに送信済みです。メールも送信されています。");
      return;
    }
    if (!lead) {
      alert("まず氏名・メール・電話を入力して、設問に進んでください。");
      return;
    }
    if (total === null) {
      alert("未回答の設問があります。すべて回答してください。");
      return;
    }

    // 必要に応じて API をあなたの実装に合わせてください
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead, answers, total, bucket }),
    });

    if (res.ok) {
      alert("回答を送信しました。結果をメールで送信済みです。");
      setSubmitted(true);
    } else {
      const t = await res.text();
      alert("送信に失敗しました: " + t);
    }
  }

  const allAnswered = total !== null;

  return (
    <div className="app-container">
      {!lead ? (
        <div className="card">
          <h2>ご連絡先を入力してください</h2>
          <input
            placeholder="氏名"
            value={leadDraft.name}
            onChange={(e) => setLeadDraft((p) => ({ ...p, name: e.target.value }))}
          />
          <input
            placeholder="メールアドレス"
            value={leadDraft.email}
            onChange={(e) => setLeadDraft((p) => ({ ...p, email: e.target.value }))}
          />
          <input
            placeholder="電話番号"
            value={leadDraft.phone}
            onChange={(e) => setLeadDraft((p) => ({ ...p, phone: e.target.value }))}
          />
          <button
            className="btn"
            onClick={() => {
              if (!leadDraft.name || !leadDraft.email) {
                alert("氏名とメールは必須です。");
                return;
              }
              setLead(leadDraft);
            }}
          >
            設問に進む
          </button>
        </div>
      ) : (
        <div className="card">
          <h2>経営者向け10問チェック</h2>

          {questions.map((q) => (
            <div key={q.id} className="question">
              <p>{q.text}</p>
              <div className="options">
                {q.options.map((opt) => (
                  <label key={opt.label}>
                    <input
                      type="radio"
                      name={q.id}
                      value={opt.value}
                      checked={answers[q.id] === opt.value}
                      onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.value }))}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="result">
            {total !== null ? (
              <p>
                現在の合計点: {total} / 20（判定: {bucket}）
              </p>
            ) : (
              <p>未回答の設問があります。</p>
            )}
          </div>

          <button className="btn primary" onClick={handleSubmit} disabled={submitted || !allAnswered}>
            {submitted ? "回答完了でメールで回答内容送信済" : "採点して送信"}
          </button>
        </div>
      )}
    </div>
  );
}
