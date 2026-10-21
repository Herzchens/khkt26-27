import assert from "node:assert/strict";
import test from "node:test";
import {
  completeSceneStopMotion,
  sceneTrainLayout,
  sceneTrainScale,
  sceneViewBoxForZoom,
  sceneRestStopForPhase,
  SCENE_REST_STATION_X,
  SCENE_TRAIN_ARRIVAL_X,
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

test("every carriage remains inside travel, rest, and terminal views at supported zoom levels", () => {
  assert.equal(sceneViewBoxForZoom(1.5, false), "150 70 600 280");
  assert.equal(sceneViewBoxForZoom(1.5, true), "300 70 600 280");

  for (let count = 1; count <= 6; count += 1) {
    const engineX = 450 + count * 32;
    const train = sceneTrainLayout(engineX, count);
    const leftExtent = count * 64 + 34;
    assert.ok(train.travelX < SCENE_REST_STATION_X, `${count} cars keep a forward approach`);
    assert.ok(train.travelX >= leftExtent, `${count} cars fit the unzoomed travel view`);

    for (const zoom of [1, 1.25, 1.5]) {
      const restView = sceneViewBoxForZoom(zoom, false).split(" ").map(Number);
      const restLeft = restView[0];
      const restRight = restLeft + restView[2];
      const travelScale = sceneTrainScale(count, train.travelX, restLeft);
      const travelTail = train.travelX - leftExtent * travelScale;
      const restTail = SCENE_REST_STATION_X - leftExtent * travelScale;
      assert.ok(travelTail >= restLeft - 0.001, `${count} cars at travel zoom ${zoom}`);
      assert.ok(restTail >= restLeft - 0.001, `${count} cars at the centered rest stop at zoom ${zoom}`);
      assert.ok(SCENE_REST_STATION_X + 49 <= restRight, `${count} cars keep the rest engine visible at zoom ${zoom}`);

      const terminalView = sceneViewBoxForZoom(zoom, true).split(" ").map(Number);
      const terminalLeft = terminalView[0];
      const terminalRight = terminalLeft + terminalView[2];
      const terminalScale = sceneTrainScale(count, SCENE_TRAIN_ARRIVAL_X, terminalLeft);
      const terminalTail = SCENE_TRAIN_ARRIVAL_X - leftExtent * terminalScale;
      assert.ok(terminalTail >= terminalLeft - 0.001, `${count} cars at the terminal at zoom ${zoom}`);
      assert.ok(SCENE_TRAIN_ARRIVAL_X + 49 <= terminalRight, `${count} cars keep the terminal engine visible at zoom ${zoom}`);
    }
  }
});
