import { embedText } from "@/llm";
import { searchItemEmbeddings } from "@/db/vector";
import { getItemById, searchItemsByCompanyTopic } from "@/db/repositories/interview_items";
import type { InterviewItem } from "../engine-types";

export interface RetrieveInput {
  topic: string;
  company: string;
  role: string;
  excludeIds?: number[];
}

function companyMatches(stored: string | undefined, target: string): boolean {
  if (!stored || !target) return false;
  const s = stored.trim();
  const t = target.trim();
  return s === t || s.includes(t) || t.includes(s);
}

// 问题来源优先级（评测修复版）：
// 1. 公司 + 岗位 + topic（精确）
// 2. 公司 + topic（放宽岗位，兼容「AI产品经理」vs「AI产品经理实习生」等角色变体）
// 3. 公司范围内语义检索
// 关键约束：始终限定目标公司，避免跨公司抓取面经污染「岗位针对性」；
// 无命中返回 null，由调用方走 LLM 生成兜底（空库/冷启动也能完整跑通）。
export async function retrievePrimaryQuestion(
  input: RetrieveInput,
): Promise<InterviewItem | null> {
  const { topic, company, role, excludeIds = [] } = input;
  const exclude = new Set(excludeIds);

  // 1. 公司 + 岗位 + topic
  let items = searchItemsByCompanyTopic({ company, role, topic, limit: 10 });

  // 2. 公司 + topic（放宽岗位）
  if (items.length === 0) {
    items = searchItemsByCompanyTopic({ company, topic, limit: 10 });
  }

  // 3. 公司范围内语义检索（依赖 embedding）
  if (items.length === 0) {
    try {
      const query = await embedText(topic);
      const hits = searchItemEmbeddings(query, 50);
      items = hits
        .map((h) => getItemById(h.id))
        .filter((x): x is InterviewItem => x !== null)
        .filter((x) => companyMatches(x.company, company));
    } catch {
      items = [];
    }
  }

  if (items.length === 0) return null;

  const candidates = items
    .filter((x) => x.id != null && !exclude.has(x.id))
    .filter((x) => x.sourceType !== "SIMULATED_INTERVIEW")
    .sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0));

  return candidates[0] ?? null;
}
