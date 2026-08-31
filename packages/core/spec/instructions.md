<!-- SPDX-License-Identifier: CC-BY-4.0 -->
# L0180 Dialect Extensions

L0180 authors **web-based assessment items**. A program compiles to one interaction plus its
answer key, ready to render and score with no vendor platform behind it.

## Writing an attribute

Three rules cover the whole surface. There is no per-word syntax to memorize.

| Target shape | How it is written |
| :----------- | :---------------- |
| an object | an attribute list — `assess [correct points 2]` |
| a list of objects | a list of attribute lists — `options [[text "A"] [text "B"]] {}` |
| a scalar | the value itself — `prompt "What is 2 + 2?"`, `shuffle true` |

Every word is the kebab-case spelling of the field it emits, and means the same thing at any
depth. Lists are space-separated (`[1 2 3]`, not `[1, 2, 3]`). Every program ends with `..`.

**One word takes no value at all: `correct`.** It stands alone inside `assess`, and its
presence is what it asserts. Write `assess [correct points 2]`, never `correct true`.

**`options` takes a configuration record after its list**, written `{}` when there is nothing
to configure: `options [...] {}`. Every other word here takes exactly one argument.

## L0180 Functions

| Function | Signature | Description |
| :------- | :-------- | :---------- |
| `choice` | `<list: record>` | A choice interaction: a stem and options to select from |
| `options` | `<list record: record>` | The options offered, each an attribute list |
| `prompt` | `<string: record>` | The question stem shown to the candidate |
| `text` | `<string: record>` | An option's visible text |
| `id` | `<string: record>` | An option's identifier. Derived as A, B, C… when omitted |
| `assess` | `<list: record>` | Scoring for an option. Its presence turns scoring on |
| `correct` | `<: record>` | Marks an option as a right answer. Takes no value |
| `points` | `<number: record>` | What an option is worth. Defaults to 1 with `correct` |
| `shuffle` | `<boolean: record>` | Present the options in random order. Defaults to false |
| `min-choices` | `<number: record>` | Fewest options selectable. Defaults to 0 |
| `max-choices` | `<number: record>` | Most options selectable. Defaults to 1 (single-select) |

## Which words each container takes

| Container | Takes |
| :-------- | :---- |
| `choice` | prompt, shuffle, min-choices, max-choices, options |
| an option | id, text, assess |
| `assess` | correct, points |

A word written in the wrong container is a compile error naming where it belongs, not a
silent no-op.

## Scoring

`assess` must say what it asserts — `correct`, `points`, or both:

- `assess [correct]` — a right answer, worth 1 point.
- `assess [correct points 2]` — a right answer, worth 2.
- `assess [points -1]` — a **penalty**: selecting this distractor costs a point.

The maximum sums only the options marked `correct`, so a penalty can never move the ceiling.
An item's score is floored at zero — penalties cannot drive it negative and subtract from
other items in an activity. An item with no `assess` anywhere is unscored, which is valid.

## L0180 Examples

### Multiple choice

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

### Weighted answer and a penalized distractor

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

### Multi-select

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

### Explicit option ids

Ids are derived as A, B, C… Write one only when something else must reference it.

```
choice [
  prompt "Which is a mammal?"
  options [
    [ id "whale" text "Blue whale" assess [ correct ] ]
    [ id "shark" text "Great white shark" ]
  ] {}
]..
```

### An unscored poll

```
choice [
  prompt "Which did you find hardest?"
  options [
    [ text "Fractions" ]
    [ text "Decimals" ]
  ] {}
]..
```
