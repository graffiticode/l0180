<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# L0180 Usage Guide

Agent-facing guide for authoring L0180 assessment items. Read this before composing a `create_item` prompt or an `update_item` modification.

## Overview

L0180 is an authoring language for **web-based assessment items** — quizzes, tests, practice questions and self-checks that render and score in a browser with no assessment platform behind them. Input is a natural-language description of a question; output is an L0180 program whose compiled form is one interaction plus its answer key, ready to deliver. This is the general-purpose assessment language: reach for it whenever the request is a quiz, a test, a practice question or a comprehension check and no particular vendor or platform is named. It is the right tool for "write me five questions about the water cycle" or "a multiple-choice item on the causes of the Civil War"; it is not a test-package builder (one item per program), not a gradebook, and not tied to any LMS format.

A compiled item has two halves, deliberately separate. `interaction` is everything the candidate sees — the stem and the options — and is safe to send to a browser. `validation` is the answer key and the points available. A practice item ships both and marks itself as the learner answers; a graded delivery withholds `validation` and scores on the server, so the answers never reach the page. Say which you want if it matters; practice is the default assumption.

When composing a request, name the question type first, then the stem, then the options, then which option or options are right. Say what an option is worth only if it is not worth one point — per-option scoring is the default, so partial credit needs no special request. Mention "select all that apply" or a number of answers when you want a multi-select item, and say so explicitly if you want the options shuffled.

In scope: choice interactions — single-select multiple choice, multi-select, and true/false — with per-option points, weighted answers, penalized distractors, shuffled options, and unscored polls. Out of scope: other interaction types (text entry, ordering, matching, classification, hot text and the rest are not implemented yet), multi-part items, test and section wrappers, rubric-scored prose, media beyond option text, and delivery concerns such as timing, attempts and gradebooks.

## Writing a request

- Give the stem verbatim — the exact wording you want the candidate to read.
- List every option, and say which is correct. Distractors need no annotation.
- State points only when an option is not worth 1.
- Say "select all that apply", or give a number, for a multi-select item.
- Mention shuffling explicitly; options keep their authored order otherwise.

## Vocabulary Cues

Say this to get that:

- **Multiple choice** — `choice [prompt "…" options [[text "A"] [text "B" assess [correct]]] {}]`. The default: one right answer, one point.
- **True/false** — the same shape with two options. There is no separate word for it.
- **Select all that apply** — adds `max-choices N`, and more than one option carries `assess [correct]`.
- **Worth N points** — `assess [correct points N]`. Only needed when N is not 1.
- **Penalty for a distractor** — `assess [points -1]` with no `correct`. Selecting it subtracts.
- **Shuffled options** — `shuffle true`.
- **A named option** — `id "…"` on the option. Ids are otherwise derived as A, B, C…
- **An unscored poll** — omit `assess` everywhere. The item renders and collects but scores nothing.
- **Program terminator** — every L0180 program ends with `..`.

## Example Prompts

- *"A multiple-choice question asking what 2 + 2 is, with options 3, 4 and 5, where 4 is correct."* → `choice`
- *"Which planet is closest to the Sun? Mercury is right and worth 2 points; penalize 'The Moon' by a point."* → `choice`
- *"Select all the prime numbers from 2, 4, 5, 9 and 11 — 2, 5 and 11 are correct. Shuffle the options."* → `choice`
- *"True or false: the Pacific is the largest ocean. True is correct."* → `choice`
- *"Ask which of four animals is a mammal — blue whale, great white shark, sea turtle, octopus — and give the options readable ids."* → `choice`
- *"An ungraded poll asking which topic students found hardest: fractions, decimals or percentages."* → `choice`

## Out of Scope

- **Other interaction types** — text entry, ordering, matching, classification, hot text, hotspot and sliders are not implemented yet. A request for one should not be answered with a choice item that approximates it.
- **Multi-part items** — one interaction per program. Cloze passages with several blanks need the item wrapper, which does not exist yet.
- **Tests and sections** — L0180 authors single items, not test packages, navigation or sequencing.
- **Rubric-scored prose** — nothing here scores free text against a rubric; scoring is exact matching against an answer key.
- **Delivery policy** — timing, attempt limits, feedback timing, and gradebooks belong to the host, not the item.
