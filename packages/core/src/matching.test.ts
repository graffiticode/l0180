// SPDX-License-Identifier: MIT
/**
 * The one place a typed answer is compared to an authored one.
 *
 * Shared by the compiler and the scorer, so these cases stand for both. Before this module the
 * rule was written twice with a test asserting the two agreed; one implementation cannot
 * disagree with itself, and the drift that mattered — a collision the compiler refuses becoming
 * a silent first-match at score time — is now impossible rather than watched.
 */
import { test, describe, expect } from "vitest";
import { Decimal } from "decimal.js";
import { normalize, parseNumber, sameNumber } from "./matching.js";

const n = (s: string) => parseNumber(s)?.toString();

describe("parseNumber accepts", () => {
  test("integers and a leading sign", () => {
    expect(n("8")).toBe("8");
    expect(n("-3")).toBe("-3");
    expect(n("+7")).toBe("7");
  });

  test("decimals, however written", () => {
    // The whole point: all of these are the same number, and string comparison said otherwise.
    expect(n("0.5")).toBe("0.5");
    expect(n(".5")).toBe("0.5");
    expect(n("0.50")).toBe("0.5");
    expect(n("0.500000")).toBe("0.5");
    expect(n("-0.25")).toBe("-0.25");
  });

  test("simple fractions", () => {
    expect(n("1/2")).toBe("0.5");
    expect(n("3/4")).toBe("0.75");
    expect(n("-7/8")).toBe("-0.875");
    expect(n("4/2")).toBe("2");
  });

  test("thousands groupings", () => {
    expect(n("1,000")).toBe("1000");
    expect(n("1,234,567")).toBe("1234567");
    expect(n("1,000.25")).toBe("1000.25");
  });

  test("surrounding whitespace", () => {
    expect(n("  0.5  ")).toBe("0.5");
  });
});

describe("parseNumber rejects", () => {
  const rejected = [
    ["an expression", "1/2 + 1/3"],
    ["units", "5 cm"],
    ["a symbol", "x/2"],
    ["percent, which is ambiguous", "50%"],
    ["scientific notation, deliberately out", "5e-1"],
    ["division by zero", "1/0"],
    ["a comma that is not a grouping", "1,2"],
    ["two slashes", "1/2/3"],
    ["words", "half"],
    ["nothing", "   "],
    ["a bare sign", "-"],
    ["a bare point", "."],
  ];
  for (const [why, input] of rejected) {
    test(`${why}: ${JSON.stringify(input)}`, () => {
      expect(parseNumber(input)).toBeNull();
    });
  }
});

describe("arithmetic is decimal, not binary", () => {
  test("0.1 + 0.2 equals 0.3, which is false in binary floating point", () => {
    // 0.1 + 0.2 === 0.30000000000000004 as JS numbers. That difference is small until it lands
    // on a tolerance boundary and decides a grade.
    expect(0.1 + 0.2 === 0.3).toBe(false);
    const sum = (parseNumber("0.1") as Decimal).add(parseNumber("0.2") as Decimal);
    expect(sameNumber(sum, parseNumber("0.3") as Decimal)).toBe(true);
  });

  test("a third is a third", () => {
    expect(sameNumber(parseNumber("1/3") as Decimal, parseNumber("1/3") as Decimal)).toBe(true);
  });

  test("a rounded third is not, without a tolerance", () => {
    const third = parseNumber("1/3") as Decimal;
    expect(sameNumber(third, parseNumber("0.333") as Decimal)).toBe(false);
    expect(sameNumber(third, parseNumber("0.333") as Decimal, 0.001)).toBe(true);
  });
});

describe("sameNumber", () => {
  const d = (s: string) => parseNumber(s) as Decimal;

  test("exact when no tolerance is given, and that is already enough", () => {
    expect(sameNumber(d("0.5"), d("0.50"))).toBe(true);
    expect(sameNumber(d("0.5"), d("1/2"))).toBe(true);
    expect(sameNumber(d("0.5"), d("0.51"))).toBe(false);
  });

  test("a tolerance widens it symmetrically, and its edge is inclusive", () => {
    expect(sameNumber(d("0.51"), d("0.5"), 0.01)).toBe(true);
    expect(sameNumber(d("0.49"), d("0.5"), 0.01)).toBe(true);
    expect(sameNumber(d("0.511"), d("0.5"), 0.01)).toBe(false);
    expect(sameNumber(d("0.51"), d("0.5"), 0.001)).toBe(false);
  });
});

describe("normalize", () => {
  test("collapses surrounding and repeated whitespace", () => {
    expect(normalize("  Cape   Canaveral ", false)).toBe("cape canaveral");
  });

  test("case only when it is asked to matter", () => {
    expect(normalize("NASA", false)).toBe("nasa");
    expect(normalize("NASA", true)).toBe("NASA");
  });

  test("punctuation survives — the typed string IS the answer", () => {
    expect(normalize("can't", false)).toBe("can't");
    expect(normalize("cant", false)).not.toBe(normalize("can't", false));
  });
});
