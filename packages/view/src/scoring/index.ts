// SPDX-License-Identifier: MIT
export {
  scoreInteraction,
  scoreChoice,
  scoreItem,
  scoreHuman,
  scoreTextEntry,
  scoreInlineChoice,
  scoreOrder,
  canonicalize,
  selectedIds,
  correctIds,
} from "./score.js";
export type {
  Score,
  Validation,
  ItemValidation,
  ScoringMode,
  ResponseProcessing,
  BaseType,
  OptionValidation,
  OptionOutcome,
} from "./score.js";
