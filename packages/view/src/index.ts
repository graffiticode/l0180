// SPDX-License-Identifier: MIT
// @graffiticode/l0180-view — L0180's Form and scorer, plus the shared View it is injected
// into (re-exported from the parent language's view package).
export { Form, ChoiceItem } from "./components/form";
export { scoreChoice, selectedIds } from "./scoring";
export type { Score, Validation, OptionValidation, OptionOutcome } from "./scoring";
export { View } from "@graffiticode/l0000-view";
export type { FormProps, FormComponent, CompileError } from "@graffiticode/l0000-view";
