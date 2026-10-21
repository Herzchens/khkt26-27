import { describe, expect, it } from "vitest";
import { studyGuideRequestSchema, studyGuideResponseSchema } from "../src/studyGuideSchemas.js";

describe("study guide request contract", () => {
  it("accepts prompt-only requests and trims their bounded fields", () => {
    expect(studyGuideRequestSchema.parse({
      topic: " biology ",
      prompt: "  Explain photosynthesis for a beginner.  ",
      goal: "  Prepare for a biology exam.  ",
    })).toEqual({
      topic: "biology",
      prompt: "Explain photosynthesis for a beginner.",
      goal: "Prepare for a biology exam.",
    });
  });

  it.each([
    { topic: "", prompt: "Explain photosynthesis for a beginner." },
    { topic: "biology", prompt: "short" },
    { topic: "biology", prompt: "x".repeat(4001) },
    { topic: "x".repeat(101), prompt: "Explain photosynthesis for a beginner." },
    { topic: "biology", prompt: "Explain photosynthesis for a beginner.", goal: "x".repeat(501) },
    { topic: "biology", prompt: "Explain photosynthesis for a beginner.", extra: true },
  ])("rejects invalid prompt request %j", input => {
    expect(studyGuideRequestSchema.safeParse(input).success).toBe(false);
  });
});

describe("study guide response contract", () => {
  it("bounds the title and editable Markdown body", () => {
    expect(studyGuideResponseSchema.safeParse({
      title: "Biology review",
      text: `## Ý chính\n${"x".repeat(80)}\n## Giả định và điểm cần kiểm chứng\nĐối chiếu với giáo trình.`,
    }).success).toBe(true);
    expect(studyGuideResponseSchema.safeParse({
      title: "x".repeat(121),
      text: "x".repeat(100),
    }).success).toBe(false);
    expect(studyGuideResponseSchema.safeParse({
      title: "Biology review",
      text: `## Giả định và điểm cần kiểm chứng\n${"x".repeat(20_001)}`,
    }).success).toBe(false);
    expect(studyGuideResponseSchema.safeParse({
      title: "Biology review",
      text: `## Ý chính\n${"x".repeat(100)}`,
    }).success).toBe(false);
  });
});
