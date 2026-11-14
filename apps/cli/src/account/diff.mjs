// The diff (account.md §diff): the account of the project now beside that of an earlier copy, a folder
// or the files under the project folder's path in a git commit; each copy's evidence judged by the
// versions its own basis names and without composing again; nothing of work/ read for either; the
// lists went stale, changed outcome, opened, closed, grouped by the change each rests on, and what
// waits for the developer now.

import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, realpath, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { inOrder, ruledSurprises, statedAddresses } from '../record/decisions.mjs';
import { basisDigest, compare, sortedBy } from '../record/json.mjs';
import { surpriseName, surprisePath } from '../record/evidence.mjs';
import { journeyRules, spanRules } from '../evidence/conformance.mjs';
import { evidenceContext } from '../evidence/context.mjs';
import { modelStates, slotStates, writtenLater } from '../evidence/currency.mjs';
import { byName, claimQuestions, modelQuestions, reductionPlan, weakerForms, weakestFailing } from '../evidence/questions.mjs';
import { CANNOT_KNOW } from './reading.mjs';
import { CHECKPOINTS, kindOf } from './items.mjs';

const run = promisify(execFile);
const git = (cwd, args, options = {}) => run('git', args, { cwd, maxBuffer: 1 << 28, encoding: 'utf8', ...options });

/**
 * Currency as the diff judges it (account.md §diff; evidence.md §currency items 1 and 2 alone): each project file its basis
 * names has the SHA-256 it gives, and each entry the pin; the versions its own basis names, and nothing composed again.
 */
function diffCurrency(ctx, value) {
  const reasons = [];
  for (const f of value.basis.files.filter((x) => x.path)) {
    const now = ctx.project.files.get(f.path);
    if (!now?.counts) reasons.push(`${f.path} is gone, or counts for nothing`);
    else if (now.sha256 !== f.sha256) reasons.push(`${f.path} changed`);
  }
  for (const e of value.basis.entries) {
    const pin = ctx.pinNow(e.entry);
    if (pin === null) reasons.push(`${e.entry} stands nowhere now`);
    else if (pin !== e.pin) reasons.push(`${e.entry} says something else now`);
  }
  return { current: reasons.length === 0, reasons, versionsOnly: false };
}

/**
 * readEvidence as the diff reads it (account.md §diff): every question asked, with its evidence's currency by items 1 and
 * 2 of evidence.md §currency alone; the journey and span rules; what is owed a run; the surprises. Shaped as readEvidence's.
 * It follows readEvidence's steps with the diff's currency, versions from each basis and nothing composed again, and
 * without what was sent back, which the diff does not compare.
 */
export async function readEvidenceForDiff(project, design) {
  const ctx = evidenceContext(project, design);
  const models = await modelStates(ctx);
  const slots = await slotStates(ctx, models);
  const records = new Map();
  const recordOf = (q) => {
    const file = project.files.get(q.path);
    const evidence = file?.counts ? file.value : null;
    const c = evidence ? diffCurrency(ctx, evidence) : { current: false, reasons: ['it has no evidence'], versionsOnly: false };
    return { question: q, composed: null, evidence, current: c.current, reasons: c.reasons, versionsOnly: false, later: writtenLater(evidence) };
  };
  const { questions: first, unchecked } = modelQuestions(ctx, models, slots);
  for (const q of first) records.set(q.name, recordOf(q));
  const before = journeyRules(ctx, models, records, slots, unchecked);
  for (const q of claimQuestions(ctx, models, slots, (key) => before.get(key)?.gate ?? false)) records.set(q.name, recordOf(q));
  const rules = journeyRules(ctx, models, records, slots, unchecked);
  const spans = spanRules(ctx, models, records);
  const surprises = [];
  for (const surprise of project.surprises.values()) {
    if (!surprise.counts) continue;
    const stem = project.stems.get(surprise.name);
    const explanation = stem?.explanation ? project.files.get(stem.explanation) : null;
    const explained = Boolean(explanation?.counts && stem.explained);
    const plan = surprise.open ? reductionPlan(ctx, models, slots, surprise) : { reducible: false, ran: [], kept: [], next: null };
    const weaker = surprise.open ? weakerForms(ctx, models, slots, surprise) : [];
    surprises.push({
      name: surprise.name, path: surprise.path, question: surprise.value.question, model: surprise.where.model, where: surprise.where, value: surprise.value,
      open: surprise.open, ruledBy: surprise.ruledBy, explained, explanation: explained ? { path: stem.explanation, ...stem.explained } : null,
      reductions: { reducible: plan.reducible, ran: plan.ran, kept: plan.kept, next: plan.next?.name ?? null, left: Boolean(plan.next) },
      weaker: weaker.map((w) => ({ key: w.key, path: w.path, found: w.evidence?.found ?? null, ran: Boolean(w.evidence) })),
      weakest: weakestFailing(weaker), sentBack: [], later: writtenLater(surprise.value), forms: weaker, plan,
    });
  }
  const openOn = new Set(surprises.filter((s) => s.open).map((s) => s.question));
  const ruled = (name) => project.decisions.some((d) => d.kind === 'rule' && ruledSurprises(d).includes(name));
  const owed = [];
  const unanswered = [];
  for (const record of records.values()) {
    const q = record.question;
    if (openOn.has(q.name)) continue;
    const e = record.evidence;
    let why = null;
    if (!e) why = 'none';
    else if (!record.current) why = 'not-current';
    else if (e.found.outcome === 'unanswered') unanswered.push({ question: q.name, found: e.found, limits: e.limits });
    else if (e.matches === false) {
      const name = surpriseName(q.name, basisDigest(e.basis));
      if (!project.files.get(surprisePath(name))?.counts && !ruled(name)) why = 'lost-surprise';
    }
    if (why) owed.push({ name: q.name, item: `run:${q.name}`, why, question: q, composed: null, spends: true, later: record.later });
  }
  for (const s of surprises.filter((x) => x.open)) {
    if (s.plan.next) owed.push({ name: s.plan.next.name, item: `run:${s.name}/reduction`, why: 'reduction', question: s.plan.next, composed: null, spends: true, later: s.later });
    for (const form of s.forms) if (!form.evidence && form.question) owed.push({ name: form.question.name, item: `run:${s.name}/weaker-${form.key}`, why: 'weaker', question: form.question, composed: null, spends: true, later: s.later });
  }
  for (const s of surprises) { delete s.plan; delete s.forms; }
  return { ctx, models, slots, questions: byName([...records.values()].map((x) => x.question)).map((q) => records.get(q.name)), owed: owed.sort((x, y) => compare(x.name, y.name)), unanswered, surprises, rules, spans, unchecked, rebuild: () => null };
}

/** A refusal (account.md §diff "Refusals"). */
const refusedOf = (says) => ({ refused: [{ check: 'account.md §diff', file: null, entry: null, field: null, says }] });

/**
 * The earlier copy (account.md §diff): `{ root, from, cleanup }` for a folder or a commit's files under the project
 * folder's path, extracted outside the project; or `{ refused }`.
 */
async function earlierCopy(root, arg, project) {
  if (arg !== null && arg !== undefined) {
    try {
      const where = resolve(arg);
      if ((await stat(where)).isDirectory()) return { root: where, from: { folder: arg }, cleanup: async () => {} };
    } catch { /* not a folder: a commit */ }
  }
  let top;
  try {
    top = (await git(root, ['rev-parse', '--show-toplevel'])).stdout.trim();
  } catch {
    return refusedOf(`the project folder ${root} is in no git repository, so a commit cannot be read; name an earlier copy's folder instead`);
  }
  const rel = relative(await realpath(top), await realpath(root)).split('\\').join('/');
  let commit = arg;
  if (commit === null || commit === undefined) {
    const latest = inOrder(project.decisions).at(-1);
    if (!latest) return refusedOf('the project holds no decision, so there is no latest decision to count from; name a commit or a folder');
    const path = rel ? `${rel}/${latest.path}` : latest.path;
    const added = (await git(top, ['log', '--diff-filter=A', '--format=%H', '-n', '1', 'HEAD', '--', path]).catch(() => ({ stdout: '' }))).stdout.trim();
    if (!added) return refusedOf(`no commit added ${latest.path}, the latest decision's file, so the diff cannot count from it; name a folder instead`);
    commit = added;
  }
  let full;
  try {
    full = (await git(top, ['rev-parse', '--verify', '--quiet', `${commit}^{commit}`])).stdout.trim();
  } catch {
    full = '';
  }
  if (!full) return refusedOf(`git cannot resolve ${commit} to a commit in the repository that holds the project folder`);
  const dir = await mkdtemp(join(tmpdir(), 'forma-diff-'));
  const copy = join(dir, 'copy');
  await mkdir(copy);
  const cleanup = () => rm(dir, { recursive: true, force: true });
  const listed = rel ? (await git(top, ['ls-tree', '-d', full, '--', rel])).stdout.trim() : 'root';
  if (listed) {
    await git(top, ['archive', '--format=tar', '-o', join(dir, 'copy.tar'), rel ? `${full}:${rel}` : full]);
    await run('tar', ['-xf', join(dir, 'copy.tar'), '-C', copy]);
  }
  return { root: copy, from: { commit: full }, cleanup };
}

/** Every evidence file's outcome as text, by question name, of an account. */
const outcomes = (a) => new Map(a.evidence.questions.filter((r) => r.evidence).map((r) => [r.question.name, r]));
const outcomeText = (f) => (f.outcome === 'violation' ? `violation of ${f.property}` : f.outcome === 'refused' ? `refused at step ${f.step}` : f.outcome === 'unanswered' ? `unanswered: ${f.reason}` : f.outcome);

/** The changes between two copies (account.md §diff "Batches"): passages, entries, files, decisions, surprises. */
function changesBetween(then, now) {
  const out = [];
  const compareMaps = (kind, a, b) => {
    for (const ref of sortedBy([...new Set([...a.keys(), ...b.keys()])])) {
      const x = a.get(ref) ?? null;
      const y = b.get(ref) ?? null;
      if (x !== y) out.push({ kind, ref, then: x, now: y });
    }
  };
  const passages = (acc) => new Map([...acc.project.brief.passages.values()].map((p) => [p.address, p.hash]));
  const entries = (acc) => new Map([...[...acc.project.restatement.pins.entries.values()].map((e) => [e.name, e.pin]), ...[...acc.design.journeys.values()].filter((j) => j.added).map((j) => [j.name, j.pin])]);
  const files = (acc) => new Map([...acc.project.files.values()].filter((f) => f.counts && ['model-md', 'engine', 'slot'].includes(f.where?.kind)).map((f) => [f.path, f.sha256]));
  const decisions = (acc) => new Map(acc.project.decisions.map((d) => [d.name, d.path]));
  const surprises = (acc) => new Map(acc.evidence.surprises.map((s) => [s.name, s.question]));
  compareMaps('passage', passages(then), passages(now));
  compareMaps('entry', entries(then), entries(now));
  compareMaps('file', files(then), files(now));
  compareMaps('decision', decisions(then), decisions(now));
  compareMaps('surprise', surprises(then), surprises(now));
  return out;
}

/** What a line rests on (account.md §diff): the refs of entries, files, passages, decisions and surprises. */
function restsOf(acc, line) {
  const refs = new Set();
  const basis = (value) => {
    for (const f of value?.basis?.files ?? []) if (f.path) refs.add(`file\0${f.path}`);
    for (const e of value?.basis?.entries ?? []) refs.add(`entry\0${e.entry}`);
  };
  // A decision rests "on what its pin holds" (account.md §diff): each entry of its unit, and the passages they cite, whose hashes the
  // pin holds (design.md §pins); the part list's rows for the unit `parts`.
  const r = acc.project.restatement;
  const citesOf = (e) => r.entries.get(e)?.cites ?? r.things.get(e)?.cites ?? acc.design.journeys.get(e)?.cites ?? [];
  const unitEntries = (name) => {
    const unit = acc.design.units.get(name);
    for (const e of unit?.entries ?? [name]) {
      refs.add(`entry\0${e}`);
      for (const address of citesOf(e)) refs.add(`passage\0${address}`);
    }
    if (name === 'parts') for (const row of r.partList?.rows ?? []) for (const address of row.cites ?? []) refs.add(`passage\0${address}`);
  };
  if (line.kind === 'decision') {
    const d = acc.project.decisions.find((x) => x.name === line.ref);
    if (d) {
      unitEntries(d.on);
      for (const x of acc.project.decisions) if (x.name !== d.name && x.on === d.on) refs.add(`decision\0${x.name}`);
      // A brief decision rests on its ruling and on the passages its words name, which its pin holds (decisions.md §rulings).
      if (d.kind === 'brief') {
        refs.add(`decision\0${d.on.split('/')[0]}`);
        if (d.rows?.Choice === 'stated') for (const address of statedAddresses(d.words)) refs.add(`passage\0${address}`);
      }
    }
  }
  if (line.kind === 'slot' || line.kind === 'model file') {
    refs.add(`file\0${line.ref}`);
    for (const p of acc.project.slots.get(line.ref)?.pins ?? []) refs.add(`entry\0${p.entry}`);
  }
  if (line.kind === 'evidence' || line.kind === 'question') {
    const name = line.ref;
    const rec = acc.evidence.questions.find((r) => r.question.name === name);
    basis(rec?.evidence ?? acc.project.files.get(`models/${name}.json`)?.value);
    // A question no longer asked rests on what keeps its model from meeting the journey rules (account.md §journey-rules).
    if (!rec) {
      for (const f of acc.standing.ruleFails.get(name.split('/')[0]) ?? []) {
        for (const n of f.items ?? []) {
          const item = acc.items.find((i) => i.item === n);
          if (item) for (const ref of restsOf(acc, { kind: 'item', ref: n, item })) refs.add(ref);
        }
      }
    }
  }
  if (line.kind === 'claim') {
    const [entry, model] = line.ref.split(' on ');
    refs.add(`entry\0${entry}`);
    for (const rec of acc.evidence.questions) if (rec.question.claim?.entry === entry && rec.question.model === model) basis(rec.evidence);
    for (const s of acc.evidence.surprises) if (s.open && s.model === model) refs.add(`surprise\0${s.name}`);
    // The changes its failing conditions rest on: those of the items that supply them.
    const m = acc.standing.claims.get(entry)?.models.find((x) => x.model === model);
    for (const c of m?.fails ?? []) {
      for (const name of c.items ?? []) {
        const item = acc.items.find((i) => i.item === name);
        if (item) for (const ref of restsOf(acc, { kind: 'item', ref: name, item })) refs.add(ref);
      }
    }
  }
  if (line.kind === 'surprise') {
    refs.add(`surprise\0${line.ref}`);
    basis(acc.evidence.surprises.find((s) => s.name === line.ref)?.value);
  }
  if (line.kind === 'item') {
    const item = line.item;
    const on = String(item.on ?? '');
    const k = kindOf(item.item);
    if (k === 'passage') refs.add(`passage\0${on}`);
    else if (['run', 'unanswered'].includes(k)) {
      const rec = acc.evidence.questions.find((r) => r.question.name === on);
      basis(rec?.evidence);
      for (const name of rec?.question?.reads ?? []) refs.add(`entry\0${name}`);
    } else if (['explain', 'rule'].includes(k)) refs.add(`surprise\0${on}`);
    else if (k === 'repair' || k === 'brief') {
      // `on` names the decision, then for repair:<decision>/<model> and brief:<ruling>/<model> the model (account.md §commands).
      refs.add(`decision\0${on.split('/')[0]}`);
      for (const d of acc.project.decisions) if (d.kind === 'brief' && d.on === on) refs.add(`decision\0${d.name}`);
    }
    else if (k === 'change') refs.add(`file\0${on}`);
    else if (k === 'slot') {
      refs.add(`file\0models/${on}`);
      for (const [path, s] of acc.project.slots) if (path.startsWith(`models/${on}`)) for (const p of s.pins ?? []) refs.add(`entry\0${p.entry}`);
    } else unitEntries(on);
    // An item a decision opened or closed rests on that decision: the decisions on its subject.
    const m = /^[^/]+\/(parts|spans)\/([^/]+)\/(journeys|claims)\/([^/]+)/.exec(on);
    const subjects = new Set([on, ...(m ? [`${m[2]}/${m[3]}/${m[4]}`] : [])]);
    for (const d of acc.project.decisions) if (subjects.has(d.on) || String(d.on).split(', ').some((x) => subjects.has(x))) refs.add(`decision\0${d.name}`);
  }
  return refs;
}

/** The lines of each list grouped by the changes they rest on (account.md §diff). */
function grouped(lines, changes, then, now) {
  const groups = changes.map((change) => ({ change, lines: [] }));
  const none = { change: null, lines: [] };
  for (const line of lines) {
    const refs = new Set([...restsOf(then, line), ...restsOf(now, line)]);
    let placed = false;
    for (const g of groups) {
      if (refs.has(`${g.change.kind}\0${g.change.ref}`)) { g.lines.push(line.out); placed = true; }
    }
    if (!placed) none.lines.push(line.out);
  }
  return [...groups.filter((g) => g.lines.length), ...(none.lines.length ? [none] : [])];
}

/** The diff between two accounts (account.md §diff) as data. */
function diffOf(then, now, from) {
  const changes = changesBetween(then, now);
  const L = (kind, ref, t, n, extra = {}) => ({ kind, ref, ...extra, out: { kind, ref, then: t, now: n } });
  // Went stale.
  const stale = [];
  // A decision's state as the reading names it (presentation.md §reading; decisions.md §in-force "decides nothing", and a carry whose
  // basis claim is not established "has lapsed too", as account.md §standing's fixpoint counts it).
  const stateOf = (acc, d) => {
    const s = acc.design.force.states.get(d.name)?.state ?? null;
    const carry = d.kind === 'carry' ? acc.standing.carries.get(d.on) : null;
    if (s === 'in force' && carry?.by?.name === d.name && carry.carried && !carry.counted) return 'lapsed';
    return s === 'nothing' ? 'decides nothing' : s;
  };
  for (const d of then.project.decisions) {
    if (stateOf(then, d) !== 'in force') continue;
    const dNow = now.project.decisions.find((x) => x.name === d.name);
    const s = dNow ? stateOf(now, dNow) : null;
    if (s !== 'in force') stale.push(L('decision', d.name, 'in force', s ?? 'absent'));
  }
  for (const [path, slot] of then.evidence.slots.files) {
    if (!slot.current) continue;
    const later = now.evidence.slots.files.get(path);
    const bytesThen = then.project.files.get(path)?.sha256 ?? null;
    const bytesNow = now.project.files.get(path)?.sha256 ?? null;
    if (!later?.current || bytesThen !== bytesNow) stale.push(L('slot', path, 'current', !bytesNow ? 'gone' : bytesThen !== bytesNow ? 'rewritten' : 'not current'));
  }
  for (const [key, m] of then.evidence.models) {
    if (!m.usable || m.engine === 'lifecycle') continue;
    for (const name of ['model.md', ...(m.engineFiles ?? [])]) {
      const path = `${m.folder}/${name}`;
      const x = then.project.files.get(path)?.sha256 ?? null;
      const y = now.project.files.get(path)?.sha256 ?? null;
      if (x && x !== y) stale.push(L('model file', path, 'current', y ? 'rewritten' : 'gone'));
    }
    void key;
  }
  const evThen = outcomes(then);
  const evNow = outcomes(now);
  for (const [name, r] of evThen) {
    if (!r.current) continue;
    const later = evNow.get(name);
    const file = now.project.files.get(`models/${name}.json`);
    if (!later?.current) stale.push(L('evidence', name, 'current', later ? 'not current' : file?.counts ? 'not asked' : 'absent'));
  }
  for (const s of then.standing.claims.values()) {
    for (const m of s.models.filter((x) => x.established)) {
      const later = now.standing.claims.get(s.entry)?.models.find((x) => x.model === m.model);
      if (!later?.established) stale.push(L('claim', `${s.entry} on ${m.model}`, 'established', later ? 'not established' : 'absent'));
    }
  }
  // Changed outcome.
  const changed = [];
  for (const [name, r] of evThen) {
    const later = evNow.get(name);
    if (!later) continue;
    const x = outcomeText(r.evidence.found);
    const y = outcomeText(later.evidence.found);
    if (x !== y) changed.push(L('question', name, x, y));
  }
  // Opened and closed: items and surprises.
  const itemsThen = new Map(then.items.map((i) => [i.item, i]));
  const itemsNow = new Map(now.items.map((i) => [i.item, i]));
  const sThen = new Set(then.evidence.surprises.map((s) => s.name));
  const sNow = new Set(now.evidence.surprises.map((s) => s.name));
  const opened = [
    ...[...itemsNow.values()].filter((i) => !itemsThen.has(i.item)).map((i) => L('item', i.item, null, i.why ?? 'missing', { item: i })),
    ...[...sNow].filter((n) => !sThen.has(n)).sort(compare).map((n) => L('surprise', n, null, 'open')),
  ];
  const closed = [
    ...[...itemsThen.values()].filter((i) => !itemsNow.has(i.item)).map((i) => L('item', i.item, i.why ?? 'missing', null, { item: i })),
    ...[...sThen].filter((n) => !sNow.has(n)).sort(compare).map((n) => L('surprise', n, 'open', null)),
  ];
  const waiting = now.items.filter((i) => i.supply.some((s) => s.by === 'developer'));
  return {
    from,
    stale: grouped(stale, changes, then, now),
    changedOutcome: grouped(changed, changes, then, now),
    opened: grouped(opened, changes, then, now),
    closed: grouped(closed, changes, then, now),
    waiting,
    cannotSay: 'The diff says only what differs between the two copies, never when or in what order it happened between them.',
    cannotKnow: CANNOT_KNOW,
  };
}

/** The diff as Markdown (account.md §diff "Output"). */
function diffText(d) {
  const lines = [`# The diff from ${d.from.commit ? `commit ${d.from.commit}` : `the folder ${d.from.folder}`}`, '', d.cannotSay];
  const changeName = (c) => (c ? `${c.kind} ${c.ref}: ${c.then ?? 'absent'} then, ${c.now ?? 'absent'} now` : 'Under no change');
  const list = (title, groups) => {
    lines.push('', `## ${title}`);
    if (!groups.length) lines.push('', '- Nothing.');
    for (const g of groups) lines.push('', `### ${changeName(g.change)}`, '', ...g.lines.map((x) => `- ${x.kind} ${x.ref}: ${x.then ?? 'absent'} then, ${x.now ?? 'absent'} now`));
  };
  list('Went stale', d.stale);
  list('Changed outcome', d.changedOutcome);
  list('Opened', d.opened);
  list('Closed', d.closed);
  lines.push('', '## Waits for the developer');
  for (const checkpoint of CHECKPOINTS) {
    const mine = d.waiting.filter((i) => i.supply.find((s) => s.by === 'developer')?.checkpoint === checkpoint);
    if (mine.length) lines.push('', `### ${checkpoint}`, '', ...mine.map((i) => `- ${i.item}${i.why ? ` (${i.why})` : ''}${i.waits ? `; waits for ${i.waits.join(', ')}` : ''}`));
  }
  if (!d.waiting.length) lines.push('', '- Nothing.');
  lines.push('', '## What it cannot know', '', ...d.cannotKnow.map((x) => `- ${x}`));
  return `${lines.join('\n')}\n`;
}

/** `forma diff [<commit or folder>]` (account.md §diff, §commands): reads git for this command alone; writes nothing. */
export async function diffCommandOf(root, arg, { json = false, accountOf }) {
  const nowProject = await (await import('../record/project.mjs')).readProject(root);
  const copy = await earlierCopy(root, arg, nowProject);
  if (copy.refused) {
    return json ? { status: 1, stdout: `${JSON.stringify({ refused: copy.refused }, null, 2)}\n`, stderr: '' } : { status: 1, stdout: `${copy.refused.map((r) => `refused: ${r.says} (${r.check})`).join('\n')}\n`, stderr: '' };
  }
  try {
    const then = await accountOf(copy.root, { machine: false, evidenceWith: readEvidenceForDiff });
    const now = await accountOf(root, { machine: false, project: nowProject, evidenceWith: readEvidenceForDiff });
    const d = diffOf(then, now, copy.from);
    if (json) {
      const { cannotSay, ...rest } = d;
      return { status: 0, stdout: `${JSON.stringify(rest, null, 2)}\n`, stderr: '' };
    }
    return { status: 0, stdout: diffText(d), stderr: '' };
  } finally {
    await copy.cleanup();
  }
}
