// SPDX-License-Identifier: MIT
/**
 * L0180's lexicon = L0000's base vocabulary + L0180's words.
 *
 * The attribute words are generated from `attributeFields` so their arity can never disagree
 * with the handlers generated from the same table. Only containers are declared by hand.
 */
import { lexicon as base, mergeLexicon } from "@graffiticode/l0000";
import { attributeFields, typeOf, wordOf } from "./attributes.js";

const fn = (name: string, arity: 0 | 1 | 2, type: string, description: string) => ({
  tk: 1,
  name,
  cls: "function",
  arity,
  type,
  description,
});

const attributeWords = Object.fromEntries(
  Object.entries(attributeFields).map(([name, meta]) => [
    wordOf(name),
    fn(name, meta.flag ? 0 : 1, typeOf(meta), meta.description),
  ]),
);

/**
 * Containers, hand-written because each has a second argument role the table cannot express.
 *
 * `choice` is arity 1: it takes an attribute list and nothing else.
 *
 * `options` is arity 2 — a member list. Its elements are homogeneous children (option
 * attribute lists) rather than named properties, so it does not merge them; the second
 * argument is the container's own configuration record. Uniform even when empty, per the
 * style guide: `options [...] {}` reads as "these children, no configuration", and a word
 * that sometimes takes the slot is a rule the generator has to remember rather than apply.
 */
const containers = {
  item: fn(
    "ITEM",
    1,
    "<list: record>",
    "An item: an optional stimulus and one or more interactions scored together.",
  ),
  parts: fn(
    "PARTS",
    2,
    "<list record: record>",
    "The interactions an item is made of, in the order they are presented.",
  ),
  choice: fn(
    "CHOICE",
    1,
    "<list: record>",
    "A choice interaction: a stem and a list of options to select from.",
  ),
  options: fn(
    "OPTIONS",
    2,
    "<list record: record>",
    "The options a choice interaction offers, each an attribute list.",
  ),
};

export const lexicon = mergeLexicon(
  base,
  { ...attributeWords, ...containers },
  { langID: "L0180" },
);
