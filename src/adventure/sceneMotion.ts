export type SceneStopPhase = "travelling" | "arriving" | "parked" | "departing";
export type SceneRestStop = { index: number; count: number };

export const SCENE_REST_STATION_X = 450;
export const SCENE_ARRIVAL_STATION_X = 780;
export const SCENE_TRAIN_TRAVEL_X = 360;
export const SCENE_TRAIN_ARRIVAL_X = 635;
const SCENE_TRAIN_CARRIAGE_STEP = 64;

/** Derive the train translations for the visual travel, rest, and terminal poses. */
export function sceneTrainLayout(engineX: number, carriageCount: number) {
  const travelX = Math.max(
    SCENE_TRAIN_TRAVEL_X,
    Math.min(SCENE_REST_STATION_X, carriageCount * SCENE_TRAIN_CARRIAGE_STEP + 40),
  );
  return {
    travelX,
    travelShift: travelX - engineX,
    restShift: SCENE_REST_STATION_X - engineX,
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

/** Keep the last station illustration while the train completes its departure. */
export function sceneRestStopForPhase(
  current: SceneRestStop | null,
  previous: SceneRestStop | null,
  phase: SceneStopPhase,
): SceneRestStop | null {
  return current ?? (phase === "departing" ? previous : null);
}

/** Derive the small, visual-only station transition from the scheduled rest key. */
export function transitionSceneStop(
  current: SceneStopPhase,
  previousRestIndex: number | null,
  nextRestIndex: number | null,
  motionAllowed: boolean,
): SceneStopPhase {
  if (nextRestIndex === null) {
    if (previousRestIndex !== null)
      return motionAllowed ? "departing" : "travelling";
    if (current === "departing") return motionAllowed ? current : "travelling";
    return "travelling";
  }

  if (previousRestIndex !== nextRestIndex)
    return motionAllowed ? "arriving" : "parked";
  if (current === "arriving" && !motionAllowed) return "parked";
  if (current === "departing") return motionAllowed ? "arriving" : "parked";
  return current === "travelling" ? "parked" : current;
}

/** Finish a one-shot arrival/departure without changing schedule or trip state. */
export function completeSceneStopMotion(phase: SceneStopPhase): SceneStopPhase {
  if (phase === "arriving") return "parked";
  if (phase === "departing") return "travelling";
  return phase;
}
