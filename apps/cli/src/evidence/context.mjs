// What every evidence module reads of the project and the design, gathered once per read: the
// strikes in force (forms.md §menu), each entry's pin now (design.md §pins), the claims and journeys
// with their parts and holders (design.md §filing, §code-journeys), the lifecycles as read (lifecycle-tool.md §as-read), and
// the allowance in force (decisions.md §intake).

import { allowanceOf } from '../door/spent.mjs';
import { isSpan } from '../record/pages.mjs';

/** A part or span as `{ key, span }`, from a thing's holder, which may be written as its key alone. */
function holderOf(restatement, holder) {
  if (holder && typeof holder === 'object') return { key: holder.key, span: Boolean(holder.span) };
  return { key: String(holder), span: isSpan(restatement, holder) && !restatement.parts.get(holder)?.readme?.exists };
}

/**
 * The context of one read (evidence.md §questions, §currency): from `project`, as src/record/project.mjs reads it, and `design`, as
 * src/design/index.mjs's readDesign gives it.
 */
export function evidenceContext(project, design) {
  const restatement = project.restatement;
  const force = design?.force ?? project.force;
  // An item is struck while a strike of it is in force and not revoked (forms.md §menu, decisions.md §carry, §in-force).
  const strikes = new Set(project.premises.strike.filter((p) => force.carried(p.name)?.carried).map((p) => p.name));
  const journeys = new Map();
  for (const [name, journey] of design?.journeys ?? []) {
    const holder = journey.from ? { key: journey.from.key, span: Boolean(journey.from.span) } : holderOf(restatement, journey.holder);
    journeys.set(name, { ...journey, entry: name, key: journey.key ?? name.split('/').pop(), holder, from: holder, parts: journey.parts ?? [] });
  }
  const claims = [...restatement.things.values()].filter((t) => t.kind === 'claims').map((claim) => ({ ...claim, parts: restatement.thingParts.get(claim.entry) ?? claim.parts }));
  const lifecycles = design?.lifecycles ?? new Map();
  /** An entry's pin now (design.md §pins): a page's entry, or a journey code adds; null for what stands nowhere now. */
  const pinNow = (name) => project.restatement.pins.entries.get(name)?.pin ?? journeys.get(name)?.pin ?? null;
  /** An entry's canonical text now (design.md §pins), for `rendered` (engines.md §trace): a page's entry, or a journey code adds. */
  const textNow = (name) => project.restatement.pins.entries.get(name)?.text ?? journeys.get(name)?.text ?? null;
  return {
    project,
    design,
    restatement,
    force,
    strikes,
    journeys,
    claims,
    lifecycles,
    pinNow,
    textNow,
    allowance: allowanceOf(force),
    /** Whether a lifecycle, by entry name, is confirmed (decisions.md §in-force). */
    confirmed: (name) => Boolean(lifecycles.get(name)?.confirmed),
  };
}
