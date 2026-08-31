// SPDX-License-Identifier: MIT
/**
 * L0180's Form: renders one compiled assessment item, or the compile errors that stopped it.
 *
 * Injected into the shared View from @graffiticode/l0000-view, which supplies `state.data`,
 * `state.errors` and `state.apply`, and owns the URL params, the parent-window messaging and
 * the recompile loop. This file only renders and reports.
 *
 * A selection is reported as a `response` action because that is one of the two action types
 * the shared View recompiles on — so scoring needs no transport of its own. The item comes
 * back with the response attached, which is what lets a graded delivery withhold `validation`
 * and score on the server instead.
 */
import "../../index.css";
import type { FormProps, CompileError } from "@graffiticode/l0000-view";
import { ChoiceItem } from "./ChoiceItem";
import { ErrorList } from "./itemKit";

/** Interaction types this build can render, and the component that renders each. */
const RENDERERS: Record<string, typeof ChoiceItem> = {
  choice: ChoiceItem,
};

export const Form = ({ state }: FormProps) => {
  const errors: CompileError[] = state.errors ?? [];
  const data = state.data ?? {};
  const interaction = data.interaction;

  const body = () => {
    if (errors.length > 0) return <ErrorList errors={errors} />;
    if (!interaction) {
      // Nothing compiled yet, or a program that produced something other than an item.
      return <pre className="text-xs text-zinc-500">{JSON.stringify(data, null, 2)}</pre>;
    }
    const Renderer = RENDERERS[interaction.type];
    if (!Renderer) {
      // A newer item than this renderer knows about. Say so plainly rather than rendering a
      // blank card that looks like a broken item.
      return (
        <ErrorList
          errors={[
            {
              message:
                `This build cannot render a "${interaction.type}" interaction. ` +
                `It knows: ${Object.keys(RENDERERS).join(", ")}.`,
            },
          ]}
        />
      );
    }
    return (
      <Renderer
        interaction={interaction}
        validation={data.validation}
        response={data.response}
        respond={(response) => state.apply({ type: "response", args: { response } })}
      />
    );
  };

  return <div className="l0180-item bg-white text-zinc-900 rounded-md font-sans p-4">{body()}</div>;
};
