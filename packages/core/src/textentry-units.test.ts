// SPDX-License-Identifier: MIT
/**
 * Cutting text at its markers, and binding blanks to responses by name.
 *
 * Most of this file is the cross-checks. They are the point: named binding is what makes them
 * expressible at all, and a positional model — Learnosity's, and L0160's — cannot say which
 * answer is orphaned or whether the counts even agree.
 */
import { test, describe, expect } from "vitest";
import { cut } from "./textentry.js";

const one = [{ id: "capital", accept: ["Paris"] }];

describe("cutting the text", () => {
  test("splits into text and blanks, in order", () => {
    const { segments } = cut("The capital of France is {{capital}}.", one, false, "text-entry");
    expect(segments).toEqual([
      { text: "The capital of France is " },
      { id: "capital", blank: true },
      { text: "." },
    ]);
  });

  test("a marker at the very start has no empty run before it", () => {
    const { segments } = cut("{{capital}} is the capital of France.", one, false, "text-entry");
    expect(segments).toEqual([
      { id: "capital", blank: true },
      { text: " is the capital of France." },
    ]);
  });

  test("a marker at the very end has no empty run after it", () => {
    const { segments } = cut("The capital of France is {{capital}}", one, false, "text-entry");
    expect(segments).toEqual([
      { text: "The capital of France is " },
      { id: "capital", blank: true },
    ]);
  });

  test("two blanks keep their order and their names", () => {
    const { segments, mapping } = cut(
      "The capital of France is {{france}}, and of Italy is {{italy}}.",
      [
        { id: "france", accept: ["Paris"] },
        { id: "italy", accept: ["Rome", "Roma"] },
      ],
      false,
      "text-entry",
    );
    expect(segments.filter((s) => s.blank).map((s) => s.id)).toEqual(["france", "italy"]);
    expect(mapping.italy.accept).toEqual(["Rome", "Roma"]);
  });

  test("the answer binds by name, not by position", () => {
    // The clause order is reversed and the responses are not — under a positional model every
    // answer after the first would silently rebind. This is the property the marker id exists
    // for.
    const { mapping } = cut(
      "The capital of Italy is {{italy}}, and of France is {{france}}.",
      [
        { id: "france", accept: ["Paris"] },
        { id: "italy", accept: ["Rome"] },
      ],
      false,
      "text-entry",
    );
    expect(mapping.france.accept).toEqual(["Paris"]);
    expect(mapping.italy.accept).toEqual(["Rome"]);
  });
});

describe("case sensitivity resolves at compile time", () => {
  test("each entry carries its own, taken from the interaction by default", () => {
    const { mapping } = cut("A {{a}} and a {{b}}.", [
      { id: "a", accept: ["x"] },
      { id: "b", accept: ["y"] },
    ], true, "text-entry");
    expect(mapping.a.caseSensitive).toBe(true);
    expect(mapping.b.caseSensitive).toBe(true);
  });

  test("a response overrides the interaction's default", () => {
    const { mapping } = cut("The agency {{agency}} launched from {{place}}.", [
      { id: "agency", accept: ["NASA"], caseSensitive: true },
      { id: "place", accept: ["Cape Canaveral"] },
    ], false, "text-entry");
    expect(mapping.agency.caseSensitive).toBe(true);
    expect(mapping.place.caseSensitive).toBe(false);
  });
});

describe("the cross-checks named binding makes possible", () => {
  const err = (fn: () => unknown): string => {
    try {
      fn();
    } catch (e: any) {
      return String(e.message);
    }
    return "";
  };

  test("a marker no response declares names it, and lists what is declared", () => {
    const msg = err(() => cut("The capital is {{captial}}.", one, false, "text-entry"));
    expect(msg).toContain("{{captial}}");
    expect(msg).toContain("no response declares that id");
    expect(msg).toContain("declares: capital");
  });

  test("a response with no marker names it — the check L0176 cannot make", () => {
    const msg = err(() =>
      cut("The capital of France is {{capital}}.", [
        { id: "capital", accept: ["Paris"] },
        { id: "orphan", accept: ["nothing"] },
      ], false, "text-entry"),
    );
    expect(msg).toContain('response "orphan"');
    expect(msg).toContain("nothing can be typed into it");
  });

  test("text with no marker at all renders nothing to fill in", () => {
    const msg = err(() => cut("The capital of France is Paris.", one, false, "text-entry"));
    expect(msg).toContain("no {{…}} marker");
    expect(msg).toContain("no blank to fill in");
  });

  test("the same marker twice is one response asked for twice", () => {
    const msg = err(() => cut("{{capital}} and {{capital}}.", one, false, "text-entry"));
    expect(msg).toContain("appears twice");
    expect(msg).toContain("own id");
  });

  test("a duplicate response id", () => {
    const msg = err(() =>
      cut("{{a}}", [
        { id: "a", accept: ["x"] },
        { id: "a", accept: ["y"] },
      ], false, "text-entry"),
    );
    expect(msg).toContain('the id "a" is already used');
  });

  test("a response needs an id and an accept", () => {
    expect(err(() => cut("{{a}}", [{ accept: ["x"] }], false, "text-entry"))).toContain(
      "needs an `id`",
    );
    expect(err(() => cut("{{a}}", [{ id: "a" }], false, "text-entry"))).toContain("needs `accept`");
    expect(err(() => cut("{{a}}", [{ id: "a", accept: [] }], false, "text-entry"))).toContain(
      "needs `accept`",
    );
    expect(err(() => cut("{{a}}", [{ id: "a", accept: ["  "] }], false, "text-entry"))).toContain(
      "accept entry 1 is empty",
    );
  });

  test("an empty marker says what to write instead", () => {
    const msg = err(() => cut("The capital is {{}}.", one, false, "text-entry"));
    expect(msg).toContain("names no response");
    expect(msg).toContain("{{<id>}}");
  });

  test("braces in the passage that are not a marker are caught, not ignored", () => {
    // A passage can legitimately contain braces. They surface as an unknown id rather than
    // being silently swallowed or silently rendered.
    const msg = err(() => cut("The set {{1,2}} has {{capital}} members.", one, false, "text-entry"));
    expect(msg).toContain("no response declares that id");
  });
});
