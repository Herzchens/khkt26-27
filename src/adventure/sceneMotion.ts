export type SceneStopPhase = "travelling" | "arriving" | "parked" | "departing";
export type SceneRestStop = { index: number; count: number };

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
