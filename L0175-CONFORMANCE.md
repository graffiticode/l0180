<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# L0180 interaction coverage: the QTI ontology and the L0175 requirement set

The design record for what L0180's interactions are and why. Written down here because it
was living in unversioned planning notes (`~/.claude/plans/`) and in one uncommitted file in
another repo — neither survives a machine.

Sources folded in: `let-s-design-the-language-rustling-heron.md` (2026-08-31, the original
requirement set and milestones) and the implementation session of 2026-09-01, which changed
two of its conclusions. Where they disagree, this file is right.

---

## 1. Two languages, one direction

**L0175 is a content language.** It composes SBAC-grounded Grade-5 ELA material — a passage,
claims, evidence, error-typed distractors, stems — and *selects* foils by plausibility. Its
pedagogy is a data table (`targets.ts`): seven learning targets, each with its own
dimensions, error taxonomy, standards and task-model numbering.

**L0180 is an assessment language.** It authors and delivers the item that results. Agents
author in L0180 directly, with or without L0175-composed content upstream.

The bar: **anything an L0175 spec describes must be expressible in L0180 and must score
identically.** None of L0175's content machinery is ported — not the claims graph, not
`plausibility()`, not the error taxonomies. Only the delivered shapes are L0180's problem.

Task model and item type are separate axes in L0175, which is what makes this tractable:
`tm3` is short-text in T4/T11, `ebsr` in T9/T2, and hot-text in T1/T8/T10. The pedagogy
stays put. Five interaction shapes cross over.

**The reverse direction is out of scope.** An L0180 item carries no claims, evidence, error
types or task models, so it cannot round-trip back. L0175 stays the system of record: "edit
the item" means edit it there and regenerate, never patch the L0180 side.

---

## 2. Why QTI's ontology, and why none of L0160's code

L0180's `interaction`/`validation` split *is* QTI's `itemBody` vs response-declaration split.
Naming it that way is deliberate, and the vocabulary comes from L0160, the platform's earlier
QTI language (`l0160/packages/api/spec/usage-guide.md` has the element list and the
kebab/camelCase alias table).

**We took L0160's vocabulary and none of its implementation.** The reason is recorded in
`l0160/CLAUDE.md`: despite the QTI authoring surface, its compiler emits *Learnosity* —
`QTI_ASSESSMENT_ITEM` converts the QTI tree into Learnosity questions and POSTs them to the
Data API. `cardinality`, `baseType`, `match_correct` and `templateRef` appear only in its
spec prose; `QTI_MAPPING` is a stub returning an unused shape. So the naming is real and
reusable, and the response-processing semantics had to be built from the QTI spec rather than
ported. `l0160/PLATFORM-NEUTRAL-ASSESSMENT.md` (2026-08-30) records the catalog gap that
prompted all of this — a routing eval where a generic "make me a quiz" produced nine
no-calls across nine runs, correct behaviour against a catalog with no general assessment
language.

The mapping as built:

| QTI | L0180 compiled field |
| :-- | :-- |
| `itemBody` | `interaction` |
| `maxChoices` / `minChoices` / `shuffle` | same names |
| `cardinality` | `interaction.cardinality` — derived from `maxChoices`, never authored |
| `responseProcessing` template | `validation.responseProcessing` |
| `mapping` / `mapEntry` | `validation.mapping` |
| `mapping@upper-bound` | `validation.upperBound` |
| `correctResponse` | `validation.correctResponse` |
| feedback keyed by identifier | `validation.feedback` |
| `outcomeDeclaration` SCORE | `validation.points` |

`correctResponse` and `mapping` are alternatives in QTI and stay alternatives here: one
template, one shape, no field whose meaning depends on another field's presence.

QTI 3.0 XML export remains future work, but the compiled shape now carries QTI's own field
names, so an exporter is a serializer rather than a translation.

---

## 3. The requirement set

| # | Requirement | Owner | State |
| :-- | :--- | :--- | :--- |
| R1 | Single-select, N options, one correct | choice | **done** `dbcbb79` |
| R2 | Multi-select with exact-set scoring — all correct and nothing else, or zero | choice | **done** `634938f` |
| R3 | Multi-part item, conjunctive scoring — every part right for one point | item | **done** `dbcbb79` |
| R4 | Stimulus — a passage with addressable paragraphs/lines | item | **done** `dbcbb79` |
| R5 | Hottext, sentence granularity, selected within the stimulus | hottext | **done** |
| R6 | Hottext, word granularity, single selection | hottext | **done** |
| R7 | Select exactly N from a valid superset | hottext | **done** |
| R8 | Rubric-scored constructed response, not auto-scored | extended-text | missing |
| R9 | Per-option rationale carried through to delivery | choice | **done** `634938f` |

L0175 item types covered end to end: `multiple-choice`, `multi-select`, `ebsr`, and all three
`hot-text` shapes. Missing: `short-text`.

### Two conclusions the original design got wrong

**R2 was never a conflict.** It was recorded as one — L0180 scoring multi-select per-option
was thought to be a *better* model that L0175's all-or-nothing contradicted, so one had to
give. Under QTI's ontology they are simply its two standard response-processing templates:
per-option points is `map_response`, all-or-nothing is `match_correct`. The language names
which is in force. Nothing was given up, and this is the clearest argument for having taken
the ontology at all.

**R7 belongs to hot text, not to choice.** The requirement list does not say so, and it reads
like a multi-select feature. L0175 computes `selectCount` two different ways: for hot text
it is `Math.min(HOT_TEXT_SELECT_MAX, valid - 1)` (`l0175/packages/core/src/compiler.ts:1210`)
— a genuine N-from-a-superset; for choice it is `options.filter(o => o.correct).length`
(`:932`, `:1038`, `:1051`), a presentation hint that `min-choices`/`max-choices` already
expresses. Choice needs no superset concept.

R7 was also recorded as "does not fit the current model". It does: QTI's
`mapping@upper-bound` caps a mapped score, so five valid identifiers worth 1 each with
`upper-bound 3` means any three reach the ceiling and a wrong pick cannot.

---

## 4. The interactions

### `hottext` — R5, R6, R7 — built

One container with a `granularity` word, as designed. Authors mark units by `quote`; the
compiler resolves them against the segmented passage. `upper-bound` is R7 — QTI's
`mapping@upper-bound` — and defaults so it is rarely written: with C correct selections it
defaults to their total, and `min-choices`/`max-choices` default to the count, so "click the
sentence" needs no numbers at all.

Four things came out different from the plan or from L0175, each for a reason:

1. **Two-phase resolution was forced, not chosen.** Children transform before parents, so
   `HOTTEXT` cannot see the stimulus. A `within "stimulus"` interaction emits a `pending`
   sibling that `ITEM` completes; `PROG` rejects one that survives. `hottext.ts` exists as a
   plain module because both phases call it.
2. **The passage renders once.** L0175 renders it twice — read-only in a "Passage" tab and
   clickable in the item — which works only because they are tabs. L0180 is inline, so
   `HottextPassage` takes the stimulus slot and `HottextPrompt` the part slot.
3. **No stopword fallback.** L0175 makes every content word over two characters clickable when
   the author curates no candidates. L0180 requires a `selections` list, so the clickable words
   are exactly the authored ones — and the language carries no stopword list.
4. **A quote that matches nothing, or matches twice, is an error.** L0175 warns and composes
   on, because it is selecting from a superset it generated. An L0180 author naming a sentence
   that is not in the passage has written a broken item. The message names the nearest sentence
   by edit distance.

Two fixes to the ported segmentation, both because a unit here is something a candidate clicks
rather than something a matcher tolerates:

- L0175's regex keeps only runs ending in `.!?`, so an unterminated final sentence is dropped
  silently. Here the remainder is kept.
- It splits `"Stop!" she called.` in two, leaving `"Stop!"` as its own clickable sentence.
  L0175 calls that acceptable; in the Grade-5 literary prose T4 and T2 use, dialogue is
  constant. A run starting lowercase is a continuation, so it rejoins.

### `extended-text` — R8

New arity-1 container, a `rubric` member list of bands (`score`, `descriptor`), and
`exemplar`.

```
extended-text [
  prompt "What inference can be made about Mara? Use details from the passage."
  rubric [ [ score 2 descriptor "…" ] [ score 1 descriptor "…" ] [ score 0 descriptor "…" ] ] {}
  exemplar "…"
]
```
```
interaction: { type: "extended-text", prompt }
validation:  { responseProcessing: "human", points: 2, rubric: [...], exemplar: "…" }
```

`"human"` is **not** an unscored poll (`points: 0`, no `responseProcessing`), and the
difference has to reach the scorer: `Score` needs a `pending` flag so an item containing a
human-scored part reports its auto-scored subtotal rather than zero-as-if-earned. A `human`
part inside a `conjunctive` item is a compile error, consistent with the existing rule that
every part of a conjunctive item must be scoreable.

### The schema, now that parts are heterogeneous

`itemInteraction.parts` was `allOf: [choiceInteraction]` — an item could only hold choice
parts, and a new part type failed the schema gate before anything else. It is now a `oneOf`
union, and `choiceValidation` became **`responseValidation`**, shared by every interaction:
a key is `responseProcessing` plus identifiers, and nothing in it is choice-specific. A third
interaction adds one `$defs` entry and two union members, and touches no validation shape.

---

## 5. Verification

**`conformance.test.ts` is the gate.** It compiles a program per L0175 delivered shape and
asserts the scorer against L0175's own `SCORING` map
(`l0175/packages/core/src/compiler.ts:1257-1263`), on **behaviour rather than shape**. It
also asserts that `hottext` and `extended-text` are absent from the lexicon, so it fails the
day either lands and asks for its cases.

**Assert on scoring, never on text.** L0175's own `assertCoverage` substring-matches `STR`
literals ≥16 chars against the spec. It cannot see structure, answer keys or ordering, and it
catches elision but never hallucination — an EBSR item collapsed into a single choice reports
full coverage because every string survived. Treat it as an elision alarm only.

**The round-trip harness remains unbuilt.** Modelled on
`graffiticode-mcp-server/scripts/eval-cross-language.ts` (which already does this for
0166→0158): take real items from `l0175/packages/core/spec/examples/` across T4, T9 and T8 so
both hot-text shapes and both answer kinds appear; `get_spec` each; `create_item("0180", …)`;
compile; assert equal scores for a set of candidate responses; report per-type fidelity so a
regression names the type that broke. `conformance.test.ts` is the in-repo stand-in — it
proves L0180 *can* express each shape, not that a generated one does.

---

## 6. Open on the L0175 side

Not this repo's work, and it only affects the MCP hand-off path, not authoring L0180
directly:

- **L0175 has no `spec/spec-directive.md`**, so `get_spec` describes its *unparsed source* —
  the claims-and-evidence superset with its distractor pools — rather than the composed item.
  A faithful hand-off needs the stem, the options in order, and which is correct.
  `l0177/packages/core/spec/spec-directive.md` is the precedent, guarded by its own
  `spec-directive.test.ts`.
- **Derived values never reach spec generation.** L0175 computes no `paths` map, so the
  compiler's distractor selection and answer key are invisible to the spec — exactly what
  L0177's directive calls "the one thing source cannot carry".
- Consider raising L0175's `spec` tier in `console/src/lib/model-priority.ts`; it defaults to
  fast/Haiku, and `console/CLAUDE.md` advises raising it for a dialect whose spec asks for
  more than verbalizing the content.

## 7. Out of scope

`text-entry`, `inline-choice`, `order`, `match`, `associate`, `gap-match`, `hotspot`,
`slider` — no L0175 driver. The `responseProcessing` dispatch makes each additive rather than
a refactor. Item metadata (standards, DOK, grade) likewise: an L0175 spec carries alignment,
but nothing in delivery reads it.
