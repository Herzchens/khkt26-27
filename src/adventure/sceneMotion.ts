export type SceneStopPhase = "travelling" | "parked" | "departing";
export type SceneStationPhase = SceneStopPhase | "approaching";
export type SceneRestStop = { index: number; count: number };
export type SceneUpcomingRestStop = SceneRestStop & { remainingSeconds: number };

export const SCENE_REST_STATION_X = 450;
export const SCENE_REST_APPROACH_SECONDS = 12;
export const SCENE_REST_APPROACH_START_X = 1050;
export const SCENE_REST_DEPARTURE_END_X = -150;
export const SCENE_ARRIVAL_STATION_X = 780;
export const SCENE_TRAIN_ARRIVAL_X = 635;
const SCENE_TRAIN_CARRIAGE_STEP = 64;

/** Keep the engine centered through ordinary travel and scheduled breaks. */
export function sceneTrainLayout(engineX: number) {
  return {
    travelX: engineX,
    travelShift: 0,
    restShift: 0,
    arrivalShift: SCENE_TRAIN_ARRIVAL_X - engineX,
  };
}

/** The car shadow is the furthest-left rendered extent for each carriage. */
export function sceneTrainLeftExtent(carriageCount: number): number {
  return carriageCount > 0 ? carriageCount * SCENE_TRAIN_CARRIAGE_STEP + 34 : 41;
}

/** Compress the train around its engine only enough to fit its current viewBox. */
export function sceneTrainScale(
  carriageCount: number,
  engineWorldX: number,
  viewBoxLeft: number,
): number {
  const availableLeft = engineWorldX - viewBoxLeft;
  return Math.max(0, Math.min(1, availableLeft / sceneTrainLeftExtent(carriageCount)));
}

export function sceneViewBoxForZoom(zoom: number, terminal: boolean): string {
  const width = 900 / zoom;
  const height = 420 / zoom;
  const left = terminal ? 900 - width : 450 - width / 2;
  return `${left} ${210 - height / 2} ${width} ${height}`;
}

/** Place an upcoming station just outside the right edge, then center it at break time. */
export function sceneUpcomingRestStationX(
  upcoming: Pick<SceneUpcomingRestStop, "remainingSeconds"> | null,
): number | null {
  if (!upcoming || !Number.isFinite(upcoming.remainingSeconds)) return null;
  const remaining = upcoming.remainingSeconds;
  if (remaining < 0 || remaining > SCENE_REST_APPROACH_SECONDS) return null;
  const bounded = Math.min(SCENE_REST_APPROACH_SECONDS, remaining);
  const distance = SCENE_REST_APPROACH_START_X - SCENE_REST_STATION_X;
  return SCENE_REST_STATION_X + (distance * bounded) / SCENE_REST_APPROACH_SECONDS;
}

export type SceneRestStationPosition = {
  stop: SceneRestStop | null;
  x: number | null;
  phase: SceneStationPhase;
};

/** Resolve the one station pose from live break state, countdown, and departure state. */
export function sceneRestStationPosition(
  current: SceneRestStop | null,
  upcoming: SceneUpcomingRestStop | null,
  previous: SceneRestStop | null,
  phase: SceneStopPhase,
): SceneRestStationPosition {
  if (current) return { stop: current, x: SCENE_REST_STATION_X, phase: "parked" };

  if (phase === "departing") {
    const stop = previous;
    return stop
      ? { stop, x: SCENE_REST_DEPARTURE_END_X, phase: "departing" }
      : { stop: null, x: null, phase: "travelling" };
  }

  const upcomingX = sceneUpcomingRestStationX(upcoming);
  if (upcoming && upcomingX !== null) {
    return {
      stop: { index: upcoming.index, count: upcoming.count },
      x: upcomingX,
      phase: "approaching",
    };
  }

  return { stop: null, x: null, phase: "travelling" };
}

/** Keep the last station illustration while it completes its leftward departure. */
export function sceneRestStopForPhase(
  current: SceneRestStop | null,
  previous: SceneRestStop | null,
  phase: SceneStopPhase,
): SceneRestStop | null {
  return current ?? (phase === "departing" ? previous : null);
}

/** Break entry is already centered by the countdown; only break exit animates. */
export function transitionSceneStop(
  current: SceneStopPhase,
  previousRestIndex: number | null,
  nextRestIndex: number | null,
  motionAllowed: boolean,
): SceneStopPhase {
  if (nextRestIndex === null) {
    if (previousRestIndex !== null) return motionAllowed ? "departing" : "travelling";
    if (current === "departing") return motionAllowed ? current : "travelling";
    return "travelling";
  }

  return "parked";
}

/** Finish the one-shot station departure without changing schedule or trip state. */
export function completeSceneStopMotion(phase: SceneStopPhase): SceneStopPhase {
  return phase === "departing" ? "travelling" : phase;
}
