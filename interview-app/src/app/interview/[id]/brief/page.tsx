"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";

interface BriefData {
  profile: { strengths?: string[]; riskPoints?: string[] };
  gap: {
    strongMatch?: string[];
    weakMatch?: string[];
    missingCapabilities?: string[];
    resumeRisks?: string[];
    highPriorityTopics?: string[];
  };
  plan: {
    durationMinutes?: number;
    primaryQuestionTarget?: number;
    difficulty?: string;
    priorityTopics?: string[];
    sections?: Array<{ type: string; weight: number }>;
  };
}

export default function BriefPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<BriefData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setBusy(true);
      try {
        const r = await apiJson<BriefData>(`/api/interviews/${params.id}/analyze`, "POST");
        setData(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    })();
  }, [params.id]);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      await apiJson(`/api/interviews/${params.id}/start`, "POST");
      router.push(`/interview/${params.id}/session`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  if (busy && !data) {
    return <p className="text-slate-500">正在分析候选人画像、能力差距与面试计划...</p>;
  }

  if (error && !data) {
    return <div className="rounded border border-red-300 bg-red-50 p-4 text-red-700">{error}</div>;
  }

  const gap = data?.gap;
  const plan = data?.plan;
  const profile = data?.profile;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">面试前简报</h1>

      <Section title="候选人画像">
        {profile?.strengths?.length ? (
          <TagList items={profile.strengths} color="green" />
        ) : (
          <p className="text-slate-400">无</p>
        )}
        <h4 className="mt-2 text-sm font-medium text-slate-600">简历风险点</h4>
        {profile?.riskPoints?.length ? (
          <TagList items={profile.riskPoints} color="red" />
        ) : (
          <p className="text-slate-400">无</p>
        )}
      </Section>

      <Section title="匹配与差距">
        <Row label="强匹配" items={gap?.strongMatch} color="green" />
        <Row label="弱匹配" items={gap?.weakMatch} color="amber" />
        <Row label="缺失能力" items={gap?.missingCapabilities} color="red" />
        <Row label="简历风险" items={gap?.resumeRisks} color="red" />
        <Row label="优先考察" items={gap?.highPriorityTopics} color="blue" />
      </Section>

      <Section title="面试计划">
        <p className="text-sm text-slate-600">
          时长约 {plan?.durationMinutes ?? 40} 分钟 · 目标 {plan?.primaryQuestionTarget ?? 10} 个主问题 ·
          难度 {plan?.difficulty ?? "medium"}
        </p>
        {plan?.sections?.length ? (
          <ul className="mt-2 space-y-1 text-sm">
            {plan.sections.map((s, i) => (
              <li key={i} className="flex justify-between">
                <span>{s.type}</span>
                <span className="text-slate-500">{Math.round(s.weight * 100)}%</span>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      {error && <div className="rounded border border-red-300 bg-red-50 p-3 text-red-700">{error}</div>}

      <button
        onClick={start}
        disabled={busy}
        className="w-full rounded bg-slate-900 px-4 py-3 text-white disabled:opacity-50"
      >
        {busy ? "准备中..." : "开始面试"}
      </button>
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

function Row({ label, items, color }: { label: string; items?: string[]; color: string }) {
  if (!items?.length) return null;
  return (
    <div className="mb-2">
      <span className="text-sm font-medium text-slate-600">{label}：</span>
      <TagList items={items} color={color} />
    </div>
  );
}

function TagList({ items, color }: { items: string[]; color: string }) {
  const palette: Record<string, string> = {
    green: "bg-green-100 text-green-800",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-800",
    blue: "bg-blue-100 text-blue-800",
  };
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <span key={i} className={`rounded px-2 py-0.5 text-xs ${palette[color] ?? palette.blue}`}>
          {t}
        </span>
      ))}
    </span>
  );
}
