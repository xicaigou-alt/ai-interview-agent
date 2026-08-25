import { z } from "zod";

// ============ Resume / Candidate Profile（§9.2） ============

export const BasicInfoSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  yearsOfExperience: z.string().optional(),
  currentRole: z.string().optional(),
  targetRole: z.string().optional(),
});

export const EducationItemSchema = z.object({
  school: z.string(),
  degree: z.string(),
  major: z.string(),
  period: z.string().optional(),
});

export const ExperienceItemSchema = z.object({
  company: z.string(),
  role: z.string(),
  period: z.string().optional(),
  description: z.string(),
});

export const ProjectItemSchema = z.object({
  name: z.string(),
  role: z.string().optional(),
  description: z.string(),
  techStack: z.array(z.string()).optional(),
});

export const CandidateProfileSchema = z.object({
  basicInfo: BasicInfoSchema.optional(),
  education: z.array(EducationItemSchema).default([]),
  experience: z.array(ExperienceItemSchema).default([]),
  projects: z.array(ProjectItemSchema).default([]),
  skills: z.array(z.string()).default([]),
  aiExperience: z.array(z.string()).default([]),
  productExperience: z.array(z.string()).default([]),
  metrics: z.array(z.string()).default([]),
  strengths: z.array(z.string()).default([]),
  riskPoints: z.array(z.string()).default([]),
  followUpPoints: z.array(z.string()).default([]),
});

export type CandidateProfile = z.infer<typeof CandidateProfileSchema>;

// ============ Competency Model（§10.2） ============

export const CompetencySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

export const CompetencyCategorySchema = z.object({
  name: z.string(), // Product / AI / Technical / Business / Behavioral
  competencies: z.array(CompetencySchema).default([]),
});

export const CompetencyModelSchema = z.object({
  role: z.string(),
  company: z.string().optional(),
  categories: z.array(CompetencyCategorySchema).default([]),
  priorityRequirements: z.array(z.string()).default([]),
});

export type CompetencyModel = z.infer<typeof CompetencyModelSchema>;

// ============ Gap Analysis（§11） ============

export const GapResultSchema = z.object({
  strongMatch: z.array(z.string()).default([]),
  mediumMatch: z.array(z.string()).default([]),
  weakMatch: z.array(z.string()).default([]),
  missingCapabilities: z.array(z.string()).default([]),
  resumeRisks: z.array(z.string()).default([]),
  highPriorityTopics: z.array(z.string()).default([]),
});

export type GapResult = z.infer<typeof GapResultSchema>;
