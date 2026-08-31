// SPDX-License-Identifier: MIT
/**
 * The scorer's contract. No DOM anywhere — if these ever need jsdom, the scorer has picked up
 * a browser dependency it must not have.
 */
import { test, describe, expect } from "vitest";
import { scoreChoice, selectedIds, type Validation } from "./score.js";

/** The validation half of the compiled example in core's choice.test.ts. */
const VALIDATION: Validation = {
  points: 2,
  options: { B: { correct: true, points: 2 }, C: { points: -1 } },
};

describe("scoreChoice", () => {
  test("the right answer earns exactly the ceiling", () => {
    const s = scoreChoice({ response: ["B"], validation: VALIDATION });
    expect(s.points).toBe(2);
    expect(s.maxPoints).toBe(2);
    expect(s.correct).toBe(true);
  });

  test("an unassessed distractor earns nothing and costs nothing", () => {
    const s = scoreChoice({ response: ["A"], validation: VALIDATION });
    expect(s).toMatchObject({ points: 0, rawPoints: 0, correct: false });
  });

  test("a penalty option subtracts", () => {
    const s = scoreChoice({ response: ["C"], validation: { points: 5, options: VALIDATION.options } });
    expect(s.rawPoints).toBe(-1);
  });

  test("the item score is floored at zero, and the raw sum is still reported", () => {
    const s = scoreChoice({ response: ["C"], validation: VALIDATION });
    expect(s.rawPoints).toBe(-1);
    expect(s.points).toBe(0);
  });

  test("no response scores zero rather than throwing", () => {
    for (const r of [undefined, null, [], ""]) {
      expect(scoreChoice({ response: r, validation: VALIDATION }).points).toBe(0);
    }
  });

  test("the ceiling is unreachable by any response other than the correct set", () => {
    const multi: Validation = {
      points: 3,
      options: { A: { correct: true, points: 1 }, C: { correct: true, points: 2 }, D: { points: -1 } },
    };
    const everything = scoreChoice({ response: ["A", "C", "D"], validation: multi });
    expect(everything.points).toBeLessThan(multi.points);
    const exact = scoreChoice({ response: ["A", "C"], validation: multi });
    expect(exact.points).toBe(3);
    expect(exact.correct).toBe(true);
  });

  test("reports every keyed option, selected or not", () => {
    const s = scoreChoice({ response: ["B"], validation: VALIDATION });
    expect(s.options).toEqual({
      B: { selected: true, points: 2, correct: true },
      C: { selected: false, points: -1, correct: false },
    });
  });

  test("an unscored item is never `correct` — there is nothing to earn", () => {
    const s = scoreChoice({ response: ["A"], validation: { points: 0, options: {} } });
    expect(s).toMatchObject({ points: 0, maxPoints: 0, correct: false });
  });

  test("survives a malformed or absent validation", () => {
    expect(scoreChoice({ response: ["B"], validation: null }).points).toBe(0);
    expect(scoreChoice({ response: ["B"], validation: undefined }).maxPoints).toBe(0);
    expect(scoreChoice({ response: ["Z"], validation: VALIDATION }).points).toBe(0);
  });
});

describe("selectedIds", () => {
  test("accepts a bare string, since single-select reports one id", () => {
    expect(selectedIds("B")).toEqual(["B"]);
  });

  test("de-duplicates and drops non-strings", () => {
    expect(selectedIds(["B", "B", 3, null, "C"])).toEqual(["B", "C"]);
  });
});
