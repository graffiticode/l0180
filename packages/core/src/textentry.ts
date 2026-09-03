// SPDX-License-Identifier: MIT
/**
 * Cutting a sentence into text and blanks, and binding each blank to its response.
 *
 * Pure: no AST, no CPS, no compiler types — the same shape as `hottext.ts`, and for the same
 * reason: the logic is worth testing on its own.
 *
 * The marker is `{{<id>}}` and the id is the response's identifier, so the answer binds to the
 * blank BY NAME. That is the one property worth taking from QTI here, where an inline
 * `<qti-text-entry-interaction response-identifier="RESPONSE"/>` binds to a sibling
 * `<qti-response-declaration identifier="RESPONSE">`. Learnosity's `{{response}}` carries no
 * identity and its answers are a parallel array matched by order of appearance, so reordering a
 * clause silently misaligns every answer after it. The delimiters here are theirs; the binding
 * is not.
 */

/** One run of the sentence: literal text, or a blank the candidate types into. */
export interface Segment {
  /** Present on a literal run. */
  text?: string;
  /** Present on a blank: the response's identifier. */
  id?: string;
  blank?: true;
}

/** One answer a blank recognizes, already merged. */
export interface Response {
  response?: string;
  assess?: { correct?: boolean; points?: number; rationale?: string };
}

/** One blank, already merged. */
export interface Blank {
  id?: string;
  responses?: Response[];
  caseSensitive?: boolean;
}

/** What one recognized answer is worth. The shape of a choice mapping value, plus its text. */
export interface Recognized {
  response: string;
  correct?: true;
  points: number;
  rationale?: string;
}

/**
 * What a blank is worth and what it recognizes.
 *
 * Comparing a typed answer against these happens in the scorer, not here — the compiler builds
 * this and never reads it back.
 */
export interface Entry {
  points: number;
  caseSensitive: boolean;
  responses: Recognized[];
}

const MARKER = /\{\{([^{}]*)\}\}/g;

/**
 * How a typed answer is compared: whitespace normalized, case only when it does not matter.
 *
 * `score.ts` carries the same rule, because the scorer cannot import from core. They must agree
 * — a compile-time collision check under one rule and a match under another would let two
 * responses claim the same input at run time. `textentry-units.test.ts` asserts they agree.
 */
export function normalize(s: unknown, caseSensitive: boolean): string {
  const t = String(s ?? "").trim().replace(/\s+/g, " ");
  return caseSensitive ? t : t.toLowerCase();
}

export interface Cut {
  segments: Segment[];
  mapping: Record<string, Entry>;
}

/**
 * Cut the text at its markers and bind each blank to what it recognizes.
 *
 * Every mismatch is a compile error naming the fix. Named binding is what makes these checks
 * possible at all — a positional model cannot say which answer is orphaned, and L0176 does not
 * even check that the marker count matches the answer count.
 */
export function cut(
  text: string,
  blanks: Blank[],
  caseSensitive: boolean,
  where: string,
): Cut {
  const declared = new Map<string, Entry>();
  blanks.forEach((b, i) => {
    const at = `${where}: blank ${i + 1}`;
    const id = typeof b.id === "string" ? b.id.trim() : "";
    if (!id) {
      throw new Error(
        `${at}: needs an \`id\`, which is what the marker in the text refers to — ` +
          'e.g. [ id "capital" responses [ [ response "Paris" assess [ correct ] ] ] {} ] ' +
          "with {{capital}} in the text.",
      );
    }
    if (declared.has(id)) {
      throw new Error(`${at}: the id "${id}" is already used. Each blank needs its own.`);
    }
    if (!Array.isArray(b.responses) || !b.responses.length) {
      throw new Error(
        `${at}: needs at least one response, e.g. responses [ [ response "Paris" assess [ correct ] ] ] {}.`,
      );
    }

    const cs = b.caseSensitive !== undefined ? b.caseSensitive === true : caseSensitive;
    const recognized: Recognized[] = [];
    const claimed = new Map<string, number>();
    b.responses.forEach((r, j) => {
      const rat = `${at}: response ${j + 1}`;
      const value = typeof r.response === "string" ? r.response.trim() : "";
      if (!value) {
        throw new Error(
          `${rat}: needs the answer it recognizes, e.g. [ response "Paris" assess [ correct ] ].`,
        );
      }
      const norm = normalize(value, cs);
      const prior = claimed.get(norm);
      if (prior !== undefined) {
        throw new Error(
          `${rat}: "${value}" is the same answer as response ${prior}` +
            (cs ? "" : " once capitals are ignored") +
            ". Two responses cannot claim the same typed input — merge them, or set " +
            "`case-sensitive true` if the difference is meant to matter.",
        );
      }
      claimed.set(norm, j + 1);

      const assess = r.assess;
      if (assess === undefined) {
        // A recognized answer worth nothing and unexplained is just a wrong answer, which the
        // blank already handles by not recognizing it.
        throw new Error(
          `${rat}: needs an \`assess\` saying what "${value}" is worth — ` +
            "`assess [correct]` for a right answer, `assess [points 1]` for partial credit, " +
            '`assess [rationale "…"]` to explain a wrong one.',
        );
      }
      const isCorrect = assess.correct === true;
      const hasPoints = typeof assess.points === "number";
      const hasRationale = typeof assess.rationale === "string";
      if (!isCorrect && !hasPoints && !hasRationale) {
        throw new Error(
          `${rat}: assess must say what it asserts — \`correct\`, \`points\`, or \`rationale\`.`,
        );
      }
      recognized.push({
        response: value,
        ...(isCorrect ? { correct: true as const } : {}),
        points: hasPoints ? (assess.points as number) : isCorrect ? 1 : 0,
        ...(hasRationale ? { rationale: assess.rationale as string } : {}),
      });
    });

    const correct = recognized.filter((r) => r.correct);
    if (!correct.length) {
      throw new Error(
        `${at}: no response is marked \`correct\`, so the blank cannot be scored. ` +
          "Add `assess [correct]` to the right answer.",
      );
    }
    // Only one answer can be typed, so the blank is worth its best correct one — not their sum.
    // `choice` sums because several options can be selected; the difference is cardinality.
    declared.set(id, {
      points: Math.max(...correct.map((r) => r.points)),
      caseSensitive: cs,
      responses: recognized,
    });
  });

  const segments: Segment[] = [];
  const seen = new Map<string, number>();
  let last = 0;
  let n = 0;
  MARKER.lastIndex = 0;
  for (let m = MARKER.exec(text); m !== null; m = MARKER.exec(text)) {
    n += 1;
    const id = m[1].trim();
    if (!id) {
      throw new Error(
        `${where}: a marker at position ${m.index} names no blank. Write {{<id>}}, ` +
          'e.g. {{capital}}, matching an id in `blanks`.',
      );
    }
    if (!declared.has(id)) {
      throw new Error(
        `${where}: the text has {{${id}}} but no blank declares that id. ` +
          `\`blanks\` declares: ${[...declared.keys()].join(", ") || "nothing"}.`,
      );
    }
    if (seen.has(id)) {
      throw new Error(
        `${where}: {{${id}}} appears twice. One blank is one input — give the second its ` +
          "own id and its own entry in `blanks`.",
      );
    }
    seen.set(id, n);
    if (m.index > last) segments.push({ text: text.slice(last, m.index) });
    segments.push({ id, blank: true });
    last = m.index + m[0].length;
  }

  if (!seen.size) {
    // L0176 guards this one too, and it is worth having: the item renders as a plain sentence
    // with nothing to fill in, and nothing downstream complains.
    throw new Error(
      `${where}: \`text\` has no {{…}} marker, so the item renders with no blank to fill in. ` +
        'Put {{<id>}} where the answer goes, e.g. "The capital of France is {{capital}}."',
    );
  }
  if (last < text.length) segments.push({ text: text.slice(last) });

  const orphan = [...declared.keys()].find((id) => !seen.has(id));
  if (orphan !== undefined) {
    throw new Error(
      `${where}: blank "${orphan}" has no {{${orphan}}} in the text, so nothing can be ` +
        "typed into it. Add the marker, or remove the blank.",
    );
  }

  return { segments, mapping: Object.fromEntries(declared) };
}
