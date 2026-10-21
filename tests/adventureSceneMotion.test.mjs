import assert from "node:assert/strict";
import test from "node:test";
import {
  completeSceneStopMotion,
  sceneTrainLayout,
  sceneTrainScale,
  sceneViewBoxForZoom,
  sceneRestStationPosition,
  sceneUpcomingRestStationX,
  sceneRestStopForPhase,
  SCENE_REST_STATION_X,
  SCENE_TRAIN_ARRIVAL_X,
  transitionSceneStop,
} from "../src/adventure/sceneMotion.ts";

test("the station settles at the centered engine when its scheduled break starts", () => {
  const parked = transitionSceneStop("travelling", null, 1, true);
  assert.equal(parked, "parked");
  assert.equal(completeSceneStopMotion(parked), "parked");

  const departing = transitionSceneStop("parked", 1, null, true);
  assert.equal(departing, "departing");
  assert.equal(completeSceneStopMotion(departing), "travelling");
});

test("rerenders within the same break keep the station centered without replaying motion", () => {
  assert.equal(transitionSceneStop("parked", 1, 1, true), "parked");
});

test("away or reduced-motion state lands at a stable station pose without animating", () => {
  assert.equal(transitionSceneStop("travelling", null, 1, false), "parked");
  assert.equal(transitionSceneStop("parked", 1, null, false), "travelling");
  assert.equal(transitionSceneStop("departing", 1, 1, false), "parked");
});

test("the station remains visible for departure and clears after the train leaves", () => {
  const lastStop = { index: 2, count: 3 };

  assert.deepEqual(sceneRestStopForPhase(null, lastStop, "departing"), lastStop);
  assert.deepEqual(sceneRestStopForPhase(lastStop, null, "departing"), lastStop);
  assert.equal(sceneRestStopForPhase(null, lastStop, "travelling"), null);
});

test("the engine stays at the viewport center in travel and terminal views at every supported zoom", () => {
  assert.equal(sceneViewBoxForZoom(1.5, false), "150 70 600 280");
  assert.equal(sceneViewBoxForZoom(1.5, true), "150 70 600 280");

  for (let count = 1; count <= 6; count += 1) {
    const engineX = 450;
    const train = sceneTrainLayout(engineX);
    const leftExtent = count * 64 + 34;
    assert.equal(train.travelX, engineX, `${count} cars keep the engine centered while travelling`);
    assert.equal(train.travelShift, 0);
    assert.equal(train.restShift, 0);

    for (const zoom of [1, 1.25, 1.5]) {
      const restView = sceneViewBoxForZoom(zoom, false).split(" ").map(Number);
      const restLeft = restView[0];
      const restRight = restLeft + restView[2];
      const centeredScale = sceneTrainScale(count, engineX, restLeft);
      const travelTail = engineX - leftExtent * centeredScale;
      const restTail = SCENE_REST_STATION_X - leftExtent * centeredScale;
      assert.equal((restLeft + restRight) / 2, engineX, `engine stays at viewport center at zoom ${zoom}`);
      assert.ok(travelTail >= restLeft - 0.001, `${count} cars at centered travel zoom ${zoom}`);
      assert.ok(restTail >= restLeft - 0.001, `${count} cars at the centered rest stop at zoom ${zoom}`);
      assert.ok(SCENE_REST_STATION_X + 49 <= restRight, `${count} cars keep the rest engine visible at zoom ${zoom}`);

      const terminalView = sceneViewBoxForZoom(zoom, true).split(" ").map(Number);
      const terminalLeft = terminalView[0];
      const terminalRight = terminalLeft + terminalView[2];
      const terminalScale = sceneTrainScale(count, SCENE_TRAIN_ARRIVAL_X, terminalLeft);
      const terminalTail = SCENE_TRAIN_ARRIVAL_X - leftExtent * terminalScale;
      assert.equal((terminalLeft + terminalRight) / 2, engineX, `terminal view remains centered at zoom ${zoom}`);
      assert.ok(terminalTail >= terminalLeft - 0.001, `${count} cars at the terminal at zoom ${zoom}`);
      assert.ok(SCENE_TRAIN_ARRIVAL_X + 49 <= terminalRight, `${count} cars keep the terminal engine visible at zoom ${zoom}`);
    }
  }
});

test("the trip start and destination stations meet the centered engine and approach from the right", async () => {
  const { sceneArrivalStationX, sceneDepartureStationX } = await import("../src/adventure/sceneMotion.ts");

  assert.equal(sceneDepartureStationX(0), 450);
  assert.equal(sceneDepartureStationX(0.5), -150);
  assert.equal(sceneDepartureStationX(2), null);
  assert.equal(sceneArrivalStationX(12), 1050);
  assert.equal(sceneArrivalStationX(6), 750);
  assert.equal(sceneArrivalStationX(0), 450);
  assert.equal(sceneArrivalStationX(-1), null);
  assert.equal(sceneArrivalStationX(13), null);
  assert.equal(sceneArrivalStationX(Number.NaN), null);
});

test("the upcoming rest station glides in from the right during the final twelve seconds", () => {
  assert.equal(sceneUpcomingRestStationX(null), null);
  assert.equal(sceneUpcomingRestStationX({ remainingSeconds: 13 }), null);
  assert.equal(sceneUpcomingRestStationX({ remainingSeconds: 12 }), 1050);
  assert.equal(sceneUpcomingRestStationX({ remainingSeconds: 6 }), 750);
  assert.equal(sceneUpcomingRestStationX({ remainingSeconds: 0 }), 450);
  assert.equal(sceneUpcomingRestStationX({ remainingSeconds: -3 }), null);
  assert.equal(sceneUpcomingRestStationX({ remainingSeconds: Number.NaN }), null);
});

test("the active rest station takes precedence and a completed stop exits fully left", () => {
  const previous = { index: 1, count: 2 };
  const current = { index: 2, count: 2 };
  assert.deepEqual(sceneRestStationPosition({ index: 1, count: 2 }, null, previous, "parked"), {
    stop: previous,
    x: 450,
    phase: "parked",
  });
  assert.deepEqual(sceneRestStationPosition(current, null, previous, "departing"), {
    stop: current,
    x: 450,
    phase: "parked",
  });
  assert.deepEqual(sceneRestStationPosition(null, { index: 2, count: 2, remainingSeconds: 6 }, null, "travelling"), {
    stop: { index: 2, count: 2 },
    x: 750,
    phase: "approaching",
  });
  assert.deepEqual(sceneRestStationPosition(null, { index: 2, count: 2, remainingSeconds: -1 }, null, "travelling"), {
    stop: null,
    x: null,
    phase: "travelling",
  });
  assert.deepEqual(sceneRestStationPosition(null, null, previous, "departing"), {
    stop: previous,
    x: -150,
    phase: "departing",
  });
  assert.deepEqual(sceneRestStationPosition(null, null, previous, "travelling"), {
    stop: null,
    x: null,
    phase: "travelling",
  });
});
