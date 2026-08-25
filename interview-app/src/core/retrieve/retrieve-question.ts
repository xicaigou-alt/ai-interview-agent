import { embedText } from "@/llm";
import { searchItemEmbeddings } from "@/db/vector";
import { getItemById, searchItemsByMetadata } from "@/db/repositories/interview_items";
import type { InterviewItem } from "../engine-types";

export interface RetrieveInput {
  topic: string;
  company: string;
  role: string;
}

// 问题来源优先级（§19 / §20）：元数据精确 → 放宽 → 语义 → 由调用方兜底生成
export async function retrievePrimaryQuestion(
  input: RetrieveInput,
): Promise<InterviewItem | null> {
  const { topic, company, role } = input;

  // 1. 精确元数据：公司 + 岗位 + topic
  let items = searchItemsByMetadata({ company, role, topic, limit: 5 });

  // 2. 放宽：仅 topic
  if (items.length === 0) {
    items = searchItemsByMetadata({ topic, limit: 5 });
  }

  // 3. 语义检索（依赖 embedding）
  if (items.length === 0) {
    try {
      const query = await embedText(topic);
      const hits = searchItemEmbeddings(query, 5);
      items = hits
        .map((h) => getItemById(h.id))
        .filter((x): x is InterviewItem => x !== null);
    } catch {
      items = [];
    }
  }

  if (items.length === 0) return null;

  return items.sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0))[0];
}
