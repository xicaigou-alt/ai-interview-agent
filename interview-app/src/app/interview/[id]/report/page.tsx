"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface ReportTurn {
  question: string;
  answer: string | null;
  isFollowUp: boolean;
  evaluation: {
    score?: number;
    strengths?: string[];
    weaknesses?: string[];
    missingPoints?: string[];
  } | null;
}
interface Report {
  overallScore: number;
  competencyScores: Record<string, number>;
  strengths: string[];
  riskAreas: string[];
  resumeRisks: Array<{ claim: string; risk: string; recommendation: string }>;
  learningPlan: string[];
  turns?: ReportTurn[];
}

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api<Report>(`/api/interviews/${params.id}/report`);
        setReport(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [params.id]);

  if (error && !report) {
    return <div className="rounded border border-red-300 bg-red-50 p-4 text-red-700">{error}</div>;
  }
  if (!report) {
    return <p className="text-slate-500">正在生成报告...</p>;
  }

  const competencies = Object.entries(report.competencyScores ?? {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">面试报告</h1>
        <Link href="/" className="text-sm text-blue-600">
          返回 Dashboard
        </Link>
      </div>

      <div className="rounded border bg-white p-6 text-center">
        <div className="text-sm text-slate-500">Overall Readiness</div>
        <div className="mt-1 text-5xl font-bold">{report.overallScore}</div>
        <div className="text-sm text-slate-400">/ 100</div>
      </div>

      {report.turns && report.turns.length > 0 && (
        <Section title={`问答记录（${report.turns.length}）`}>
          <div className="space-y-4">
            {groupReportTurns(report.turns).map((g, gi) => (
              <div key={gi} className="rounded bg-slate-50 p-3">
                <ReportTurnView label={`Q${gi + 1}`} turn={g.primary} />
                {g.followUps.length > 0 && (
                  <div className="mt-2 space-y-2 border-l-2 border-slate-200 pl-3">
                    {g.followUps.map((f, fi) => (
                      <ReportTurnView key={fi} label="追问" turn={f} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {competencies.length > 0 && (
        <Section title="能力评分">
          <ul className="space-y-2">
            {competencies.map(([k, v]) => (
              <li key={k} className="flex items-center justify-between text-sm">
                <span>{k}</span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-40 overflow-hidden rounded bg-slate-100">
                    <span className="block h-full bg-blue-500" style={{ width: `${v}%` }} />
                  </span>
                  <span className="w-8 text-right font-medium">{v}</span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="强项">
        <List items={report.strengths} />
      </Section>

      <Section title="风险点">
        <List items={report.riskAreas} />
      </Section>

      {report.resumeRisks?.length > 0 && (
        <Section title="简历风险">
          <ul className="space-y-3">
            {report.resumeRisks.map((r, i) => (
              <li key={i} className="rounded bg-red-50 p-3 text-sm">
                <div className="font-medium">简历表述：{r.claim}</div>
                <div className="mt-1 text-red-700">风险：{r.risk}</div>
                <div className="mt-1 text-slate-600">建议：{r.recommendation}</div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="学习计划（按优先级）">
        {report.learningPlan?.length ? (
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {report.learningPlan.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
        ) : (
          <p className="text-slate-400">无</p>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border bg-white p-4">
      <h3 className="mb-2 font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function List({ items }: { items: string[] }) {
  if (!items?.length) return <p className="text-slate-400">无</p>;
  return (
    <ul className="list-disc space-y-1 pl-5 text-sm">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

function joinClean(items: string[] | undefined): string {
  return (items ?? []).map((s) => s.replace(/[。；;，,\s]+$/g, "")).join("；");
}

function groupReportTurns(turns: ReportTurn[]): { primary: ReportTurn; followUps: ReportTurn[] }[] {
  const groups: { primary: ReportTurn; followUps: ReportTurn[] }[] = [];
  for (const t of turns) {
    if (!t.isFollowUp) {
      groups.push({ primary: t, followUps: [] });
    } else if (groups.length > 0) {
      groups[groups.length - 1].followUps.push(t);
    }
  }
  return groups;
}

function ReportTurnView({ label, turn }: { label: string; turn: ReportTurn }) {
  return (
    <div>
      <div className="font-medium">
        {label}：{turn.question}
      </div>
      <div className="mt-1 text-sm text-slate-600">
        <span className="text-slate-400">答：</span>
        {turn.answer?.trim() ? turn.answer : "（未回答 / 已跳过）"}
      </div>
      {turn.evaluation && turn.evaluation.score != null && (
        <div className="mt-2 rounded bg-white p-2 text-sm">
          <span className="font-semibold">评分 {turn.evaluation.score}</span>
          {turn.evaluation.strengths?.length ? (
            <div className="mt-1 text-green-700">优点：{joinClean(turn.evaluation.strengths)}</div>
          ) : null}
          {turn.evaluation.weaknesses?.length ? (
            <div className="mt-1 text-amber-700">不足：{joinClean(turn.evaluation.weaknesses)}</div>
          ) : null}
          {turn.evaluation.missingPoints?.length ? (
            <div className="mt-1 text-red-700">缺失点：{joinClean(turn.evaluation.missingPoints)}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
