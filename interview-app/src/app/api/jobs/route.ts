import { NextResponse } from "next/server";
import { listJobs } from "@/db/repositories/jobs";

export const runtime = "nodejs";

export async function GET() {
  try {
    const jobs = listJobs().map((j) => ({
      id: j.id,
      company: j.company,
      role: j.role,
      createdAt: j.createdAt,
    }));
    return NextResponse.json({ jobs });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
