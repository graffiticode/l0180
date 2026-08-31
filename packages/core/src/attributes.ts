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
  expects?: "string" | "number" | "boolean";
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
export const attributeFields: Record<string, AttributeMeta> = {
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
};

/** The signature string the generated spec renders, derived so it cannot drift from the row. */
export const typeOf = (meta: AttributeMeta): string =>
  meta.flag ? "<: record>" : meta.shape === "object" ? "<list: record>" : `<${meta.expects || "any"}: record>`;

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
  choice: ["prompt", "shuffle", "min-choices", "max-choices", "options"],
  option: ["id", "text", "assess"],
  assess: ["correct", "points"],
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
  { options: "options" },
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
