import { z } from "zod";

export const STUDY_GUIDE_BODY_LIMIT_BYTES = 20 * 1024;

export const studyGuideRequestSchema = z.object({
  topic: z.string().trim().min(1).max(100),
  prompt: z.string().trim().min(10).max(4000),
  goal: z.string().trim().min(1).max(500).optional(),
}).strict();

export type StudyGuideInput = z.infer<typeof studyGuideRequestSchema>;

export const studyGuideResponseSchema = z.object({
  title: z.string().trim().min(1).max(120),
  text: z.string().trim().min(100).max(20_000).refine(
    text => /giả định[\s\S]{0,120}(?:kiểm chứng|xác minh)/iu.test(text),
    "Study guide must include an assumptions and verification section",
  ),
}).strict();

export const studyGuideResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "text"],
  properties: {
    title: { type: "string" },
    text: { type: "string" },
  },
};
