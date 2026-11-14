// The account (account.md): computed from the project's tracked files at every read and stored
// nowhere, with this machine's allowance and refusals beside it; and the commands `forma missing`,
// `forma account`, `forma box` and `forma diff` (account.md §commands). Each command returns
// `{ status, stdout, stderr }`; src/cli.mjs prints and exits.

import { readProject } from '../record/project.mjs';
import { readDesign } from '../design/index.mjs';
import { readEvidence } from '../evidence/index.mjs';
import { allowanceOf, left, readSpent } from '../door/spent.mjs';
import { refusalsHere } from '../door/work.mjs';
import { DEFAULT_SETTINGS, inOrder } from '../record/decisions.mjs';
import { standingOf } from './standing.mjs';
import { allowItem, CHECKPOINTS, forTheDeveloper, itemCompare, itemsOf, waitingDecisions, waitsFirst } from './items.mjs';
import { briefsOf, mechanismsOn } from './mechanisms.mjs';
import { readingOf, readingText, refusedReading } from './reading.mjs';
import { boxOf, boxText } from './box.mjs';
import { diffCommandOf } from './diff.mjs';

/** This machine's allowance as presentation.md §reading, account.md §commands show it: `answers` and `runs`, each `allowed`, `spent`, `left`; `engines`. */
function hereOf(allowance, spent) {
  const l = left(allowance, spent);
  return {
    answers: { allowed: allowance.answers, spent: spent.answers, left: l.answers },
    runs: { allowed: allowance.runs, spent: spent.runs, left: l.runs },
    engines: {
      tlc: { seconds: allowance.engines.tlc.seconds, megabytes: allowance.engines.tlc.megabytes },
      alloy: { seconds: allowance.engines.alloy.seconds, megabytes: allowance.engines.alloy.megabytes },
      lifecycle: { seconds: allowance.engines.lifecycle.seconds },
    },
  };
}

/** The settings in force (decisions.md §intake): the latest intake or allowance giving each, else the defaults. */
function settingsOf(design) {
  const out = { cadence: DEFAULT_SETTINGS.Cadence, cap: Number(DEFAULT_SETTINGS['Inbox cap']) };
  const force = design.force;
  for (const d of inOrder([...(force.intake ? [force.intake] : []), ...(force.allowances ?? [])])) {
    if (d.rows?.Cadence !== undefined) out.cadence = d.rows.Cadence;
    if (d.rows?.['Inbox cap'] !== undefined && /^\d+$/.test(d.rows['Inbox cap'])) out.cap = Number(d.rows['Inbox cap']);
  }
  return out;
}

/**
 * The account of a project as read from its files (account.md §what-it-is to §waits): `{ project, design, evidence, standing, items,
 * here, settings, waiting }`. With `machine: false`, nothing is read of work/ (account.md §diff): no allowance spent and
 * no refusals. `project` may be given, already read.
 */
export async function accountOf(root, { machine = true, project = null, evidenceWith = readEvidence } = {}) {
  project = project ?? (await readProject(root));
  const design = readDesign(project);
  const evidence = await evidenceWith(project, design);
  const allowance = allowanceOf(design.force);
  const spent = machine ? await readSpent(root) : { answers: 0, runs: 0 };
  const refusals = machine ? await refusalsHere(root) : new Map();
  // The real findings' met repairs on models and the brief decisions on them (decisions.md §rulings, §in-force), which the basis
  // line, the box and the item brief: read; each brief decision's state joins the others' (presentation.md §reading Decided).
  const briefs = briefsOf({ project, design });
  for (const [name, state] of briefs.states) design.force.states.set(name, state);
  const standing = standingOf({ project, design, evidence, mechanismsOf: (model) => mechanismsOn(briefs, model) });
  const a = { root, project, design, evidence, briefs, standing, here: { allowance, spent, left: left(allowance, spent), refusals } };
  const items = itemsOf(a);
  a.items = items;
  a.waiting = waitingDecisions(a);
  a.settings = settingsOf(design);
  resolveNeeds(a);
  // This machine's, beside the account (account.md §what-it-is): the allowance spent here and the item allow it may owe.
  a.allow = machine ? allowItem(items, a.here, design.force) : null;
  a.hereJson = { ...hereOf(allowance, spent), ...(a.allow ? { allow: a.allow } : {}) };
  return a;
}

/**
 * Each failing condition's and rule's items (account.md §standing, §journey-rules): the items its needs name that the account lists, a
 * surprise standing for its explain:, its reduction's run: or the rule: of the waiting decision holding it; before the
 * intake, `intake`.
 */
function resolveNeeds(a) {
  const names = new Set(a.items.map((i) => i.item));
  const ruleOf = new Map();
  for (const w of a.waiting) for (const s of w.surprises) ruleOf.set(s, `rule:${w.name}`);
  const resolve = (needs) => {
    if (!a.design.force.intake) return names.has('intake') ? ['intake'] : [];
    const out = new Set();
    for (const n of needs) {
      if (n.startsWith('surprise:')) {
        const s = n.slice('surprise:'.length);
        for (const x of [`explain:${s}`, `run:${s}/reduction`, ruleOf.get(s)]) if (x && names.has(x)) out.add(x);
      } else if (names.has(n)) out.add(n);
    }
    return [...out].sort(itemCompare);
  };
  for (const s of a.standing.claims.values()) {
    for (const m of s.models) for (const c of m.conditions) c.items = resolve(c.needs);
    s.coverItems = s.cover && names.has(s.cover) ? [s.cover] : [];
  }
  for (const fails of a.standing.ruleFails.values()) for (const f of fails) f.items = resolve(f.needs);
  a.resolve = resolve;
}

/**
 * The account: `{ project, design, evidence, standing, items, here, settings, waiting }`, `items` in
 * account.md §commands's JSON form and `here` as presentation.md §reading, account.md §commands show it.
 */
export async function readAccount(root) {
  const a = await accountOf(root);
  return { project: a.project, design: a.design, evidence: a.evidence, standing: a.standing, items: a.items, here: a.hereJson, settings: a.settings, waiting: a.waiting };
}

// --- forma missing (account.md §commands) -------------------------------------------------------------------------------

const supplierText = (s) => (s.by === 'agent' ? `agent: ${s.answer}` : s.by === 'developer' ? `developer: ${s.decision}` : s.by);

/** One item as `forma missing` lists it: its name, who supplies it and what it waits for, this machine's reasons beneath. */
function itemLines(item, indent = '') {
  const lines = [`${indent}- ${item.item}: ${item.supply.map(supplierText).join(', or ')}${item.why ? ` (${item.why})` : ''}${item.waits ? `; waits for ${item.waits.join(', ')}` : ''}`];
  if (item.found) lines.push(`${indent}  - found: ${item.found}`);
  for (const [n, reasons] of (item.refused ?? []).entries()) {
    lines.push(`${indent}  - refused here (${n + 1}):`);
    for (const r of reasons) lines.push(`${indent}    - ${r.check}${r.file ? ` ${r.file}` : ''}${r.entry ? ` ${r.entry}` : ''}${r.field ? ` ${r.field}` : ''}: ${r.says}`);
  }
  return lines;
}

/** This machine's allowance as text (presentation.md §reading item 1), with the item allow when this machine owes it. */
function hereLines(here) {
  return [
    `- answers: ${here.answers.left} left of ${here.answers.allowed} allowed, ${here.answers.spent} spent here`,
    `- runs: ${here.runs.left} left of ${here.runs.allowed} allowed, ${here.runs.spent} spent here`,
    `- tlc: ${here.engines.tlc.seconds} seconds and ${here.engines.tlc.megabytes} megabytes a run`,
    `- alloy: ${here.engines.alloy.seconds} seconds and ${here.engines.alloy.megabytes} megabytes a run`,
    `- lifecycle: ${here.engines.lifecycle.seconds} seconds a run`,
    ...(here.allow ? itemLines({ ...here.allow, item: `${here.allow.item} (this machine's)` }) : []),
  ];
}

/**
 * The developer's items as text (account.md §waits): under each checkpoint, grouped as the cadence groups them, the first
 * inbox-cap items in full and the rest by name and count.
 */
function developerLines(groups, cadence, level = '##') {
  const lines = [];
  for (const { checkpoint, groups: list } of groups) {
    lines.push('', `${level} The developer: ${checkpoint}`);
    for (const g of list) {
      if (cadence !== 'question') lines.push('', `${level}# ${cadence === 'session' ? `Session ${g.under}` : g.under === 'project' ? 'The project' : g.under}`);
      lines.push('');
      for (const item of g.full) lines.push(...itemLines(item));
      if (g.rest.length) lines.push(`- and ${g.rest.length} more: ${g.rest.map((i) => i.item).join(', ')}`);
    }
  }
  return lines;
}

/** `forma missing` (account.md §commands): this machine's allowance, then every item in the group of its first supplier. */
export async function missingCommand(root, { json = false } = {}) {
  const a = await accountOf(root);
  const first = (i) => i.supply[0];
  // Each group in order of item name, but that an item other items of its group wait for comes before them (account.md §commands).
  const byName = (list) => waitsFirst(list);
  const agents = byName(a.items.filter((i) => first(i).by === 'agent'));
  const runs = byName(a.items.filter((i) => first(i).by === 'run'));
  const developer = a.items.filter((i) => first(i).by === 'developer');
  const anyone = byName(a.items.filter((i) => first(i).by === 'anyone'));
  const groups = forTheDeveloper(byName(developer), a, a.settings).filter((g) => CHECKPOINTS.includes(g.checkpoint));
  // forTheDeveloper also gathers items that wait for allow; forma missing lists each item once, in its first supplier's group.
  for (const g of groups) for (const sub of g.groups) { sub.full = sub.full.filter((i) => first(i).by === 'developer'); sub.rest = sub.rest.filter((i) => first(i).by === 'developer'); }
  // With --json, the same content (account.md §commands): every item, in the order the text lists them, each in the group of its first supplier.
  if (json) {
    const ordered = [...agents, ...runs, ...groups.flatMap((g) => g.groups.flatMap((sub) => [...sub.full, ...sub.rest])), ...anyone];
    const placed = new Set(ordered.map((i) => i.item));
    ordered.push(...a.items.filter((i) => !placed.has(i.item)));
    return { status: 0, stdout: `${JSON.stringify({ here: a.hereJson, items: ordered }, null, 2)}\n`, stderr: '' };
  }
  const lines = ['## On this machine', '', ...hereLines(a.hereJson)];
  if (agents.length) lines.push('', "## Agents' answers", '', ...agents.flatMap((i) => itemLines(i)));
  if (runs.length) lines.push('', '## Runs', '', ...runs.flatMap((i) => itemLines(i)));
  lines.push(...developerLines(groups.filter((g) => g.groups.some((s) => s.full.length || s.rest.length)), a.settings.cadence));
  if (anyone.length) lines.push('', '## Anyone', '', ...anyone.flatMap((i) => itemLines(i)));
  if (!a.items.length) lines.push('', 'Nothing is missing.');
  return { status: 0, stdout: `${lines.join('\n')}\n`, stderr: '' };
}

// --- forma account, forma box, forma diff (presentation.md §reading to account.md §diff, §commands) --------------------------------------------------

/** `forma account [<part, span or thing>]` (presentation.md §reading, account.md §commands). */
export async function accountCommand(root, arg = null, { json = false } = {}) {
  const a = await accountOf(root);
  const refused = refusedReading(a, arg);
  if (refused) return refusal(refused, json);
  // An item a lapsed decision opened shows what changed since that decision, as presentation.md §showings shows a lapse (decisions.md §confirm Open).
  const { showingOf } = await import('../decisions/show.mjs');
  a.lapseChanges = new Map();
  const view = unrefused(a);
  for (const i of a.items) {
    const kind = i.item.slice(0, i.item.indexOf(':'));
    if (i.why !== 'lapsed' || !['confirm', 'carry', 'brief'].includes(kind)) continue;
    const lapsedBrief = kind === 'brief' ? a.briefs.subjects.get(i.on)?.lapsed : null;
    const s = showingOf(view, kind, [i.on], { words: lapsedBrief?.rows.Choice === 'stated' ? lapsedBrief.words : null, toDecide: kind !== 'brief' });
    const at = s.shown ? s.shown.indexOf('\nchanged since ') : -1;
    if (at >= 0) a.lapseChanges.set(i.item, s.shown.slice(at + 1).split('\n'));
  }
  const reading = readingOf(a, arg);
  return json ? { status: 0, stdout: `${JSON.stringify(reading, null, 2)}\n`, stderr: '' } : { status: 0, stdout: readingText(a, reading), stderr: '' };
}

/**
 * The account as a showing of a lapsed decision's subject reads it for the change since that decision (presentation.md §showings;
 * presentation.md §reading Open): with nothing that refuses a new decision, which bears on making one and not on what changed.
 * showingOf refuses while the part list is unconfirmed, a finding blocks the unit or a lifecycle freeze holds it, and the
 * reading shows the change whatever blocks a new decision; so this view has the part list confirmed, no findings and no
 * open surprises, none of which changes what a showing shows.
 */
function unrefused(a) {
  const units = new Map([...a.design.units].map(([name, u]) => [name, name === 'parts' ? { ...u, state: 'confirmed' } : u]));
  return { ...a, design: { ...a.design, units, tool: { ...a.design.tool, findings: [] } }, evidence: { ...a.evidence, surprises: [] } };
}

/** `forma box` (account.md §box, §commands). */
export async function boxCommand(root, { json = false } = {}) {
  const a = await accountOf(root);
  const box = boxOf(a);
  return json ? { status: 0, stdout: `${JSON.stringify(box, null, 2)}\n`, stderr: '' } : { status: 0, stdout: boxText(box, a.design), stderr: '' };
}

/** `forma diff [<commit or folder>]` (account.md §diff, §commands). */
export async function diffCommand(root, arg = null, { json = false } = {}) {
  return diffCommandOf(root, arg, { json, accountOf });
}

/** A refused command's result (account.md §commands): every reason, exit status 1, nothing changed. */
function refusal(reasons, json) {
  return json
    ? { status: 1, stdout: `${JSON.stringify({ refused: reasons }, null, 2)}\n`, stderr: '' }
    : { status: 1, stdout: `${reasons.map((r) => (typeof r === 'string' ? r : `refused: ${r.says} (${r.check})`)).join('\n')}\n`, stderr: '' };
}
