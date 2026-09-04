// SPDX-License-Identifier: MIT
/**
 * Put these in the right order.
 *
 * Moves are buttons rather than drag-and-drop, deliberately. Dragging needs a library or a
 * mouse-only implementation, and neither is worth what it costs here: a candidate on a phone,
 * a keyboard or a screen reader has to be able to answer the question. Up and down are
 * operable by all three and need nothing.
 *
 * Fully controlled, like every interaction that takes clicks: a move is discrete, so the new
 * order is reported and read straight back off the model.
 *
 * The elements arrive in PRESENTATION order — the compiler never emits them in the right one,
 * because that half of the compiled item is what a graded delivery ships.
 */
import type { ReactNode } from "react";
import { cx, Stem } from "./itemKit";
import { useShuffled } from "./shuffling";
import { scoreOrder } from "../../scoring";
import type { Validation } from "../../scoring";

interface Element {
  id: string;
  text: string;
}

interface Interaction {
  type: string;
  prompt?: string;
  /** Randomize the starting order, which is the default. */
  shuffle?: boolean;
  elements?: Element[];
}

export function OrderItem({
  interaction,
  validation,
  response,
  respond,
  showResult = true,
}: {
  interaction: Interaction;
  /** Absent when the item is delivered graded — the right sequence stays server-side. */
  validation?: Validation;
  response: unknown;
  respond: (response: string[]) => void;
  showResult?: boolean;
}) {
  const elements = interaction.elements ?? [];
  const byId = new Map(elements.map((e) => [e.id, e]));

  // The starting order, shuffled once per mount. `avoid` is the answer where we have it: a
  // shuffle that lands on the right sequence would hand the candidate the point for doing
  // nothing. In a graded delivery `validation` is withheld, so there it is 1-in-n! and cannot
  // be helped from here.
  const start = useShuffled(elements, interaction.shuffle === true, validation?.correctResponse);

  // The candidate's order if they have moved anything, the starting one until then. Ids the
  // interaction no longer has are dropped and missing ones appended, so an order that outlived
  // an edit to the item still renders every element exactly once.
  const given = Array.isArray(response) ? (response as string[]).filter((id) => byId.has(id)) : [];
  const order = [...given, ...start.map((e) => e.id).filter((id) => !given.includes(id))];

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    [next[from], next[to]] = [next[to], next[from]];
    respond(next);
  };

  const answered = given.length > 0;
  const gradable = !!validation && (validation.points ?? 0) > 0;
  const score = gradable && answered ? scoreOrder({ response: order, validation }) : null;

  return (
    <div className="flex flex-col gap-3">
      {interaction.prompt && (
        <fieldset className="border-0 p-0 m-0">
          <Stem>{interaction.prompt}</Stem>
        </fieldset>
      )}

      <ol className="flex flex-col gap-2 m-0 p-0 list-none">
        {order.map((id, i) => {
          const el = byId.get(id)!;
          const outcome = score?.options?.[id];
          const right = !!outcome && outcome.correct;
          const wrong = !!outcome && !outcome.correct;
          return (
            <li
              key={id}
              className={cx(
                "flex items-center gap-2 rounded border px-3 py-2 text-sm",
                right
                  ? "border-green-400 bg-green-50"
                  : wrong
                    ? "border-red-400 bg-red-50"
                    : "border-zinc-300 bg-white",
              )}
            >
              <span className="w-5 text-xs text-zinc-500 tabular-nums">{i + 1}.</span>
              <span className="flex-1">{el.text}</span>
              {right && <span aria-hidden="true">✓</span>}
              {wrong && <span aria-hidden="true">✗</span>}
              <span className="flex gap-1">
                <MoveButton
                  label={`Move "${el.text}" up`}
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                >
                  ↑
                </MoveButton>
                <MoveButton
                  label={`Move "${el.text}" down`}
                  disabled={i === order.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  ↓
                </MoveButton>
              </span>
            </li>
          );
        })}
      </ol>

      {score && showResult && (
        <div
          role="status"
          className={cx(
            "rounded-md border px-3 py-2 text-sm font-medium",
            score.correct
              ? "border-green-400 bg-green-50 text-green-800"
              : "border-red-300 bg-red-50 text-red-800",
          )}
        >
          {score.correct
            ? `Correct — ${score.points} / ${score.maxPoints} ${score.maxPoints === 1 ? "point" : "points"}.`
            : `Not quite — ${score.points} / ${score.maxPoints} ${score.maxPoints === 1 ? "point" : "points"}.`}
        </div>
      )}
    </div>
  );
}

function MoveButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "rounded border border-zinc-300 px-2 py-0.5 text-xs",
        "focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500",
        disabled ? "text-zinc-300" : "text-zinc-700 hover:bg-zinc-100",
      )}
    >
      {children}
    </button>
  );
}
