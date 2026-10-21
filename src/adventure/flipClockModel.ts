export type FlipDigitState = {
  current: string;
  previous: string | null;
};

export function splitClockTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds)
    ? Math.max(0, Math.floor(seconds))
    : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  const minuteText = String(minutes).padStart(2, "0");
  const secondText = String(remainder).padStart(2, "0");
  return {
    minuteDigits: Array.from(minuteText),
    secondDigits: Array.from(secondText),
    minutes,
    seconds: remainder,
    duration: `PT${safeSeconds}S`,
    spoken: `${minutes} phút ${remainder} giây`,
  };
}

export function advanceFlipDigit(
  state: FlipDigitState,
  next: string,
  motionAllowed: boolean,
): FlipDigitState {
  if (state.current === next) {
    return motionAllowed || state.previous === null
      ? state
      : { current: next, previous: null };
  }
  return { current: next, previous: motionAllowed ? state.current : null };
}

export function finishFlipDigit(
  state: FlipDigitState,
  finishedValue: string,
): FlipDigitState {
  return state.current === finishedValue && state.previous !== null
    ? { current: state.current, previous: null }
    : state;
}
