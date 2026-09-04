// SPDX-License-Identifier: MIT
export {
  scoreInteraction,
  scoreChoice,
  scoreItem,
  scoreHuman,
  scoreTextEntry,
  scoreInlineChoice,
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
