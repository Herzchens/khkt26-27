import assert from "node:assert/strict";
import test from "node:test";
import { advanceFlipDigit, finishFlipDigit, splitClockTime } from "../src/adventure/flipClockModel.ts";

test("clock parts preserve long minute values and keep seconds in two digits", () => {
  assert.deepEqual(splitClockTime(255 * 60 + 5), {
    minuteDigits: ["2", "5", "5"],
    secondDigits: ["0", "5"],
    minutes: 255,
    seconds: 5,
    duration: "PT15305S",
    spoken: "255 phút 5 giây",
  });
});

test("clock parts clamp invalid and negative values to zero", () => {
  for (const seconds of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(splitClockTime(seconds), {
      minuteDigits: ["0", "0"],
      secondDigits: ["0", "0"],
      minutes: 0,
      seconds: 0,
      duration: "PT0S",
      spoken: "0 phút 0 giây",
    });
  }
});

test("only a changed digit with motion enabled retains its old face for one flip", () => {
  assert.deepEqual(
    advanceFlipDigit({ current: "8", previous: null }, "7", true),
    { current: "7", previous: "8" },
  );
  assert.deepEqual(
    advanceFlipDigit({ current: "8", previous: null }, "8", true),
    { current: "8", previous: null },
  );
  assert.deepEqual(
    advanceFlipDigit({ current: "8", previous: "9" }, "7", false),
    { current: "7", previous: null },
  );
});

test("an older animation cannot clear a newer digit transition", () => {
  const current = { current: "7", previous: "8" };
  assert.deepEqual(finishFlipDigit(current, "8"), current);
  assert.deepEqual(finishFlipDigit(current, "7"), { current: "7", previous: null });
});
