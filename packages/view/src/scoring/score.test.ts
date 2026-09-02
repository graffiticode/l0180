// SPDX-License-Identifier: MIT
/**
 * The scorer's contract. No DOM anywhere — if these ever need jsdom, the scorer has picked up
 * a browser dependency it must not have.
 */
import { test, describe, expect } from "vitest";
import {
  correctIds,
  scoreChoice,
  scoreHuman,
  scoreTextEntry,
  selectedIds,
  type Validation,
} from "./score.js";

/** The validation half of the compiled example in core's choice.test.ts. */
const VALIDATION: Validation = {
  points: 2,
  mapping: { B: { correct: true, points: 2 }, C: { points: -1 } },
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
    const s = scoreChoice({ response: ["C"], validation: { points: 5, mapping: VALIDATION.mapping } });
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
      mapping: { A: { correct: true, points: 1 }, C: { correct: true, points: 2 }, D: { points: -1 } },
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
    const s = scoreChoice({ response: ["A"], validation: { points: 0, mapping: {} } });
    expect(s).toMatchObject({ points: 0, maxPoints: 0, correct: false });
  });

  test("survives a malformed or absent validation", () => {
    expect(scoreChoice({ response: ["B"], validation: null }).points).toBe(0);
    expect(scoreChoice({ response: ["B"], validation: undefined }).maxPoints).toBe(0);
    expect(scoreChoice({ response: ["Z"], validation: VALIDATION }).points).toBe(0);
  });
});

describe("scoreChoice under match_correct", () => {
  /** "Choose the two sentences that belong in a summary" — L0175's multi-select shape. */
  const EXACT: Validation = {
    responseProcessing: "match_correct",
    points: 1,
    correctResponse: ["A", "B"],
  };

  test("exactly the correct set earns the point", () => {
    const s = scoreChoice({ response: ["A", "B"], validation: EXACT });
    expect(s).toMatchObject({ points: 1, maxPoints: 1, correct: true });
  });

  test("order does not matter", () => {
    expect(scoreChoice({ response: ["B", "A"], validation: EXACT }).correct).toBe(true);
  });

  test("a SUBSET earns nothing — this is the whole point of the template", () => {
    // Under map_response this same response would have earned half. Naming the template is
    // what makes the difference visible instead of silent.
    const s = scoreChoice({ response: ["A"], validation: EXACT });
    expect(s).toMatchObject({ points: 0, correct: false });
  });

  test("a SUPERSET earns nothing either", () => {
    const s = scoreChoice({ response: ["A", "B", "C"], validation: EXACT });
    expect(s).toMatchObject({ points: 0, correct: false });
  });

  test("an empty response earns nothing", () => {
    expect(scoreChoice({ response: [], validation: EXACT }).correct).toBe(false);
  });

  test("reports per-option outcomes over the correct set and whatever was picked", () => {
    const s = scoreChoice({ response: ["A", "C"], validation: EXACT });
    expect(s.options).toEqual({
      A: { selected: true, points: 0, correct: true },
      B: { selected: false, points: 0, correct: true },
      C: { selected: true, points: 0, correct: false },
    });
  });

  test("an empty correct set can never be satisfied", () => {
    const s = scoreChoice({
      response: [],
      validation: { responseProcessing: "match_correct", points: 1, correctResponse: [] },
    });
    expect(s.correct).toBe(false);
  });
});

describe("scoreChoice under an upper bound", () => {
  /** Four valid sentences, click any three — L0175's hot-text shape. */
  const SUPERSET: Validation = {
    responseProcessing: "map_response",
    points: 3,
    upperBound: 3,
    mapping: {
      a: { correct: true, points: 1 },
      b: { correct: true, points: 1 },
      c: { correct: true, points: 1 },
      d: { correct: true, points: 1 },
    },
  };

  test("any three of the four reach the ceiling", () => {
    expect(scoreChoice({ response: ["a", "b", "c"], validation: SUPERSET })).toMatchObject({
      points: 3,
      maxPoints: 3,
      correct: true,
    });
    expect(scoreChoice({ response: ["b", "c", "d"], validation: SUPERSET }).correct).toBe(true);
  });

  test("the bound caps a fourth pick rather than paying for it", () => {
    const s = scoreChoice({ response: ["a", "b", "c", "d"], validation: SUPERSET });
    expect(s.points).toBe(3);
    expect(s.rawPoints).toBe(4); // the unclamped sum is still reported
  });

  test("too few still falls short", () => {
    expect(scoreChoice({ response: ["a", "b"], validation: SUPERSET })).toMatchObject({
      points: 2,
      correct: false,
    });
  });
});

describe("correctIds", () => {
  test("reads either template, so the renderer and the scorer cannot disagree", () => {
    expect(correctIds(VALIDATION)).toEqual(["B"]);
    expect(
      correctIds({ responseProcessing: "match_correct", points: 1, correctResponse: ["A", "B"] }),
    ).toEqual(["A", "B"]);
  });

  test("is empty for an unscored item or a missing key", () => {
    expect(correctIds({ points: 0, mapping: {} })).toEqual([]);
    expect(correctIds(null)).toEqual([]);
  });
});

describe("scoreTextEntry", () => {
  const TWO: Validation = {
    responseProcessing: "map_response",
    cardinality: "single",
    baseType: "string",
    points: 2,
    mapping: {
      france: { correct: true, points: 1, accept: ["Paris"], caseSensitive: false },
      italy: { correct: true, points: 1, accept: ["Rome", "Roma"], caseSensitive: false },
    },
  };

  test("both right earns the ceiling", () => {
    const s = scoreTextEntry({ response: { france: "Paris", italy: "Roma" }, validation: TWO });
    expect(s).toMatchObject({ points: 2, maxPoints: 2, correct: true });
  });

  test("one right is partial credit, which is what map_response means", () => {
    const s = scoreTextEntry({ response: { france: "Paris", italy: "Milan" }, validation: TWO });
    expect(s).toMatchObject({ points: 1, correct: false });
    expect(s.options).toMatchObject({
      france: { selected: true, correct: true },
      italy: { selected: true, correct: false },
    });
  });

  test("case is ignored by default", () => {
    expect(scoreTextEntry({ response: { france: "paris", italy: "ROME" }, validation: TWO }).points).toBe(2);
  });

  test("case matters when the entry says so", () => {
    const strict: Validation = {
      responseProcessing: "map_response",
      baseType: "string",
      points: 1,
      mapping: { a: { correct: true, points: 1, accept: ["NASA"], caseSensitive: true } },
    };
    expect(scoreTextEntry({ response: { a: "NASA" }, validation: strict }).points).toBe(1);
    expect(scoreTextEntry({ response: { a: "nasa" }, validation: strict }).points).toBe(0);
  });

  test("surrounding and repeated whitespace never costs a mark", () => {
    const s = scoreTextEntry({ response: { france: "  Paris ", italy: "Roma" }, validation: TWO });
    expect(s.points).toBe(2);
    const spaced: Validation = {
      responseProcessing: "map_response",
      baseType: "string",
      points: 1,
      mapping: { a: { correct: true, points: 1, accept: ["Cape Canaveral"], caseSensitive: false } },
    };
    expect(scoreTextEntry({ response: { a: "Cape   Canaveral" }, validation: spaced }).points).toBe(1);
  });

  test("punctuation still counts, unlike the compiler's quote matching", () => {
    // hottext's matcher strips all punctuation so a quote can find its sentence. Here the typed
    // string IS the answer, so "cant" must not pass for "can't".
    const v: Validation = {
      responseProcessing: "map_response",
      baseType: "string",
      points: 1,
      mapping: { a: { correct: true, points: 1, accept: ["can't"], caseSensitive: false } },
    };
    expect(scoreTextEntry({ response: { a: "cant" }, validation: v }).points).toBe(0);
    expect(scoreTextEntry({ response: { a: "can't" }, validation: v }).points).toBe(1);
  });

  test("blank, missing and stale responses earn nothing and throw nothing", () => {
    expect(scoreTextEntry({ response: { france: "  " }, validation: TWO }).points).toBe(0);
    expect(scoreTextEntry({ response: {}, validation: TWO }).points).toBe(0);
    expect(scoreTextEntry({ response: null, validation: TWO }).points).toBe(0);
    expect(scoreTextEntry({ response: { gone: "Paris" }, validation: TWO }).points).toBe(0);
  });

  test("under match_correct every blank must be right", () => {
    // Nothing emits this today — text-entry always compiles to map_response — but the template
    // is honoured rather than silently ignored, so a hand-built key cannot mean one thing and
    // score as another.
    const exact: Validation = { ...TWO, responseProcessing: "match_correct", points: 1 };
    expect(scoreTextEntry({ response: { france: "Paris", italy: "Rome" }, validation: exact })).toMatchObject({
      points: 1,
      correct: true,
    });
    expect(scoreTextEntry({ response: { france: "Paris" }, validation: exact })).toMatchObject({
      points: 0,
      correct: false,
    });
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

describe("scoreHuman", () => {
  const WRITTEN: Validation = {
    responseProcessing: "human",
    points: 2,
    rubric: [
      { score: 2, descriptor: "Full." },
      { score: 0, descriptor: "None." },
    ],
  };

  test("reports the points as available, not as earned", () => {
    const s = scoreHuman({ validation: WRITTEN });
    expect(s).toMatchObject({ points: 0, maxPoints: 2, correct: false, pending: true });
  });

  test("an unscored item is a different thing entirely", () => {
    // Both earn nothing. Only one of them has anything to earn, and `pending` is the difference.
    const unscored = scoreChoice({ response: [], validation: { points: 0, mapping: {} } });
    expect(unscored.pending).toBeUndefined();
    expect(unscored.maxPoints).toBe(0);
    expect(scoreHuman({ validation: WRITTEN }).maxPoints).toBe(2);
  });
});
