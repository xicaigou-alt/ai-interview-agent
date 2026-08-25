"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, apiJson } from "@/lib/api";

interface Current {
  status: string;
  mode: "coaching" | "mock";
  currentQuestion: string | null;
  primaryCount: number;
  questionTarget: number;
}
interface Evaluation {
  score: number;
  strengths: string[];
  weaknesses: string[];
  missingPoints: string[];
}
interface AnswerRes {
  finished: boolean;
  question: string | null;
  isFollowUp: boolean;
  decision: string;
  evaluation?: Evaluation;
}
interface SkipRes {
  finished: boolean;
  question: string | null;
  isFollowUp: boolean;
  decision: string;
}
interface Turn {
  question: string;
  answer: string;
  isFollowUp: boolean;
  evaluation?: Evaluation;
}

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [current, setCurrent] = useState<Current | null>(null);
  const [primaryCount, setPrimaryCount] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const c = await api<Current>(`/api/interviews/${params.id}/current`);
        setCurrent(c);
        setPrimaryCount(c.primaryCount);
        if (c.currentQuestion) {
          setTurns([{ question: c.currentQuestion, answer: "", isFollowUp: false }]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [params.id]);

  async function submit() {
    if (!answer.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await apiJson<AnswerRes>(`/api/interviews/${params.id}/answer`, "POST", { answer });

      setTurns((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last) {
          last.answer = answer;
          if (r.evaluation) last.evaluation = r.evaluation;
        }
        return next;
      });

      setAnswer("");

      if (r.finished) {
        router.push(`/interview/${params.id}/report`);
        return;
      }
      if (r.question) {
        const nextQuestion = r.question;
        if (!r.isFollowUp) setPrimaryCount((p) => p + 1);
        setTurns((prev) => [...prev, { question: nextQuestion, answer: "", isFollowUp: r.isFollowUp }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await apiJson<SkipRes>(`/api/interviews/${params.id}/skip`, "POST");

      setTurns((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && !last.answer) last.answer = "(已跳过)";
        return next;
      });

      if (r.finished) {
        router.push(`/interview/${params.id}/report`);
        return;
      }
      if (r.question) {
        setPrimaryCount((p) => p + 1);
        setTurns((prev) => [...prev, { question: r.question!, answer: "", isFollowUp: r.isFollowUp }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">面试进行中</h1>
        {current && (
          <span className="text-sm text-slate-500">
            主问题 {primaryCount} / {current.questionTarget}
          </span>
        )}
      </div>

      <div className="space-y-4">
        {groupTurns(turns).map((g, gi) => (
          <div key={gi} className="rounded border bg-white p-4">
            <TurnView label={`Q${gi + 1}`} turn={g.primary} />
            {g.followUps.length > 0 && (
              <div className="mt-2 space-y-2 border-l-2 border-slate-200 pl-3">
                {g.followUps.map((f, fi) => (
                  <TurnView key={fi} label="追问" turn={f} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <div className="rounded border border-red-300 bg-red-50 p-3 text-red-700">{error}</div>}

      <div className="rounded border bg-white p-4">
        <textarea
          className="w-full rounded border p-2 text-sm"
          rows={4}
          placeholder="输入你的回答..."
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400">Ctrl/Cmd + Enter 提交</span>
          <div className="flex gap-2">
            <button
              onClick={skip}
              disabled={busy}
              className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600 disabled:opacity-50"
            >
              跳过此题
            </button>
            <button
              onClick={submit}
              disabled={busy || !answer.trim()}
              className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {busy ? "评估中..." : "提交回答"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 拼接列表前去掉每项末尾的多余标点，避免出现「。；」这类堆叠
function cleanList(items: string[] | undefined): string {
  return (items ?? []).map((s) => s.replace(/[。；;，,\s]+$/g, "")).join("；");
}

// 把追问归到所属主问题下面，主问题序号连续（追问不占号）
function groupTurns(turns: Turn[]): { primary: Turn; followUps: Turn[] }[] {
  const groups: { primary: Turn; followUps: Turn[] }[] = [];
  for (const t of turns) {
    if (!t.isFollowUp) {
      groups.push({ primary: t, followUps: [] });
    } else if (groups.length > 0) {
      groups[groups.length - 1].followUps.push(t);
    }
  }
  return groups;
}

function TurnView({ label, turn }: { label: string; turn: Turn }) {
  return (
    <div>
      <div className="font-medium">
        {label}：{turn.question}
      </div>
      {turn.answer && (
        <div className="mt-2 rounded bg-slate-50 p-3 text-sm">
          <span className="text-slate-500">我的回答：</span>
          {turn.answer}
        </div>
      )}
      {turn.evaluation && (
        <div className="mt-2 rounded bg-blue-50 p-3 text-sm">
          <div>
            评分：<span className="font-semibold">{turn.evaluation.score}</span>
          </div>
          {turn.evaluation.strengths?.length > 0 && (
            <div className="mt-1 text-green-700">优点：{cleanList(turn.evaluation.strengths)}</div>
          )}
          {turn.evaluation.weaknesses?.length > 0 && (
            <div className="mt-1 text-amber-700">不足：{cleanList(turn.evaluation.weaknesses)}</div>
          )}
          {turn.evaluation.missingPoints?.length > 0 && (
            <div className="mt-1 text-red-700">缺失点：{cleanList(turn.evaluation.missingPoints)}</div>
          )}
        </div>
      )}
    </div>
  );
}
