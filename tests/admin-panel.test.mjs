import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(resolve("src/adventure/AdminPanel.tsx"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
const panelModule = { exports: {} };
const panelRequire = (specifier) => {
  if (specifier === "./admin.css") return {};
  if (specifier === "../services/api") return { ApiError: class ApiError extends Error {} };
  if (specifier === "../services/admin") return {};
  return require(specifier);
};
new Function("require", "module", "exports", compiled)(panelRequire, panelModule, panelModule.exports);
const { AdminOverview } = panelModule.exports;

test("study indicators use actual non-break study time and handle an empty report", () => {
  assert.deepEqual(panelModule.exports.adminStudyIndicators({ actualStudySeconds: 0, focusedSeconds: 0, distractions: 0, sessionCount: 0 }), {
    focusPercent: null, distractionsPerHour: null, averageStudySeconds: null,
  });
  assert.deepEqual(panelModule.exports.adminStudyIndicators({ actualStudySeconds: 3600, focusedSeconds: 2700, distractions: 3, sessionCount: 2 }), {
    focusPercent: 75, distractionsPerHour: 3, averageStudySeconds: 1800,
  });
});

test("session rows from another account, group, period or page never carry over to a new selection", () => {
  const previous = { key: "7:account-a::0", rows: [{ id: "a-private-metrics" }], total: 1 };
  assert.deepEqual(panelModule.exports.adminRowsForKey(previous, previous.key), { rows: previous.rows, total: 1 });
  for (const key of ["7:account-b::0", "7::group-b:0", "30:account-a::0", "7:account-a::25"]) {
    assert.deepEqual(panelModule.exports.adminRowsForKey(previous, key), { rows: [], total: 0 });
  }
});

test("AdminOverview presents UTC usage, quiz coverage and topic trends on narrow layouts", () => {
  const report = {
    days: 7,
    timezone: "UTC",
    fromUtc: "2026-10-15T00:00:00.000Z",
    asOfUtc: "2026-10-21T12:00:00.000Z",
    matchingSessionCount: 1,
    recordsAnalyzed: 1,
    truncated: false,
    totals: {
      sessionCount: 1,
      plannedStudySeconds: 3600,
      actualStudySeconds: 1800,
      focusedSeconds: 1500,
      plannedBreakSeconds: 300,
      actualBreakSeconds: 300,
      distractions: 2,
      completedSessions: 0,
      completionPercent: 0,
      gradedQuizSessions: 1,
      quizCoveragePercent: 100,
      quizScore: 3,
      quizTotal: 5,
      quizScorePercent: 60,
    },
    daily: [{
      dateUtc: "2026-10-21",
      sessionCount: 1,
      plannedStudySeconds: 3600,
      actualStudySeconds: 1800,
      focusedSeconds: 1500,
      plannedBreakSeconds: 300,
      actualBreakSeconds: 300,
      distractions: 2,
      completedSessions: 0,
      completionPercent: 0,
      gradedQuizSessions: 1,
      quizCoveragePercent: 100,
      quizScore: 3,
      quizTotal: 5,
      quizScorePercent: 60,
    }],
    topics: [{
      topic: "biology",
      sessionCount: 1,
      plannedStudySeconds: 3600,
      actualStudySeconds: 1800,
      focusedSeconds: 1500,
      plannedBreakSeconds: 300,
      actualBreakSeconds: 300,
      distractions: 2,
      completedSessions: 0,
      completionPercent: 0,
      gradedQuizSessions: 1,
      quizCoveragePercent: 100,
      quizScore: 3,
      quizTotal: 5,
      quizScorePercent: 60,
    }],
  };
  const html = renderToStaticMarkup(React.createElement(AdminOverview, { report }));

  assert.match(html, /UTC/);
  assert.match(html, /Độ phủ quiz/);
  assert.match(html, /biology/);
  assert.match(html, /30 phút/);
  assert.match(html, /admin-overview-scroll/);
});
