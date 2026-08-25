"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, apiJson } from "@/lib/api";

export default function CreateInterview() {
  const router = useRouter();

  const [resumeText, setResumeText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jdText, setJdText] = useState("");
  const [requirement, setRequirement] = useState("");
  const [questionTarget, setQuestionTarget] = useState(10);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 从历史面试「再次训练」进入时，预填公司/岗位
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const c = sp.get("company");
    const r = sp.get("role");
    if (c) setCompany(c);
    if (r) setRole(r);
  }, []);

  async function submit() {
    if (!company.trim() || !role.trim() || !jdText.trim()) {
      setError("请填写公司、岗位和 JD");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let resumeId: number | undefined;

      if (file) {
        setStep("解析简历文件...");
        const fd = new FormData();
        fd.append("file", file);
        const r = await api<{ id: number }>("/api/resumes", { method: "POST", body: fd });
        resumeId = r.id;
      } else if (resumeText.trim()) {
        setStep("解析简历...");
        const r = await apiJson<{ id: number }>("/api/resumes", "POST", { raw_text: resumeText });
        resumeId = r.id;
      }

      setStep("分析岗位 JD...");
      const job = await apiJson<{ id: number }>("/api/jobs/analyze", "POST", {
        company,
        role,
        jd_text: jdText,
      });

      setStep("创建面试...");
      const session = await apiJson<{ id: number }>("/api/interviews", "POST", {
        resume_id: resumeId,
        job_id: job.id,
        requirement,
        question_target: questionTarget,
      });

      router.push(`/interview/${session.id}/brief`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">新建面试</h1>

      <Field label="简历（粘贴文本，或上传 PDF/DOCX/TXT）">
        <textarea
          className="w-full rounded border p-2 text-sm"
          rows={5}
          placeholder="粘贴简历文本（可选：不填则使用当前已保存的简历）"
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
        />
        <input
          type="file"
          accept=".pdf,.docx,.txt,.md"
          className="mt-2 text-sm"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </Field>

      <Field label="岗位信息">
        <div className="flex gap-3">
          <input
            className="w-1/2 rounded border p-2 text-sm"
            placeholder="公司（如 字节）"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          <input
            className="w-1/2 rounded border p-2 text-sm"
            placeholder="岗位（如 AI 产品经理）"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </div>
      </Field>

      <Field label="JD 原文">
        <textarea
          className="w-full rounded border p-2 text-sm"
          rows={6}
          placeholder="粘贴岗位 JD"
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
        />
      </Field>

      <Field label="面试要求（可选）">
        <textarea
          className="input min-h-[80px]"
          placeholder="例如：侧重追问项目中的技术细节；风格偏压力面；重点考察 RAG 与 Agent 落地经验..."
          value={requirement}
          onChange={(e) => setRequirement(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-400">自定义面试风格或考察侧重点，AI 会据此调整出题与追问。</p>
      </Field>

      <Field label="题目数（主问题，3-30）">
        <div className="flex items-center gap-2">
          <input
            className="input w-24"
            type="number"
            min={3}
            max={30}
            value={questionTarget}
            onChange={(e) => setQuestionTarget(Math.min(30, Math.max(3, Number(e.target.value) || 10)))}
          />
          <span className="text-xs text-slate-400">答满 / 跳过到此题数后自动结束面试</span>
        </div>
      </Field>

      {error && <div className="rounded border border-red-300 bg-red-50 p-3 text-red-700">{error}</div>}

      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded bg-slate-900 px-4 py-3 text-white disabled:opacity-50"
      >
        {busy ? step : "创建面试"}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
