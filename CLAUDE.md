# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

L0180 is a Graffiticode dialect for **web-based assessment delivery**: quizzes, tests and
practice questions that render and score in a browser with no assessment platform behind them.
It exists because the catalog had no ungated general assessment language — L0176 covers the
item types but is vendor-gated to Learnosity, and L0175 is Grade-5-ELA-only, so "make me a
five-question quiz" routed nowhere.

The central design commitment: **a compiled item is `interaction` and `validation`, kept
apart.** `interaction` is everything the candidate sees and is safe to send to a browser;
`validation` is the answer key. A practice item ships both and marks itself; a graded delivery
withholds `validation` and scores server-side. Anything that would smear the two together — a
correct flag on a rendered option, a score computed into the presentation — breaks the only
property that makes graded delivery possible.

Ported conceptually from L0179 (the `validation` model), L0176 (the attribute machinery), and
L0175 (native React item rendering). No code is inherited from L0160, the previous attempt,
which was a facade over the Learnosity Data API.

## Commands

```bash
npm run build      # core → build-static → api → view → view:embed → assemble
npm run dev        # API on :50180 (expects Firestore emulator :8080, local auth :4100)
npm run start      # the built API server
npm test           # core + view suites
npm run lint       # ESLint over the monorepo
npm run gcp:deploy # Cloud Run as l0180, us-central1, port 50180
```

`npm run assemble` wipes and repopulates `packages/api/static/` from `core/dist/static` and
`view/dist-embed`. It is not incremental — a stale file cannot survive it, which is the point.

Tests are Vitest, colocated as `*.test.ts`. Run one with
`npm run -w packages/core test -- -t "the starter template compiles"`. **They must run with
`packages/core` as the cwd**, which the workspace script does: `docs.test.ts` reads `spec/*` by
relative path.

## Architecture

Three workspaces on the published `@graffiticode/l0000` (^0.2.0) and `@graffiticode/l0000-view`.

- **`packages/core`** (`@graffiticode/l0180`) — the language. `attributes.ts` is the vocabulary
  as data; `lexicon.ts` and `compiler.ts` both generate from it; `spec/` is what agents read.
- **`packages/api`** (`@graffiticode/api-l0180`, private) — Express: `POST /compile`,
  `GET /form`, a health check at `/`, and the assembled static assets mounted before auth.
- **`packages/view`** (`@graffiticode/l0180-view`) — the `Form` and the scorer.

### The attribute table drives everything

`packages/core/src/attributes.ts` holds one row per word. The lexicon entry, the Checker method
and the Transformer method are all generated from it, arity included, so a word can never be
declared with one arity and handled with another. **Never hand-write an attribute handler.**
Only containers (`ITEM`, `PARTS`, `CHOICE`, `OPTIONS`) and `PROG` are written out, because each
has a second argument role or an assembly step the table cannot express.

The style is attribute lists, per `console/docs/language-authoring-style.md` — the canonical
spec for authoring a Graffiticode dialect. Read it before adding vocabulary.

### Value validation goes in the Transformer, never the Checker

`Checker.LIST` (inherited from L0000) visits only `elts[0]`. A validation rule written as a
Checker method therefore fires on the first element of a list and nowhere else — in a style
built on lists, that is almost nowhere. L0166 shipped a Checker rule rejecting negative points
that silently did nothing for exactly this reason. The generated Checker methods here walk the
tree and do not judge; `checkValue` runs in the Transformer, where every element is visited.

### Error messages are a product surface

The generator is an LLM that reads a compile error and tries again. `assertKnownAttributes`
names the legal set *and where the misplaced word belongs* — "`correct` is not an attribute of
option. It takes: id, text, assess. `correct` belongs inside `assess`." The tests assert on
that message text, not merely that compilation failed, because a message that stops naming the
fix is a regression even when the program still errors.

### Two words break the arity-1 rule, deliberately

- **`correct` is arity 0.** `assess [correct points 2]` folds to `[{correct: true},
  {points: 2}]` and merges. At arity 1 it would swallow `{points: 2}` as its argument and
  silently lose the score.
- **`options` is arity 2** — a member list: homogeneous children plus its own configuration
  record, written `{}` when empty.

Everything else takes exactly one argument. Keep that set small and stated in
`spec/instructions.md`.

### The item wrapper, and why conjunctive scoring exists

A bare interaction is a whole program. `item` wraps one or more of them with an optional
`stimulus`, and its `scoring` decides how they combine. `additive` sums the parts.
**`conjunctive` awards the item's points only when every part is fully correct** — the shape a
two-part evidence question needs, where naming the right idea while citing the wrong line
earns zero rather than half. That is the requirement L0175's EBSR imposes, and it is why the
wrapper is not just a container.

Two consequences worth keeping:

- A conjunctive item refuses to compile if any part is unscoreable, because "every part
  correct" is meaningless over a part that cannot be correct.
- `points` is rejected on an additive item. The item is already worth the sum of its parts, so
  an authored figure would be a second, disagreeing answer to what a correct response earns.

Part ids are numeric (`"1"`, `"2"`) and option ids are letters, deliberately: the response is
keyed by part id, and a part could otherwise be mistaken for an option. `ItemView` passes each
part only its own slice and merges on the way back up, so a part component is identical
standing alone or nested.

Only the item reports a score — parts render with `showResult={false}`. A per-part "Correct"
while a conjunctive item earns nothing is actively misleading. Option-level ✓/✗ still show.

### Every choice needs its own radio group

`ChoiceItem` takes its group name from `useId()`. A fixed name put both parts of a two-part
item into one native radio group, where the browser enforces mutual exclusion across the whole
group — answering Part B silently unchecked Part A. Unit tests cannot see this; it took
rendering a real two-part item to catch. Any future interaction using radios needs the same
treatment.

### Scoring

`packages/view/src/scoring/` has **no React and no DOM anywhere in its import graph**, because
the same module has to run server-side to score without shipping the key to the browser. L0166
exported its scorer from the same entry as its Form and could not be loaded in bare Node.

Points resolve at compile time, so the scorer does arithmetic and nothing else.
`validation.points` sums only the `correct` options — a penalty must not be able to move the
ceiling, or a fully correct response could never equal it. An item's score is floored at zero;
`Score.rawPoints` carries the unclamped sum for a host that wants signed item scores.

### PROG spreads `data` first, unlike L0179

`resume(e0, { ...data, ...val })` — the fresh compile wins. `data` carries the learner's
response, but after one round trip it also carries the *previous* compile's `interaction` and
`validation`, because the View merges each compile result back into the model. Letting those
shadow the newly compiled ones would render a stale item forever. L0179 spreads the other way
on purpose: its learner edits live inside `interaction.cells` and must survive. Here a response
is a separate key and needs no such protection.

### The View harness is not ours

It lives in `@graffiticode/l0000-view` and owns the URL params (`id`, `access_token`, `origin`,
`data`), the `postMessage` contract with the parent window, and the recompile loop. L0180
supplies only `Form`. Its action protocol already carries a `response` action that triggers
recompile — that is the learner-response channel, so scoring needs no transport of its own.

L0180 uses the default `formModel: "live"`. The `"loaded"` mode exists for L0166's uncontrolled
ProseMirror grid and does not apply here; the choice renderer is fully controlled, holding no
answer state of its own.

### Preflight is off, and one rule has to come back

`tailwind.config.js` disables preflight so this published component never injects a global
reset into a consumer app or the page hosting the `/form` iframe. But preflight is also what
sets `border-style: solid; border-width: 0` on every element — without it, Tailwind's
`border-*` utilities set a colour and a width against CSS's default `border-style: none`, and
every bordered card renders with no border at all. `src/index.css` restores that one
declaration, scoped to `.l0180-item` rather than the document. The Form's root carries that
class; a new component tree that wants borders must sit inside it.

## Spec is tested, not decorative

`docs.test.ts` compiles every fenced program in `spec/spec.md` and `spec/instructions.md`, plus
`spec/template.gc`; checks that every documented word exists in the lexicon with the signature
the docs claim; and checks `examples.md`'s numbering is internally coherent. A wrong example is
not a documentation nit — the generator writes from `instructions.md` and retrieves from
`examples.md`, so it is reproduced verbatim into generated programs.

`spec/usage-guide.md`'s `## Overview` section is extracted into `dist/static/language-info.json`
as `authoring_guide`, and the build **fails** if it is missing or under 100 chars. Edit the
Overview, not the JSON — `language-info.json` must not carry that key itself.

## Adding an interaction type

1. Add its words to `attributeFields`, and its container to `lexicon.ts`.
2. Add the container's allowed set to `validAttributes`, block levels included.
3. Write the container's Transformer method; assemble `interaction` and `validation`.
4. Add a scorer case, keeping the module DOM-free.
5. Add a renderer and register it in the `RENDERERS` map in `interactions.tsx` — not in
   `Form.tsx`, which only chooses between an item and a bare interaction.
6. Document it in `spec/instructions.md` and `spec/spec.md` with a compiling example, add
   prompts to `examples.md` as a new numbered category, and extend `supported_item_types`.

## Not built yet

Every interaction type but `choice` — text entry, ordering, matching, classification, hot text,
hotspot, sliders. QTI export, which the `interaction`/`validation` split is deliberately shaped
to allow later.

The L0175 conformance requirements still open (see the plan): exact-set multi-select scoring,
hottext at word and sentence granularity, select-exactly-N-from-a-valid-superset, rubric-scored
constructed response, and per-option rationale.

## Related repos

- `l0000` — the base language and the View harness. Both are npm dependencies, not workspaces.
- `console/docs/language-authoring-style.md` — the style spec this dialect follows.
- `console/src/lib/languages.ts` — the catalog. **L0180 must be registered here to reach any
  user**; L0160's absence from that file is why it is invisible today.
- `l0179`, `l0176`, `l0175` — the sources of the validation model, the attribute machinery, and
  the native renderer respectively.
