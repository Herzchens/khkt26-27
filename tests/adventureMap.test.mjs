import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { mapGeometry, stopIndices } from "../src/adventure/mapGeometry.ts";
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

test("the map keeps every unexplored cloud an opaque rendered layer", () => {
  const markup = renderToStaticMarkup(
    React.createElement(TopDownMap, {
      journey: { branch: "coast", station: 0, remaining: 0, threshold: 1800 },
      carriages: [{ id: "guest", name: "Toa Mây", color: "#398575" }],
      ownId: "guest",
    }),
  );
  const opaqueClouds = [...markup.matchAll(/<path class="cartoon-cloud-body"[^>]*fill-opacity="1"/gu)];

  assert.equal(opaqueClouds.length, 63);
});

test("opaque cloud grid covers both branches and reveals progressively", () => {
  for (const branch of ["mountain", "coast"]) {
    const geometry = mapGeometry(branch);
    assert.equal(geometry.clouds.length, 63);
    for (const cloud of geometry.clouds) {
      assert.ok(Number.isFinite(cloud.x) && Number.isFinite(cloud.y));
      assert.ok(cloud.x >= -65 && cloud.x <= 1185);
      assert.ok(cloud.y >= -49 && cloud.y <= 619);
      assert.ok(cloud.clearsAt >= 0 && cloud.clearsAt <= 1);
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
