// The box (account.md §box): what leaves Forma. Each claim established, with each model it is
// established on and the bounds and premises in force there; each claim accepted and not established
// whose page-named premises are all carried; every premise carried. Nothing else enters it, and
// nothing of this machine's (work/) is in it.

import { sortedBy } from '../record/json.mjs';
import { tidy } from '../record/pins.mjs';
import { mechanismLines, mechanismsOn } from './mechanisms.mjs';
import { CANNOT_KNOW } from './reading.mjs';
import { premiseLine, premiseSays, restsOnPremises } from './standing.mjs';

/**
 * The box as data (account.md §box): `{ claims, premises, cannotKnow }`, the JSON `forma box --json` prints. Under each
 * claim established, for each model it is established on, every mechanism a met repair of a real finding in force on
 * that model added, in order of its ruling's name, with whether the brief states it, so no claim leaves Forma as if it
 * held of the design the brief describes when it holds only with a mechanism the brief does not state.
 */
export function boxOf(a) {
  const { project, standing } = a;
  const claims = [];
  for (const s of sortedBy([...standing.claims.values()], (x) => x.entry)) {
    const base = { ref: s.entry, name: s.claim.name, sentence: s.claim.sentence, standing: s.label };
    if (s.label === 'established') {
      claims.push({ ...base, models: s.models.filter((m) => m.established).map((m) => ({ model: m.model, bounds: m.bounds, premises: m.premises.map((p) => premiseLine(p, a)), mechanisms: m.basis?.mechanisms ?? mechanismsOn(a.briefs, m.model) })) });
    } else if (s.label === 'accepted') {
      // An accepted claim enters only while every premise its page names is carried (account.md §box).
      const named = restsOnPremises(project.restatement, s.claim).map((name) => ({ name, ...(standing.carries.get(name) ?? { counted: false }) }));
      if (named.every((p) => p.counted)) claims.push({ ...base, acceptance: s.acceptance, premises: named.map((p) => premiseLine(p, a)) });
    }
  }
  const premises = [];
  for (const [name, c] of sortedBy([...standing.carries.entries()], ([n]) => n)) {
    if (!c.counted) continue;
    const line = premiseLine({ name, ...c }, a);
    const out = { premise: name, statement: line.statement, falsifier: line.falsifier };
    if (name.startsWith('choice:')) out.pick = { decision: line.decision, choice: line.pick, by: line.by, at: line.at };
    else Object.assign(out, { decision: line.decision, by: line.by, at: line.at });
    premises.push(out);
  }
  return { claims, premises, cannotKnow: CANNOT_KNOW };
}

/**
 * The box as Markdown (account.md §box): it opens with the one heading that uses the word guarantee. Each premise is
 * shown with its class and provider too (forms.md §premise-says), from `design`, readDesign's, which box JSON leaves out.
 */
export function boxText(box, design) {
  const says = (name) => premiseSays(design.premises.find((x) => x.name === name));
  const lines = ['# What the software may be said to guarantee', ''];
  if (!box.claims.length) lines.push('- No claim is established or accepted with its premises carried.');
  for (const c of box.claims) {
    if (c.models) {
      lines.push(`- ${c.name} (${c.ref}): ${tidy(c.sentence)}`);
      for (const m of c.models) {
        lines.push(`  - established on ${m.model}, within ${m.bounds === 'phase level' ? 'phase level' : m.bounds.map((b) => `${b.bound} = ${b.value} (${b.meaning})`).join('; ') || 'no bounds'}`);
        for (const p of m.premises) lines.push(`    - resting on ${p.premise}: ${p.statement ?? '-'}`);
        for (const x of m.mechanisms ?? []) lines.push(...mechanismLines(x, 2));
      }
    } else {
      lines.push(`- ${c.name} (${c.ref}): ${tidy(c.sentence)} — accepted and not examined: ${c.acceptance.words} (${c.acceptance.decision}, by ${c.acceptance.by}, ${c.acceptance.at})`);
      for (const p of c.premises) lines.push(`  - resting on ${p.premise}: ${p.statement ?? '-'}, carried`);
    }
  }
  lines.push('', '## Premises carried', '');
  if (!box.premises.length) lines.push('- None.');
  for (const p of box.premises) {
    const { class: kind, provider } = says(p.premise);
    lines.push(`- ${p.premise}: ${p.statement ?? '-'}`);
    lines.push(`  - class: ${kind ?? '-'}`);
    lines.push(`  - falsifier: ${p.falsifier ?? '-'}`);
    lines.push(`  - provider: ${provider ?? '-'}`);
    lines.push(p.pick ? `  - picked ${p.pick.choice} by ${p.pick.by}, ${p.pick.at} (${p.pick.decision})` : `  - carried by ${p.by}, ${p.at} (${p.decision})`);
  }
  lines.push('', '## What it cannot know', '', ...box.cannotKnow.map((x) => `- ${x}`));
  return `${lines.join('\n')}\n`;
}
