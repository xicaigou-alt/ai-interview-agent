import { z } from "zod";

// ============ Source Type（§14） ============
export const SourceTypeSchema = z.enum([
  "MODEL_GENERATED",
  "REAL_INTERVIEW",
  "PERSONAL_REAL_INTERVIEW",
  "IMPORTED_INTERVIEW_EXPERIENCE",
  "SIMULATED_INTERVIEW",
  "CURATED",
]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

// ============ Interview Item（§13） ============
export const InterviewItemSchema = z.object({
  id: z.number().optional(),
  question: z.string(),
  company: z.string().optional(),
  role: z.string().optional(),
  department: z.string().optional(),
  stage: z.string().optional(),
  questionType: z.string().optional(),
  topics: z.array(z.string()).default([]),
  difficulty: z.string().optional(),
  sourceType: SourceTypeSchema,
  sourcePlatform: z.string().optional(),
  sourceUrl: z.string().optional(),
  qualityScore: z.number().optional(),
  confidence: z.number().optional(),
  knowledgePoints: z.array(z.string()).default([]),
  evaluationRubric: z.array(z.string()).default([]),
  importedId: z.number().optional(),
});
export type InterviewItem = z.infer<typeof InterviewItemSchema>;

// ============ Interview Plan（§18.2） ============
export const PlanSectionSchema = z.object({
  type: z.string(),
  weight: z.number(),
});

export const InterviewPlanSchema = z.object({
  durationMinutes: z.number().default(40),
  primaryQuestionTarget: z.number().default(10),
  difficulty: z.string().default("medium"),
  sections: z.array(PlanSectionSchema).default([]),
  priorityTopics: z.array(z.string()).default([]),
});
export type InterviewPlan = z.infer<typeof InterviewPlanSchema>;

// ============ Evaluation（§24.1） ============
export const EvaluationSchema = z.object({
  score: z.number(),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  missingPoints: z.array(z.string()).default([]),
  resumeRisks: z.array(z.string()).default([]),
  competencyUpdates: z
    .record(z.string(), z.object({ score: z.number(), verified: z.boolean() }))
    .optional(),
  followUpRecommendation: z.string().default(""),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

// ============ Decision（§25） ============
export const DecisionSchema = z.enum([
  "PASS",
  "CLARIFY",
  "DEEP_DIVE",
  "CHALLENGE",
  "COUNTERFACTUAL",
  "TECHNICAL",
  "DATA_VALIDATION",
  "OWNERSHIP_CHECK",
  "NEXT_QUESTION",
  "FINISH",
]);
export type Decision = z.infer<typeof DecisionSchema>;

export const DecisionResultSchema = z.object({
  decision: DecisionSchema,
  reasoning: z.string().default(""),
});
export type DecisionResult = z.infer<typeof DecisionResultSchema>;

// ============ Candidate State（§26） ============
export const CompetencyStateSchema = z.object({
  score: z.number(),
  verified: z.boolean(),
});

export const CandidateStateSchema = z.object({
  competencies: z.record(z.string(), CompetencyStateSchema).default({}),
  verifiedStrengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  knowledgeGaps: z.array(z.string()).default([]),
  resumeRisks: z.array(z.string()).default([]),
  communicationIssues: z.array(z.string()).default([]),
  inconsistencies: z.array(z.string()).default([]),
  coveredTopics: z.array(z.string()).default([]),
  remainingTopics: z.array(z.string()).default([]),
  difficulty: z.string().default("medium"),
});
export type CandidateState = z.infer<typeof CandidateStateSchema>;

export const EMPTY_CANDIDATE_STATE: CandidateState = {
  competencies: {},
  verifiedStrengths: [],
  weaknesses: [],
  knowledgeGaps: [],
  resumeRisks: [],
  communicationIssues: [],
  inconsistencies: [],
  coveredTopics: [],
  remainingTopics: [],
  difficulty: "medium",
};

// ============ Session Status ============
export const SessionStatus = {
  CREATED: "CREATED",
  ANALYZING: "ANALYZING",
  READY: "READY",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
} as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

// 由检索/生成得到的「主问题」；question 为未个性化的底题，交由 Interviewer 个性化
export interface PrimaryQuestion {
  question: string;
  questionType: string;
  topics: string[];
  sourceType: SourceType;
  sourceId: number | null;
}
