// SPDX-License-Identifier: MIT
/**
 * The vocabulary as data.
 *
 * Adding an attribute is a row in this file: the lexicon entry, the Checker method and the
 * Transformer method are all generated from it, arity included, so a word can never be
 * declared with one arity and handled with another. Never hand-write an attribute handler.
 *
 * The style is attribute lists, per `console/docs/language-authoring-style.md`: every
 * attribute word takes exactly one argument and evaluates to a single-key record, and a
 * `[...]` list of them merges into one object. Each word is the kebab-case spelling of the
 * field it emits — the 1:1 mapping is the feature, so do not invent friendlier names.
 *
 * One word breaks that rule deliberately: `correct` is arity 0. See `flag` below.
 */

/** How a value is turned into the field it emits. */
export interface AttributeMeta {
  /** The key this word emits. Kebab-case word -> camelCase field where they differ. */
  field: string;
  /** `object` merges the word's attribute list into one object. Absent means pass the value through. */
  shape?: "object";
  /** Type asserted before the value is used. Checked in the Transformer, never the Checker — see below. */
  expects?: "string" | "number" | "boolean" | "strings";
  /** Closed set of legal values, for a word whose value names a mode. */
  oneOf?: readonly string[];
  /**
   * Arity 0: the word stands alone and its presence IS its value.
   *
   * `assess [correct points 2]` folds to `[{correct: true}, {points: 2}]`, which merges. At
   * arity 1 `correct` would swallow `{points: 2}` as its argument and emit
   * `{correct: {points: 2}}`, silently losing the score. Order-independent either way.
   */
  flag?: true;
  /** One line, shown in the generated spec. */
  description: string;
}

/**
 * One row per word. The key is the AST tag (the Transformer method name); the source spelling
 * is the key lowercased with underscores as dashes, so MIN_CHOICES is written `min-choices`.
 */
/** The scoring modes an item may declare. */
export const SCORING_MODES = ["additive", "conjunctive"] as const;

/**
 * The response-processing templates a choice may declare, named for QTI's own.
 *
 * `map-response` scores each selected option and sums — the per-option model. `match-correct`
 * is all-or-nothing against the correct set: every correct option and nothing else, or zero.
 *
 * These are QTI's two standard templates, not competing models, which is why a choice names
 * the one in force rather than the language picking a winner. Exact-set scoring was long read
 * as a conflict with per-option points; it is the other template.
 */
export const RESPONSE_PROCESSING_TEMPLATES = ["map-response", "match-correct"] as const;

/** How a hottext's text is cut into selectable units. */
export const GRANULARITIES = ["sentence", "word"] as const;

/** What a hottext may select within, when it does not carry its own text. */
export const SELECTION_SCOPES = ["stimulus"] as const;

/**
 * What a blank's response variable is made of — QTI's baseType.
 *
 * `string` compares text; `float` and `integer` parse the typed answer as a number, which is
 * what makes 0.50, .5 and 1/2 all equal 0.5. `integer` differs from `float` only in refusing an
 * authored answer that is not whole.
 */
export const BASE_TYPES = ["string", "float", "integer"] as const;

/**
 * The written forms a numeric blank will accept.
 *
 * `numeric` is the umbrella — any of the others — and is what a blank gets when it says
 * nothing. The named forms are for a question where the form IS the point: "express your
 * answer as a fraction" cannot be asked without them.
 */
export const INPUT_FORMATS = ["numeric", "decimal", "fraction", "scientific"] as const;

/** Authored spelling -> the QTI template identifier emitted in `validation`. */
export const templateId = (word: string): string => word.replace(/-/g, "_");

export const attributeFields: Record<string, AttributeMeta> = {
  // Item-level
  STIMULUS: {
    field: "stimulus",
    shape: "object",
    description: "The passage or source material the item's parts are about.",
  },
  TITLE: { field: "title", expects: "string", description: "The stimulus's title." },
  PARAGRAPHS: {
    field: "paragraphs",
    expects: "strings",
    description: "The stimulus text, one string per paragraph. Addressable as p1, p2, …",
  },
  SCORING: {
    field: "scoring",
    expects: "string",
    oneOf: SCORING_MODES,
    description:
      "How an item's parts combine: `additive` sums them (default), `conjunctive` awards the item only if every part is fully correct.",
  },

  // Interaction-level
  PROMPT: {
    field: "prompt",
    expects: "string",
    description: "The question stem shown to the candidate.",
  },
  SHUFFLE: {
    field: "shuffle",
    expects: "boolean",
    description: "Present the options in a random order. Defaults to false.",
  },
  MIN_CHOICES: {
    field: "minChoices",
    expects: "number",
    description: "Fewest options the candidate may select. Defaults to 0.",
  },
  MAX_CHOICES: {
    field: "maxChoices",
    expects: "number",
    description: "Most options the candidate may select. Defaults to 1, which is single-select.",
  },
  GRANULARITY: {
    field: "granularity",
    expects: "string",
    oneOf: GRANULARITIES,
    description: "What a hottext makes clickable: whole `sentence`s, or single `word`s.",
  },
  WITHIN: {
    field: "within",
    expects: "string",
    oneOf: SELECTION_SCOPES,
    description:
      "Select within the item's `stimulus` rather than the hottext's own text. One of `within` or `text` is required.",
  },
  QUOTE: {
    field: "quote",
    expects: "string",
    description: "The text this selection names, copied from the passage.",
  },
  UPPER_BOUND: {
    field: "upperBound",
    expects: "number",
    description:
      "Most points the mapped selections can earn. Set it below the number of correct answers to ask for any N of them.",
  },
  RESPONSE: {
    field: "response",
    expects: "string",
    description: "One answer a blank recognizes. Its `assess` says what that answer is worth.",
  },
  BASE_TYPE: {
    field: "baseType",
    expects: "string",
    oneOf: BASE_TYPES,
    description:
      "What this blank's answers are: `string` (the default) compares text, `float` and `integer` compare numbers.",
  },
  INPUT_FORMATS: {
    field: "inputFormats",
    expects: "strings",
    oneOf: INPUT_FORMATS,
    description:
      "Which written forms a numeric blank accepts: `numeric` (any, the default), or a list of `decimal`, `fraction` and `scientific`.",
  },
  TOLERANCE: {
    field: "tolerance",
    expects: "number",
    description:
      "How far a numeric answer may be from the expected one and still count. Absolute and symmetric.",
  },
  CASE_SENSITIVE: {
    field: "caseSensitive",
    expects: "boolean",
    description:
      "Whether capitals have to match. Defaults to false, and a response may override the interaction's setting.",
  },
  EXEMPLAR: {
    field: "exemplar",
    expects: "string",
    description: "A response that would earn full marks, shown to the reader alongside the rubric.",
  },
  DESCRIPTOR: {
    field: "descriptor",
    expects: "string",
    description: "What a response has to do to earn this band.",
  },
  RESPONSE_PROCESSING: {
    field: "responseProcessing",
    expects: "string",
    oneOf: RESPONSE_PROCESSING_TEMPLATES,
    description:
      "How the response is scored: `map-response` scores each option and sums them (default), `match-correct` awards the points only for exactly the correct set.",
  },

  // Option-level
  ID: {
    field: "id",
    expects: "string",
    description: "Identifier for this option. Derived as A, B, C… when omitted.",
  },
  TEXT: { field: "text", expects: "string", description: "The option's visible text." },
  ASSESS: {
    field: "assess",
    shape: "object",
    description: "Scoring for this option. Its presence turns scoring on.",
  },

  // Scoring
  CORRECT: {
    field: "correct",
    flag: true,
    description: "Marks the option as a right answer. Stands alone — it takes no value.",
  },
  POINTS: {
    field: "points",
    expects: "number",
    description: "What this option is worth. Defaults to 1 with `correct`; negative penalizes.",
  },
  RATIONALE: {
    field: "rationale",
    expects: "string",
    description:
      "Why this option is right or wrong. Shown against it once the candidate has selected it.",
  },
};

/** The signature string the generated spec renders, derived so it cannot drift from the row. */
export const typeOf = (meta: AttributeMeta): string => {
  if (meta.flag) return "<: record>";
  if (meta.shape === "object" || meta.expects === "strings") return "<list: record>";
  return `<${meta.expects || "any"}: record>`;
};

/**
 * Which words each container accepts, in source spelling.
 *
 * This is the highest-value check in the file, and the reason it is maintained by hand: an
 * attribute list merges whatever it is handed, so a word written one level too high lands in
 * a record nothing reads, compiles clean, and silently does not do what it says. L0176
 * shipped exactly that at its block levels before adding this check.
 *
 * `option` is not a word — an option is a bare attribute list inside `options` — but it is a
 * container for this purpose and its contents are checked under that name.
 */
export const validAttributes: Record<string, string[]> = {
  item: ["stimulus", "scoring", "points", "parts"],
  stimulus: ["title", "paragraphs"],
  choice: [
    "prompt", "shuffle", "min-choices", "max-choices",
    "response-processing", "upper-bound", "options",
  ],
  hottext: [
    "prompt", "text", "within", "granularity", "min-choices", "max-choices",
    "response-processing", "upper-bound", "selections",
  ],
  selection: ["quote", "assess"],
  "text-entry": ["prompt", "text", "case-sensitive", "blanks"],
  blank: ["id", "responses", "case-sensitive", "base-type", "tolerance", "input-formats"],
  // The member container and its value word are both `response`, so an error reads
  // "It takes: response, assess". Repetitive, and accurate.
  response: ["response", "assess"],
  "extended-text": ["prompt", "rubric", "exemplar"],
  band: ["points", "descriptor"],
  option: ["id", "text", "assess"],
  assess: ["correct", "points", "rationale"],
};

/** Source spelling for a tag, so an error names the word the author wrote. */
export const wordOf = (name: string): string => name.toLowerCase().replace(/_/g, "-");

/** Containers that legitimately own each word, for the "belongs inside" hint. */
const wordOwners: Record<string, string[]> = Object.entries(validAttributes).reduce(
  (acc: Record<string, string[]>, [container, words]) => {
    for (const w of words) (acc[w] = acc[w] || []).push(container);
    return acc;
  },
  {},
);

/**
 * Unwrap L0000's internal Record representation to plain JS.
 *
 * A `{...}` literal reaching a Transformer is `{_type: "record", _entries: Map}` with keys
 * encoded `tag:`/`str:`/`num:`. L0000 does not export a reader for it, so every child
 * language carries this. Dot-access without it silently misses.
 */
export function toPlainObject(val: any): any {
  if (val !== null && typeof val === "object" && val._type === "record" && val._entries instanceof Map) {
    const obj: any = {};
    for (const [k, v] of val._entries) {
      obj[(k as string).replace(/^(tag|str|num):/, "")] = toPlainObject(v);
    }
    return obj;
  }
  if (Array.isArray(val)) return val.map(toPlainObject);
  return val;
}

/** Name a bad value the way its author wrote it, so the message points at the mistake. */
const showValue = (v: any): string => {
  if (typeof v === "string") return JSON.stringify(v);
  if (v === null) return "null";
  if (Array.isArray(v)) return "a list";
  if (typeof v === "object") return "a record";
  return String(v);
};

/**
 * Assert a value's type. Returns an error string, or null.
 *
 * This runs in the TRANSFORMER, not the Checker, and that is not a style preference:
 * `Checker.LIST` visits only `elts[0]`, so a rule written as a Checker method fires on the
 * first element of a list and nowhere else. In a style built on lists that means almost
 * never. L0166 shipped a Checker rule rejecting negative points that did nothing for exactly
 * this reason.
 */
export function checkValue(name: string, meta: AttributeMeta, raw: any): string | null {
  const word = wordOf(name);
  if (meta.shape === "object") {
    if (!Array.isArray(raw)) {
      return `${word}: expected an attribute list in [brackets], e.g. ${word} [correct points 1].`;
    }
    return null;
  }
  if (meta.expects === "strings") {
    if (!Array.isArray(raw) || !raw.length) {
      // A closed set shows its own values rather than a placeholder, so the example is the
      // answer: a generator reading `["First." "Second."]` for `input-formats` learns nothing.
      const eg = meta.oneOf ? meta.oneOf.slice(0, 2) : ["First.", "Second."];
      return `${word}: expected a list of strings, e.g. ${word} [${eg.map((v) => `"${v}"`).join(" ")}].`;
    }
    const bad = raw.findIndex((s) => typeof s !== "string" || !s.trim());
    if (bad >= 0) {
      return `${word}: entry ${bad + 1} is ${showValue(raw[bad])}; every entry must be a non-empty string.`;
    }
    if (meta.oneOf) {
      // A closed set over a list is checked entry by entry. It used to be tested against the
      // value as a whole, which silently passed anything once the value became a list.
      const unknown = raw.findIndex((v: string) => !meta.oneOf!.includes(v));
      if (unknown >= 0) {
        return (
          `${word}: ${showValue(raw[unknown])} is not one of the values \`${word}\` takes: ` +
          `${meta.oneOf.join(", ")}.`
        );
      }
    }
    return null;
  }
  if (!meta.expects) return null;
  const actual = typeof raw;
  if (meta.expects === "number" && (actual !== "number" || !Number.isFinite(raw))) {
    return `${word}: expected a number, got ${showValue(raw)}.`;
  }
  if (meta.expects === "string" && actual !== "string") {
    return `${word}: expected a string in "quotes", got ${showValue(raw)}.`;
  }
  if (meta.expects === "boolean" && actual !== "boolean") {
    return `${word}: expected true or false, got ${showValue(raw)}.`;
  }
  // A closed set is checked here rather than in the Checker for the same reason every other
  // value check is: Checker.LIST would only ever reach the first element of a list.
  if (meta.oneOf && !meta.oneOf.includes(raw)) {
    return `${word}: ${showValue(raw)} is not a ${word} mode. It takes: ${meta.oneOf.join(", ")}.`;
  }
  return null;
}

/**
 * Fold an attribute list into one object. A malformed entry is a compile error, never a
 * silent drop — a dropped attribute is indistinguishable from one that did nothing.
 */
export function mergeAttributes(attrs: any, where: string): Record<string, any> {
  if (!Array.isArray(attrs)) {
    throw new Error(`${where}: expected an attribute list in [brackets], e.g. [text "A" assess [correct]].`);
  }
  const out: Record<string, any> = {};
  for (const a of attrs) {
    if (a === null || typeof a !== "object" || Array.isArray(a)) {
      throw new Error(
        `${where}: every entry must be an attribute applied to a value, e.g. [text "A" assess [correct]]. ` +
          `Got ${showValue(a)}.`,
      );
    }
    for (const k of Object.keys(a)) {
      if (Object.prototype.hasOwnProperty.call(out, k)) {
        throw new Error(`${where}: \`${fieldWord(k)}\` is given twice. Each attribute may appear once.`);
      }
      out[k] = a[k];
    }
  }
  return out;
}

/** Map an emitted field back to its source spelling (minChoices -> min-choices). */
const fieldToWord: Record<string, string> = Object.entries(attributeFields).reduce(
  (acc: Record<string, string>, [name, meta]) => {
    acc[meta.field] = wordOf(name);
    return acc;
  },
  // Container words are not rows in the table, but they must still be nameable when a
  // container rejects one of them.
  { options: "options", parts: "parts", selections: "selections", rubric: "rubric", responses: "responses", blanks: "blanks" },
);
const fieldWord = (field: string): string => fieldToWord[field] || field;

/**
 * Reject a word the container does not accept, naming the legal set and — the half that
 * actually fixes the program — where the misplaced word belongs.
 *
 * The generator is an LLM that reads this message and tries again, so the wording is a
 * product surface, not a diagnostic. L0176's equivalent took a deterministic failure to a
 * reliable pass, permanently and for every model.
 */
export function assertKnownAttributes(container: string, attrs: Record<string, any>): void {
  const allowed = validAttributes[container];
  if (!allowed) return;
  const unknown = Object.keys(attrs)
    .map(fieldWord)
    .filter((w) => !allowed.includes(w));
  if (!unknown.length) return;
  const hints = unknown
    .map((w) => {
      const owners = (wordOwners[w] || []).filter((o) => o !== container);
      return owners.length ? ` \`${w}\` belongs inside \`${owners[0]}\`.` : "";
    })
    .join("");
  throw new Error(
    `${container}: ${unknown.map((u) => `\`${u}\``).join(", ")} ` +
      `${unknown.length === 1 ? "is not an attribute" : "are not attributes"} of ${container}. ` +
      `It takes: ${allowed.join(", ")}.${hints}`,
  );
}
