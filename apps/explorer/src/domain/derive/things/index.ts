// What a name opens, by the kind of node it names.
import type { Thing } from '../../reading.ts';
import { isEntry } from '../access.ts';
import type { Context } from '../context.ts';
import { need } from '../refs.ts';
import { actionThing } from './action.ts';
import { actorThing } from './actor.ts';
import { pageThing, premiseThing } from './assumption.ts';
import { claimThing } from './claim.ts';
import { lifecycleThing } from './lifecycle.ts';
import { modelThing } from './model.ts';
import { questionThing } from './question.ts';
import { rulingThing } from './ruling.ts';
import { scenarioThing } from './scenario.ts';

export function thingOf(ctx: Context, id: string): Thing {
  const restatement = ctx.restatements.get(id);
  if (restatement) return restatement;
  const n = need(ctx.g.node(id), id);
  if (isEntry(n, 'claims')) return claimThing(ctx, n);
  if (isEntry(n, 'journeys')) return scenarioThing(ctx, n);
  if (isEntry(n, 'actions')) return actionThing(ctx, n);
  if (isEntry(n, 'lifecycles')) return lifecycleThing(ctx, n);
  if (isEntry(n, 'choices')) return questionThing(ctx, n);
  if (isEntry(n, 'premises')) return pageThing(ctx, n);
  if (n.kind === 'boundary') return actorThing(ctx, n);
  if (n.kind === 'premise') return premiseThing(ctx, n);
  if (n.kind === 'decision') return rulingThing(ctx, n);
  if (n.kind === 'model') return modelThing(ctx, n);
  throw new Error(`${id} is no thing the page opens`);
}
