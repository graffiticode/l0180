// SPDX-License-Identifier: MIT
/**
 * Scoring a choice response against a compiled `validation`.
 *
 * NO React, NO DOM, and nothing in this file's import graph may reach either. The same code
 * has to run server-side, where an item is scored without shipping its answer key to the
 * browser, and a module that touches `document` at import time cannot be loaded there. L0166
 * learned this the hard way — its scorer was exported from the same entry as its Form and
 * could not be loaded in bare Node.
 *
 * The compiler resolves points at compile time, so this does arithmetic and nothing else:
 * no inheritance to walk, no defaults to reapply. `validation.points` is the ceiling, and it
 * was summed from the same per-option numbers this sums.
 */

/** One option's entry in a compiled `validation.options`. */
export interface OptionValidation {
  /** Present and true when selecting this option is a right answer. */
  correct?: boolean;
  /** What selecting it is worth. Negative penalizes. */
  points: number;
}

/**
 * QTI's response-processing templates, and the only thing that decides how a response scores.
 *
 * `map_response` maps each selected identifier to a score and sums them. `match_correct` is
 * all-or-nothing against the correct set. They are alternatives, and so are the fields that
 * serve them: a `map_response` key carries `mapping`, a `match_correct` key carries
 * `correctResponse`, and neither carries the other.
 */
export type ResponseProcessing = "map_response" | "match_correct";

/** The answer key half of a compiled item. */
export interface Validation {
  /** Which template scores this response. Absent means `map_response`, the historical default. */
  responseProcessing?: ResponseProcessing;
  /** The maximum achievable. Under `map_response`, the sum of the `correct` options only. */
  points: number;
  /** `map_response` only: what each identifier is worth. */
  mapping?: Record<string, OptionValidation>;
  /** `match_correct` only: the set that must be selected exactly. */
  correctResponse?: string[];
  /** Why an option is right or wrong, keyed as the options are. Shown once it is selected. */
  feedback?: Record<string, string>;
}

/**
 * The correct identifiers, whichever template is in force.
 *
 * Exported so the renderer's ✓/✗ and the scorer cannot disagree about which options are right —
 * they read the same function rather than each reaching into the key's shape.
 */
export function correctIds(validation: Validation | null | undefined): string[] {
  if (validation?.correctResponse) return validation.correctResponse.slice();
  const mapping = validation?.mapping || {};
  return Object.keys(mapping).filter((id) => mapping[id]?.correct === true);
}

/** What one option contributed to the result. */
export interface OptionOutcome {
  selected: boolean;
  /** The option's own points, whether or not it was selected. */
  points: number;
  correct: boolean;
}

/** How an item's parts combine into its score. */
export type ScoringMode = "additive" | "conjunctive";

/** The answer key of a multi-part item. */
export interface ItemValidation {
  points: number;
  scoring: ScoringMode;
  parts: Record<string, Validation>;
}

export interface Score {
  /** Points earned, floored at zero — see `rawPoints`. */
  points: number;
  /**
   * The unclamped sum, which penalties can drive negative.
   *
   * `points` is floored at zero because an item that scores below zero subtracts from the
   * other items in an activity, which is almost never what an author means by a distractor
   * penalty. The raw figure is kept so a host that does want signed item scores has it,
   * rather than having to re-derive it from the key.
   */
  rawPoints: number;
  /** `validation.points` — what a fully correct response earns. */
  maxPoints: number;
  /** Earned everything available. False for an unscored item, which has nothing to earn. */
  correct: boolean;
  /** Per option, keyed as `validation.options` is. Present for a choice. */
  options?: Record<string, OptionOutcome>;
  /** Per part, keyed as `validation.parts` is. Present for a multi-part item. */
  parts?: Record<string, Score>;
}

/**
 * A response is a list of selected option ids. A bare string is accepted because a
 * single-select UI naturally reports one id rather than a list of one.
 */
export function selectedIds(response: unknown): string[] {
  if (response === null || response === undefined) return [];
  const list = Array.isArray(response) ? response : [response];
  const out: string[] = [];
  for (const r of list) {
    if (typeof r !== "string" || out.includes(r)) continue;
    out.push(r);
  }
  return out;
}

/**
 * Score a response. Never throws: an item mid-edit, or a response naming an option that no
 * longer exists, scores what it can rather than taking the renderer down with it.
 */
export function scoreChoice({
  response,
  validation,
}: {
  response: unknown;
  validation: Validation | null | undefined;
}): Score {
  const maxPoints = typeof validation?.points === "number" ? validation.points : 0;
  const selected = selectedIds(response);

  if (validation?.responseProcessing === "match_correct") {
    const wanted = validation.correctResponse || [];
    // Every correct option and nothing else. A subset and a superset both score zero — partial
    // credit is precisely what this template exists to refuse.
    const exact =
      wanted.length > 0 &&
      selected.length === wanted.length &&
      wanted.every((id) => selected.includes(id));
    const options: Record<string, OptionOutcome> = {};
    for (const id of new Set([...wanted, ...selected])) {
      options[id] = { selected: selected.includes(id), points: 0, correct: wanted.includes(id) };
    }
    const earned = exact ? maxPoints : 0;
    return { points: earned, rawPoints: earned, maxPoints, correct: exact, options };
  }

  const key = validation?.mapping || {};
  const options: Record<string, OptionOutcome> = {};
  let rawPoints = 0;
  for (const id of Object.keys(key)) {
    const entry = key[id];
    const isSelected = selected.includes(id);
    const points = typeof entry?.points === "number" ? entry.points : 0;
    options[id] = { selected: isSelected, points, correct: entry?.correct === true };
    if (isSelected) rawPoints += points;
  }

  const points = Math.max(0, rawPoints);
  return { points, rawPoints, maxPoints, correct: maxPoints > 0 && points >= maxPoints, options };
}

/**
 * Score a multi-part item. The response is keyed by part id, as `validation.parts` is.
 *
 * `conjunctive` is the mode the wrapper exists for: the item's points are earned only when
 * EVERY part is fully correct, and nothing otherwise. Picking the right claim while citing the
 * wrong line scores zero, not half — which is what a two-part evidence item means by "one
 * point". `additive` simply sums the parts.
 */
export function scoreItem({
  response,
  validation,
}: {
  response: unknown;
  validation: ItemValidation | null | undefined;
}): Score {
  const key = validation?.parts || {};
  const mode: ScoringMode = validation?.scoring === "conjunctive" ? "conjunctive" : "additive";
  const maxPoints = typeof validation?.points === "number" ? validation.points : 0;
  const given = response !== null && typeof response === "object" ? (response as any) : {};

  const parts: Record<string, Score> = {};
  let summed = 0;
  let everyPartCorrect = true;
  for (const id of Object.keys(key)) {
    const s = scoreChoice({ response: given[id], validation: key[id] });
    parts[id] = s;
    summed += s.points;
    if (!s.correct) everyPartCorrect = false;
  }

  const hasParts = Object.keys(key).length > 0;
  if (mode === "conjunctive") {
    const earned = hasParts && everyPartCorrect ? maxPoints : 0;
    return { points: earned, rawPoints: earned, maxPoints, correct: hasParts && everyPartCorrect, parts };
  }
  const points = Math.max(0, summed);
  return { points, rawPoints: summed, maxPoints, correct: maxPoints > 0 && points >= maxPoints, parts };
}

/**
 * Score whatever a compiled item turns out to be. This is the entry point a host should use;
 * `scoreChoice` and `scoreItem` are the cases behind it.
 */
export function scoreInteraction({
  interaction,
  validation,
  response,
}: {
  interaction: { type?: string } | null | undefined;
  validation: any;
  response: unknown;
}): Score {
  if (interaction?.type === "item") return scoreItem({ response, validation });
  return scoreChoice({ response, validation });
}
