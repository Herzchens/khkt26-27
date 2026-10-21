import assert from "node:assert/strict";
import test from "node:test";
import {
  completeSceneStopMotion,
  sceneRestStopForPhase,
  transitionSceneStop,
} from "../src/adventure/sceneMotion.ts";

test("the train transitions into a scheduled rest stop and departs when the break ends", () => {
  const arriving = transitionSceneStop("travelling", null, 1, true);
  assert.equal(arriving, "arriving");
  assert.equal(completeSceneStopMotion(arriving), "parked");

  const departing = transitionSceneStop("parked", 1, null, true);
  assert.equal(departing, "departing");
  assert.equal(completeSceneStopMotion(departing), "travelling");
});

test("rerenders within the same break do not replay the arrival animation", () => {
  assert.equal(transitionSceneStop("arriving", 1, 1, true), "arriving");
  assert.equal(transitionSceneStop("parked", 1, 1, true), "parked");
});

test("away or reduced-motion state lands at a stable station pose without animating", () => {
  assert.equal(transitionSceneStop("travelling", null, 1, false), "parked");
  assert.equal(transitionSceneStop("parked", 1, null, false), "travelling");
  assert.equal(transitionSceneStop("arriving", 1, 1, false), "parked");
});

test("the station remains visible for departure and clears after the train leaves", () => {
  const lastStop = { index: 2, count: 3 };

  assert.deepEqual(sceneRestStopForPhase(null, lastStop, "departing"), lastStop);
  assert.deepEqual(sceneRestStopForPhase(lastStop, null, "departing"), lastStop);
  assert.equal(sceneRestStopForPhase(null, lastStop, "travelling"), null);
});
