import { understandImage } from "@/llm/vision";
import { parseJsonContent } from "@/llm/json";
import { extractTextFromImage } from "./ocr";
import { ImportedTextSchema, importText, type ImportResult } from "./import-text";

const VISION_PROMPT = `你是面试情报整理助手，擅长从面试经验截图中抽取、归一化、分类面试题。

请从这张截图（可能是小红书/牛客等平台的面试经验分享）中抽取所有面试题，做归一化、分类、去重，并按轮次切分（一张截图里可能包含多轮，也可能只有一轮）。

输出 JSON（camelCase）：
{
  "company": "公司名（若可推断，否则省略该字段）",
  "role": "岗位名（若可推断，否则省略该字段）",
  "warnings": ["需要注意的信息（没有则留空数组）"],
  "rounds": [
    {
      "round": "一面 / 二面 / 三面 / HR面 / 技术面 / 笔试 / 终面（若可推断，否则省略）",
      "summary": "该轮面试的整体感受/总结（若可推断，否则省略）",
      "questions": [
        {
          "question": "归一化后的完整问题",
          "questionType": "AI_KNOWLEDGE / RESUME_DEEP_DIVE / PRODUCT_DESIGN / BEHAVIORAL / JD_GAP",
          "topics": ["相关 topic"],
          "difficulty": "easy / medium / hard",
          "knowledgePoints": ["考察知识点"],
          "evaluationRubric": ["评价要点"]
        }
      ]
    }
  ]
}

要求：
1. 问题归一化成可直接提问的形式，去除「他问了我……」「然后聊了……」等叙述。
2. 同一轮内合并重复问题；按轮次标记把问题切分到对应轮次，无标记则归为一个轮次（round 省略）。
3. summary 属于该轮面试，没有就省略。
4. 只输出 JSON，不要任何额外文字。`;

// 从面试经验截图/图片中抽取面试题。
// 默认走 OCR 方案：图片 → 文本 → 复用文本导入管线（多轮/总结/警示自动生效），
// 不依赖 SiliconFlow 的 VL 视觉模型权限。如需切回视觉模型，设置环境变量 IMAGE_IMPORT_MODE=vision。
export async function importImage(imageDataUrl: string): Promise<ImportResult> {
  const mode = (process.env.IMAGE_IMPORT_MODE ?? "ocr").trim().toLowerCase();

  if (mode === "vision") {
    const raw = await understandImage(imageDataUrl, VISION_PROMPT);
    return parseJsonContent<ImportResult>(raw, ImportedTextSchema);
  }

  const text = await extractTextFromImage(imageDataUrl);
  if (!text) {
    return { rounds: [] };
  }
  return importText(text);
}
