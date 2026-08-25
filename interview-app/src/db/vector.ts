import { db } from "./client";
import { cosine } from "./cosine";

export { cosine };

export function upsertItemEmbedding(itemId: number, embedding: number[]): void {
  db.prepare("UPDATE interview_items SET embedding = ? WHERE id = ?").run(
    JSON.stringify(embedding),
    itemId,
  );
}

// 暴力余弦检索：V1 规模（几十~几百条）完全够用；后续可在同一接口后换成 sqlite-vec
export function searchItemEmbeddings(
  query: number[],
  limit = 10,
): { id: number; score: number }[] {
  const rows = db
    .prepare("SELECT id, embedding FROM interview_items WHERE embedding IS NOT NULL")
    .all() as { id: number; embedding: string }[];

  const scored = rows.map((r) => {
    let emb: number[] = [];
    try {
      emb = JSON.parse(r.embedding) as number[];
    } catch {
      emb = [];
    }
    return { id: r.id, score: cosine(query, emb) };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
