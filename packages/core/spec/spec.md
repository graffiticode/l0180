<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# L0180 Vocabulary

This specification documents the dialect-specific functions available in the
**L0180** language of Graffiticode. These functions extend the core language
with assessment-item authoring.

The core language specification including the definition of its syntax,
semantics and base library can be found here:
[Graffiticode Language Specification](./graffiticode-language-spec.html)

## Overview

An L0180 program is one interaction. It compiles to two siblings:

- `interaction` — everything the candidate sees. Safe to send to a browser.
- `validation` — the answer key and the points available.

Keeping them apart is what lets a graded delivery withhold the key and score on the server,
while a practice item ships both and marks itself.

## Writing an attribute

Attributes are written as lists. Each word takes one value and contributes one field; a
`[...]` list of them merges into one object.

| Target shape | How it is written |
| :----------- | :---------------- |
| an object | an attribute list — `assess [correct points 2]` |
| a list of objects | a list of attribute lists — `options [[text "A"] [text "B"]] {}` |
| a scalar | the value itself — `prompt "What is 2 + 2?"` |

Two words depart from that, both deliberately:

- `correct` takes **no** value. It stands alone inside `assess`.
- `options` takes its list **and** a configuration record, written `{}` when empty.

## Functions

| Function | Signature | Description |
| :------- | :-------- | :---------- |
| `item` | `<list: record>` | An item: a stimulus and one or more parts |
| `parts` | `<list record: record>` | The interactions an item is made of |
| `stimulus` | `<list: record>` | The passage the parts are about |
| `title` | `<string: record>` | The stimulus's title |
| `paragraphs` | `<list: record>` | The stimulus text, one string per paragraph |
| `scoring` | `<string: record>` | How parts combine — additive or conjunctive |
| `choice` | `<list: record>` | A choice interaction |
| `options` | `<list record: record>` | The options offered |
| `prompt` | `<string: record>` | The question stem |
| `text` | `<string: record>` | An option's visible text |
| `id` | `<string: record>` | An option's identifier |
| `assess` | `<list: record>` | Scoring for an option |
| `correct` | `<: record>` | Marks a right answer |
| `points` | `<number: record>` | What an option is worth |
| `shuffle` | `<boolean: record>` | Randomize option order |
| `min-choices` | `<number: record>` | Fewest options selectable |
| `max-choices` | `<number: record>` | Most options selectable |

### item

A stimulus and one or more parts, scored together. A bare interaction is already a complete
program, so reach for `item` when the question needs a passage, or when one question has
several parts answered together.

`scoring` decides how the parts combine. `additive` (the default) sums them. `conjunctive`
awards the item's points only when every part is fully correct and nothing otherwise, which
is what a two-part evidence question means by "one point" — naming the right idea while
citing the wrong line earns zero, not half. A conjunctive item is worth 1 unless `points`
says otherwise, and every part must be scoreable.

```
item [
  stimulus [
    title "The Loose Board"
    paragraphs [
      "Nina had walked past the crooked porch a hundred times."
      "Then she knelt down and set the first nail without anyone asking her to."
    ]
  ]
  scoring "conjunctive"
  parts [
    choice [
      prompt "What can the reader conclude about Nina?"
      options [
        [ text "She takes care of a problem on her own." assess [ correct ] ]
        [ text "She is afraid of her neighbours." ]
      ] {}
    ]
    choice [
      prompt "Which line best supports your answer to Part A?"
      options [
        [ text "Nina had walked past the crooked porch a hundred times." ]
        [ text "Then she knelt down and set the first nail." assess [ correct ] ]
      ] {}
    ]
  ] {}
]..
```

### stimulus

The passage the item's parts are about. Paragraphs are addressed `p1`, `p2`, … and are
numbered for the reader, so a stem can refer to them by line.

### choice

A stem and a list of options. Single-select by default; raise `max-choices` for multi-select.

```
choice [
  prompt "What is 2 + 2?"
  options [
    [ text "3" ]
    [ text "4" assess [ correct ] ]
    [ text "5" ]
  ] {}
]..
```

### options

A list of options, each an attribute list, followed by a configuration record. An option's
`id` is derived as A, B, C… unless written.

```
choice [
  options [
    [ id "whale" text "Blue whale" assess [ correct ] ]
    [ id "shark" text "Great white shark" ]
  ] {}
]..
```

### assess

Turns scoring on for the option that carries it. It must say what it asserts — `correct`,
`points`, or both — so an assessed option is never ambiguous.

```
choice [
  prompt "Which planet is closest to the Sun?"
  options [
    [ text "Mercury" assess [ correct points 2 ] ]
    [ text "Venus" ]
    [ text "The Moon" assess [ points -1 ] ]
  ] {}
]..
```

`assess [points -1]` is a penalty: no `correct`, so selecting it subtracts. The maximum sums
only the `correct` options — a penalty cannot move the ceiling, and an item's score is
floored at zero rather than going negative.

### max-choices

Raising it makes the item multi-select, and permits more than one option to be `correct`.
Marking more options correct than `max-choices` allows is a compile error.

```
choice [
  prompt "Select the prime numbers."
  max-choices 3
  shuffle true
  options [
    [ text "2" assess [ correct ] ]
    [ text "4" ]
    [ text "5" assess [ correct ] ]
    [ text "9" ]
    [ text "11" assess [ correct ] ]
  ] {}
]..
```
