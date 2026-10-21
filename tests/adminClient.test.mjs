import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

function client(getAccessToken) {
  const source = readFileSync(new URL("../src/services/admin.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  class ApiError extends Error {
    constructor(status, message) { super(message); this.status = status; }
  }
  const mod = { exports: {} };
  new Function("require", "module", "exports", compiled)(() => ({ API_URL: "https://api.example.invalid", ApiError, getAccessToken }), mod, mod.exports);
  return mod.exports;
}

test("a cancelled admin export sends no request and an in-flight export follows its cancellation signal", async () => {
  const api = client(async () => "test-token");
  let fetched = false;
  globalThis.fetch = async () => { fetched = true; throw new Error("Must not fetch"); };
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(api.exportAdminReport(7, cancelled.signal), { name: "AbortError" });
  assert.equal(fetched, false);

  let started;
  const requestStarted = new Promise(resolve => { started = resolve; });
  globalThis.fetch = (_url, init) => new Promise((_resolve, reject) => {
    started();
    init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
  });
  const controller = new AbortController();
  const pending = api.exportAdminReport(30, controller.signal);
  await requestStarted;
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("an account-token change prevents returning a downloaded admin report", async () => {
  let reads = 0;
  const api = client(async () => ++reads === 1 ? "old-test-token" : "new-test-token");
  globalThis.fetch = async () => new Response("private aggregate", { status: 200 });
  await assert.rejects(api.exportAdminReport(7), error => error.status === 409);
});

test("CSV export carries authorization and honors only a safe attachment filename", async () => {
  const api = client(async () => "test-token");
  globalThis.fetch = async (url, init) => {
    assert.match(url, /days=90$/);
    assert.equal(init.headers.Authorization, "Bearer test-token");
    assert.equal(init.cache, "no-store");
    return new Response("summary,12", { headers: { "Content-Disposition": 'attachment; filename="report-UTC.csv"' } });
  };
  const file = await api.exportAdminReport(90);
  assert.equal(file.filename, "report-UTC.csv");
  assert.equal(await file.blob.text(), "summary,12");
  globalThis.fetch = async () => new Response("csv", { headers: { "Content-Disposition": 'attachment; filename="../../report.csv"' } });
  assert.equal((await api.exportAdminReport(7)).filename, "viendu-admin-report-7d-UTC.csv");
});
