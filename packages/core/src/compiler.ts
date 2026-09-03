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
  templateId,
  toPlainObject,
  wordOf,
} from "./attributes.js";
import { resolveSelections, sentenceUnits, wordUnits } from "./hottext.js";
import type { Paragraph, Unit } from "./hottext.js";
import { cut } from "./textentry.js";

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
Checker.prototype.HOTTEXT = checkChild;
Checker.prototype.SELECTIONS = checkBoth;
Checker.prototype.EXTENDED_TEXT = checkChild;
Checker.prototype.RUBRIC = checkBoth;
Checker.prototype.TEXT_ENTRY = checkChild;
Checker.prototype.BLANKS = checkBoth;
Checker.prototype.RESPONSES = checkBoth;
Checker.prototype.ITEM = checkChild;
Checker.prototype.PARTS = checkBoth;

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
 * A member list of selections — the same shape as OPTIONS, and merged the same way.
 */
Transformer.prototype.SELECTIONS = function (this: any, node: any, options: any, resume: any) {
  this.visit(node.elts[0], options, (e0: any, v0: any) => {
    this.visit(node.elts[1], options, (e1: any, v1: any) => {
      const err = ([] as any[]).concat(e0 || [], e1 || []);
      const raw = toPlainObject(v0);
      if (!Array.isArray(raw)) {
        resume(
          err.concat('selections: expected a list of selections, e.g. selections [[quote "…" assess [correct]]] {}.'),
          {},
        );
        return;
      }
      try {
        const sels = raw.map((entry: any, i: number) => {
          const sel = mergeAttributes(entry, `selection ${i + 1}`);
          assertKnownAttributes("selection", sel);
          return sel;
        });
        resume(err, { ...(toPlainObject(v1) || {}), selections: sels });
      } catch (e: any) {
        resume(err.concat(String((e && e.message) || e)), {});
      }
    });
  });
};

/**
 * Assemble a hottext once its units are known.
 *
 * Shared because the units come from two places: an interaction carrying its own `text` has
 * them immediately, while one selecting `within "stimulus"` cannot — children transform before
 * parents, so the stimulus does not exist when HOTTEXT runs, and ITEM finishes those.
 */
function assembleHottext(attrs: any, units: Unit[], where: string) {
  const { mapping, feedback, correctIds } = resolveSelections(units, attrs.selections, where);

  const template = attrs.responseProcessing !== undefined ? attrs.responseProcessing : "map-response";
  const exactSet = template === "match-correct";
  const scored = Object.keys(mapping).length > 0;
  if (scored && !correctIds.length) {
    throw new Error(
      `${where}: no selection is marked \`correct\`, so the item cannot be scored. ` +
        "Add `assess [correct]` to the right one, or remove every `assess` for an unscored item.",
    );
  }
  if (exactSet && !correctIds.length) {
    throw new Error(
      `${where}: \`response-processing "match-correct"\` scores against the correct set, but no ` +
        "selection is marked `correct`.",
    );
  }

  // Each correct selection is worth its points; `upper-bound` caps the total, which is how
  // "click any three of these five" is expressed — QTI's mapping@upper-bound.
  const sum = correctIds.reduce((n, id) => n + (mapping[id]?.points ?? 0), 0);
  const bounded = attrs.upperBound !== undefined;
  const upperBound = bounded ? attrs.upperBound : sum;
  if (bounded && attrs.upperBound > sum) {
    throw new Error(
      `${where}: upper-bound is ${attrs.upperBound} but the correct selections are only worth ${sum}. ` +
        "Lower `upper-bound`, or mark more selections correct.",
    );
  }

  // How many to click follows from the ceiling: all the correct ones, or the bounded count.
  const maxChoices =
    attrs.maxChoices !== undefined ? attrs.maxChoices : bounded ? attrs.upperBound : correctIds.length || 1;
  const minChoices = attrs.minChoices !== undefined ? attrs.minChoices : maxChoices;
  if (minChoices > maxChoices) {
    throw new Error(`${where}: min-choices (${minChoices}) is greater than max-choices (${maxChoices}).`);
  }
  if (!bounded && correctIds.length > maxChoices) {
    throw new Error(
      `${where}: ${correctIds.length} selections are marked \`correct\` but max-choices is ${maxChoices}. ` +
        "Raise `max-choices`, or set `upper-bound` to ask for that many of them.",
    );
  }

  return {
    interaction: {
      type: "hottext",
      ...(attrs.prompt !== undefined ? { prompt: attrs.prompt } : {}),
      granularity: attrs.granularity !== undefined ? attrs.granularity : "sentence",
      minChoices,
      maxChoices,
      units,
    },
    validation: {
      responseProcessing: templateId(template),
      cardinality: maxChoices > 1 ? "multiple" : "single",
      baseType: "identifier",
      points: exactSet ? 1 : Math.min(sum, upperBound),
      ...(exactSet ? { correctResponse: correctIds } : { mapping }),
      ...(bounded && !exactSet ? { upperBound } : {}),
      ...(Object.keys(feedback).length ? { feedback } : {}),
    },
  };
}

/**
 * A hottext interaction: a passage cut into clickable sentences or words.
 *
 * When it carries its own `text` it resolves here. When it says `within "stimulus"` it cannot —
 * the stimulus is a sibling of `parts` inside `item`, and children transform first — so it
 * emits a `pending` sibling that ITEM consumes. PROG rejects one that never got resolved.
 */
Transformer.prototype.HOTTEXT = function (this: any, node: any, options: any, resume: any) {
  this.visit(node.elts[0], options, (e0: any, v0: any) => {
    const err = ([] as any[]).concat(e0 || []);
    try {
      const attrs = mergeAttributes(toPlainObject(v0), "hottext");
      assertKnownAttributes("hottext", attrs);

      if (!Array.isArray(attrs.selections) || !attrs.selections.length) {
        throw new Error(
          'hottext: needs at least one selection, e.g. selections [[quote "…" assess [correct]]] {}.',
        );
      }
      const hasText = attrs.text !== undefined;
      const hasWithin = attrs.within !== undefined;
      if (hasText && hasWithin) {
        throw new Error(
          "hottext: takes `text` or `within`, not both. `text` gives it its own passage; " +
            '`within "stimulus"` selects inside the item\'s passage.',
        );
      }
      if (!hasText && !hasWithin) {
        throw new Error(
          "hottext: needs the text it selects within — either its own `text \"…\"`, or " +
            '`within "stimulus"` to use the passage of the item it is a part of.',
        );
      }

      if (hasWithin) {
        // Deferred. ITEM has the stimulus and will finish this.
        resume(err, { pending: { scope: attrs.within, attrs } });
        return;
      }

      const granularity = attrs.granularity !== undefined ? attrs.granularity : "sentence";
      const units =
        granularity === "word"
          ? wordUnits(attrs.text)
          : sentenceUnits([{ id: "p1", text: attrs.text }]);
      if (!units.length) {
        throw new Error("hottext: `text` is empty, so there is nothing to select.");
      }
      resume(err, assembleHottext(attrs, units, "hottext"));
    } catch (e: any) {
      resume(err.concat(String((e && e.message) || e)), {});
    }
  });
};

/**
 * A member list of rubric bands — the same shape as OPTIONS and SELECTIONS.
 */
Transformer.prototype.RUBRIC = function (this: any, node: any, options: any, resume: any) {
  this.visit(node.elts[0], options, (e0: any, v0: any) => {
    this.visit(node.elts[1], options, (e1: any, v1: any) => {
      const err = ([] as any[]).concat(e0 || [], e1 || []);
      const raw = toPlainObject(v0);
      if (!Array.isArray(raw)) {
        resume(
          err.concat('rubric: expected a list of bands, e.g. rubric [[score 2 descriptor "…"]] {}.'),
          {},
        );
        return;
      }
      try {
        const bands = raw.map((entry: any, i: number) => {
          const band = mergeAttributes(entry, `band ${i + 1}`);
          assertKnownAttributes("band", band);
          return band;
        });
        resume(err, { ...(toPlainObject(v1) || {}), rubric: bands });
      } catch (e: any) {
        resume(err.concat(String((e && e.message) || e)), {});
      }
    });
  });
};

/**
 * A member list of blanks — the same shape as OPTIONS, SELECTIONS and RUBRIC.
 */
Transformer.prototype.BLANKS = function (this: any, node: any, options: any, resume: any) {
  this.visit(node.elts[0], options, (e0: any, v0: any) => {
    this.visit(node.elts[1], options, (e1: any, v1: any) => {
      const err = ([] as any[]).concat(e0 || [], e1 || []);
      const raw = toPlainObject(v0);
      if (!Array.isArray(raw)) {
        resume(
          err.concat(
            'blanks: expected a list of blanks, e.g. blanks [[id "capital" responses [...] {}]] {}.',
          ),
          {},
        );
        return;
      }
      try {
        const bs = raw.map((entry: any, i: number) => {
          const b = mergeAttributes(entry, `blank ${i + 1}`);
          assertKnownAttributes("blank", b);
          return b;
        });
        resume(err, { ...(toPlainObject(v1) || {}), blanks: bs });
      } catch (e: any) {
        resume(err.concat(String((e && e.message) || e)), {});
      }
    });
  });
};

/**
 * A member list of the answers one blank recognizes, each with its own `assess` — the same
 * shape as the options of a choice, which is the point of the whole arrangement.
 */
Transformer.prototype.RESPONSES = function (this: any, node: any, options: any, resume: any) {
  this.visit(node.elts[0], options, (e0: any, v0: any) => {
    this.visit(node.elts[1], options, (e1: any, v1: any) => {
      const err = ([] as any[]).concat(e0 || [], e1 || []);
      const raw = toPlainObject(v0);
      if (!Array.isArray(raw)) {
        resume(
          err.concat(
            'responses: expected a list of answers, e.g. responses [[response "Paris" assess [correct]]] {}.',
          ),
          {},
        );
        return;
      }
      try {
        const rs = raw.map((entry: any, i: number) => {
          const r = mergeAttributes(entry, `response ${i + 1}`);
          assertKnownAttributes("response", r);
          return r;
        });
        resume(err, { ...(toPlainObject(v1) || {}), responses: rs });
      } catch (e: any) {
        resume(err.concat(String((e && e.message) || e)), {});
      }
    });
  });
};

/**
 * A sentence with blanks the candidate types into.
 *
 * The marker `{{<id>}}` positions a blank and names it, so the answer binds BY NAME — QTI's
 * response-identifier model, where an inline interaction binds to a sibling response
 * declaration. Learnosity's `{{response}}` carries no identity and matches its answers by
 * order, which is what makes reordering a clause silently rebind every answer after it.
 *
 * Always `map_response`: each blank is worth one point, so several blanks give partial credit.
 * All-or-nothing across blanks is a conjunctive item around it, the same way a single-part
 * hottext gets its 1/0.
 */
Transformer.prototype.TEXT_ENTRY = function (this: any, node: any, options: any, resume: any) {
  this.visit(node.elts[0], options, (e0: any, v0: any) => {
    const err = ([] as any[]).concat(e0 || []);
    try {
      const attrs = mergeAttributes(toPlainObject(v0), "text-entry");
      assertKnownAttributes("text-entry", attrs);

      if (typeof attrs.text !== "string" || !attrs.text.trim()) {
        throw new Error(
          'text-entry: needs the sentence it blanks out, e.g. text "The capital of France is ' +
            '{{capital}}." Put {{<id>}} where each answer goes.',
        );
      }
      if (!Array.isArray(attrs.blanks) || !attrs.blanks.length) {
        throw new Error(
          'text-entry: needs at least one blank, e.g. ' +
            'blanks [[id "capital" responses [[response "Paris" assess [correct]]] {}]] {}.',
        );
      }

      const { segments, mapping } = cut(
        attrs.text,
        attrs.blanks,
        attrs.caseSensitive === true,
        "text-entry",
      );

      resume(err, {
        interaction: {
          type: "text-entry",
          ...(attrs.prompt !== undefined ? { prompt: attrs.prompt } : {}),
          segments,
        },
        validation: {
          responseProcessing: "map_response",
          // Cardinality stays here because it does not vary: every blank takes one typed value.
          // `baseType` DOES vary, so it rides on each mapping entry instead — a text-entry has
          // one response variable per blank, and in QTI each carries its own declaration.
          cardinality: "single",
          // Each blank contributes its own best correct answer; the interaction is their sum.
          points: Object.values(mapping).reduce((n: number, e: any) => n + e.points, 0),
          mapping,
        },
      });
    } catch (e: any) {
      resume(err.concat(String((e && e.message) || e)), {});
    }
  });
};

/**
 * A written response, scored by a person against a rubric.
 *
 * `responseProcessing: "human"` is the third template, and it is NOT the same as an unscored
 * poll. A poll has nothing to earn (`points: 0`); this has points that simply cannot be
 * awarded here. The scorer keeps them apart with `Score.pending`, so a written answer is never
 * reported as zero earned.
 */
Transformer.prototype.EXTENDED_TEXT = function (this: any, node: any, options: any, resume: any) {
  this.visit(node.elts[0], options, (e0: any, v0: any) => {
    const err = ([] as any[]).concat(e0 || []);
    try {
      const attrs = mergeAttributes(toPlainObject(v0), "extended-text");
      assertKnownAttributes("extended-text", attrs);

      const bands: any[] = attrs.rubric || [];
      if (bands.length < 2) {
        throw new Error(
          "extended-text: needs a rubric of at least two bands, e.g. " +
            'rubric [[score 2 descriptor "…"] [score 0 descriptor "…"]] {}. ' +
            "A written response is scored by a person, and the rubric is what they score against.",
        );
      }
      const seen = new Map<number, number>();
      for (const [i, band] of bands.entries()) {
        if (typeof band.points !== "number") {
          throw new Error(`band ${i + 1}: needs \`points\`, e.g. [ points 2 descriptor "…" ].`);
        }
        if (typeof band.descriptor !== "string" || !band.descriptor.trim()) {
          throw new Error(
            `band ${i + 1}: needs a \`descriptor\` saying what earns ${band.points}. ` +
              "A bare score tells the person marking it nothing.",
          );
        }
        const prior = seen.get(band.points);
        if (prior !== undefined) {
          throw new Error(
            `band ${i + 1}: ${band.points} points is already band ${prior}. Each band scores differently.`,
          );
        }
        seen.set(band.points, i + 1);
      }

      const points = Math.max(...bands.map((b) => b.points));
      if (points <= 0) {
        throw new Error(
          "extended-text: no band earns anything, so the response cannot be scored. " +
            "Give the top band a score above zero.",
        );
      }

      resume(err, {
        interaction: {
          type: "extended-text",
          ...(attrs.prompt !== undefined ? { prompt: attrs.prompt } : {}),
        },
        validation: {
          responseProcessing: "human",
          points,
          // Ordered high to low, which is how a rubric is read.
          rubric: bands
            .slice()
            .sort((a, b) => b.points - a.points)
            .map((b) => ({ points: b.points, descriptor: b.descriptor })),
          ...(attrs.exemplar !== undefined ? { exemplar: attrs.exemplar } : {}),
        },
      });
    } catch (e: any) {
      resume(err.concat(String((e && e.message) || e)), {});
    }
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

      // QTI's two response-processing templates. `map-response` scores each selected option
      // and sums; `match-correct` is all-or-nothing against the correct set. Which one is in
      // force decides the SHAPE of `validation` — mapping and correctResponse are alternatives
      // in QTI and stay alternatives here, so no field's meaning depends on another's presence.
      const template = attrs.responseProcessing !== undefined ? attrs.responseProcessing : "map-response";
      const exactSet = template === "match-correct";

      const mapping: Record<string, any> = {};
      const correctResponse: string[] = [];
      const feedback: Record<string, string> = {};
      let points = 0;
      let assessed = 0;
      for (const opt of withIds) {
        const assess = opt.assess;
        if (assess === undefined) continue;
        assessed += 1;
        const isCorrect = assess.correct === true;
        const hasPoints = typeof assess.points === "number";
        const hasRationale = typeof assess.rationale === "string";
        if (!isCorrect && !hasPoints && !hasRationale) {
          throw new Error(
            `option "${opt.id}": assess must say what it asserts — \`correct\`, \`points\`, or ` +
              "`rationale`. `assess [correct]` marks the answer; `assess [points -1]` penalizes a " +
              "distractor; `assess [rationale \"…\"]` explains one.",
          );
        }
        // Rationale is feedback, not scoring — QTI keeps them apart, and it has to survive under
        // `match-correct`, where there is no mapping to hang it on.
        if (hasRationale) feedback[opt.id] = assess.rationale;
        if (isCorrect) correctResponse.push(opt.id);

        if (exactSet) {
          // Per-option points under an all-or-nothing template would be a second, disagreeing
          // answer to what a correct response earns — the same reason `points` is refused on an
          // additive item. Refuse it rather than accept it and ignore it.
          if (hasPoints) {
            throw new Error(
              `option "${opt.id}": \`points\` is not meaningful under ` +
                '`response-processing "match-correct"`, which awards the item\'s points for exactly ' +
                "the correct set and nothing otherwise. Remove `points`, or use the default " +
                '`response-processing "map-response"` to score each option.',
            );
          }
          continue;
        }
        if (!isCorrect && !hasPoints) continue; // rationale alone asserts nothing about scoring
        // `correct` with no `points` is worth 1. A penalty carries its own negative points.
        const value = hasPoints ? assess.points : 1;
        mapping[opt.id] = isCorrect ? { correct: true, points: value } : { points: value };
        if (isCorrect) points += value;
      }
      const correctCount = correctResponse.length;
      if (assessed > 0 && correctCount === 0) {
        throw new Error(
          "choice: no option is marked `correct`, so the item cannot be scored. " +
            "Add `assess [correct]` to the right answer, or remove every `assess` for an unscored item.",
        );
      }
      if (exactSet && correctCount === 0) {
        throw new Error(
          'choice: `response-processing "match-correct"` scores against the correct set, but no ' +
            "option is marked `correct`. Add `assess [correct]` to every option that belongs in " +
            "the answer.",
        );
      }
      // Under match-correct the item is worth one point for the whole set, not the sum of its
      // options — there are no per-option points to sum.
      if (exactSet) points = 1;
      // `upper-bound` caps the mapping, which is how "any N of these" is said. Meaningless
      // under match-correct, where the whole set is the answer.
      const bounded = attrs.upperBound !== undefined && !exactSet;
      if (attrs.upperBound !== undefined && exactSet) {
        throw new Error(
          'choice: `upper-bound` is not meaningful under `response-processing "match-correct"`, ' +
            "which already requires exactly the correct set.",
        );
      }
      if (bounded) {
        if (attrs.upperBound > points) {
          throw new Error(
            `choice: upper-bound is ${attrs.upperBound} but the correct options are only worth ${points}. ` +
              "Lower `upper-bound`, or mark more options correct.",
          );
        }
        points = attrs.upperBound;
      }

      const maxChoices = attrs.maxChoices !== undefined ? attrs.maxChoices : 1;
      const minChoices = attrs.minChoices !== undefined ? attrs.minChoices : 0;
      if (correctCount > maxChoices && !bounded) {
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
        validation: {
          responseProcessing: templateId(template),
          // QTI keeps cardinality and baseType on the response declaration, which is this half.
          // Both are derived rather than authored: max-choices already says the first, and the
          // interaction type says the second.
          cardinality: maxChoices > 1 ? "multiple" : "single",
          baseType: "identifier",
          points,
          ...(exactSet ? { correctResponse } : { mapping }),
          ...(bounded ? { upperBound: attrs.upperBound } : {}),
          ...(Object.keys(feedback).length ? { feedback } : {}),
        },
      });
    } catch (e: any) {
      resume(err.concat(String((e && e.message) || e)), {});
    }
  });
};

/**
 * A member list of interactions. Its elements are whole interaction values — each already a
 * `{interaction, validation}` pair — rather than attribute lists, so nothing is merged here;
 * ITEM composes them.
 */
Transformer.prototype.PARTS = function (this: any, node: any, options: any, resume: any) {
  this.visit(node.elts[0], options, (e0: any, v0: any) => {
    this.visit(node.elts[1], options, (e1: any, v1: any) => {
      const err = ([] as any[]).concat(e0 || [], e1 || []);
      const raw = toPlainObject(v0);
      if (!Array.isArray(raw) || !raw.length) {
        resume(
          err.concat("parts: expected at least one interaction, e.g. parts [ choice [ ... ] ] {}."),
          {},
        );
        return;
      }
      const bad = raw.findIndex((p: any) => !p || typeof p !== "object" || !(p.interaction || p.pending));
      if (bad >= 0) {
        resume(
          err.concat(
            `parts: entry ${bad + 1} is not an interaction. Each part is a whole interaction, ` +
              "e.g. parts [ choice [ ... ] hottext [ ... ] ] {}.",
          ),
          {},
        );
        return;
      }
      resume(err, { ...(toPlainObject(v1) || {}), parts: raw });
    });
  });
};

/**
 * An item: an optional stimulus plus one or more interactions scored together.
 *
 * Two scoring modes, and the difference is the whole reason the wrapper exists.
 * `additive` (the default) sums the parts, so the item is worth what its parts are worth.
 * `conjunctive` awards the item's points only when EVERY part is fully correct and nothing
 * otherwise — the shape a two-part evidence item needs, where picking the right claim while
 * citing the wrong line earns zero rather than half.
 */
Transformer.prototype.ITEM = function (this: any, node: any, options: any, resume: any) {
  this.visit(node.elts[0], options, (e0: any, v0: any) => {
    const err = ([] as any[]).concat(e0 || []);
    try {
      const attrs = mergeAttributes(toPlainObject(v0), "item");
      assertKnownAttributes("item", attrs);

      const parts: any[] = attrs.parts || [];
      if (!parts.length) {
        throw new Error("item: needs at least one part, e.g. parts [ choice [ ... ] ] {}.");
      }

      // Paragraphs are addressed p1, p2, … and a hottext selecting `within "stimulus"` keys its
      // units off them, so they are built before anything reads a part's validation.
      const paragraphs: Paragraph[] = ((attrs.stimulus && attrs.stimulus.paragraphs) || []).map(
        (text: string, i: number) => ({ id: `p${i + 1}`, text }),
      );

      // Finish the parts that could not finish themselves. Children transform before parents, so
      // a `within "stimulus"` hottext reached here holding only its authored selections.
      let owner = -1;
      parts.forEach((part: any, i: number) => {
        if (!part.pending) return;
        if (!paragraphs.length) {
          throw new Error(
            `part ${i + 1}: hottext says \`within "stimulus"\` but the item has no stimulus. ` +
              "Add `stimulus [ paragraphs [ … ] ]`, or give the hottext its own `text`.",
          );
        }
        if (owner >= 0) {
          throw new Error(
            `part ${i + 1}: a second hottext selects \`within "stimulus"\`, but part ${owner + 1} ` +
              "already does. One passage cannot be two interactions; give this one its own `text`.",
          );
        }
        owner = i;
        const a = part.pending.attrs;
        const units =
          a.granularity === "word"
            ? wordUnits(paragraphs.map((p) => p.text).join(" "))
            : sentenceUnits(paragraphs);
        parts[i] = { ...assembleHottext(a, units, `part ${i + 1}`), within: "stimulus" };
      });

      const scoring = attrs.scoring !== undefined ? attrs.scoring : "additive";
      if (attrs.points !== undefined && scoring !== "conjunctive") {
        throw new Error(
          "item: `points` is only meaningful with `scoring \"conjunctive\"`. With additive " +
            "scoring the item is worth the sum of its parts, so setting it here would be a " +
            "second, disagreeing answer to what a correct response earns.",
        );
      }

      // Ids are 1-based and stable, and the response is keyed by them. Deliberately numeric so
      // a part id can never be mistaken for an option id, which is a letter.
      const ids = parts.map((_, i) => String(i + 1));
      const partValidation: Record<string, any> = {};
      let summed = 0;
      parts.forEach((p, i) => {
        const v = p.validation || { points: 0, options: {} };
        partValidation[ids[i]] = v;
        summed += typeof v.points === "number" ? v.points : 0;
      });

      if (scoring === "conjunctive") {
        const human = ids.filter((id) => partValidation[id]?.responseProcessing === "human");
        if (human.length) {
          throw new Error(
            `item: conjunctive scoring needs every part to be scoreable, but part ${human.join(", ")} ` +
              "is a written response scored by a person. Use the default additive scoring, so the " +
              "rest of the item scores while that part waits to be marked.",
          );
        }
        const unscored = ids.filter((id) => !(partValidation[id]?.points > 0));
        if (unscored.length) {
          throw new Error(
            `item: conjunctive scoring needs every part to be scoreable, but part ` +
              `${unscored.join(", ")} earns nothing. Mark a correct answer in it, or use the ` +
              "default additive scoring.",
          );
        }
      }

      const points = scoring === "conjunctive" ? (attrs.points !== undefined ? attrs.points : 1) : summed;

      const stimulus = attrs.stimulus
        ? {
            ...(attrs.stimulus.title !== undefined ? { title: attrs.stimulus.title } : {}),
            // Paragraphs are addressed p1, p2, … so a later span-selecting interaction can
            // point into the stimulus and have the reference survive into `validation`.
            paragraphs: (attrs.stimulus.paragraphs || []).map((text: string, i: number) => ({
              id: `p${i + 1}`,
              text,
            })),
          }
        : undefined;

      resume(err, {
        interaction: {
          type: "item",
          ...(stimulus ? { stimulus } : {}),
          parts: parts.map((p, i) => ({ id: ids[i], ...p.interaction, ...(p.within ? { within: p.within } : {}) })),
        },
        validation: { points, scoring, parts: partValidation },
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
    if (val && typeof val === "object" && (val as any).pending) {
      resume(
        ([] as any[]).concat(e0 || [], [
          'hottext: `within "stimulus"` needs the hottext to be a part of an item that has one. ' +
            "Wrap it in `item [ stimulus [ … ] parts [ … ] {} ]`, or give it its own `text`.",
        ]),
        {},
      );
      return;
    }
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
