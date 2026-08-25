import { NextResponse } from "next/server";
import { deleteItem } from "@/db/repositories/interview_items";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const itemId = Number(id);
    if (!Number.isInteger(itemId)) {
      return NextResponse.json({ error: "无效的 id" }, { status: 400 });
    }

    deleteItem(itemId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
