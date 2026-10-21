import assert from "node:assert/strict";
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
});

test("focus scenery keeps the country sky clear of fog-covering clouds", () => {
  const markup = sceneMarkup({ running: true });

  assert.doesNotMatch(markup, /cartoon-cloud-body|travel-cloud-cover/u);
  assert.equal([...markup.matchAll(/class="scene-sky-cloud"/gu)].length, 2);
});
