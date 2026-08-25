import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  let dbStatus = "ok";
  try {
    const { db } = await import("@/db/client");
    db.prepare("SELECT 1 AS x").get();
  } catch (e) {
    dbStatus = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    ok: dbStatus === "ok",
    db: dbStatus,
    deepseekKey: Boolean(process.env.DEEPSEEK_API_KEY),
    siliconflowKey: Boolean(process.env.SILICONFLOW_API_KEY),
  });
}
