import { useEffect, useRef, useState } from "react";
import { advanceFlipDigit, finishFlipDigit, splitClockTime } from "./flipClockModel";
import "./flipClock.css";

type FlipDigitProps = {
  value: string;
  motionAllowed: boolean;
};

function FlipDigit({ value, motionAllowed }: FlipDigitProps) {
  const [state, setState] = useState(() => ({ current: value, previous: null as string | null }));
  useEffect(() => {
    setState((current) => advanceFlipDigit(current, value, motionAllowed));
  }, [motionAllowed, value]);

  const displayed = state.current === value
    ? state
    : advanceFlipDigit(state, value, motionAllowed);
  const showFlip = motionAllowed && displayed.previous !== null;

  return (
    <span className="flip-clock-digit" data-digit={value}>
      <span className="flip-clock-half flip-clock-upper"><span>{displayed.current}</span></span>
      <span className="flip-clock-half flip-clock-lower"><span>{displayed.current}</span></span>
      {showFlip && (
        <span className="flip-clock-flipper" aria-hidden="true">
          <span className="flip-clock-half flip-clock-fold-top"><span>{displayed.previous}</span></span>
          <span
            className="flip-clock-half flip-clock-fold-bottom"
            data-value={displayed.current}
            onAnimationEnd={(event) => {
              if (event.animationName === "flip-clock-bottom-in") {
                const finishedValue = event.currentTarget.dataset.value ?? value;
                setState((current) => finishFlipDigit(current, finishedValue));
              }
            }}
          >
            <span>{displayed.current}</span>
          </span>
        </span>
      )}
    </span>
  );
}

function ClockDigits({ digits, unit, motionAllowed }: {
  digits: string[];
  unit: "minutes" | "seconds";
  motionAllowed: boolean;
}) {
  return (
    <span className="flip-clock-group">
      <span className="flip-clock-digits">
        {digits.map((digit, index) => (
          <FlipDigit
            key={`${unit}-${digits.length - index}`}
            value={digit}
            motionAllowed={motionAllowed}
          />
        ))}
      </span>
      <span className="flip-clock-unit" aria-hidden="true">{unit === "minutes" ? "PHÚT" : "GIÂY"}</span>
    </span>
  );
}

export function FlipClock({
  seconds,
  label,
  motionAllowed = true,
}: {
  seconds: number;
  label: string;
  motionAllowed?: boolean;
}) {
  const element = useRef<HTMLTimeElement>(null);
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const time = splitClockTime(seconds);
  useEffect(() => {
    let inView = true;
    const update = () => setVisible(inView && !document.hidden);
    const observer = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(([entry]) => {
          inView = entry.isIntersecting;
          update();
        });
    if (element.current) observer?.observe(element.current);
    document.addEventListener("visibilitychange", update);
    update();

    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReducedMotion(Boolean(media?.matches));
    updateMotionPreference();
    if (media?.addEventListener) media.addEventListener("change", updateMotionPreference);
    else media?.addListener?.(updateMotionPreference);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", update);
      if (media?.removeEventListener) media.removeEventListener("change", updateMotionPreference);
      else media?.removeListener?.(updateMotionPreference);
    };
  }, []);

  const canAnimate = motionAllowed && visible && !reducedMotion;
  return (
    <time
      ref={element}
      className="timer flip-clock"
      role="timer"
      aria-label={`${label}: ${time.spoken}`}
      dateTime={time.duration}
      data-animated={canAnimate}
    >
      <span className="flip-clock-readout" aria-hidden="true">
        <ClockDigits digits={time.minuteDigits} unit="minutes" motionAllowed={canAnimate} />
        <span className="flip-clock-separator" aria-hidden="true" />
        <ClockDigits digits={time.secondDigits} unit="seconds" motionAllowed={canAnimate} />
      </span>
    </time>
  );
}
