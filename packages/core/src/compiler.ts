// SPDX-License-Identifier: MIT
/* Copyright (c) 2026, ARTCOMPILER INC */
//
// L0180 inherits L0000: its Checker/Transformer extend L0000's. Attribute handlers are
// GENERATED from `attributeFields` — never hand-write one. Only containers (CHOICE, OPTIONS)
// and PROG are written out, because each has a second argument role or an assembly step the
// table cannot express. Unhandled tags fall through to L0000's base handlers.
import {
  Checker as BaseChecker,
  Transformer as BaseTransformer,
  Compiler,
} from "@graffiticode/l0000";

import {
  attributeFields,
  assertKnownAttributes,
  checkValue,
  mergeAttributes,
  toPlainObject,
  wordOf,
} from "./attributes.js";

/* ------------------------------------------------------------------ Checker */

export class Checker extends BaseChecker {
  [key: string]: any;
}

const checkNothing = function (this: any, node: any, options: any, resume: any) {
  resume([], node);
};

const checkChild = function (this: any, node: any, options: any, resume: any) {
  this.visit(node.elts[0], options, (e0: any) => resume(([] as any[]).concat(e0 || []), node));
};

const checkBoth = function (this: any, node: any, options: any, resume: any) {
  this.visit(node.elts[0], options, (e0: any) => {
    this.visit(node.elts[1], options, (e1: any) =>
      resume(([] as any[]).concat(e0 || [], e1 || []), node),
    );
  });
};

// The Checker only walks the tree. Value validation lives in the Transformer — `Checker.LIST`
// visits just `elts[0]`, so a rule written here would fire on the first element of a list and
// nowhere else, which in a list-based style is almost nowhere.
for (const [name, meta] of Object.entries(attributeFields)) {
  Checker.prototype[name] = meta.flag ? checkNothing : checkChild;
}
Checker.prototype.CHOICE = checkChild;
Checker.prototype.OPTIONS = checkBoth;

/* -------------------------------------------------------------- Transformer */

export class Transformer extends BaseTransformer {
  [key: string]: any;
}

for (const [name, meta] of Object.entries(attributeFields)) {
  if (meta.flag) {
    // Arity 0: nothing to visit, presence is the value.
    Transformer.prototype[name] = function (node: any, options: any, resume: any) {
      resume([], { [meta.field]: true });
    };
    continue;
  }
  Transformer.prototype[name] = function (this: any, node: any, options: any, resume: any) {
    this.visit(node.elts[0], options, (e0: any, v0: any) => {
      const err = ([] as any[]).concat(e0 || []);
      const raw = toPlainObject(v0);
      const typeError = checkValue(name, meta, raw);
      if (typeError) {
        resume(err.concat(typeError), {});
        return;
      }
      let value: any = raw;
      if (meta.shape === "object") {
        try {
          const word = wordOf(name);
          const attrs = mergeAttributes(raw, word);
          assertKnownAttributes(word, attrs);
          value = attrs;
        } catch (e: any) {
          resume(err.concat(String((e && e.message) || e)), {});
          return;
        }
      }
      resume(err, { [meta.field]: value });
    });
  };
}

/* ------------------------------------------------------------- Option ids */

/** A, B, ... Z, AA, AB, ... — enough labels for any option list, in a familiar order. */
export function optionLabel(index: number): string {
  let n = index;
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/* ------------------------------------------------------------- Containers */

/**
 * A member list: option attribute lists plus this container's own configuration record.
 * Each element is merged and checked on its own; nothing merges the elements together.
 */
Transformer.prototype.OPTIONS = function (this: any, node: any, options: any, resume: any) {
  this.visit(node.elts[0], options, (e0: any, v0: any) => {
    this.visit(node.elts[1], options, (e1: any, v1: any) => {
      const err = ([] as any[]).concat(e0 || [], e1 || []);
      const raw = toPlainObject(v0);
      if (!Array.isArray(raw)) {
        resume(
          err.concat('options: expected a list of options, e.g. options [[text "A"] [text "B"]] {}.'),
          {},
        );
        return;
      }
      try {
        const opts = raw.map((entry: any, i: number) => {
          const opt = mergeAttributes(entry, `option ${i + 1}`);
          assertKnownAttributes("option", opt);
          return opt;
        });
        resume(err, { ...(toPlainObject(v1) || {}), options: opts });
      } catch (e: any) {
        resume(err.concat(String((e && e.message) || e)), {});
      }
    });
  });
};

/**
 * Assemble the compiled item: `interaction` (safe to ship) and `validation` (the answer key)
 * as siblings, so a graded delivery can withhold the second and score server-side while a
 * practice item keeps it inline and self-checks.
 *
 * Points resolve here, at compile time, so the runtime never walks an inheritance chain and
 * the scorer's ceiling is the same number this computed. `validation.points` sums only the
 * options marked `correct`: a penalty must not be able to move the maximum, or a fully
 * correct response could never equal it.
 */
Transformer.prototype.CHOICE = function (this: any, node: any, options: any, resume: any) {
  this.visit(node.elts[0], options, (e0: any, v0: any) => {
    const err = ([] as any[]).concat(e0 || []);
    try {
      const attrs = mergeAttributes(toPlainObject(v0), "choice");
      assertKnownAttributes("choice", attrs);

      const opts: any[] = attrs.options || [];
      if (!opts.length) {
        throw new Error('choice: needs at least one option, e.g. options [[text "A"]] {}.');
      }

      // Ids are auto-derived and written only when something else must reference one.
      const seen = new Map<string, number>();
      const withIds = opts.map((opt, i) => {
        const id = opt.id !== undefined ? opt.id : optionLabel(i);
        if (seen.has(id)) {
          throw new Error(
            `choice: two options share the id "${id}" (options ${seen.get(id)} and ${i + 1}). ` +
              "Ids must be unique; omit `id` to have them derived.",
          );
        }
        seen.set(id, i + 1);
        return { ...opt, id };
      });

      const validationOptions: Record<string, any> = {};
      let points = 0;
      let assessed = 0;
      let correctCount = 0;
      for (const opt of withIds) {
        const assess = opt.assess;
        if (assess === undefined) continue;
        assessed += 1;
        const isCorrect = assess.correct === true;
        const hasPoints = typeof assess.points === "number";
        if (!isCorrect && !hasPoints) {
          throw new Error(
            `option "${opt.id}": assess must say what it asserts — \`correct\`, \`points\`, or both. ` +
              "`assess [correct]` marks the answer; `assess [points -1]` penalizes a distractor.",
          );
        }
        // `correct` with no `points` is worth 1. A penalty carries its own negative points.
        const value = hasPoints ? assess.points : 1;
        validationOptions[opt.id] = isCorrect ? { correct: true, points: value } : { points: value };
        if (isCorrect) {
          correctCount += 1;
          points += value;
        }
      }
      if (assessed > 0 && correctCount === 0) {
        throw new Error(
          "choice: no option is marked `correct`, so the item cannot be scored. " +
            "Add `assess [correct]` to the right answer, or remove every `assess` for an unscored item.",
        );
      }

      const maxChoices = attrs.maxChoices !== undefined ? attrs.maxChoices : 1;
      const minChoices = attrs.minChoices !== undefined ? attrs.minChoices : 0;
      if (correctCount > maxChoices) {
        throw new Error(
          `choice: ${correctCount} options are marked \`correct\` but max-choices is ${maxChoices}. ` +
            "Raise `max-choices` for a multi-select item, or mark fewer options correct.",
        );
      }
      if (minChoices > maxChoices) {
        throw new Error(`choice: min-choices (${minChoices}) is greater than max-choices (${maxChoices}).`);
      }

      resume(err, {
        interaction: {
          type: "choice",
          ...(attrs.prompt !== undefined ? { prompt: attrs.prompt } : {}),
          minChoices,
          maxChoices,
          shuffle: attrs.shuffle !== undefined ? attrs.shuffle : false,
          options: withIds.map(({ id, text }) => ({ id, text: text !== undefined ? text : "" })),
        },
        validation: { points, options: validationOptions },
      });
    } catch (e: any) {
      resume(err.concat(String((e && e.message) || e)), {});
    }
  });
};

/**
 * The program's value is its last expression.
 *
 * `data` is spread FIRST so the fresh compile wins. It carries the learner's response, but
 * after one round trip it also carries the previous compile's own `interaction` and
 * `validation` (the View merges a compile result back into the model), and letting those
 * shadow the newly compiled ones would render a stale item forever. L0179 spreads the other
 * way round on purpose — its learner edits live inside `interaction.cells` and must survive —
 * but here a response is a separate key and needs no such protection.
 */
Transformer.prototype.PROG = function (this: any, node: any, options: any, resume: any) {
  this.visit(node.elts[0], options, (e0: any, v0: any) => {
    const data = options?.data || {};
    const val = v0.pop();
    const isObject = typeof val === "object" && val !== null && !Array.isArray(val);
    resume(e0, isObject ? { ...data, ...val } : val);
  });
};

export const compiler = new Compiler({
  langID: "0180",
  version: "v0.0.1",
  Checker,
  Transformer,
});
