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

/** One entry of an authored `responses` list, already merged. */
export interface Response {
  id?: string;
  accept?: string[];
  caseSensitive?: boolean;
}

/**
 * What a blank is worth and what it takes.
 *
 * Comparing a typed answer against `accept` happens in the scorer, not here — the compiler
 * builds this and never reads it back.
 */
export interface Entry {
  correct: true;
  points: number;
  accept: string[];
  caseSensitive: boolean;
}

const MARKER = /\{\{([^{}]*)\}\}/g;

export interface Cut {
  segments: Segment[];
  mapping: Record<string, Entry>;
}

/**
 * Cut the text at its markers and bind each blank to its response.
 *
 * Every mismatch is a compile error naming the fix. Named binding is what makes these checks
 * possible at all — a positional model cannot say which answer is orphaned, and L0176 does not
 * even check that the marker count matches the answer count.
 */
export function cut(
  text: string,
  responses: Response[],
  caseSensitive: boolean,
  where: string,
): Cut {
  const declared = new Map<string, Response>();
  responses.forEach((r, i) => {
    const at = `${where}: response ${i + 1}`;
    const id = typeof r.id === "string" ? r.id.trim() : "";
    if (!id) {
      throw new Error(
        `${at}: needs an \`id\`, which is what the marker in the text refers to — ` +
          'e.g. [ id "capital" accept [ "Paris" ] ] with {{capital}} in the text.',
      );
    }
    if (declared.has(id)) {
      throw new Error(`${at}: the id "${id}" is already used. Each response needs its own.`);
    }
    if (!Array.isArray(r.accept) || !r.accept.length) {
      throw new Error(
        `${at}: needs \`accept\` listing what counts as right, e.g. accept [ "Paris" ]. ` +
          "List every spelling you will take.",
      );
    }
    const bad = r.accept.findIndex((a) => typeof a !== "string" || !a.trim());
    if (bad >= 0) {
      throw new Error(`${at}: accept entry ${bad + 1} is empty. Every accepted answer must be text.`);
    }
    declared.set(id, r);
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
        `${where}: a marker at position ${m.index} names no response. Write {{<id>}}, ` +
          'e.g. {{capital}}, matching an id in `responses`.',
      );
    }
    if (!declared.has(id)) {
      throw new Error(
        `${where}: the text has {{${id}}} but no response declares that id. ` +
          `\`responses\` declares: ${[...declared.keys()].join(", ") || "nothing"}.`,
      );
    }
    if (seen.has(id)) {
      throw new Error(
        `${where}: {{${id}}} appears twice. One response is one blank — give the second its ` +
          "own id and its own entry in `responses`.",
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
      `${where}: response "${orphan}" has no {{${orphan}}} in the text, so nothing can be ` +
        "typed into it. Add the marker, or remove the response.",
    );
  }

  const mapping: Record<string, Entry> = {};
  for (const [id, r] of declared) {
    mapping[id] = {
      correct: true,
      points: 1,
      accept: (r.accept as string[]).map((a) => a.trim()),
      // Resolved here rather than left to the scorer to inherit — points resolve at compile
      // time in this language, and so does this.
      caseSensitive: r.caseSensitive !== undefined ? r.caseSensitive === true : caseSensitive,
    };
  }
  return { segments, mapping };
}
