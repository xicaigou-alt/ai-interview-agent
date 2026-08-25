import { extractTextFromImage } from "./ocr";
import { importText, type ImportResult, type ImportRound } from "./import-text";

const ROUND_NAMES = ["一面", "二面", "三面", "四面", "五面", "六面", "七面", "八面", "九面", "十面"];

function roundName(index: number): string {
  return ROUND_NAMES[index] ?? `第${index + 1}轮`;
}

// 把图片文本按字符数分块（每块拼接后控制在 20000 以内，低于解析上限 24000）
function chunkTexts(texts: string[]): string[][] {
  const chunks: string[][] = [];
  let cur: string[] = [];
  let len = 0;
  for (const t of texts) {
    if (len + t.length > 20000 && cur.length > 0) {
      chunks.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(t);
    len += t.length + 8;
  }
  if (cur.length > 0) chunks.push(cur);
  return chunks;
}

// 多次解析结果合并：同名轮次合并题目与总结
function mergeRounds(results: ImportResult[]): ImportResult {
  const company = results.map((r) => r.company).find(Boolean) ?? undefined;
  const role = results.map((r) => r.role).find(Boolean) ?? undefined;
  const warnings = [...new Set(results.flatMap((r) => r.warnings ?? []))];
  const roundMap = new Map<string, ImportRound>();
  for (const res of results) {
    for (const r of res.rounds ?? []) {
      const key = r.round?.trim() || "未标注";
      const existing = roundMap.get(key);
      if (existing) {
        existing.questions = [...existing.questions, ...(r.questions ?? [])];
        if (r.summary) existing.summary = existing.summary ? `${existing.summary}\n${r.summary}` : r.summary;
      } else {
        roundMap.set(key, {
          round: key === "未标注" ? undefined : key,
          summary: r.summary,
          questions: [...(r.questions ?? [])],
        });
      }
    }
  }
  return { company, role, warnings, rounds: [...roundMap.values()] };
}

// 批量图片导入：同一公司/岗位的不同轮次截图。
// 策略（方案 C）：
//   1. 逐张 OCR；
//   2. 合并全部文本做一次内容分割（超长按图分块解析后合并轮次）；
//   3. 若结果只有「未标注」一轮（内容里没有轮次标记），退回按上传顺序逐图分轮（一面/二面…）。
export async function importImages(imageDataUrls: string[]): Promise<ImportResult> {
  const texts: string[] = [];
  for (const url of imageDataUrls) {
    const t = await extractTextFromImage(url);
    texts.push(t);
  }

  if (texts.length <= 1) {
    return importText(texts[0] ?? "");
  }

  const chunks = chunkTexts(texts);
  const results: ImportResult[] = [];
  for (const chunk of chunks) {
    const combined = chunk.map((t, i) => `【图${i + 1}】\n${t}`).join("\n\n");
    results.push(await importText(combined));
  }
  const combined = mergeRounds(results);

  const singleUnknown =
    combined.rounds.length === 1 &&
    !combined.rounds[0].round &&
    combined.rounds[0].questions.length > 0;
  if (singleUnknown) {
    const perImageRounds: ImportRound[] = [];
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i].trim();
      if (!t) continue;
      const img = await importText(t);
      for (const r of img.rounds ?? []) {
        perImageRounds.push({
          round: r.round ?? roundName(i),
          summary: r.summary,
          questions: r.questions,
        });
      }
    }
    return {
      company: combined.company,
      role: combined.role,
      warnings: [
        ...(combined.warnings ?? []),
        "图片中未识别到明确的轮次标记，已按上传顺序分轮（一面/二面…），可在预览中重命名或移动题目",
      ],
      rounds: perImageRounds,
    };
  }

  return combined;
}
