// A scenario's walk lit on a lifecycle drawing (presentation.md §explorer, A lifecycle drawn), and the same
// walk lit only up to the step a reader stands at. Up to the walk's last step, the drawing is lit exactly
// as the reading gives it; before that, only what the steps so far took.
import type { z } from 'zod';
import type { LifecycleDrawing, MoveAction } from '../../domain/reading.ts';

export type Action = z.infer<typeof MoveAction>;
type Phase = LifecycleDrawing['phases'][number];

/** The last step the drawing lights; 0 where no walk is lit on it. */
function lastLitStep(drawing: LifecycleDrawing): number {
  const actions = [...drawing.moves.flatMap((m) => m.actions), ...drawing.stays.flatMap((s) => s.actions)];
  return Math.max(0, drawing.refusedAt ?? 0, ...actions.flatMap((a) => a.steps));
}

const whole = (drawing: LifecycleDrawing, upTo: number | null): boolean => upTo === null || upTo >= lastLitStep(drawing);

/** An action as lit up to a step: the steps taken by then, and whether it is the refused one, once reached. */
export function actionUpTo(action: Action, upTo: number | null): Action {
  const steps = upTo === null ? action.steps : action.steps.filter((s) => s <= upTo);
  return { label: action.label, steps, mustNot: action.mustNot && steps.length > 0 };
}

export const isLit = (action: Action): boolean => action.steps.length > 0;

/** A lit action as the drawing writes it: `1,3. check`, the refused one `✕ must be refused`. */
export const litLabel = (action: Action): string =>
  `${action.steps.join(',')}. ${action.label}${action.mustNot ? ' ✕ must be refused' : ''}`;

/** Whether the walk has reached a phase by the step. */
export function reached(drawing: LifecycleDrawing, phase: Phase, upTo: number | null): boolean {
  if (whole(drawing, upTo) || !phase.visited) return phase.visited;
  if (phase.initial) return true;
  const taken = (a: Action) => isLit(actionUpTo(a, upTo));
  return (
    drawing.moves.some((m) => m.actions.some((a) => taken(a) && (m.from === phase.id || (m.to === phase.id && !a.mustNot)))) ||
    drawing.stays.some((s) => s.phase === phase.id && s.actions.some(taken))
  );
}

/** The step refused here, once the walk has come to it. */
export function refusedBy(drawing: LifecycleDrawing, upTo: number | null): number | null {
  const at = drawing.refusedAt;
  return at !== null && (upTo === null || upTo >= at) ? at : null;
}
