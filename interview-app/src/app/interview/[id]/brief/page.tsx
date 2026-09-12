"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";

interface BriefData {
  profile: {
    skills?: string[];
    experience?: Array<{ company: string; role: string; description: string }>;
    projects?: Array<{ name: string; role?: string; description: string; techStack?: string[] }>;
    strengths?: string[];
    riskPoints?: string[];
  };
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
    mainQuestions?: Array<{ dimension: string; target: string; angle?: string }>;
    knowledgeTopics?: string[];
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
        <h4 className="text-sm font-medium text-slate-600">个人技能</h4>
        {profile?.skills?.length ? (
          <TagList items={profile.skills} color="blue" />
        ) : (
          <p className="text-slate-400">无</p>
        )}

        <h4 className="mt-3 text-sm font-medium text-slate-600">实习 / 工作经历</h4>
        {profile?.experience?.length ? (
          <ul className="mt-1 space-y-2 text-sm">
            {profile.experience.map((e, i) => (
              <li key={i} className="rounded bg-slate-50 p-2">
                <div className="font-medium">
                  {e.company}
                  {e.role ? ` · ${e.role}` : ""}
                </div>
                {e.description ? <div className="mt-0.5 text-slate-600">{e.description}</div> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-400">无</p>
        )}

        <h4 className="mt-3 text-sm font-medium text-slate-600">项目经历</h4>
        {profile?.projects?.length ? (
          <ul className="mt-1 space-y-2 text-sm">
            {profile.projects.map((p, i) => (
              <li key={i} className="rounded bg-slate-50 p-2">
                <div className="font-medium">
                  {p.name}
                  {p.role ? `（${p.role}）` : ""}
                </div>
                {p.description ? <div className="mt-0.5 text-slate-600">{p.description}</div> : null}
                {p.techStack?.length ? (
                  <div className="mt-1.5">
                    <TagList items={p.techStack} color="blue" />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-400">无</p>
        )}

        {profile?.strengths?.length ? (
          <>
            <h4 className="mt-3 text-sm font-medium text-slate-600">亮点</h4>
            <TagList items={profile.strengths} color="green" />
          </>
        ) : null}
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
        {plan?.mainQuestions?.length ? (
          <ol className="mt-3 space-y-1.5 text-sm">
            {plan.mainQuestions.map((q, i) => (
              <li key={i} className="flex items-baseline gap-2">
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                  Q{i + 1}
                </span>
                <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                  {dimensionLabel(q.dimension)}
                </span>
                <span className="text-slate-700">{q.target || (q.angle ? "行为/动机" : "—")}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-slate-400">暂无主问题计划</p>
        )}
        <p className="mt-3 text-xs text-slate-400">
          主问题均为宽入口开场；技术细节等深挖将在你回答后，由面试官基于你的回答动态追问。
        </p>
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

function dimensionLabel(d: string): string {
  const map: Record<string, string> = {
    KNOWLEDGE: "知识",
    EXPERIENCE: "实习",
    PROJECT: "项目",
    BEHAVIORAL: "行为",
    JD_SCENARIO: "情景",
  };
  return map[d] ?? d;
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
