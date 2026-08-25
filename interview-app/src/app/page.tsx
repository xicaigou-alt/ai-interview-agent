"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, apiJson } from "@/lib/api";

interface Job {
  id: number;
  company: string;
  role: string;
  createdAt: string;
}
interface SessionInfo {
  id: number;
  mode: string;
  status: string;
  title: string | null;
  company: string | null;
  role: string | null;
  resumeId: number | null;
  jobId: number | null;
  questionTarget: number | null;
  requirement: string | null;
  avgScore: number | null;
  completedAt: string | null;
  createdAt: string;
  weaknesses: string[];
}
interface KnowledgeItem {
  id: number;
  sourceType: string;
}
interface RealInterview {
  id: number;
}
interface ScheduleInfo {
  id: number;
  company: string;
  role: string;
  interviewAt: string;
  reminded: boolean;
  notes: string | null;
}
interface PracticeSuggestion {
  topic: string;
  reason: string;
  priority: string;
}

type SortKey = "latest" | "role" | "company";

function fmtDateTime(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function Dashboard() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sort, setSort] = useState<SortKey>("latest");
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [realInterviews, setRealInterviews] = useState<RealInterview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);
  const [showContinue, setShowContinue] = useState(false);
  const [reqInput, setReqInput] = useState("");
  const [targetInput, setTargetInput] = useState(10);
  const [schedules, setSchedules] = useState<ScheduleInfo[]>([]);
  const [dueTomorrow, setDueTomorrow] = useState<ScheduleInfo[]>([]);
  const [practicePlan, setPracticePlan] = useState<PracticeSuggestion[]>([]);
  const [schedCompany, setSchedCompany] = useState("");
  const [schedRole, setSchedRole] = useState("");
  const [schedAt, setSchedAt] = useState("");
  const [schedBusy, setSchedBusy] = useState(false);

  async function load() {
    try {
      const [j, s, k, ri, sc, pr] = await Promise.all([
        api<{ jobs: Job[] }>("/api/jobs").catch(() => ({ jobs: [] })),
        api<{ sessions: SessionInfo[] }>("/api/interviews").catch(() => ({ sessions: [] })),
        api<{ items: KnowledgeItem[] }>("/api/knowledge/items").catch(() => ({ items: [] })),
        api<{ items: RealInterview[] }>("/api/real-interviews").catch(() => ({ items: [] })),
        api<{ schedules: ScheduleInfo[]; dueTomorrow: ScheduleInfo[] }>("/api/schedule").catch(() => ({ schedules: [], dueTomorrow: [] })),
        api<{ plan: PracticeSuggestion[] }>("/api/practice/today").catch(() => ({ plan: [] })),
      ]);
      setJobs(j.jobs);
      setSessions(s.sessions);
      setKnowledgeItems(k.items);
      setRealInterviews(ri.items);
      setSchedules(sc.schedules);
      setDueTomorrow(sc.dueTomorrow);
      setPracticePlan(pr.plan);

      const saved = Number(localStorage.getItem("currentJobId") ?? "");
      const valid = j.jobs.some((x) => x.id === saved);
      setSelectedJobId(valid ? saved : j.jobs[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const currentJob = jobs.find((x) => x.id === selectedJobId) ?? jobs[0] ?? null;
  const scopedSessions = currentJob ? sessions.filter((s) => s.jobId === currentJob.id) : sessions;

  const topWeaknesses = scopedSessions
    .flatMap((s) => s.weaknesses)
    .reduce<{ text: string; count: number }[]>((acc, w) => {
      const found = acc.find((x) => x.text === w);
      if (found) found.count++;
      else acc.push({ text: w, count: 1 });
      return acc;
    }, [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((x) => x.text);

  const completed = scopedSessions.find((s) => s.status === "COMPLETED" && s.avgScore != null);
  const evidenceCount = knowledgeItems.filter((i) => i.sourceType !== "MODEL_GENERATED").length;

  const sortedSessions = useMemo(() => {
    const arr = [...sessions];
    if (sort === "role") {
      arr.sort((a, b) => (a.role ?? "").localeCompare(b.role ?? "", "zh") || (a.company ?? "").localeCompare(b.company ?? "", "zh"));
    } else if (sort === "company") {
      arr.sort((a, b) => (a.company ?? "").localeCompare(b.company ?? "", "zh") || (a.role ?? "").localeCompare(b.role ?? "", "zh"));
    } else {
      arr.sort((a, b) => b.id - a.id);
    }
    return arr;
  }, [sessions, sort]);

  function selectJob(id: number) {
    setSelectedJobId(id);
    localStorage.setItem("currentJobId", String(id));
  }

  async function addSchedule() {
    if (!schedCompany.trim() || !schedRole.trim() || !schedAt || schedBusy) return;
    setSchedBusy(true);
    setError(null);
    try {
      await apiJson("/api/schedule", "POST", {
        company: schedCompany.trim(),
        role: schedRole.trim(),
        interviewAt: schedAt,
      });
      setSchedCompany("");
      setSchedRole("");
      setSchedAt("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSchedBusy(false);
    }
  }

  async function removeSchedule(id: number) {
    try {
      await apiJson(`/api/schedule/${id}`, "DELETE");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // 继续模拟：复用当前目标岗位的 JD + 已保存简历，确认面试要求/题目数后直接开始
  function openContinue() {
    const last = scopedSessions[0];
    setReqInput(last?.requirement ?? "");
    setTargetInput(last?.questionTarget ?? 10);
    setShowContinue(true);
  }

  async function doContinue(requirement: string | null, questionTarget: number | null) {
    if (!currentJob || continuing) return;
    setContinuing(true);
    setError(null);
    try {
      const r = await apiJson<{ id: number }>("/api/interviews/quick", "POST", {
        job_id: currentJob.id,
        requirement: requirement ?? undefined,
        question_target: questionTarget ?? undefined,
      });
      router.push(`/interview/${r.id}/session`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setContinuing(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">准备面试</h1>
          <div className="flex gap-2">
            <Link href="/knowledge" className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700">
              快速复盘
            </Link>
            <Link href="/interview/new" className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
              + 新建面试
            </Link>
          </div>
        </div>

        {error && <div className="rounded border border-red-300 bg-red-50 p-3 text-red-700">{error}</div>}

        {dueTomorrow.length > 0 && (
          <div className="rounded border border-blue-300 bg-blue-50 p-4">
            <div className="text-sm font-semibold text-blue-800">⏰ 明天有面试，记得准备</div>
            {dueTomorrow.map((s) => (
              <div key={s.id} className="mt-1 text-sm text-blue-700">
                {s.company} · {s.role} · {fmtDateTime(s.interviewAt)}
              </div>
            ))}
          </div>
        )}

        {/* 当前目标岗位（可选） */}
        <section className="rounded border bg-white p-5">
          <div className="text-sm text-slate-500">当前目标岗位</div>
          {jobs.length === 0 ? (
            <div className="mt-1 text-slate-400">还没有目标岗位，先新建一场面试吧。</div>
          ) : (
            <>
              <select
                className="input mt-2"
                value={currentJob?.id ?? ""}
                onChange={(e) => selectJob(Number(e.target.value))}
              >
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.company} · {j.role}
                  </option>
                ))}
              </select>
              {currentJob && (
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-xl font-semibold">{currentJob.company}</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-lg">{currentJob.role}</span>
                </div>
              )}
            </>
          )}
        </section>

        {/* 面试日程 */}
        <section className="rounded border bg-white p-5">
          <div className="text-sm text-slate-500">面试日程</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <input className="input w-32" placeholder="公司" value={schedCompany} onChange={(e) => setSchedCompany(e.target.value)} />
            <input className="input w-32" placeholder="岗位" value={schedRole} onChange={(e) => setSchedRole(e.target.value)} />
            <input className="input" type="datetime-local" value={schedAt} onChange={(e) => setSchedAt(e.target.value)} />
            <button className="btn" disabled={schedBusy} onClick={() => void addSchedule()}>
              {schedBusy ? "保存中..." : "添加"}
            </button>
          </div>
          {schedules.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {schedules.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-700">
                    {s.company} · {s.role} <span className="text-xs text-slate-400">{fmtDateTime(s.interviewAt)}</span>
                  </span>
                  <button className="text-xs text-slate-400 hover:text-red-600" onClick={() => void removeSchedule(s.id)}>删除</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-400">还没有面试日程，添加后面试前一天会提醒你。</p>
          )}
        </section>

        {/* 准备度 + Top 3 弱项（按所选岗位） */}
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded border bg-white p-5">
            <div className="text-sm text-slate-500">面试准备度</div>
            <div className="mt-1 text-3xl font-semibold">
              {completed?.avgScore != null ? `${completed.avgScore} / 100` : "—"}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              {completed ? "该岗位最近一次模拟平均分" : "完成一场模拟面试后显示"}
            </div>
          </div>
          <div className="rounded border bg-white p-5">
            <div className="text-sm text-slate-500">Top 3 当前弱项</div>
            {topWeaknesses.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {topWeaknesses.map((w, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">#{i + 1}</span>
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-sm text-amber-800">{w}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-1 text-slate-400">该岗位完成面试后自动聚合。</div>
            )}
          </div>
        </section>

        {/* 下一步建议 */}
        <section className="rounded border bg-white p-5">
          <div className="text-sm text-slate-500">下一步建议</div>
          {topWeaknesses.length > 0 ? (
            <p className="mt-1 text-sm text-slate-700">
              建议优先针对 <span className="font-medium text-amber-700">{topWeaknesses.join("、")}</span>{" "}
              做专项训练，再进行下一场模拟。
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-400">先完成一场模拟面试，AI 会给出针对性建议。</p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              onClick={openContinue}
              disabled={continuing || !currentJob}
              className="rounded bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {continuing ? "准备中..." : "继续模拟"}
            </button>
          </div>
        </section>

        {/* 今日练习计划（基于跨会话记忆表） */}
        <section className="rounded border bg-white p-5">
          <div className="text-sm text-slate-500">今日练习计划</div>
          {practicePlan.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {practicePlan.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">#{i + 1}</span>
                  <div>
                    <span className="font-medium text-slate-800">{p.topic}</span>
                    <div className="text-xs text-slate-400">{p.reason}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-400">完成几场模拟后，这里会根据你的弱项自动生成练习建议。</p>
          )}
        </section>

        {/* 数据概览（次要位置） */}
        <section className="flex gap-4 text-sm text-slate-500">
          <span>知识库 {knowledgeItems.length} 题</span>
          <span>·</span>
          <span>真实面经 {evidenceCount} 题</span>
          <span>·</span>
          <span>复盘 {realInterviews.length} 场</span>
        </section>
      </div>

      {/* 侧栏：历史面试 */}
      <aside className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">历史面试</h2>
          <select className="input w-28 py-1 text-xs" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="latest">按最新</option>
            <option value="role">按岗位</option>
            <option value="company">按公司</option>
          </select>
        </div>
        {sortedSessions.length === 0 ? (
          <p className="rounded border bg-white p-4 text-sm text-slate-400">还没有面试记录。</p>
        ) : (
          sortedSessions.map((s) => (
            <SessionCard key={s.id} session={s} onRenamed={() => void load()} />
          ))
        )}
      </aside>

      {showContinue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded border bg-white p-5">
            <h3 className="font-semibold">继续模拟</h3>
            <p className="mt-1 text-xs text-slate-400">
              将复用当前目标岗位的 JD 与已保存简历；可先调整面试要求与题目数。
            </p>

            <label className="mt-3 block text-sm text-slate-600">面试要求（可选，留空=默认）</label>
            <textarea
              className="input mt-1 min-h-[80px]"
              placeholder="例如：侧重追问项目中的技术细节；风格偏压力面..."
              value={reqInput}
              onChange={(e) => setReqInput(e.target.value)}
            />

            <label className="mt-3 block text-sm text-slate-600">题目数（3-30）</label>
            <input
              className="input mt-1 w-24"
              type="number"
              min={3}
              max={30}
              value={targetInput}
              onChange={(e) => setTargetInput(Math.min(30, Math.max(3, Number(e.target.value) || 10)))}
            />

            <div className="mt-4 flex gap-2">
              <button
                className="btn flex-1"
                disabled={continuing}
                onClick={() => {
                  const last = scopedSessions[0];
                  void doContinue(last?.requirement ?? null, last?.questionTarget ?? 10);
                }}
              >
                {continuing ? "准备中..." : "直接开始"}
              </button>
              <button
                className="btn flex-1 bg-green-700"
                disabled={continuing}
                onClick={() => void doContinue(reqInput.trim() || null, targetInput)}
              >
                保存并开始
              </button>
            </div>
            <button
              className="mt-2 w-full text-sm text-slate-500"
              onClick={() => setShowContinue(false)}
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SessionCard({
  session,
  onRenamed,
}: {
  session: SessionInfo;
  onRenamed: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(session.title ?? "");
  const [busy, setBusy] = useState(false);

  const displayTitle = session.title ?? `${session.company ?? "未命名"} · ${session.role ?? ""}`;

  async function saveTitle() {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await apiJson(`/api/interviews/${session.id}`, "PATCH", { title: t });
      onRenamed();
      setEditing(false);
    } catch {
      // 保持编辑态让用户重试
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded border bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        {editing ? (
          <div className="flex flex-1 gap-2">
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveTitle();
                if (e.key === "Escape") setEditing(false);
              }}
              autoFocus
            />
            <button className="btn" onClick={() => void saveTitle()} disabled={busy}>
              保存
            </button>
          </div>
        ) : (
          <div className="min-w-0">
            <div className="truncate font-medium">{displayTitle}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {session.company ? session.company : ""}
              {session.role ? ` · ${session.role}` : ""}
            </div>
            <div className="mt-0.5 text-xs text-slate-400">
              {session.avgScore != null ? `${session.avgScore} 分` : ""}
              <span className="ml-1">{session.status === "COMPLETED" ? "已完成" : session.status}</span>
            </div>
          </div>
        )}
        {!editing && (
          <button
            className="shrink-0 text-xs text-slate-400 hover:text-slate-700"
            onClick={() => {
              setTitle(session.title ?? "");
              setEditing(true);
            }}
          >
            重命名
          </button>
        )}
      </div>

      {session.weaknesses.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {session.weaknesses.slice(0, 2).map((w, i) => (
            <span key={i} className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
              {w}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-3 text-sm">
        <Link href={`/interview/${session.id}/report`} className="text-blue-600">
          查看报告
        </Link>
      </div>
    </div>
  );
}
