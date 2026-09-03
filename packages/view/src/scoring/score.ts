// SPDX-License-Identifier: MIT
/**
 * Scoring a response against a compiled `validation`.
 *
 * NO React, NO DOM, and nothing in this file's import graph may reach either. The same code
 * has to run server-side, where an item is scored without shipping its answer key to the
 * browser, and a module that touches `document` at import time cannot be loaded there. L0166
 * learned this the hard way — its scorer was exported from the same entry as its Form and
 * could not be loaded in bare Node.
 *
 * The compiler resolves points at compile time, so this does arithmetic and nothing else: no
 * inheritance to walk, no defaults to reapply. `validation.points` is the ceiling, and it was
 * summed from the same per-option numbers this sums.
 *
 * The one import is `@graffiticode/l0180/matching` — the rules for comparing a typed answer,
 * shared with the compiler so a collision it refuses cannot become a match here. A subpath on
 * purpose: the package root would drag the whole compiler into the browser.
 */
import { normalize, parseNumber, sameNumber } from "@graffiticode/l0180/matching";


/** One option's entry in a compiled `validation.options`. */
export interface OptionValidation {
  /** Present and true when selecting this option is a right answer. */
  correct?: boolean;
  /** What selecting it is worth. Negative penalizes. */
  points: number;
  /**
   * Typed answers only: what this blank recognizes, in authored order.
   *
   * Each is a mapping value plus the `response` that identifies it — QTI's mapKey. A recognized
   * wrong answer sits here too, with its points and its rationale, which is how a typed mistake
   * gets explained back the way a chosen one does.
   */
  responses?: { response: string; correct?: boolean; points: number; rationale?: string }[];
  /**
   * What this blank's answers are made of.
   *
   * Per blank rather than per interaction, because a text-entry has one response variable per
   * blank and QTI gives each its own declaration. One numeric blank beside a text one is why
   * this cannot live at the top.
   */
  baseType?: BaseType;
  /** `string` only: whether capitals must match. Already resolved by the compiler. */
  caseSensitive?: boolean;
  /** Numeric only: how far a typed answer may be and still count. Absolute and symmetric. */
  tolerance?: number;
  /**
   * Numeric only: the written forms this blank accepts, already expanded by the compiler.
   *
   * Absent means any of them. Present, a typed answer written another way is refused even when
   * its value is right — which is how "express your answer as a fraction" is asked.
   */
  inputFormats?: string[];
}

/**
 * QTI's response-processing templates, and the only thing that decides how a response scores.
 *
 * `map_response` maps each selected identifier to a score and sums them. `match_correct` is
 * all-or-nothing against the correct set. They are alternatives, and so are the fields that
 * serve them: a `map_response` key carries `mapping`, a `match_correct` key carries
 * `correctResponse`, and neither carries the other.
 *
 * `human` means nothing here can score it — a written response marked by a person against a
 * rubric. It is NOT an unscored item: an unscored item has nothing to earn, this has points
 * that cannot be awarded yet, which is the difference `Score.pending` carries.
 */
export type ResponseProcessing = "map_response" | "match_correct" | "human";

/**
 * What the response is made of — QTI's baseType.
 *
 * `identifier` is what the candidate selected, and a mapping key names an option. The rest are
 * what the candidate typed, and a mapping key names a blank: `string` compares text, `float` and
 * `integer` compare numbers, so 0.50, .5 and 1/2 are one answer rather than three.
 *
 * On a text-entry it sits on each mapping entry rather than at the top, because a text-entry has
 * one response variable per blank and they need not agree — a numeric blank can sit beside a
 * text one in the same sentence.
 */
export type BaseType = "identifier" | "string" | "float" | "integer";

/** The answer key half of a compiled item. */
export interface Validation {
  /** Which template scores this response. Absent means `map_response`, the historical default. */
  responseProcessing?: ResponseProcessing;
  /** The maximum achievable. Under `map_response`, the sum of the `correct` options only. */
  points: number;
  /** QTI cardinality of the response variable. Absent on a human-scored key. */
  cardinality?: "single" | "multiple";
  /** What the response is made of. Absent means `identifier`. */
  baseType?: BaseType;
  /** `map_response` only: what each identifier is worth. */
  mapping?: Record<string, OptionValidation>;
  /**
   * `map_response` only: the most the mapping can earn — QTI's `mapping@upper-bound`.
   *
   * Set below the sum of the correct entries it means "any N of these": more identifiers are
   * right than the candidate is asked to pick, and picking any N of them reaches the ceiling.
   */
  upperBound?: number;
  /** `match_correct` only: the set that must be selected exactly. */
  correctResponse?: string[];
  /** Why an option is right or wrong, keyed as the options are. Shown once it is selected. */
  feedback?: Record<string, string>;
  /** `human` only: the bands a person marks the response against, highest first. */
  rubric?: { points: number; descriptor: string }[];
  /** `human` only: a response that would earn full marks. */
  exemplar?: string;
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

/** What one option, unit or blank contributed to the result. */
export interface OptionOutcome {
  selected: boolean;
  /** The option's own points, whether or not it was selected. */
  points: number;
  correct: boolean;
  /**
   * Typed answers only: why the recognized answer they typed is wrong.
   *
   * Reported here so the renderer does not repeat the match to find it — the scorer already
   * knows which response entry was hit.
   */
  rationale?: string;
  /**
   * The value was right and the way it was written was not.
   *
   * A distinct outcome from being wrong: the candidate did the work and presented it in a form
   * the question did not ask for, and telling them so is different from telling them they are
   * incorrect. Carries the forms that would have been accepted.
   */
  wrongFormat?: string[];
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
  /**
   * True when some of this score is waiting on a person.
   *
   * A written response cannot be marked here, so reporting 0 would be a lie — the candidate
   * would be told they earned nothing when nobody has looked yet. An item holding one reports
   * what its other parts earned and says the rest is pending.
   */
  pending?: boolean;
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

  // The bound caps what the selections can earn; `rawPoints` stays the unclamped sum, so a host
  // that wants the signed total still has it.
  const bounded =
    typeof validation?.upperBound === "number" ? Math.min(rawPoints, validation.upperBound) : rawPoints;
  const points = Math.max(0, bounded);
  return { points, rawPoints, maxPoints, correct: maxPoints > 0 && points >= maxPoints, options };
}

/**
 * Score typed answers. The response is a map of blank id to what was typed.
 *
 * `caseSensitive` is read off each entry and never inherited from the key as a whole — the
 * compiler resolved it, the same way it resolves points.
 */
export function scoreTextEntry({
  response,
  validation,
}: {
  response: unknown;
  validation: Validation | null | undefined;
}): Score {
  const key = validation?.mapping || {};
  const maxPoints = typeof validation?.points === "number" ? validation.points : 0;
  const given = response !== null && typeof response === "object" ? (response as any) : {};

  const options: Record<string, OptionOutcome> = {};
  let rawPoints = 0;
  for (const id of Object.keys(key)) {
    const entry = key[id];
    const typed = given[id];
    const answered = typeof typed === "string" && typed.trim().length > 0;
    // First match wins. The compiler refuses two responses that would recognize the same input,
    // so at most one can match — this order only decides anything if that check was bypassed.
    const { hit, wrongFormat } = answered ? recognize(entry, typed) : {};
    options[id] = {
      selected: answered,
      points: hit?.points ?? 0,
      correct: hit?.correct === true,
      ...(hit?.rationale ? { rationale: hit.rationale } : {}),
      ...(wrongFormat ? { wrongFormat } : {}),
    };
    if (hit) rawPoints += hit.points;
  }

  if (validation?.responseProcessing === "match_correct") {
    const all = Object.keys(key).length > 0 && Object.keys(key).every((id) => options[id].correct);
    const earned = all ? maxPoints : 0;
    return { points: earned, rawPoints: earned, maxPoints, correct: all, options };
  }
  const points = Math.max(0, rawPoints);
  return { points, rawPoints, maxPoints, correct: maxPoints > 0 && points >= maxPoints, options };
}

/**
 * Which authored answer, if any, the typed one matches.
 *
 * Numbers are compared as numbers, which is the whole point: `0.50`, `.5` and `1/2` are all
 * `0.5`, and no enumeration of spellings could have covered them. Text is compared as text.
 */
function recognize(
  entry: OptionValidation | undefined,
  typed: unknown,
): { hit?: { response: string; correct?: boolean; points: number; rationale?: string }; wrongFormat?: string[] } {
  const answers = entry?.responses || [];
  if (entry?.baseType === "float" || entry?.baseType === "integer") {
    const parsed = parseNumber(typed);
    if (!parsed) return {};
    const hit = answers.find((r) => {
      const want = parseNumber(r.response);
      return want ? sameNumber(parsed.value, want.value, entry.tolerance) : false;
    });
    if (!hit) return {};
    // The value is right. Whether it counts depends on how they wrote it, and if it does not,
    // that is worth saying rather than folding into a bare wrong.
    if (entry.inputFormats && !entry.inputFormats.includes(parsed.format)) {
      return { wrongFormat: entry.inputFormats };
    }
    return { hit };
  }
  const cs = entry?.caseSensitive === true;
  const want = normalize(typed, cs);
  return { hit: answers.find((r) => normalize(r.response, cs) === want) };
}

/**
 * A written response: nothing here can score it.
 *
 * The points are real and are reported as the maximum, so a host can show "0 / 2, pending"
 * rather than pretending there was nothing to earn.
 */
export function scoreHuman({ validation }: { validation: Validation | null | undefined }): Score {
  const maxPoints = typeof validation?.points === "number" ? validation.points : 0;
  return { points: 0, rawPoints: 0, maxPoints, correct: false, pending: true };
}

/** Score one interaction's response, whichever template its key declares. */
/**
 * A typed key is the one whose mapping entries carry the answers they recognize.
 *
 * Structural rather than declared, because `baseType` moved onto the blanks — a text-entry has
 * no single base type to dispatch on once one of its blanks is numeric and another is text.
 */
const isTyped = (v: Validation | null | undefined): boolean =>
  Object.values(v?.mapping ?? {}).some((e) => Array.isArray(e?.responses));

function scorePart(response: unknown, validation: Validation | null | undefined): Score {
  if (validation?.responseProcessing === "human") return scoreHuman({ validation });
  if (isTyped(validation)) return scoreTextEntry({ response, validation });
  return scoreChoice({ response, validation });
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
  let pending = false;
  for (const id of Object.keys(key)) {
    const s = scorePart(given[id], key[id]);
    parts[id] = s;
    summed += s.points;
    if (s.pending) pending = true;
    if (!s.correct) everyPartCorrect = false;
  }

  const hasParts = Object.keys(key).length > 0;
  const settled = hasParts && everyPartCorrect && !pending;
  if (mode === "conjunctive") {
    // A human-scored part is refused inside a conjunctive item at compile time, since "every
    // part correct" is unknowable over one. Handled anyway rather than reporting a confident
    // zero if one ever arrives.
    const earned = settled ? maxPoints : 0;
    return {
      points: earned,
      rawPoints: earned,
      maxPoints,
      correct: settled,
      ...(pending ? { pending: true } : {}),
      parts,
    };
  }
  const points = Math.max(0, summed);
  return {
    points,
    rawPoints: summed,
    maxPoints,
    // An item waiting on a person has not earned everything, whatever its other parts did.
    correct: !pending && maxPoints > 0 && points >= maxPoints,
    ...(pending ? { pending: true } : {}),
    parts,
  };
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
  return scorePart(response, validation);
}
