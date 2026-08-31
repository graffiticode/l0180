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

/** The answer key half of a compiled item. */
export interface Validation {
  /** The maximum achievable — the sum of the `correct` options only. */
  points: number;
  options: Record<string, OptionValidation>;
}

/** What one option contributed to the result. */
export interface OptionOutcome {
  selected: boolean;
  /** The option's own points, whether or not it was selected. */
  points: number;
  correct: boolean;
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
  /** Per option, keyed as `validation.options` is. */
  options: Record<string, OptionOutcome>;
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
  const key = validation?.options || {};
  const maxPoints = typeof validation?.points === "number" ? validation.points : 0;
  const selected = selectedIds(response);

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
