// SPDX-License-Identifier: MIT
/**
 * How a typed answer is compared to an authored one.
 *
 * Shared deliberately. The compiler parses authored answers — to validate them, and to refuse
 * two that would recognize the same input — and the scorer parses what the candidate types. If
 * those two disagreed by so much as a rounding rule, a collision the compiler refused would
 * become a silent first-match-wins at score time. One implementation cannot disagree with
 * itself, which is why this is published as `@graffiticode/l0180/matching` rather than written
 * twice.
 *
 * The subpath matters: importing `@graffiticode/l0180` would pull the compiler and
 * @graffiticode/l0000 into the browser, and the scorer is supposed to be loadable on its own.
 * Only this file and decimal.js come along.
 */
import { Decimal } from "decimal.js";

/**
 * String comparison: whitespace normalized, case only when the author says it matters.
 *
 * Gentler than the compiler's quote matching for hottext, which strips all punctuation so a
 * quote can locate its sentence. Here the typed string IS the answer, so `cant` must not pass
 * for `can't`.
 */
export function normalize(s: unknown, caseSensitive: boolean): string {
  const t = String(s ?? "").trim().replace(/\s+/g, " ");
  return caseSensitive ? t : t.toLowerCase();
}

/** `1,000` is a number; `1,2` is a typo. Only real thousands groupings are stripped. */
const THOUSANDS = /^([+-]?)(\d{1,3}(?:,\d{3})+)(\.\d*)?$/;
const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

function decimalOnly(s: string): Decimal | null {
  const t = s.trim();
  if (!t) return null;
  const grouped = THOUSANDS.exec(t);
  const bare = grouped ? `${grouped[1]}${grouped[2].replace(/,/g, "")}${grouped[3] ?? ""}` : t;
  if (!DECIMAL.test(bare)) return null;
  try {
    return new Decimal(bare);
  } catch {
    return null;
  }
}

/**
 * Parse a typed number. Integers, decimals, a leading sign, and simple fractions.
 *
 * Decimal rather than binary, because 0.1 has no exact binary representation and a tolerance
 * comparison at its boundary would land either side of the line depending on the values. An
 * assessment scorer is the wrong place for that.
 *
 * A fraction divides at decimal.js's default precision, so 1/3 is a 20-significant-digit
 * decimal rather than a repeating one. Both sides of every comparison come through here, so the
 * rounding is shared and 1/3 equals 1/3. A candidate typing 0.333 against 1/3 needs a
 * tolerance, which is correct rather than a limitation.
 *
 * Returns null for anything else — an expression, a unit, a symbol. That boundary is where
 * L0176 reaches for Learnosity's math engine, and where this stops on purpose.
 */
export function parseNumber(s: unknown): Decimal | null {
  const t = String(s ?? "").trim();
  if (!t) return null;
  const slash = t.indexOf("/");
  if (slash < 0) return decimalOnly(t);
  const numerator = decimalOnly(t.slice(0, slash));
  const denominator = decimalOnly(t.slice(slash + 1));
  if (!numerator || !denominator || denominator.isZero()) return null;
  return numerator.div(denominator);
}

/**
 * Do two numbers count as the same answer?
 *
 * `tolerance` is absolute and symmetric — QTI's `absolute` mode, its default when a tolerance is
 * given. Absent, the comparison is exact in decimal, which already makes 0.50, .5 and 1/2 equal
 * to 0.5 without any tolerance at all.
 */
export function sameNumber(a: Decimal, b: Decimal, tolerance?: number): boolean {
  if (tolerance === undefined) return a.eq(b);
  return a.sub(b).abs().lte(new Decimal(tolerance));
}
