import type { ZodType, ZodTypeDef } from "zod";

export type Role = "system" | "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface LlmOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface JsonLlmOptions<T = unknown> extends LlmOptions {
  schema?: ZodType<T, ZodTypeDef, any>;
}
