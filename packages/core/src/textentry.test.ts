// SPDX-License-Identifier: MIT
/**
 * The text-entry interaction — fill in the blank.
 *
 * The first interaction whose key is not made of identifiers, which is what `baseType` is for.
 */
import { test, describe, expect } from "vitest";
import { parser } from "@graffiticode/parser";
import { compiler, lexicon } from "./index.js";

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

async function errorOf(src: string): Promise<string> {
  try {
    const val = await compile(src);
    throw new Error(`expected a compile error, got ${JSON.stringify(val)}`);
  } catch (e: any) {
    if (e instanceof Error) throw e;
    const first = Array.isArray(e) ? e[0] : e;
    return String(first?.message ?? first);
  }
}

const ONE = `
text-entry [
  prompt "Complete the sentence."
  text "The capital of France is {{capital}}."
  responses [
    [ id "capital" accept [ "Paris" ] ]
  ] {}
]`;

const TWO = `
text-entry [
  text "The capital of France is {{france}}, and of Italy is {{italy}}."
  responses [
    [ id "france" accept [ "Paris" ] ]
    [ id "italy" accept [ "Rome" "Roma" ] ]
  ] {}
]`;

describe("interaction", () => {
  test("the sentence arrives cut into text and blanks", async () => {
    const { interaction } = await compile(ONE);
    expect(interaction).toEqual({
      type: "text-entry",
      prompt: "Complete the sentence.",
      segments: [
        { text: "The capital of France is " },
        { id: "capital", blank: true },
        { text: "." },
      ],
    });
  });

  test("no accepted answer reaches the half that ships to the browser", async () => {
    const { interaction } = await compile(TWO);
    const shipped = JSON.stringify(interaction);
    expect(shipped).not.toContain("Paris");
    expect(shipped).not.toContain("Roma");
  });

  test("nothing in it betrays how long an answer is", async () => {
    // QTI has expected-length as a presentation hint and deriving it from the answer would put
    // the answer's shape in the candidate's half. A five-character box is a five-letter clue.
    const { interaction } = await compile(ONE);
    expect(JSON.stringify(interaction)).not.toContain("expectedLength");
    expect(JSON.stringify(interaction)).not.toContain("length");
  });
});

describe("validation", () => {
  test("declares a string response, and carries the answers", async () => {
    const { validation } = await compile(ONE);
    expect(validation).toEqual({
      responseProcessing: "map_response",
      cardinality: "single",
      baseType: "string",
      points: 1,
      mapping: { capital: { correct: true, points: 1, accept: ["Paris"], caseSensitive: false } },
    });
  });

  test("each blank is worth a point, so several give partial credit", async () => {
    const { validation } = await compile(TWO);
    expect(validation.points).toBe(2);
    expect(validation.mapping.france.points).toBe(1);
    expect(validation.mapping.italy.points).toBe(1);
  });

  test("alternates are values, not a flag", async () => {
    const { validation } = await compile(TWO);
    expect(validation.mapping.italy.accept).toEqual(["Rome", "Roma"]);
  });

  test("case sensitivity is resolved onto every entry", async () => {
    const { validation } = await compile(`
      text-entry [
        text "The agency {{agency}} launched from {{place}}."
        case-sensitive false
        responses [
          [ id "agency" accept [ "NASA" ] case-sensitive true ]
          [ id "place" accept [ "Cape Canaveral" ] ]
        ] {}
      ]`);
    expect(validation.mapping.agency.caseSensitive).toBe(true);
    expect(validation.mapping.place.caseSensitive).toBe(false);
    // Resolved, so there is nothing left at the top for a scorer to inherit from.
    expect(validation.caseSensitive).toBeUndefined();
  });
});

describe("inside an item", () => {
  test("all-or-nothing across blanks is a conjunctive item, as it is for hottext", async () => {
    const { validation } = await compile(`
      item [
        scoring "conjunctive"
        points 1
        parts [ ${TWO} ] {}
      ]`);
    expect(validation.scoring).toBe("conjunctive");
    expect(validation.points).toBe(1);
    expect(validation.parts["1"].baseType).toBe("string");
  });

  test("it sits beside a choice in one item", async () => {
    const { interaction, validation } = await compile(`
      item [
        parts [
          choice [ prompt "Which continent?" options [ [ text "Europe" assess [ correct ] ] ] {} ]
          ${ONE}
        ] {}
      ]`);
    expect(interaction.parts.map((p: any) => p.type)).toEqual(["choice", "text-entry"]);
    expect(validation.points).toBe(2);
  });
});

describe("errors name the fix, not just the fault", () => {
  test("no text", async () => {
    const msg = await errorOf(`text-entry [ responses [ [ id "a" accept [ "x" ] ] ] {} ]`);
    expect(msg).toContain("needs the sentence it blanks out");
    expect(msg).toContain("{{capital}}");
  });

  test("no responses", async () => {
    const msg = await errorOf(`text-entry [ text "A {{a}}." responses [] {} ]`);
    expect(msg).toContain("needs at least one response");
  });

  test("a marker with no response lists the declared ids", async () => {
    const msg = await errorOf(ONE.replace("{{capital}}", "{{captial}}"));
    expect(msg).toContain("no response declares that id");
    expect(msg).toContain("declares: capital");
  });

  test("a response with no marker", async () => {
    const msg = await errorOf(
      ONE.replace('[ id "capital" accept [ "Paris" ] ]', '[ id "capital" accept [ "Paris" ] ] [ id "spare" accept [ "x" ] ]'),
    );
    expect(msg).toContain('response "spare"');
  });

  test("text with no marker at all", async () => {
    const msg = await errorOf(ONE.replace("{{capital}}", "Paris"));
    expect(msg).toContain("no blank to fill in");
  });

  test("a choice attribute on text-entry lists the legal set", async () => {
    const msg = await errorOf(`
      text-entry [ shuffle true text "A {{a}}." responses [ [ id "a" accept [ "x" ] ] ] {} ]`);
    expect(msg).toContain("is not an attribute of text-entry");
    expect(msg).toContain("It takes: prompt, text, case-sensitive, responses");
  });

  test("an option attribute inside a response lists the legal set", async () => {
    const msg = await errorOf(`
      text-entry [ text "A {{a}}." responses [ [ id "a" accept [ "x" ] assess [ correct ] ] ] {} ]`);
    expect(msg).toContain("is not an attribute of response");
    expect(msg).toContain("It takes: id, accept, case-sensitive");
  });
});
