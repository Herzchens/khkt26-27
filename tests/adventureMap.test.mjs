import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { mapGeometry, stopIndices } from "../src/adventure/mapGeometry.ts";
import {
  mapFogApertureScale,
  mapFogBlobPath,
  mapFogBlobPoints,
  mapFogMotionShouldRun,
} from "../src/adventure/mapFogGeometry.ts";
import * as mapFogGeometry from "../src/adventure/mapFogGeometry.ts";
import { studyTopics } from "../backend/src/adventure/topics.ts";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
let vite;
let TopDownMap;

test.before(async () => {
  vite = await createServer({
    configFile: resolve(projectRoot, "vite.config.ts"),
    cacheDir: resolve(projectRoot, "node_modules/.vite-map-tests"),
    appType: "custom",
    logLevel: "silent",
    server: { middlewareMode: true },
  });
  ({ TopDownMap } = await vite.ssrLoadModule("/src/adventure/TopDownMap.tsx"));
});

test.after(async () => {
  await vite?.close();
});

test("six carriages fit behind the engine at the first station", () => {
  const geometry = mapGeometry();
  const start = geometry.distances[stopIndices[0]];
  for (let i = 0; i <= 6; i++) {
    const p = geometry.position(start - i * 49);
    assert.ok(p.x > 25 && p.x < 1100);
    assert.equal(p.y, 505);
  }
});
test("both branches visit the same five stations with different tracks", () => {
  const mountain = mapGeometry("mountain"),
    coast = mapGeometry("coast");
  assert.notEqual(mountain.path, coast.path);
  for (const index of stopIndices) {
    for (const geometry of [mountain, coast]) {
      const p = geometry.position(geometry.distances[index]);
      assert.deepEqual([p.x, p.y], mountain.route[index]);
      assert.ok(Number.isFinite(p.angle));
    }
  }
  assert.equal(mountain.position(-100).x, 35);
  assert.equal(coast.position(Infinity).x, 965);
});

test("map railway layers share one continuous route and unopened station names stay hidden", () => {
  const markup = renderToStaticMarkup(
    React.createElement(TopDownMap, {
      journey: { branch: "mountain", station: 0, remaining: 0, threshold: 1800 },
      carriages: [{ id: "guest", name: "Toa Mây", color: "#398575" }],
      ownId: "guest",
    }),
  );
  const rails = [...markup.matchAll(/<path class="map-rail-layer[^"]*" d="([^"]+)"/gu)];

  assert.equal(rails.length, 4, "the bed, tie, rail and highlight strokes render");
  assert.ok(rails.every(([, d]) => d === rails[0][1]), "each rail layer follows the same route");
  assert.match(rails[0][1], /^M35 505 L350 505/u);
  assert.match(markup, /Ga Khởi đầu/u);
  assert.doesNotMatch(markup, /Đồng cỏ Gió|Rừng Sương mù|Đèo Ánh sao|Thành phố Bình minh/u);
});

test("one opaque mist cover hides unrevealed map under a soft aperture mask", () => {
  const markup = renderToStaticMarkup(
    React.createElement(TopDownMap, {
      journey: { branch: "coast", station: 0, remaining: 0, threshold: 1800 },
      carriages: [{ id: "guest", name: "Toa Mây", color: "#398575" }],
      ownId: "guest",
    }),
  );
  assert.match(markup, /class="map-fog-cover"[^>]*mask="url\(#.+-apertures\)"/u);
  assert.match(markup, /class="map-fog-layer"/u);
  assert.doesNotMatch(markup, /cartoon-cloud-body|map-cloud-shape/u);
  assert.match(markup, /map-fog-wisp/u);
  assert.match(markup, /<radialGradient[^>]*r="50%"[^>]*>[\s\S]*?<stop offset="100%" stop-color="#000" stop-opacity="0"/u);
  assert.match(markup, /stop-color="#000" stop-opacity="1"/u);
  assert.match(markup, /filterUnits="objectBoundingBox"/u);
  assert.equal([...markup.matchAll(/<path filter="url\(#[^"]+-mist-blur\)"/gu)].length, 3);
});

test("fog apertures are deterministic and reveal only inside each node's approach window", () => {
  assert.equal(mapFogApertureScale(0.2, 0.5), 0);
  assert.ok(Math.abs(mapFogApertureScale(0.49, 0.5) - 0.5) < 1e-12);
  assert.equal(mapFogApertureScale(0.5, 0.5), 1);
  assert.equal(mapFogApertureScale(0.9, 0.5), 1);
  assert.equal(mapFogApertureScale(Number.NaN, 0.5), 0);

  const first = mapFogBlobPoints("5-3");
  assert.deepEqual(mapFogBlobPoints("5-3"), first, "the same map node keeps the same edge shape");
  assert.notDeepEqual(mapFogBlobPoints("5-3"), mapFogBlobPoints("5-4"));
  assert.equal(first.length, 16);
  assert.match(mapFogBlobPath("5-3"), /\bZ$/u);
  for (const point of first) {
    const radius = Math.hypot(point.x, point.y);
    assert.ok(radius >= 0.86 && radius <= 1.15, "organic boundary stays within bounded radius");
  }
});

test("fog motion pauses offscreen, when hidden, and for reduced motion", () => {
  assert.equal(mapFogMotionShouldRun(true, true, false), true);
  assert.equal(mapFogMotionShouldRun(false, true, false), false);
  assert.equal(mapFogMotionShouldRun(true, false, false), false);
  assert.equal(mapFogMotionShouldRun(true, true, true), false);
});

test("the final progress window fades the complete fog cover and clamps safely", () => {
  const { mapFogLayerOpacity } = mapFogGeometry;
  assert.equal(typeof mapFogLayerOpacity, "function", "fog coverage exposes a completion fade helper");
  assert.equal(mapFogLayerOpacity(0), 1);
  assert.equal(mapFogLayerOpacity(-1), 1);
  assert.equal(mapFogLayerOpacity(0.98), 1);
  assert.ok(Math.abs(mapFogLayerOpacity(0.99) - 0.5) < 1e-12);
  assert.equal(mapFogLayerOpacity(1), 0);
  assert.equal(mapFogLayerOpacity(2), 0);
  assert.equal(mapFogLayerOpacity(Number.NaN), 1);

  const markup = renderToStaticMarkup(
    React.createElement(TopDownMap, {
      journey: { branch: "mountain", station: 4, remaining: 0, threshold: 1800 },
      carriages: [{ id: "guest", name: "Toa Mây", color: "#398575" }],
      ownId: "guest",
    }),
  );
  assert.match(markup, /class="map-fog-layer"[^>]*style="opacity:0"/u);
});

test("fog reveal nodes cover both branches and reveal progressively", () => {
  for (const branch of ["mountain", "coast"]) {
    const geometry = mapGeometry(branch);
    assert.equal(geometry.clouds.length, 63);
    for (const cloud of geometry.clouds) {
      assert.ok(Number.isFinite(cloud.x) && Number.isFinite(cloud.y));
      assert.ok(cloud.x >= -65 && cloud.x <= 1185);
      assert.ok(cloud.y >= -49 && cloud.y <= 619);
      assert.ok(cloud.clearsAt >= 0 && cloud.clearsAt <= 1);
      assert.equal(mapFogApertureScale(1, cloud.clearsAt), 1, "every reveal node is open at completion");
    }
    const startTail = geometry.clouds.find((cloud) => cloud.row === 5 && cloud.column === 0);
    const startStation = geometry.clouds.find((cloud) => cloud.row === 5 && cloud.column === 3);
    assert.equal(startTail?.clearsAt, 0, "the already traveled tail starts clear");
    assert.equal(startStation?.clearsAt, 0, "clouds around the starting station start clear");

    // Every newly revealed cloud is connected to the starting station; no
    // previously unseen patch can clear on its own behind a route bend.
    for (const progress of [0.2, 0.4, 0.6, 0.8, 1]) {
      const revealed = geometry.clouds.filter((cloud) => cloud.clearsAt <= progress);
      const remaining = new Set(revealed.map((cloud) => cloud.id));
      const start = revealed.find((cloud) => cloud.clearsAt === 0);
      assert.ok(start);
      const queue = [start];
      remaining.delete(start.id);
      while (queue.length) {
        const current = queue.shift();
        for (const neighbor of revealed) {
          if (
            remaining.has(neighbor.id) &&
            Math.abs(neighbor.row - current.row) + Math.abs(neighbor.column - current.column) === 1
          ) {
            remaining.delete(neighbor.id);
            queue.push(neighbor);
          }
        }
      }
      assert.equal(remaining.size, 0, `${branch} reveal at ${progress} is connected`);
    }
  }
  assert.notDeepEqual(mapGeometry("mountain").clouds, mapGeometry("coast").clouds);
});
test("every study topic has unique valid metadata", () => {
  assert.equal(studyTopics.length, 12);
  assert.equal(new Set(studyTopics.map((t) => t.id)).size, 12);
  for (const topic of studyTopics) {
    assert.match(topic.id, /^[a-z0-9-]+$/);
    assert.ok(topic.name.trim());
    assert.ok(topic.icon.trim());
  }
});
