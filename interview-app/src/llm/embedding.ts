import OpenAI from "openai";

let client: OpenAI | null = null;

export const EMBEDDING_DIM = 1024;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.SILICONFLOW_API_KEY,
      baseURL: process.env.SILICONFLOW_BASE_URL || "https://api.siliconflow.cn/v1",
    });
  }
  return client;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const c = getClient();
  const model = process.env.EMBEDDING_MODEL || "BAAI/bge-m3";
  const res = await c.embeddings.create({ model, input: texts });
  const sorted = [...res.data].sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}

export async function embedText(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  return v;
}
