import React, { useEffect, useState } from "react";

type Choice = { label: string; score: number };
type Question = { id: string; text: string; choices: Choice[] };
type QuestionData = { title: string; cutoff: number; questions: Question[] };

export default function CEOCheckApp() {
  const [data, setData] = useState<QuestionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/questions.json")
      .then(res => {
        if (!res.ok) throw new Error("HTTP error " + res.status);
        return res.json();
      })
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error("fetch failed:", err);
        setError("設問データを読み込めませんでした");
        setLoading(false);
      });
  }, []);

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>{error}</div>;
  if (!data) return <div>データなし</div>;

  const { title, cutoff, questions } = data;

  return (
    <div>
      <h1>{title}</h1>
      <p>判定カットオフ: {cutoff}点</p>
      <ul>
        {questions.map(q => (
          <li key={q.id}>
            <p>{q.text}</p>
            <ul>
              {q.choices.map((c, idx) => (
                <li key={idx}>
                  {c.label} ({c.score}点)
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
