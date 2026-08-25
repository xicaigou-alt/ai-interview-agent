"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { apiJson } from "@/lib/api";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface KnowledgeItem {
  id: number;
  question: string;
  sourceType: string;
  company?: string;
  role?: string;
  stage?: string;
  questionType?: string;
  topics?: string[];
  importedId?: number;
}
interface ImportQuestion {
  question: string;
  questionType: string;
  topics: string[];
  difficulty: string;
  knowledgePoints: string[];
  evaluationRubric: string[];
}
interface ImportRound {
  round?: string;
  summary?: string;
  questions: ImportQuestion[];
}
interface ImportDraft {
  company?: string;
  role?: string;
  warnings?: string[];
  rounds: ImportRound[];
}
interface ImportRecord {
  id: number;
  company: string | null;
  role: string | null;
  round: string | null;
  summary: string | null;
  createdAt: string;
  questionCount: number;
}
interface DebriefResult {
  company: string;
  role: string;
  round: string;
  date?: string;
  questions: Array<{ question: string; type: string; topics: string[] }>;
  notes: string;
}

const SOURCE_LABEL: Record<string, string> = {
  MODEL_GENERATED: "AI 生成",
  REAL_INTERVIEW: "真实面经",
  PERSONAL_REAL_INTERVIEW: "个人面试",
  IMPORTED_INTERVIEW_EXPERIENCE: "导入面经",
  SIMULATED_INTERVIEW: "模拟面试",
  CURATED: "精选",
};

const TYPE_LABEL: Record<string, string> = {
  AI_KNOWLEDGE: "AI 知识",
  PRODUCT_DESIGN: "产品设计",
  RESUME_DEEP_DIVE: "简历深挖",
  BEHAVIORAL: "行为面",
  JD_GAP: "JD 差距",
};

const TYPE_COLORS: Record<string, string> = {
  AI_KNOWLEDGE: "#6366f1",
  PRODUCT_DESIGN: "#f59e0b",
  RESUME_DEEP_DIVE: "#10b981",
  BEHAVIORAL: "#ec4899",
  JD_GAP: "#8b5cf6",
};

function normalizeQuestion(s: string): string {
  return s.toLowerCase().replace(/[\s，。；：、！？,.!?;:'"“”‘’()（）\-—_/\\]/g, "");
}

type ViewMode = "flat" | "company" | "role";

export default function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [records, setRecords] = useState<ImportRecord[]>([]);

  // 筛选与视图
  const [fCompany, setFCompany] = useState("");
  const [fRole, setFRole] = useState("");
  const [fStage, setFStage] = useState("");
  const [fSource, setFSource] = useState("");
  const [view, setView] = useState<ViewMode>("flat");

  // Generate
  const [gRole, setGRole] = useState("");
  const [gTopic, setGTopic] = useState("");
  const [gDifficulty, setGDifficulty] = useState("medium");
  const [gCount, setGCount] = useState(5);

  // Import（解析 → 预览 → 确认）
  const [importText, setImportText] = useState("");
  const [importDraft, setImportDraft] = useState<ImportDraft | null>(null);

  // Debrief
  const [debriefText, setDebriefText] = useState("");
  const [draft, setDraft] = useState<DebriefResult | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function loadAll() {
    try {
      const [r1, r2] = await Promise.all([
        apiJson<{ items: KnowledgeItem[] }>("/api/knowledge/items", "GET"),
        apiJson<{ records: ImportRecord[] }>("/api/knowledge/records", "GET"),
      ]);
      setItems(r1.items);
      setRecords(r2.records);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const companyOptions = useMemo(
    () => [...new Set([...items.map((i) => i.company), ...records.map((r) => r.company)].filter(Boolean))] as string[],
    [items, records],
  );
  const roleOptions = useMemo(
    () => [...new Set([...items.map((i) => i.role), ...records.map((r) => r.role)].filter(Boolean))] as string[],
    [items, records],
  );
  const stageOptions = useMemo(
    () => [...new Set([...items.map((i) => i.stage), ...records.map((r) => r.round)].filter(Boolean))] as string[],
    [items, records],
  );

  const filteredItems = useMemo(
    () =>
      items.filter(
        (it) =>
          (!fCompany || it.company === fCompany) &&
          (!fRole || it.role === fRole) &&
          (!fStage || it.stage === fStage) &&
          (!fSource || it.sourceType === fSource),
      ),
    [items, fCompany, fRole, fStage, fSource],
  );

  async function runGenerate() {
    if (!gRole.trim() || !gTopic.trim()) {
      setError("请填写岗位和 topic");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await apiJson<{ count: number; skipped?: number }>("/api/knowledge/generate", "POST", {
        role: gRole,
        topic: gTopic,
        difficulty: gDifficulty,
        count: gCount,
      });
      setMessage(`已生成 ${r.count} 道题${r.skipped ? `，跳过重复 ${r.skipped} 道` : ""}`);
      setGRole("");
      setGTopic("");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runParseImport() {
    if (!importText.trim()) {
      setError("请粘贴面经文本");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await apiJson<ImportDraft>("/api/knowledge/import-text/parse", "POST", {
        text: importText,
      });
      setImportDraft(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runSaveImport() {
    const rounds = (importDraft?.rounds ?? []).filter(
      (r) => (r.questions?.length ?? 0) > 0 || (r.summary ?? "").trim() !== "",
    );
    const totalQuestions = rounds.reduce((n, r) => n + (r.questions?.length ?? 0), 0);
    if (!importDraft || rounds.length === 0 || totalQuestions === 0) return;
    setBusy(true);
    setError(null);
    try {
      const r = await apiJson<{ count: number; skipped?: number }>("/api/knowledge/import-text", "POST", {
        company: importDraft.company,
        role: importDraft.role,
        rounds,
        raw_text: importText,
      });
      setMessage(
        `已导入 ${r.count} 道题${importDraft.company ? `（${importDraft.company}）` : ""}${r.skipped ? `，跳过重复 ${r.skipped} 道` : ""}`,
      );
      setImportDraft(null);
      setImportText("");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runParseDebrief() {
    if (!debriefText.trim()) {
      setError("请输入真实面试叙述");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await apiJson<DebriefResult>("/api/real-interviews/parse", "POST", { text: debriefText });
      setDraft(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runSaveDebrief() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const r = await apiJson<{ inserted: number }>("/api/real-interviews", "POST", draft);
      setMessage(`已保存复盘，沉淀 ${r.inserted} 道个人真实面试题`);
      setDraft(null);
      setDebriefText("");
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(id: number) {
    await apiJson(`/api/knowledge/items/${id}`, "DELETE");
    await loadAll();
  }

  // ===== 语音复盘（半双工，SiliconFlow SenseVoice） =====
  async function toggleRecord() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        setRecording(false);
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size > 0) await transcribeBlob(blob);
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (e) {
      setError("无法访问麦克风：" + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function transcribeBlob(blob: Blob) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", blob, "voice.webm");
      const res = await fetch("/api/voice/transcribe", { method: "POST", body: fd });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "语音转写失败");
      const t = (data.text ?? "").trim();
      if (t) setDebriefText((prev) => (prev.trim() ? `${prev}\n${t}` : t));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  // ===== 图片导入面经（批量：同一公司/岗位不同轮次截图，合并后内容分割） =====
  async function onImagePicked(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrls: string[] = [];
      for (const file of files) {
        dataUrls.push(await readAsDataUrl(file));
      }
      const r = await apiJson<ImportDraft>("/api/knowledge/import-images/parse", "POST", {
        imageDataUrls: dataUrls,
      });
      setImportDraft(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  // 读取图片并压缩（最长边不超过 2000px），加快 OCR 并减小请求体
  async function readAsDataUrl(file: File): Promise<string> {
    const original = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(new Error("读取图片失败"));
      fr.readAsDataURL(file);
    });
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("图片解码失败"));
        img.src = original;
      });
      const MAX = 2000;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      if (scale >= 1) return original;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return original;
      ctx.drawImage(img, 0, 0, w, h);
      return canvas.toDataURL("image/jpeg", 0.85);
    } catch {
      return original; // 降级：原图
    }
  }

  function updateRoundSummary(ri: number, v: string) {
    setImportDraft((prev) =>
      prev ? { ...prev, rounds: prev.rounds.map((r, i) => (i === ri ? { ...r, summary: v } : r)) } : prev,
    );
  }

  function updateRoundName(ri: number, v: string) {
    setImportDraft((prev) =>
      prev ? { ...prev, rounds: prev.rounds.map((r, i) => (i === ri ? { ...r, round: v } : r)) } : prev,
    );
  }

  function updateImportCompany(v: string) {
    setImportDraft((prev) => (prev ? { ...prev, company: v } : prev));
  }

  function updateImportRole(v: string) {
    setImportDraft((prev) => (prev ? { ...prev, role: v } : prev));
  }

  function removeImportQuestion(ri: number, qi: number) {
    setImportDraft((prev) =>
      prev
        ? {
            ...prev,
            rounds: prev.rounds.map((r, i) =>
              i === ri ? { ...r, questions: r.questions.filter((_, j) => j !== qi) } : r,
            ),
          }
        : prev,
    );
  }

  function moveQuestion(fromRi: number, qi: number, toRi: number) {
    if (fromRi === toRi) return;
    setImportDraft((prev) => {
      if (!prev) return prev;
      const rounds = prev.rounds.map((r) => ({ ...r, questions: [...r.questions] }));
      const [q] = rounds[fromRi].questions.splice(qi, 1);
      if (!q) return prev;
      rounds[toRi].questions.push(q);
      return { ...prev, rounds };
    });
  }

  function cancelImport() {
    setImportDraft(null);
    setImportText("");
  }

  function cancelDebrief() {
    setDraft(null);
    setDebriefText("");
  }

  function updateDraft(field: "company" | "role" | "round", value: string) {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  const totalImportQuestions = (importDraft?.rounds ?? []).reduce(
    (n, r) => n + (r.questions?.length ?? 0),
    0,
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">面试情报 / Interview Intelligence</h1>

      {message && <div className="rounded border border-green-300 bg-green-50 p-3 text-green-700">{message}</div>}
      {error && <div className="rounded border border-red-300 bg-red-50 p-3 text-red-700">{error}</div>}

      <Section title="① 导入真实面经">
        <textarea
          className="input min-h-[140px]"
          placeholder="粘贴牛客/分享帖等面经文本..."
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />
        <div className="mt-3 flex gap-2">
          <button className="btn" onClick={runParseImport} disabled={busy}>
            AI 解析
          </button>
          <label className="btn cursor-pointer">
            🖼 导入截图
            <input type="file" accept="image/*" multiple className="hidden" onChange={onImagePicked} />
          </label>
        </div>

        {importDraft && (
          <div className="mt-3 rounded bg-slate-50 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="input w-36"
                  placeholder="公司（未知公司）"
                  value={importDraft.company ?? ""}
                  onChange={(e) => updateImportCompany(e.target.value)}
                />
                <span className="text-slate-400">·</span>
                <input
                  className="input w-40"
                  placeholder="岗位（未知岗位）"
                  value={importDraft.role ?? ""}
                  onChange={(e) => updateImportRole(e.target.value)}
                />
                <span className="text-xs font-normal text-slate-400">
                  {importDraft.rounds.length} 轮 · {totalImportQuestions} 题
                </span>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  className="rounded border border-slate-300 px-3 py-2 text-slate-600"
                  onClick={cancelImport}
                >
                  取消
                </button>
                <button className="btn bg-green-700" onClick={runSaveImport} disabled={busy}>
                  确认保存（{totalImportQuestions} 题）
                </button>
              </div>
            </div>

            {(importDraft.warnings ?? []).length > 0 && (
              <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                {importDraft.warnings!.map((w, i) => (
                  <div key={i}>⚠ {w}</div>
                ))}
              </div>
            )}

            <div className="mt-3 space-y-3">
              {importDraft.rounds.length === 0 && (
                <p className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                  ⚠ 未识别到面试题目，请检查文本/图片内容，或调整后重新解析。
                </p>
              )}
              {importDraft.rounds.map((rnd, ri) => (
                <div key={ri} className="rounded border border-slate-200 bg-white p-3">
                  <div className="flex items-center gap-2">
                    <input
                      className="input w-40"
                      value={rnd.round ?? ""}
                      placeholder="未标注轮次"
                      onChange={(e) => updateRoundName(ri, e.target.value)}
                    />
                    <span className="text-xs text-slate-400">{rnd.questions.length} 题</span>
                  </div>
                  <label className="mt-2 block text-xs text-slate-500">该轮面试总结（可编辑，留空则不存）</label>
                  <textarea
                    className="input mt-1 min-h-[56px]"
                    placeholder="作者的整体感受 / 总结 / 经验教训..."
                    value={rnd.summary ?? ""}
                    onChange={(e) => updateRoundSummary(ri, e.target.value)}
                  />
                  <ol className="mt-2 list-decimal space-y-1 pl-5">
                    {rnd.questions.map((q, qi) => (
                      <li key={qi} className="flex items-start justify-between gap-2">
                        <span>
                          {q.question} <span className="text-slate-400">[{q.topics?.join(", ")}]</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          <select
                            className="rounded border border-slate-300 px-1 py-0.5 text-xs"
                            value={ri}
                            title="移动到其他轮次"
                            onChange={(e) => moveQuestion(ri, qi, Number(e.target.value))}
                          >
                            {importDraft.rounds.map((_, toRi) => (
                              <option key={toRi} value={toRi}>
                                {toRi === ri ? "本轮" : (importDraft.rounds[toRi].round ?? `轮${toRi + 1}`)}
                              </option>
                            ))}
                          </select>
                          <button
                            className="text-xs text-red-500"
                            onClick={() => removeImportQuestion(ri, qi)}
                          >
                            删除
                          </button>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section title="② 真实面试复盘">
        <textarea
          className="input min-h-[120px]"
          placeholder="例如：今天字节 AI PM 一面，先自我介绍，然后问我为什么项目用 RAG..."
          value={debriefText}
          onChange={(e) => setDebriefText(e.target.value)}
        />
        <div className="mt-3 flex gap-2">
          <button className="btn" onClick={toggleRecord} disabled={busy}>
            {recording ? "⏹ 停止录音" : "🎤 语音复盘"}
          </button>
          <button className="btn" onClick={runParseDebrief} disabled={busy}>
            结构化解析
          </button>
          {draft && (
            <>
              <button className="btn bg-green-700" onClick={runSaveDebrief} disabled={busy}>
                确认保存
              </button>
              <button className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-600" onClick={cancelDebrief}>
                取消
              </button>
            </>
          )}
        </div>

        {draft && (
          <div className="mt-3 rounded bg-slate-50 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="input w-32"
                placeholder="公司"
                value={draft.company}
                onChange={(e) => updateDraft("company", e.target.value)}
              />
              <span className="text-slate-400">·</span>
              <input
                className="input w-36"
                placeholder="岗位"
                value={draft.role}
                onChange={(e) => updateDraft("role", e.target.value)}
              />
              <span className="text-slate-400">·</span>
              <input
                className="input w-28"
                placeholder="轮次"
                value={draft.round}
                onChange={(e) => updateDraft("round", e.target.value)}
              />
              {draft.date ? <span className="text-slate-400">· {draft.date}</span> : null}
            </div>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              {draft.questions.map((q, i) => (
                <li key={i}>
                  {q.question} <span className="text-slate-400">[{q.topics.join(", ")}]</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Section>

      <Section title="③ AI 生成补充题">
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="input" placeholder="岗位（如 AI产品经理）" value={gRole} onChange={(e) => setGRole(e.target.value)} />
          <input className="input" placeholder="Topic（如 RAG）" value={gTopic} onChange={(e) => setGTopic(e.target.value)} />
        </div>
        <div className="mt-2 flex gap-2">
          <select className="input" value={gDifficulty} onChange={(e) => setGDifficulty(e.target.value)}>
            <option value="easy">easy</option>
            <option value="medium">medium</option>
            <option value="hard">hard</option>
          </select>
          <input
            className="input w-24"
            type="number"
            min={1}
            max={20}
            value={gCount}
            onChange={(e) => setGCount(Number(e.target.value))}
          />
        </div>
        <button className="btn mt-3" onClick={runGenerate} disabled={busy}>
          生成
        </button>
      </Section>

      <StatsDashboard items={filteredItems} />

      {/* 筛选 + 视图 */}
      <section className="rounded border bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect label="公司" value={fCompany} onChange={setFCompany} options={companyOptions} placeholder="全部公司" />
          <FilterSelect label="岗位" value={fRole} onChange={setFRole} options={roleOptions} placeholder="全部岗位" />
          <FilterSelect label="轮次" value={fStage} onChange={setFStage} options={stageOptions} placeholder="全部轮次" />
          <FilterSelect
            label="来源"
            value={fSource}
            onChange={setFSource}
            options={Object.keys(SOURCE_LABEL)}
            optionLabel={(v) => SOURCE_LABEL[v]}
            placeholder="全部来源"
          />
          <div>
            <label className="block text-xs text-slate-500">视图</label>
            <select className="input mt-1 w-36" value={view} onChange={(e) => setView(e.target.value as ViewMode)}>
              <option value="flat">平铺列表</option>
              <option value="company">按公司分组</option>
              <option value="role">按岗位分组</option>
            </select>
          </div>
        </div>
      </section>

      <Section title={`题目列表（${filteredItems.length}）`}>
        {filteredItems.length === 0 ? (
          <p className="text-slate-400">当前筛选下暂无题目。</p>
        ) : view === "flat" ? (
          <FlatList items={filteredItems} onRemove={removeItem} />
        ) : (
          <GroupedList items={filteredItems} records={records} dim={view} onRemove={removeItem} />
        )}
      </Section>
    </div>
  );
}

function SourceBadge({ sourceType }: { sourceType: string }) {
  const palette: Record<string, string> = {
    MODEL_GENERATED: "bg-slate-100 text-slate-600",
    REAL_INTERVIEW: "bg-green-100 text-green-700",
    PERSONAL_REAL_INTERVIEW: "bg-purple-100 text-purple-700",
    IMPORTED_INTERVIEW_EXPERIENCE: "bg-cyan-100 text-cyan-700",
    SIMULATED_INTERVIEW: "bg-indigo-100 text-indigo-700",
    CURATED: "bg-orange-100 text-orange-700",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 ${palette[sourceType] ?? "bg-slate-100 text-slate-600"}`}>
      {SOURCE_LABEL[sourceType] ?? sourceType}
    </span>
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

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  optionLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  optionLabel?: (v: string) => string;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500">{label}</label>
      <select className="input mt-1 w-40" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {optionLabel ? optionLabel(o) : o}
          </option>
        ))}
      </select>
    </div>
  );
}

function FlatList({ items, onRemove }: { items: KnowledgeItem[]; onRemove: (id: number) => void }) {
  return (
    <ul className="divide-y">
      {items.map((it) => (
        <li key={it.id} className="flex items-start justify-between gap-3 py-2">
          <div className="text-sm">
            <div>{it.question}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
              <SourceBadge sourceType={it.sourceType} />
              {it.stage && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-blue-700">{it.stage}</span>}
              {it.company && <span>{it.company}</span>}
              {it.role && <span>{it.role}</span>}
              {it.topics?.length ? <span>{it.topics.join("/")}</span> : null}
            </div>
          </div>
          <button className="text-xs text-red-500" onClick={() => onRemove(it.id)}>
            删除
          </button>
        </li>
      ))}
    </ul>
  );
}

interface LeafGroup {
  company: string;
  role: string;
  stage: string;
  summary?: string;
  items: KnowledgeItem[];
}
interface Group2 {
  key: string;
  leaves: LeafGroup[];
}
interface Group3 {
  key: string;
  groups: Group2[];
}

function buildGroups(items: KnowledgeItem[], records: ImportRecord[], dim: "company" | "role"): Group3[] {
  const summaryMap = new Map<string, string>();
  for (const rec of records) {
    summaryMap.set(`${rec.company ?? ""}|${rec.role ?? ""}|${rec.round ?? ""}`, rec.summary ?? "");
  }

  const leafByKey = new Map<string, LeafGroup>();
  const order: string[] = [];
  for (const it of items) {
    const c = it.company ?? "未标注公司";
    const r = it.role ?? "未标注岗位";
    const s = it.stage ?? "未标注轮次";
    const key = `${c}|${r}|${s}`;
    if (!leafByKey.has(key)) {
      leafByKey.set(key, { company: c, role: r, stage: s, summary: summaryMap.get(key) || undefined, items: [] });
      order.push(key);
    }
    leafByKey.get(key)!.items.push(it);
  }

  const groups: Group3[] = [];
  for (const key of order) {
    const leaf = leafByKey.get(key)!;
    const k1 = dim === "company" ? leaf.company : leaf.role;
    const k2 = dim === "company" ? leaf.role : leaf.company;
    let g1 = groups.find((g) => g.key === k1);
    if (!g1) {
      g1 = { key: k1, groups: [] };
      groups.push(g1);
    }
    let g2 = g1.groups.find((g) => g.key === k2);
    if (!g2) {
      g2 = { key: k2, leaves: [] };
      g1.groups.push(g2);
    }
    g2.leaves.push(leaf);
  }
  return groups;
}

function GroupedList({
  items,
  records,
  dim,
  onRemove,
}: {
  items: KnowledgeItem[];
  records: ImportRecord[];
  dim: "company" | "role";
  onRemove: (id: number) => void;
}) {
  const groups = buildGroups(items, records, dim);
  return (
    <div className="space-y-3">
      {groups.map((g1) => (
        <details key={g1.key} className="rounded border bg-white">
          <summary className="cursor-pointer px-4 py-2 font-medium">{g1.key}</summary>
          <div className="space-y-2 px-4 pb-3">
            {g1.groups.map((g2) => (
              <details key={g2.key} className="rounded bg-slate-50 p-2">
                <summary className="cursor-pointer text-sm font-medium">{g2.key}</summary>
                <div className="mt-2 space-y-2">
                  {g2.leaves.map((leaf) => (
                    <div key={`${leaf.company}|${leaf.role}|${leaf.stage}`} className="rounded bg-white p-3">
                      <div className="text-sm font-medium">
                        {leaf.company} · {leaf.role} · {leaf.stage}
                        <span className="ml-2 text-xs font-normal text-slate-400">{leaf.items.length} 题</span>
                      </div>
                      {leaf.summary && (
                        <div className="mt-1 rounded bg-amber-50 p-2 text-xs text-amber-800">总结：{leaf.summary}</div>
                      )}
                      <ul className="mt-2 space-y-1.5">
                        {leaf.items.map((it) => (
                          <li key={it.id} className="flex items-start justify-between gap-2 text-sm">
                            <span className="flex flex-wrap items-center gap-1">
                              <SourceBadge sourceType={it.sourceType} />
                              {it.question}
                            </span>
                            <button className="shrink-0 text-xs text-red-500" onClick={() => onRemove(it.id)}>
                              删除
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

function StatsDashboard({ items }: { items: KnowledgeItem[] }) {
  const [selTopic, setSelTopic] = useState<string | null>(null);
  const [selType, setSelType] = useState<string | null>(null);
  const [selQuestion, setSelQuestion] = useState<{ key: string; text: string; companies: string[] } | null>(null);

  const stats = useMemo(() => {
    const topicCount = new Map<string, number>();
    for (const it of items) {
      for (const t of it.topics ?? []) {
        topicCount.set(t, (topicCount.get(t) ?? 0) + 1);
      }
    }
    const topTopics = [...topicCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));

    const byQuestion = new Map<string, { text: string; companies: Set<string> }>();
    for (const it of items) {
      const norm = normalizeQuestion(it.question);
      if (!norm) continue;
      if (!byQuestion.has(norm)) byQuestion.set(norm, { text: it.question, companies: new Set() });
      if (it.company) byQuestion.get(norm)!.companies.add(it.company);
    }
    const crossCompany = [...byQuestion.entries()]
      .map(([key, v]) => ({
        key,
        name: v.text.length > 12 ? v.text.slice(0, 12) + "…" : v.text,
        full: v.text,
        companies: [...v.companies],
        value: v.companies.size,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const typeCount = new Map<string, number>();
    for (const it of items) {
      const t = it.questionType ?? "OTHER";
      typeCount.set(t, (typeCount.get(t) ?? 0) + 1);
    }
    const typeDist = [...typeCount.entries()].map(([name, value]) => ({
      name: TYPE_LABEL[name] ?? name,
      key: name,
      value,
      color: TYPE_COLORS[name] ?? "#94a3b8",
    }));

    const companies = new Set(items.map((i) => i.company).filter(Boolean));
    const roles = new Set(items.map((i) => i.role).filter(Boolean));
    const stages = new Set(items.map((i) => i.stage).filter(Boolean));

    return { topTopics, crossCompany, typeDist, companies: companies.size, roles: roles.size, stages: stages.size };
  }, [items]);

  const topicItems = selTopic ? items.filter((it) => (it.topics ?? []).includes(selTopic)) : [];
  const typeItems = selType ? items.filter((it) => (it.questionType ?? "OTHER") === selType) : [];

  return (
    <Section title={`数据看板（当前筛选 ${items.length} 题）`}>
      <div className="mb-3 flex flex-wrap gap-4 text-sm text-slate-500">
        <span>题目 {items.length}</span>
        <span>· 公司 {stats.companies}</span>
        <span>· 岗位 {stats.roles}</span>
        <span>· 轮次 {stats.stages}</span>
        <span className="text-slate-400">（点击图表可展开对应题目）</span>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <ChartCard title="高频考察方向 Top5（按 topic 计数）">
          {stats.topTopics.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.topTopics}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} width={24} />
                <Tooltip />
                <Bar
                  dataKey="value"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(d: any) => {
                    const name = String(d?.name ?? "");
                    setSelTopic((prev) => (prev === name ? null : name));
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
          {selTopic && (
            <InlinePanel title={`方向「${selTopic}」的题目（${topicItems.length}）`} onClose={() => setSelTopic(null)}>
              <InlineQuestionList items={topicItems} />
            </InlinePanel>
          )}
        </ChartCard>
        <ChartCard title="跨公司高频问题 Top5（按出现公司数）">
          {stats.crossCompany.some((c) => c.value > 1) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.crossCompany} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" allowDecimals={false} width={24} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                <Tooltip formatter={(v) => [`${v} 家公司`, "出现"]} />
                <Bar
                  dataKey="value"
                  fill="#10b981"
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(d: any) => {
                    const key = String(d?.key ?? "");
                    if (!key) return;
                    setSelQuestion((prev) =>
                      prev?.key === key
                        ? null
                        : { key, text: String(d?.full ?? ""), companies: Array.isArray(d?.companies) ? d.companies : [] },
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart text="暂无跨公司重复出现的问题" />
          )}
          {selQuestion && (
            <InlinePanel title="该题出现在这些公司" onClose={() => setSelQuestion(null)}>
              <div className="text-sm">{selQuestion.text}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {selQuestion.companies.map((c) => (
                  <span key={c} className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                    {c}
                  </span>
                ))}
              </div>
            </InlinePanel>
          )}
        </ChartCard>
        <ChartCard title="题型分布">
          {stats.typeDist.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={stats.typeDist}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label
                  onClick={(d: any) => {
                    const key = String(d?.key ?? "");
                    setSelType((prev) => (prev === key ? null : key));
                  }}
                >
                  {stats.typeDist.map((d) => (
                    <Cell key={d.key} fill={d.color} style={{ cursor: "pointer" }} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
          {selType && (
            <InlinePanel title={`题型「${TYPE_LABEL[selType] ?? selType}」的题目（${typeItems.length}）`} onClose={() => setSelType(null)}>
              <InlineQuestionList items={typeItems} />
            </InlinePanel>
          )}
        </ChartCard>
      </div>
    </Section>
  );
}

function InlinePanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">{title}</span>
        <button className="text-xs text-slate-400 hover:text-slate-700" onClick={onClose}>
          ✕ 关闭
        </button>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function InlineQuestionList({ items }: { items: KnowledgeItem[] }) {
  if (items.length === 0) {
    return <p className="text-xs text-slate-400">当前筛选下没有匹配的题目。</p>;
  }
  return (
    <ul className="max-h-56 space-y-1.5 overflow-y-auto">
      {items.map((it) => (
        <li key={it.id} className="text-sm">
          <div className="flex flex-wrap items-center gap-1">
            <SourceBadge sourceType={it.sourceType} />
            {it.company && <span className="text-xs text-slate-400">{it.company}</span>}
            {it.role && <span className="text-xs text-slate-400">{it.role}</span>}
            {it.stage && <span className="text-xs text-slate-400">{it.stage}</span>}
          </div>
          <div>{it.question}</div>
        </li>
      ))}
    </ul>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border bg-white p-3">
      <h4 className="mb-2 text-sm font-medium text-slate-600">{title}</h4>
      {children}
    </div>
  );
}

function EmptyChart({ text = "暂无数据" }: { text?: string }) {
  return <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">{text}</div>;
}
