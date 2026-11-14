// The Repair answer's routing (door.md §repair-answer): where a decline's reason or a ruling's verdict sends a
// repair, and so what the answer for `repair:<decision>` or `repair:<decision>/<model>` may hold:
// pages of the restatement, files of one TLC or Alloy model, or a lifecycle model's slots and its
// part's confirmed lifecycle pages (decisions.md §rulings, §expects; models.md §model-repair).

import { modelsPath } from '../record/tree.mjs';

/** The surprises a ruling's `## Surprises` records (decisions.md §rulings): `[{ surprise, question, parts, ... }]`. */
export const ruledRows = (decision) => decision?.surprises?.surprises ?? [];

/** Where a surprise of a question is under models/ (evidence.md §question-names): the model, and the thing's folder when it is on one. */
export function questionPlace(question) {
  const where = modelsPath(`models/${question}.json`);
  const model = question.split('/')[0];
  const thingFolder = where.thing ? `models/${model}/${where.holder.span ? 'spans' : 'parts'}/${where.holder.key}/${where.thing.kind}/${where.thing.key}` : null;
  const entry = where.thing ? `${where.holder.key}/${where.thing.kind}/${where.thing.key}` : null;
  return { model, where, thingFolder, entry };
}

/** A model target (door.md §repair-answer): its key, parts, and whether it is a lifecycle model. Its packet holds every slot on it (door.md §gives). */
function modelTarget(project, model) {
  const record = project.models.get(model);
  const lifecycle = model.startsWith('lifecycles-');
  const parts = lifecycle ? [model.slice('lifecycles-'.length)] : record?.model?.parts ?? [];
  return { kind: 'model', model, lifecycle, parts };
}

/**
 * The repair an item names (door.md §repair-answer; account.md §items): `{ decision, verdict, targets, kinds, reasons }`. `kinds` lists
 * what an answer for it may be: `{ kind: 'restate' }`, or `{ kind: 'model', model, lifecycle, parts }`, one for each
 * model it may repair; a property wrong `repair:<decision>` may be either (door.md §gives).
 */
export function repairOf(project, design, item) {
  const m = /^repair:([^/]+)(?:\/(.+))?$/.exec(item ?? '');
  if (!m) return { decision: null, verdict: null, kinds: [], reasons: [] };
  const decision = project.decisions.find((d) => d.name === m[1]) ?? null;
  const named = m[2] ?? null;
  if (!decision) return { decision: null, verdict: null, kinds: [], reasons: [`no decision ${m[1]} stands in the project`] };
  const rows = ruledRows(decision);
  const ran = [...new Set(rows.map((r) => questionPlace(r.question).model))].sort();
  if (decision.kind === 'decline') return { decision, verdict: 'decline', kinds: [{ kind: 'restate' }], reasons: [] };
  if (decision.kind !== 'rule') return { decision, verdict: null, kinds: [], reasons: [`${decision.name} is a ${decision.kind}, which sends no repair`] };
  const verdict = decision.rows?.Verdict ?? null;
  const target = decision.rows?.Target ?? '-';
  const models = (keys) => keys.map((key) => modelTarget(project, key));
  if (verdict === 'model wrong') return { decision, verdict, kinds: models(named ? [named] : ran), reasons: [] };
  if (verdict === 'real finding') {
    if (target === 'brief' || target.startsWith('premise:') || target.startsWith('choice:')) return { decision, verdict, kinds: [], reasons: [`the ruling ${decision.name} is a real finding on ${target}, which sends nothing to an agent`] };
    return { decision, verdict, kinds: models([named ?? target]), reasons: [] };
  }
  // A property wrong repair is a Restate repair of the claim or a Repair of a model it ran on (door.md §gives, §repair-answer).
  if (verdict === 'property wrong') return { decision, verdict, kinds: [{ kind: 'restate' }, ...models(named ? [named] : ran)], reasons: [] };
  if (verdict === 'abstraction too coarse') return { decision, verdict, kinds: [{ kind: 'restate' }], reasons: [] };
  return { decision, verdict, kinds: [], reasons: [`the ruling ${decision.name} has no verdict Forma knows`] };
}
