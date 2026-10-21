import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
let vite;
let TopDownScene;

before(async () => {
  vite = await createServer({
    configFile: resolve(projectRoot, "vite.config.ts"),
    cacheDir: resolve(projectRoot, "node_modules/.vite-rest-stop-tests"),
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  ({ TopDownScene } = await vite.ssrLoadModule("/src/adventure/TopDownScene.tsx"));
});

after(async () => {
  await vite?.close();
});

const sceneMarkup = (overrides = {}) => renderToStaticMarkup(
  React.createElement(TopDownScene, {
    carriages: [{ id: "guest", name: "Toa Mây", color: "#398575" }],
    ownId: "guest",
    running: false,
    fogStrength: 0,
    exploration: 0.25,
    restStop: null,
    motionAllowed: true,
    ...overrides,
  }),
);

test("mounting during a scheduled break shows the train parked at a rest stop", () => {
  const markup = sceneMarkup({ restStop: { index: 1, count: 1 } });

  assert.match(markup, /data-stop-phase="parked"/u);
  assert.match(markup, /TRẠM NGHỈ/u);
  assert.match(markup, /data-rest-index="1"/u);
  assert.match(markup, /class="travel-rest-stop-position"[^>]*data-station-x="450"/u);
  assert.match(markup, /class="travel-train"[^>]*transform="translate\(450 210\) scale\(1\) translate\(-450 -210\)"/u);
});

test("the upcoming station approaches from offscreen right and centers as the break begins", () => {
  const twelveSeconds = sceneMarkup({ upcomingRestStop: { index: 1, count: 2, remainingSeconds: 12 } });
  const sixSeconds = sceneMarkup({ upcomingRestStop: { index: 1, count: 2, remainingSeconds: 6 } });
  const breakStart = sceneMarkup({
    restStop: { index: 1, count: 2 },
    upcomingRestStop: { index: 1, count: 2, remainingSeconds: 0 },
  });

  assert.match(twelveSeconds, /class="travel-rest-stop-position"[^>]*data-station-x="1050"/u);
  assert.match(twelveSeconds, /style="--station-shift:600px;--station-departure-shift:-600px"/u);
  assert.match(sixSeconds, /class="travel-rest-stop-position"[^>]*data-station-x="750"/u);
  assert.match(sixSeconds, /style="--station-shift:300px;--station-departure-shift:-600px"/u);
  assert.match(breakStart, /class="travel-rest-stop-position"[^>]*data-station-x="450"/u);
  assert.match(breakStart, /style="--station-shift:0px;--station-departure-shift:-600px"/u);
  assert.match(breakStart, /style="--travel-shift:0px;--rest-shift:0px;--arrival-shift:185px"/u);
});

test("the approach transition remains active through the parked position and respects reduced motion", async () => {
  const stylesheet = await readFile(resolve(projectRoot, "src/adventure/travelScene.css"), "utf8");

  assert.match(
    stylesheet,
    /\.travel-scene\[data-stop-motion="true"\] \.travel-rest-stop-position\[data-stop-phase="approaching"\]\s*,\s*\.travel-scene\[data-stop-motion="true"\] \.travel-rest-stop-position\[data-stop-phase="parked"\]\s*\{\s*transition:\s*transform 1000ms linear;\s*\}/u,
  );
  assert.match(
    stylesheet,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.travel-scene \.travel-rest-stop-position,[\s\S]*?transition:\s*none\s*!important;/u,
  );
});

test("six-car markup keeps the engine centered and applies the fitted uniform engine-pivot scale", () => {
  const carriages = Array.from({ length: 6 }, (_, index) => ({
    id: `guest-${index + 1}`,
    name: `Toa ${index + 1}`,
    color: "#398575",
  }));
  const markup = sceneMarkup({ carriages, ownId: "guest-1", running: true });

  assert.match(markup, /style="--travel-shift:0px;--rest-shift:0px;--arrival-shift:185px"/u);
  assert.match(markup, /class="travel-train" aria-label="Đoàn tàu nhìn từ trên xuống" transform="translate\(450 210\) scale\(1\) translate\(-450 -210\)" data-train-scale="1"/u);
  assert.equal([...markup.matchAll(/aria-label="Toa [1-6]:/gu)].length, 6);
});

test("a terminal scene parks at the right-hand destination without implying a rest break", () => {
  const markup = sceneMarkup({
    arrival: { label: "Chuyến học đã kết thúc", completed: true },
    restStop: { index: 1, count: 2 },
    running: true,
  });

  assert.match(markup, /data-moving="false"/u);
  assert.match(markup, /data-arrival-complete="true"/u);
  assert.match(markup, /class="travel-arrival-stop"[^>]*transform="translate\(780 18\)"/u);
  assert.match(markup, /style="--travel-shift:0px;--rest-shift:0px;--arrival-shift:185px"/u);
  assert.match(markup, /GA CUỐI/u);
  assert.doesNotMatch(markup, /data-rest-index=|TRẠM NGHỈ|1\/2/u);
});

test("an early terminal scene is labeled as a stop, not the final station", () => {
  const markup = sceneMarkup({
    arrival: { label: "Đã dừng học", completed: false },
  });

  assert.match(markup, /ĐIỂM DỪNG/u);
  assert.doesNotMatch(markup, /GA CUỐI/u);
  assert.doesNotMatch(markup, /data-rest-index=|TRẠM NGHỈ/u);
});

test("focus scenery keeps the country sky clear of fog-covering clouds", () => {
  const markup = sceneMarkup({ running: true });

  assert.doesNotMatch(markup, /cartoon-cloud-body|travel-cloud-cover/u);
  assert.equal([...markup.matchAll(/class="scene-sky-cloud"/gu)].length, 2);
});
