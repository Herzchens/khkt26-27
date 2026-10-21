import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
let vite;
let BoardingTicket;
let JourneyView;

before(async () => {
  vite = await createServer({
    configFile: resolve(projectRoot, "vite.config.ts"),
    cacheDir: resolve(projectRoot, "node_modules/.vite-ticket-tests"),
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  ({ BoardingTicket } = await vite.ssrLoadModule("/src/adventure/BoardingTicket.tsx"));
  ({ JourneyView } = await vite.ssrLoadModule("/src/adventure/JourneyView.tsx"));
});

after(async () => {
  await vite?.close();
});

const boardingTicket = (overrides = {}) => renderToStaticMarkup(
  React.createElement(BoardingTicket, {
    goal: "Review cell structure",
    topicName: "Biology",
    minutes: 45,
    breakCount: 2,
    breakMinutes: 5,
    station: "Rừng Sương mù",
    branch: "coast",
    carriageName: "Toa Mây",
    mode: "group",
    ...overrides,
  }),
);

test("boarding pass keeps the goal, route, and planned time on a concise ticket", () => {
  const markup = boardingTicket({ tripCode: "V-ABCDEF012345" });

  assert.match(markup, /Review cell structure/u);
  assert.match(markup, /Biology/u);
  assert.match(markup, /Toa Mây/u);
  assert.match(markup, /45 phút/u);
  assert.match(markup, /10 phút/u);
  assert.match(markup, /2 lần × 5 phút/u);
  assert.match(markup, /55 phút/u);
  assert.match(markup, /Rừng Sương mù/u);
  assert.match(markup, /Ven biển/u);
  assert.match(markup, /Cùng đoàn/u);
  assert.match(markup, /V-ABCDEF012345/u);
  assert.doesNotMatch(markup, /Kết thúc phiên|Nghỉ xen kẽ/u);
  assert.doesNotMatch(markup, /Thành phố Bình minh/u);
});

test("boarding pass shows the honest pending code copy unless given a valid history code", () => {
  for (const tripCode of [undefined, "V-abcdef012345", "V-ABCDEF01234"]) {
    const markup = boardingTicket({ tripCode });

    assert.match(markup, /Chờ cấp mã chuyến/u);
    assert.doesNotMatch(markup, /V-(?:abcdef012345|ABCDEF01234)/u);
  }
});

test("boarding pass shows no planned break time when the plan has no breaks", () => {
  const markup = boardingTicket({ minutes: 25, breakCount: 0 });

  assert.match(markup, /25 phút/u);
  assert.match(markup, /Không nghỉ/u);
  assert.doesNotMatch(markup, /lượt nghỉ/u);
});

test("boarding pass handles invalid duration and break values without exposing NaN", () => {
  const markup = boardingTicket({ minutes: Number.NaN, breakCount: 2, breakMinutes: Number.NaN });

  assert.doesNotMatch(markup, /NaN|Infinity/u);
  assert.match(markup, /Cần kiểm tra/u);
});

test("journey view uses the map and active 2D scene without exposing a 3D switch", () => {
  const props = {
    journey: undefined,
    carriages: [{ id: "guest", name: "Toa Mây", color: "#398575" }],
    ownId: "guest",
  };
  const mapMarkup = renderToStaticMarkup(React.createElement(JourneyView, props));
  const focusMarkup = renderToStaticMarkup(React.createElement(JourneyView, {
    ...props,
    focusState: "focus",
  }));

  assert.match(mapMarkup, /Bản đồ tiến trình từ trên xuống/u);
  assert.match(focusMarkup, /Cảnh tàu 2D nhìn thẳng từ trên xuống/u);
  for (const markup of [mapMarkup, focusMarkup]) {
    assert.doesNotMatch(markup, /camera-switch|scene-3d|train-canvas|Cảnh 3D/u);
  }
});
