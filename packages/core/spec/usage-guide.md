<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# L0180 Usage Guide

Agent-facing guide for authoring L0180 assessment items. Read this before composing a `create_item` prompt or an `update_item` modification.

## Overview

L0180 is an authoring language for **web-based assessment items** — quizzes, tests, practice questions and self-checks that render and score in a browser with no assessment platform behind them. Input is a natural-language description of a question; output is an L0180 program whose compiled form is one interaction plus its answer key, ready to deliver. This is the general-purpose assessment language: reach for it whenever the request is a quiz, a test, a practice question or a comprehension check and no particular vendor or platform is named. It is the right tool for "write me five questions about the water cycle" or "a multiple-choice item on the causes of the Civil War"; it is not a test-package builder (one item per program), not a gradebook, and not tied to any LMS format.

A question can stand alone, or be wrapped in an **item** when it needs a reading passage or has several parts answered together. An item says how its parts combine: `additive` sums them, while `conjunctive` awards the point only when every part is right — which is what a two-part evidence question means, where naming the right idea but citing the wrong line earns zero rather than half.

A compiled item has two halves, deliberately separate. `interaction` is everything the candidate sees — the stem and the options — and is safe to send to a browser. `validation` is the answer key and the points available. A practice item ships both and marks itself as the learner answers; a graded delivery withholds `validation` and scores on the server, so the answers never reach the page. Say which you want if it matters; practice is the default assumption.

When composing a request, name the question type first, then the stem, then the options, then which option or options are right. Say what an option is worth only if it is not worth one point — per-option scoring is the default, so partial credit needs no special request. Mention "select all that apply" or a number of answers when you want a multi-select item, and say so explicitly if you want the options shuffled.

In scope: choice interactions — single-select multiple choice, multi-select, and true/false — with per-option points, weighted answers, penalized distractors, shuffled options, unscored polls, exact-set scoring for a "choose exactly these" question, and a rationale on a distractor explaining why it is wrong; hottext interactions, where the candidate clicks a sentence or a word inside the passage itself, including "click any three of these" and click-the-word vocabulary items; and multi-part items over a reading passage, scored additively or conjunctively. Out of scope: other interaction types (text entry, ordering, matching, classification, hot text and the rest are not implemented yet), test and section wrappers, rubric-scored prose, media beyond passage and option text, and delivery concerns such as timing, attempts and gradebooks.

## Writing a request

- Give the stem verbatim — the exact wording you want the candidate to read.
- List every option, and say which is correct. Distractors need no annotation.
- State points only when an option is not worth 1.
- Say "select all that apply", or give a number, for a multi-select item.
- Say whether a multi-select gives partial credit. Per-option scoring is the default; ask for all-or-nothing when the question means "exactly these".
- Give a rationale for a distractor when you want the item to explain the mistake back.
- Mention shuffling explicitly; options keep their authored order otherwise.

## Vocabulary Cues

Say this to get that:

- **Multiple choice** — `choice [prompt "…" options [[text "A"] [text "B" assess [correct]]] {}]`. The default: one right answer, one point.
- **True/false** — the same shape with two options. There is no separate word for it.
- **Select all that apply** — adds `max-choices N`, and more than one option carries `assess [correct]`.
- **Exactly these, no partial credit** — `response-processing "match-correct"`, with `min-choices` and `max-choices` both set to the number wanted. Every correct option and nothing else earns the point; a subset or a superset earns zero. This is what "choose the two sentences that belong in a summary" means.
- **Why a wrong answer is wrong** — `assess [rationale "…"]` on the distractor. It scores nothing on its own and is shown only after the candidate picks that option.
- **Worth N points** — `assess [correct points N]`. Only needed when N is not 1.
- **Penalty for a distractor** — `assess [points -1]` with no `correct`. Selecting it subtracts.
- **Shuffled options** — `shuffle true`.
- **A named option** — `id "…"` on the option. Ids are otherwise derived as A, B, C…
- **An unscored poll** — omit `assess` everywhere. The item renders and collects but scores nothing.
- **A passage to read** — `item [ stimulus [ title "…" paragraphs [ "…" "…" ] ] parts [ … ] {} ]`. Paragraphs are numbered for the reader, so a stem can refer to them by line.
- **Click a sentence in the passage** — `hottext [ prompt "…" within "stimulus" selections [[quote "…" assess [correct]]] {} ]` as a part of an item. The passage renders once, at the top, with its sentences clickable.
- **Click any N of several right sentences** — add `upper-bound N`. Without it every correct sentence must be clicked.
- **Click the word** — `granularity "word"` with its own `text`. Only the words a selection names are clickable, so author the distractor words too.
- **Two parts, both required** — `scoring "conjunctive"` on the item. Every part must be right for the point.
- **Two parts, scored separately** — the default `additive`; the item is worth the sum of its parts.
- **Program terminator** — every L0180 program ends with `..`.

## Example Prompts

- *"A multiple-choice question asking what 2 + 2 is, with options 3, 4 and 5, where 4 is correct."* → `choice`
- *"Which planet is closest to the Sun? Mercury is right and worth 2 points; penalize 'The Moon' by a point."* → `choice`
- *"Select all the prime numbers from 2, 4, 5, 9 and 11 — 2, 5 and 11 are correct. Shuffle the options."* → `choice`
- *"True or false: the Pacific is the largest ocean. True is correct."* → `choice`
- *"Ask which of four animals is a mammal — blue whale, great white shark, sea turtle, octopus — and give the options readable ids."* → `choice`
- *"An ungraded poll asking which topic students found hardest: fractions, decimals or percentages."* → `choice`
- *"Choose the two sentences that belong in a summary of the passage — all or nothing, no partial credit."* → `choice`
- *"Which gas do plants absorb? Explain to a student who picks oxygen why that is the gas plants release."* → `choice`
- *"A two-part reading question about a short passage: first what the reader can conclude, then which line supports it. Both parts must be right for the point."* → `item`
- *"Show a passage and ask the student to click the sentence that best supports the inference."* → `hottext`
- *"Read the sentence and click the word that means 'a channel that carries water'."* → `hottext`

## Out of Scope

- **Other interaction types** — text entry, ordering, matching, classification, hotspot and sliders are not implemented yet. A request for one should not be answered with a choice item that approximates it.
- **Cloze passages** — an item can hold several parts, but a blank *inside* running text needs an inline interaction, which does not exist yet.
- **Tests and sections** — L0180 authors single items, not test packages, navigation or sequencing.
- **Rubric-scored prose** — nothing here scores free text against a rubric; scoring is exact matching against an answer key.
- **Delivery policy** — timing, attempt limits, feedback timing, and gradebooks belong to the host, not the item.
