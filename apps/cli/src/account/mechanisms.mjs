// The mechanisms real-finding repairs added (decisions.md §rulings, §expects; account.md §items, §basis-line, §box): which repairs
// a receipt line meets, each met repair of a real finding on a model by a ruling in force with the
// mechanism its receipt lines give, the `brief` decision in force on it, and what the box and the basis
// line say of each mechanism.

import { briefForce, statedAddresses } from '../record/decisions.mjs';
import { compare, sortedBy } from '../record/json.mjs';
import { tidy } from '../record/pins.mjs';
import { onModel, repairMechanisms } from '../record/receipts.mjs';

/** Whether a ruling sends a real finding to a model: its verdict `real finding` and its target a model's key (decisions.md §rulings). */
export const findsOnModel = (ruling) => ruling?.kind === 'rule' && ruling.rows?.Verdict === 'real finding' && !['', '-', 'brief'].includes(ruling.rows.Target ?? '') && !/^(premise|choice):/.test(ruling.rows.Target);

/**
 * The receipt lines that meet the repair a decision sends (decisions.md §expects), each `{ path, value }`: a line of a file
 * `test` takes whose `answers` name the decision by what the answer changed, its `before` differing from its `sha256`,
 * or its files `removed`, a later version that keeps them included.
 */
export function meetingLines(project, decision, test) {
  const out = [];
  for (const receipt of project.receipts.values()) {
    const folder = receipt.path.slice(0, receipt.path.lastIndexOf('/'));
    for (const line of receipt.lines) {
      const v = line.value;
      if (!v || !(v.answers ?? []).includes(decision)) continue;
      const path = `${folder}/${v.file}`;
      if (!test(path)) continue;
      if (v.before === v.sha256 && !(v.removed ?? []).length) continue;
      out.push({ path, value: v });
    }
  }
  return sortedBy(out, (x) => x.path);
}

/**
 * The mechanisms the Repair answer that met a model wrong ruling's or a real finding's repair of a model added
 * (decisions.md §rulings, §expects): `[{ mechanism, files }]`, from the receipt lines under the model, or for a lifecycle model on
 * its part's lifecycle pages and the README.md its removals are recorded on, that name the decision in their `answers`
 * by what the answer changed with its mechanism in `mechanisms`, as only a Repair answer for it writes them (door.md §repair-answer,
 * door.md §receipts). The repair is met exactly when there is one.
 */
export const repairedModel = (project, decision, model) => repairMechanisms(project.receipts, decision, onModel(model));

/**
 * Each real finding's met repair on a model (decisions.md §rulings, §expects): for each ruling in force for any of its surprises
 * whose verdict sends a real finding to a model, once the Repair answer for it is taken in. Gives `[{ name, ruling,
 * model, mechanisms, files }]` in order of name, `name` its `<ruling>/<model>`, `mechanisms` those the meeting lines
 * give for the ruling, in byte order, `files` the paths whose lines give them.
 */
function metRealFindings({ project, design }) {
  const rulings = new Map();
  for (const ruling of design.force.rulings.values()) rulings.set(ruling.name, ruling);
  const out = [];
  for (const ruling of sortedBy([...rulings.values()], (r) => r.name)) {
    if (!findsOnModel(ruling)) continue;
    const model = ruling.rows.Target;
    const found = repairedModel(project, ruling.name, model);
    if (!found.length) continue;
    out.push({ name: `${ruling.name}/${model}`, ruling, model, mechanisms: found.map((m) => m.mechanism), files: sortedBy([...new Set(found.flatMap((m) => m.files))]) });
  }
  return out;
}

/**
 * The brief decisions on the real findings' met repairs (decisions.md §rulings, §in-force): `{ repairs, subjects, states }`, each
 * subject the repair with the decisions on it in order, the one in force and the one that lapsed (briefForce).
 */
export function briefsOf(a) {
  const repairs = metRealFindings(a);
  return { repairs, ...briefForce(a.project.decisions, repairs, a.project.brief.passages) };
}

/**
 * The mechanisms met real-finding repairs added to a model (account.md §basis-line, §box), in order of their ruling's name: each
 * `{ mechanism, ruling, brief, passages | words }`, `brief` `stated` while a stated decision is in force on the repair,
 * with the addresses its words name; `accepted` while an accepted one is, with its words; otherwise `not stated`.
 */
export function mechanismsOn(briefs, model) {
  const out = [];
  const on = [...(briefs?.subjects.values() ?? [])].filter((s) => s.model === model).sort((x, y) => compare(x.ruling.name, y.ruling.name));
  for (const s of on) {
    const d = s.inForce;
    for (const mechanism of s.mechanisms) {
      if (d?.rows.Choice === 'stated') out.push({ mechanism, ruling: s.ruling.name, brief: 'stated', passages: statedAddresses(d.words) });
      else if (d?.rows.Choice === 'accepted') out.push({ mechanism, ruling: s.ruling.name, brief: 'accepted', words: d.words ?? '' });
      else out.push({ mechanism, ruling: s.ruling.name, brief: 'not stated' });
    }
  }
  return out;
}

/**
 * Whether the brief states a mechanism, as the box and the basis line say it (account.md §box): `the brief states it
 * (<addresses>)`, `not in the brief, accepted (<why>)` or `not in the brief`.
 */
const briefSays = (m) => (m.brief === 'stated' ? `the brief states it (${m.passages.join(', ')})` : m.brief === 'accepted' ? `not in the brief, accepted (${tidy(m.words)})` : 'not in the brief');

/**
 * A mechanism as list items of text (account.md §basis-line, §box), at `depth` two-space indents: what the repair added, by its
 * ruling's name, then, under it, whether the brief states it.
 */
export const mechanismLines = (m, depth = 0) => [`${'  '.repeat(depth)}- holding with a mechanism the repair of ${m.ruling} added: ${tidy(m.mechanism)}`, `${'  '.repeat(depth + 1)}- ${briefSays(m)}`];
