import { NextResponse } from "next/server";
import { createSchedule, getDueReminders, listSchedules } from "@/db/repositories/schedule";
import { syncSchedulesToServer } from "@/lib/reminder-sync";

export const runtime = "nodejs";

export async function GET() {
  try {
    const schedules = listSchedules();
    const dueTomorrow = getDueReminders();
    return NextResponse.json({ schedules, dueTomorrow });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      company?: string;
      role?: string;
      interviewAt?: string;
      notes?: string;
    };
    const company = String(body.company ?? "").trim();
    const role = String(body.role ?? "").trim();
    const interviewAt = String(body.interviewAt ?? "").trim();
    if (!company || !role || !interviewAt) {
      return NextResponse.json({ error: "company / role / interviewAt 必填" }, { status: 400 });
    }

    const schedule = createSchedule({
      company,
      role,
      interviewAt,
      notes: body.notes ?? null,
    });
    void syncSchedulesToServer(listSchedules());
    return NextResponse.json({ schedule });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
