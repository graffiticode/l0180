// SPDX-License-Identifier: MIT
/**
 * Multi-part item scoring. The case that matters is conjunctive: the right claim with the
 * wrong supporting line earns zero, not half.
 */
import { test, describe, expect } from "vitest";
import { scoreItem, scoreInteraction, type ItemValidation } from "./score.js";

/** The validation half of the EBSR-shaped item in core's item.test.ts. */
const CONJUNCTIVE: ItemValidation = {
  points: 1,
  scoring: "conjunctive",
  parts: {
    "1": { points: 1, options: { A: { correct: true, points: 1 } } },
    "2": { points: 1, options: { B: { correct: true, points: 1 } } },
  },
};

const ADDITIVE: ItemValidation = {
  points: 3,
  scoring: "additive",
  parts: {
    "1": { points: 1, options: { A: { correct: true, points: 1 } } },
    "2": { points: 2, options: { B: { correct: true, points: 2 } } },
  },
};

describe("conjunctive", () => {
  test("every part right earns the item's points", () => {
    const s = scoreItem({ response: { "1": ["A"], "2": ["B"] }, validation: CONJUNCTIVE });
    expect(s).toMatchObject({ points: 1, maxPoints: 1, correct: true });
  });

  test("one part wrong earns nothing — not half", () => {
    const s = scoreItem({ response: { "1": ["A"], "2": ["A"] }, validation: CONJUNCTIVE });
    expect(s.points).toBe(0);
    expect(s.correct).toBe(false);
    // The part breakdown still shows which half was right, for feedback.
    expect(s.parts!["1"].correct).toBe(true);
    expect(s.parts!["2"].correct).toBe(false);
  });

  test("an unanswered part earns nothing even when the answered one is right", () => {
    expect(scoreItem({ response: { "1": ["A"] }, validation: CONJUNCTIVE }).points).toBe(0);
    expect(scoreItem({ response: {}, validation: CONJUNCTIVE }).points).toBe(0);
  });

  test("a points override is what a fully correct response earns", () => {
    const v = { ...CONJUNCTIVE, points: 3 };
    expect(scoreItem({ response: { "1": ["A"], "2": ["B"] }, validation: v }).points).toBe(3);
  });
});

describe("additive", () => {
  test("sums the parts", () => {
    const s = scoreItem({ response: { "1": ["A"], "2": ["B"] }, validation: ADDITIVE });
    expect(s).toMatchObject({ points: 3, maxPoints: 3, correct: true });
  });

  test("partial credit is real — one part right scores that part", () => {
    const s = scoreItem({ response: { "2": ["B"] }, validation: ADDITIVE });
    expect(s.points).toBe(2);
    expect(s.correct).toBe(false);
  });

  test("the ceiling is unreachable without every part", () => {
    for (const r of [{}, { "1": ["A"] }, { "1": ["A"], "2": ["A"] }]) {
      expect(scoreItem({ response: r, validation: ADDITIVE }).points).toBeLessThan(ADDITIVE.points);
    }
  });
});

describe("scoreInteraction dispatch", () => {
  test("routes an item to the item scorer", () => {
    const s = scoreInteraction({
      interaction: { type: "item" },
      validation: CONJUNCTIVE,
      response: { "1": ["A"], "2": ["B"] },
    });
    expect(s).toMatchObject({ points: 1, correct: true });
    expect(s.parts).toBeDefined();
  });

  test("routes a bare interaction to the choice scorer", () => {
    const s = scoreInteraction({
      interaction: { type: "choice" },
      validation: { points: 2, options: { B: { correct: true, points: 2 } } },
      response: ["B"],
    });
    expect(s).toMatchObject({ points: 2, correct: true });
    expect(s.options).toBeDefined();
    expect(s.parts).toBeUndefined();
  });
});

describe("robustness", () => {
  test("never throws on a malformed or absent validation", () => {
    expect(scoreItem({ response: { "1": ["A"] }, validation: null }).points).toBe(0);
    expect(scoreItem({ response: null, validation: CONJUNCTIVE }).points).toBe(0);
    expect(scoreItem({ response: "nonsense", validation: CONJUNCTIVE }).points).toBe(0);
  });

  test("an item with no parts is never correct", () => {
    const s = scoreItem({ response: {}, validation: { points: 1, scoring: "conjunctive", parts: {} } });
    expect(s.correct).toBe(false);
    expect(s.points).toBe(0);
  });
});
