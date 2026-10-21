import { afterEach, describe, expect, it, vi } from "vitest";
const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@google/genai", async importOriginal => {
  const original = await importOriginal<typeof import("@google/genai")>();
  return { ...original, GoogleGenAI: class { models = { generateContent }; } };
});
import { config } from "../src/config.js";
import { generateStudyGuide, STUDY_GUIDE_SYSTEM_INSTRUCTION } from "../src/studyGuide.js";
import { studyGuideResponseJsonSchema } from "../src/studyGuideSchemas.js";

const input = {
  topic: "biology",
  prompt: "Explain photosynthesis for a beginner.",
  goal: "Prepare for a biology exam.",
};
const draft = {
  title: "Ôn tập quang hợp",
  text: `## Ý chính\n${"Quang hợp chuyển năng lượng ánh sáng thành năng lượng hóa học. ".repeat(4)}\n## Giả định và điểm cần kiểm chứng\nĐối chiếu với giáo trình của lớp.`,
};
const originalKey = config.GEMINI_API_KEY;
const originalModel = config.GEMINI_MODEL;
const originalFallbackModel = config.GEMINI_FALLBACK_MODEL;

afterEach(() => {
  config.GEMINI_API_KEY = originalKey;
  config.GEMINI_MODEL = originalModel;
  config.GEMINI_FALLBACK_MODEL = originalFallbackModel;
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe("prompt-generated study guide", () => {
  it("uses the configured Gemini model and returns a bounded editable draft", async () => {
    config.GEMINI_API_KEY = "test-only-private-key";
    generateContent.mockResolvedValue({ text: JSON.stringify(draft) });

    await expect(generateStudyGuide(input)).resolves.toEqual(draft);
    const request = generateContent.mock.calls[0][0];
    expect(request.model).toBe(config.GEMINI_MODEL);
    expect(request.config.responseMimeType).toBe("application/json");
    expect(request.config.responseJsonSchema).toEqual(studyGuideResponseJsonSchema);
    expect(request.config.systemInstruction).toBe(STUDY_GUIDE_SYSTEM_INSTRUCTION);
    expect(request.config.systemInstruction).toMatch(/không.*trích dẫn.*bịa|không.*bịa.*trích dẫn/iu);
    expect(request.config.systemInstruction).toMatch(/gia sư|người hướng dẫn/iu);
    expect(request.config.systemInstruction).toMatch(/từng bước|chia nhỏ|đoạn ngắn/iu);
    expect(request.config.systemInstruction).toMatch(/câu hỏi tự luyện/iu);
    expect(request.config.systemInstruction).toMatch(/\$H_2O\$/u);
    expect(request.config.abortSignal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(request.contents)).toEqual({ studyGuideRequest: input });
    expect(JSON.stringify(request)).not.toContain("test-only-private-key");
  });

  it("rejects oversized or malformed provider output without exposing provider data", async () => {
    config.GEMINI_API_KEY = "test-only-private-key";
    generateContent.mockResolvedValue({ text: JSON.stringify({ ...draft, text: "x".repeat(20_001) }) });

    await expect(generateStudyGuide(input)).rejects.toMatchObject({
      status: 502,
      kind: "invalid-ai-output",
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("rejects guide output that omits the assumptions and verification section", async () => {
    config.GEMINI_API_KEY = "test-only-private-key";
    generateContent.mockResolvedValue({
      text: JSON.stringify({
        title: draft.title,
        text: `## Ý chính\n${"Quang hợp chuyển năng lượng ánh sáng thành năng lượng hóa học. ".repeat(3)}`,
      }),
    });

    await expect(generateStudyGuide(input)).rejects.toMatchObject({
      status: 502,
      kind: "invalid-ai-output",
    });
  });

  it("maps provider quota errors to a safe retryable API error", async () => {
    config.GEMINI_API_KEY = "test-only-private-key";
    config.GEMINI_MODEL = "primary-model";
    config.GEMINI_FALLBACK_MODEL = "fallback-model";
    generateContent.mockRejectedValue({ status: 429, message: "private provider details" });

    await expect(generateStudyGuide(input)).rejects.toMatchObject({
      status: 429,
      kind: "provider-quota-exceeded",
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("aborts a stalled primary at 30 seconds and gives fallback only the remaining overall budget", async () => {
    config.GEMINI_API_KEY = "test-only-private-key";
    config.GEMINI_MODEL = "primary-model";
    config.GEMINI_FALLBACK_MODEL = "fallback-model";
    vi.useFakeTimers();
    let primarySignal: AbortSignal | undefined;
    generateContent
      .mockImplementationOnce(request => new Promise((_resolve, reject) => {
        primarySignal = request.config.abortSignal as AbortSignal;
        primarySignal.addEventListener("abort", () => reject(new Error("primary aborted")), { once: true });
      }))
      .mockResolvedValueOnce({ text: JSON.stringify(draft) });

    const pending = generateStudyGuide(input);
    await vi.advanceTimersByTimeAsync(30_000);

    expect(primarySignal?.aborted).toBe(true);
    await expect(pending).resolves.toEqual(draft);
    const primary = generateContent.mock.calls[0][0];
    const fallback = generateContent.mock.calls[1][0];
    expect(primary.config.httpOptions.timeout).toBe(30_000);
    expect(fallback.config.httpOptions.timeout).toBeLessThanOrEqual(60_000);
    expect(fallback.config.httpOptions.timeout).toBeGreaterThan(0);
    expect(fallback.config.abortSignal).not.toBe(primarySignal);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it.each([
    { status: 503, code: "UNAVAILABLE", message: "overloaded" },
    { status: 408, message: "request timeout" },
    { status: 504, code: "DEADLINE_EXCEEDED", message: "deadline" },
  ])("tries fallback after a primary timeout or overload ($status)", async providerError => {
    config.GEMINI_API_KEY = "test-only-private-key";
    config.GEMINI_MODEL = "primary-model";
    config.GEMINI_FALLBACK_MODEL = "fallback-model";
    generateContent
      .mockRejectedValueOnce(providerError)
      .mockResolvedValueOnce({ text: JSON.stringify(draft) });

    await expect(generateStudyGuide(input)).resolves.toEqual(draft);
    expect(generateContent.mock.calls.map(([request]) => request.model)).toEqual([
      "primary-model", "fallback-model",
    ]);
    expect(generateContent.mock.calls[0][0].config.httpOptions.timeout).toBeLessThanOrEqual(30_000);
    expect(generateContent.mock.calls[1][0].config.httpOptions.timeout).toBeLessThanOrEqual(90_000);
  });

  it("returns 499 on caller cancellation without starting a fallback", async () => {
    config.GEMINI_API_KEY = "test-only-private-key";
    config.GEMINI_MODEL = "primary-model";
    config.GEMINI_FALLBACK_MODEL = "fallback-model";
    const caller = new AbortController();
    let primarySignal: AbortSignal | undefined;
    generateContent.mockImplementationOnce(request => new Promise((_resolve, reject) => {
      primarySignal = request.config.abortSignal as AbortSignal;
      primarySignal.addEventListener("abort", () => reject(new Error("primary aborted")), { once: true });
    }));

    const pending = generateStudyGuide(input, caller.signal);
    const cancelled = expect(pending).rejects.toMatchObject({ status: 499, kind: "request-cancelled" });
    caller.abort();

    await cancelled;
    expect(primarySignal?.aborted).toBe(true);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("does not retry configuration errors", async () => {
    config.GEMINI_API_KEY = "test-only-private-key";
    config.GEMINI_MODEL = "primary-model";
    config.GEMINI_FALLBACK_MODEL = "fallback-model";
    generateContent.mockRejectedValueOnce({ status: 400, message: "private provider details" });

    await expect(generateStudyGuide(input)).rejects.toMatchObject({
      status: 502,
      kind: "provider-configuration-error",
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("does not retry provider authentication errors", async () => {
    config.GEMINI_API_KEY = "test-only-private-key";
    config.GEMINI_MODEL = "primary-model";
    config.GEMINI_FALLBACK_MODEL = "fallback-model";
    generateContent.mockRejectedValueOnce({ status: 403, code: "PERMISSION_DENIED", message: "private provider details" });

    await expect(generateStudyGuide(input)).rejects.toMatchObject({
      status: 502,
      kind: "provider-authentication-failed",
    });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("does not retry when the primary times out and the fallback names the same model", async () => {
    config.GEMINI_API_KEY = "test-only-private-key";
    config.GEMINI_MODEL = "same-model";
    config.GEMINI_FALLBACK_MODEL = "same-model";
    vi.useFakeTimers();
    generateContent.mockImplementationOnce(request => new Promise((_resolve, reject) => {
      const signal = request.config.abortSignal as AbortSignal;
      signal.addEventListener("abort", () => reject(new Error("primary aborted")), { once: true });
    }));

    const pending = generateStudyGuide(input);
    const timedOut = expect(pending).rejects.toMatchObject({ status: 504, kind: "upstream-timeout" });
    await vi.advanceTimersByTimeAsync(30_000);

    await timedOut;
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("does not contact Gemini when the request was already cancelled or the key is missing", async () => {
    config.GEMINI_API_KEY = undefined;
    await expect(generateStudyGuide(input)).rejects.toMatchObject({ status: 503 });
    config.GEMINI_API_KEY = "test-only-private-key";
    const controller = new AbortController();
    controller.abort();
    await expect(generateStudyGuide(input, controller.signal)).rejects.toMatchObject({ status: 499 });
    expect(generateContent).not.toHaveBeenCalled();
  });
});
