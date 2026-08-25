export function getEnv(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export function hasDeepSeekKey(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export function hasEmbeddingKey(): boolean {
  return Boolean(process.env.SILICONFLOW_API_KEY);
}
