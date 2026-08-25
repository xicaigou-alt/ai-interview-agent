import { NextResponse } from "next/server";
import { listItems } from "@/db/repositories/interview_items";
import type { SourceType } from "@/core/engine-types";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sourceType = searchParams.get("source_type") as SourceType | null;

    const items = listItems(sourceType ? { sourceType } : {});
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
