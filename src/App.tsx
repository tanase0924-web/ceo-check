import { useState, useMemo } from "react";
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
  const [lead, setLead] = useState<Lead | null>(null);
  const [answers, setAnswers] = useState<Record<string, number | null>>(
    Object.fromEntries(questions.map((q) => [q.id, null]))
  );
  const [submitted, setSubmitted] = useState(false);

  const total: number | null = useMemo(() => {
    const vals = Object.values(answers);
    if (vals.some((v) => v === null)) return null;
    return (vals as number[]).reduce((acc, v) => acc + v, 0);
  }, [answers]);

  const bucket = useMemo(() => {
    if (total === null) return "";
    if (total >= 15) return "自走型";
    if (total >= 10) return "要改善";
    return "右腕不在型";
  }, [total]);

  const handleSubmit = async () => {
    if (submitted) {
      alert("すでに送信済みです。メールも送信されています。");
      return;
    }
    if (total === null) {
      alert("未回答の設問があります。すべて回答してください。");
      return;
    }
    if (!lead) {
      alert("氏名・メール・電話を入力してください。");
      return;
    }

    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead, answers, total, bucket }),
    });

    if (res.ok) {
      alert("回答を送信しました。結果をメールで送信済みです。");
      setSubmitted(true);
    } else {
      alert("送信に失敗しました。");
    }
  };

  return (
    <div className="app-container">
      {!lead ? (
        <div className="card">
          <h2>ご連絡先を入力してください</h2>
          <input placeholder="氏名" onChange={(e) => setLead({ ...lead, name: e.target.value } as Lead)} />
          <input placeholder="メールアドレス" onChange={(e) => setLead({ ...lead, email: e.target.value } as Lead)} />
          <input placeholder="電話番号" onChange={(e) => setLead({ ...lead, phone: e.target.value } as Lead)} />
          <button className="btn" onClick={() => lead && setLead(lead)}>
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
                  <label key={opt.value}>
                    <input
                      type="radio"
                      name={q.id}
                      value={opt.value}
                      checked={answers[q.id] === opt.value}
                      onChange={() => setAnswers({ ...answers, [q.id]: opt.value })}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="result">
            {total !== null && (
              <p>
                現在の合計点: {total} / 20 （判定: {bucket}）
              </p>
            )}
          </div>
          <button
            className="btn primary"
            onClick={handleSubmit}
            disabled={submitted}
          >
            {submitted ? "回答完了でメールで回答内容送信済" : "採点して送信"}
          </button>
        </div>
      )}
    </div>
  );
}
