// SPDX-License-Identifier: MIT
/**
 * L0175 conformance: does an L0180 item score the way L0175's does?
 *
 * L0175 is the content language — it composes the passage, the claims and the error-typed
 * distractors. L0180 is the assessment language that delivers the result. The bar is that any
 * item an L0175 spec describes is expressible here AND scores identically, so this compiles a
 * real program per delivered shape and runs candidate responses through the scorer.
 *
 * The rules asserted are L0175's own, from its `SCORING` map
 * (`l0175/packages/core/src/compiler.ts:1257-1263`):
 *
 *   multiple-choice  "Correct option = 1 point; otherwise 0."
 *   multi-select     "All correct selections (and no others) = 1 point; otherwise 0."
 *   ebsr             "Both parts correct = 1 point; otherwise 0."
 *
 * Asserting on SCORING BEHAVIOUR rather than on shape is deliberate. L0175's own coverage
 * check substring-matches string literals, which an EBSR item collapsed into a single choice
 * still passes — structure and answer keys are invisible to it. A response that scores
 * differently is the failure that actually matters.
 *
 * The scorer is imported across the workspace by relative path, which works only because
 * `score.ts` has no imports at all — the same DOM-free discipline that lets it run server-side.
 * Core's tsconfig excludes `*.test.ts`, so this never reaches `tsc`.
 */
import { test, describe, expect } from "vitest";
import { parser } from "@graffiticode/parser";
import { compiler, lexicon } from "./index.js";
import { scoreInteraction } from "../../view/src/scoring/score.js";

async function compile(src: string): Promise<any> {
  const code: any = await parser.parse(180, src.trim().endsWith("..") ? src : `${src}..`, lexicon);
  const perr: any = Object.values(code).find((n: any) => n && n.tag === "ERROR");
  if (perr) throw new Error(`parse error: ${JSON.stringify(perr.elts)}`);
  return await new Promise((resolve, reject) =>
    compiler.compile(code, {}, {}, (e: any, v: any) => {
      const errs = Array.isArray(e) ? e.filter(Boolean) : e ? [e] : [];
      if (errs.length) reject(errs);
      else resolve(v);
    }),
  );
}

/** Compile once, then score a response against it the way a delivery would. */
async function scorer(src: string) {
  const { interaction, validation } = await compile(src);
  return (response: unknown) => scoreInteraction({ interaction, validation, response });
}

describe("multiple-choice — correct option = 1 point, otherwise 0", () => {
  const SRC = `
    choice [
      prompt "Which inference about Mara is supported by the passage?"
      options [
        [ text "Mara cares more about the tide pool than the picnic." assess [ correct ] ]
        [ text "Mara is angry at her brother for calling her twice."
          assess [ rationale "Not turning around shows absorption, not anger." ] ]
        [ text "Mara is bored by the beach." ]
        [ text "Mara wants to go home." ]
      ] {}
    ]
  `;

  test("the key earns the point; every distractor earns zero", async () => {
    const score = await scorer(SRC);
    expect(score(["A"])).toMatchObject({ points: 1, maxPoints: 1, correct: true });
    for (const wrong of ["B", "C", "D"]) {
      expect(score([wrong]), wrong).toMatchObject({ points: 0, correct: false });
    }
    expect(score([])).toMatchObject({ points: 0, correct: false });
  });

  test("a distractor rationale rides in the key, not the presentation", async () => {
    const { interaction, validation } = await compile(SRC);
    expect(validation.feedback.B).toContain("absorption");
    expect(JSON.stringify(interaction)).not.toContain("absorption");
  });
});

describe("multi-select — all correct and nothing else = 1 point, otherwise 0", () => {
  const SRC = `
    choice [
      prompt "Choose the two sentences that belong in a summary of the passage."
      response-processing "match-correct"
      min-choices 2
      max-choices 2
      options [
        [ text "Bees live together in large groups called colonies." assess [ correct ] ]
        [ text "Every bee in a colony does a job that helps the group survive." assess [ correct ] ]
        [ text "Some bees are yellow and black." ]
        [ text "A hive can be kept in a wooden box." ]
      ] {}
    ]
  `;

  test("the exact set earns the point", async () => {
    const score = await scorer(SRC);
    expect(score(["A", "B"])).toMatchObject({ points: 1, maxPoints: 1, correct: true });
    expect(score(["B", "A"])).toMatchObject({ correct: true });
  });

  test("a subset earns zero, not half — the case per-option scoring gets wrong", async () => {
    const score = await scorer(SRC);
    expect(score(["A"])).toMatchObject({ points: 0, correct: false });
    expect(score(["B"])).toMatchObject({ points: 0, correct: false });
  });

  test("a superset earns zero, and so does the wrong pair", async () => {
    const score = await scorer(SRC);
    expect(score(["A", "B", "C"])).toMatchObject({ points: 0, correct: false });
    expect(score(["C", "D"])).toMatchObject({ points: 0, correct: false });
    expect(score([])).toMatchObject({ points: 0, correct: false });
  });
});

describe("ebsr — both parts correct = 1 point, otherwise 0", () => {
  const SRC = `
    item [
      stimulus [
        title "The Tide Pool"
        paragraphs [
          "Mara crouched at the edge of the tide pool, ignoring the picnic behind her."
          "Her brother called twice. She did not turn around."
        ]
      ]
      scoring "conjunctive"
      parts [
        choice [
          prompt "What can the reader conclude about Mara?"
          options [
            [ text "She is absorbed by the tide pool." assess [ correct ] ]
            [ text "She is angry at her brother." ]
          ] {}
        ]
        choice [
          prompt "Which sentence best supports your answer to Part A?"
          options [
            [ text "Her brother called twice." ]
            [ text "She did not turn around." assess [ correct ] ]
          ] {}
        ]
      ] {}
    ]
  `;

  test("both parts right earns one point for the item, not one per part", async () => {
    const score = await scorer(SRC);
    expect(score({ "1": ["A"], "2": ["B"] })).toMatchObject({
      points: 1,
      maxPoints: 1,
      correct: true,
    });
  });

  test("the right claim with the wrong evidence earns zero, not half", async () => {
    // This is the requirement the item wrapper exists for: naming the right idea while citing
    // the wrong line is not partial credit in an EBSR item.
    const score = await scorer(SRC);
    expect(score({ "1": ["A"], "2": ["A"] })).toMatchObject({ points: 0, correct: false });
    expect(score({ "1": ["B"], "2": ["B"] })).toMatchObject({ points: 0, correct: false });
    expect(score({ "1": ["A"] })).toMatchObject({ points: 0, correct: false });
    expect(score({})).toMatchObject({ points: 0, correct: false });
  });
});

describe("what L0175 still asks for that L0180 cannot express", () => {
  // Stated as a passing test rather than a failing one, so the suite reports the real boundary
  // instead of a permanent red mark. When either word lands this fails, which is the reminder
  // to bring its conformance cases in above.
  test("hot-text and short-text have no vocabulary yet", () => {
    expect(lexicon["hottext"], "hottext landed — add its conformance cases").toBeUndefined();
    expect(
      lexicon["extended-text"],
      "extended-text landed — add its conformance cases",
    ).toBeUndefined();
  });
});
