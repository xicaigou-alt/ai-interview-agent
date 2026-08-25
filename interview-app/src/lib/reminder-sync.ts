// 把本地面试日程上报到提醒服务器（方案 A：本地为主，仅日程上云）
// 失败静默：服务器不可达时不影响本地日程功能。

export interface ReminderSchedule {
  company: string;
  role: string;
  interviewAt: string;
}

// 纯函数：构建同步 payload（只保留提醒服务需要的三个字段，便于单测）
export function buildSchedulePayload(
  schedules: ReminderSchedule[],
): { schedules: ReminderSchedule[] } {
  return {
    schedules: schedules.map(({ company, role, interviewAt }) => ({ company, role, interviewAt })),
  };
}

export async function syncSchedulesToServer(schedules: ReminderSchedule[]): Promise<void> {
  const base = (process.env.REMINDER_SERVER_URL ?? "").replace(/\/$/, "");
  if (!base) return; // 未配置服务器则不同步

  try {
    await fetch(`${base}/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.REMINDER_AUTH_TOKEN
          ? { Authorization: `Bearer ${process.env.REMINDER_AUTH_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(buildSchedulePayload(schedules)),
    });
  } catch {
    // 静默：下次增删日程时再重试
  }
}
