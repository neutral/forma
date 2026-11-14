import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  answerFolder, forma, hasToolchain, project, read, sha256, snapshot, tempFolder, tree, writeFiles,
} from './helpers/forma.mjs';

// All fixtures are handwritten. Hashes, receipts and historical decision names
// below are constructed from the contracts, never copied from implementation output.
const CITE = 'design/brief/system.md#workflow';
const OUTSIDE = 'design/brief/system.md#outside';
const LIFE = 'alpha/lifecycles/request';
const CLAIM = 'alpha/claims/safe';
const PREMISE = 'alpha/premises/reliable';
const CHOICE = 'alpha/choices/policy';
const AT = '2025-01-01T00:00:00.000Z';
const AUTHOR = { provider: 'fixture-author', model: 'writer', session: 'draft' };
const MAKER = { provider: 'declared-provider', model: 'declared-model', session: 'decision-session-secret-7e504b5e' };
const BY = 'Project owner';
const ALLOWANCE = ['Answers', 'Runs', 'TLC seconds', 'TLC megabytes', 'Alloy seconds', 'Alloy megabytes', 'Lifecycle seconds'];
const OPTIONS = ['--answers', '--runs', '--tlc-seconds', '--tlc-megabytes', '--alloy-seconds', '--alloy-megabytes', '--lifecycle-seconds'];
const sessionArgs = (s = MAKER) => ['--provider', s.provider, '--model', s.model, '--session', s.session];
const identity = (s = MAKER, by = BY) => ['--by', by, ...sessionArgs(s)];
const pathOf = (ref) => `design/${ref.startsWith('together/') ? 'spans' : 'parts'}/${ref}/README.md`;
const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;
const table = (rows) => `| Field | Value |\n| --- | --- |\n${rows.map(([key, value]) => `| ${key} | ${String(value).replaceAll('|', '\\|')} |`).join('\n')}\n`;
const fieldsOf = (text) => Object.fromEntries(fieldRows(text));
// forms.md §page-rules: inspect values without fixing table padding,
// column order, the case of field names, or a whole-cell code-span wrapper.
const canonicalFields = ['Field', 'Value', 'Kind', 'On', 'Pin', 'Provider', 'Model', 'Session', 'By', 'At',
  'Situation', ...ALLOWANCE, 'Cadence', 'Inbox cap', 'Choice', 'Basis', 'Verdict', 'Level', 'Target', 'Target pin',
  'Sentence', 'Stake', 'Rests on', 'Parts', 'Origin', 'Cites', 'Statement', 'Class', 'Why not examined', 'Falsifier',
  'Entity', 'Initial', 'Ends', 'Unaffected', 'Question', 'Recommendation', 'Polarity', 'Expected end', 'Refused step',
  'Journey', 'Not kept', 'Action', 'Mechanism', 'Meaning', 'Weaker'];
function tableCells(line) {
  const value = line.trim();
  if (!/(?<!\\)\|/.test(value)) return null;
  return value.replace(/^\|/, '').replace(/(?<!\\)\|$/, '').split(/(?<!\\)\|/).map((cell) => {
    const text = cell.trim().replaceAll('\\|', '|');
    const span = /^(`+)([\s\S]*)\1$/.exec(text);
    return span ? span[2] : text;
  });
}
function fieldRows(text) {
  const head = text.split(/^## /m)[0];
  let fieldAt = null;
  const result = [];
  for (const row of head.split('\n').map(tableCells)) {
    if (row?.length !== 2) { fieldAt = null; continue; }
    if (row.some((cell) => cell.toLowerCase() === 'field') && row.some((cell) => cell.toLowerCase() === 'value')) {
      fieldAt = row.findIndex((cell) => cell.toLowerCase() === 'field');
    } else if (fieldAt !== null && !/^:?-+:?$/.test(row[0])) {
      result.push([canonicalFields.find((field) => field.toLowerCase() === row[fieldAt].toLowerCase()) ?? row[fieldAt], row[1 - fieldAt]]);
    }
  }
  return result;
}
function headings(text) {
  let at = 0;
  let ticks = null;
  const found = [];
  for (const line of text.split('\n')) {
    if (ticks) { if (line === ticks) ticks = null; }
    else if (/^`{3,}text$/.test(line)) ticks = line.slice(0, -4);
    else if (line.startsWith('## ')) found.push({ name: line.slice(3), start: at, content: at + line.length + 1 });
    at += line.length + 1;
  }
  return found;
}
const sectionNames = (text) => headings(text).map((heading) => heading.name);
function section(text, name) {
  const all = headings(text);
  const index = all.findIndex((heading) => heading.name === name);
  assert.notEqual(index, -1, `missing ${name}`);
  return text.slice(all[index].content, all[index + 1]?.start ?? text.length);
}
// decisions.md §decision-file: sections/fences are fixed, at least three backticks,
// and exceed every content run by one; the content is followed by one LF.
function fence(content) {
  const n = Math.max(3, ...[...content.matchAll(/`+/g)].map((m) => m[0].length + 1));
  const ticks = '`'.repeat(n);
  return `${ticks}text\n${content}\n${ticks}\n`;
}
function fenced(text, name) {
  const body = section(text, name).replace(/^(?:[ \t]*\n)*/, '');
  const match = /^(`{3,})text\n([\s\S]*?)\n\1\n/.exec(body);
  assert.ok(match, `${name} is one text fence`);
  assert.equal(match[0], fence(match[2]));
  assert.equal(body.slice(match[0].length).trim(), '');
  return match[2];
}
// lifecycle-tool.md §as-read: pictures retained in text are independent JSON
// records, even when their fence is nested inside a decision's Shown fence.
function retainedPictures(text) {
  return [...text.matchAll(/^([ \t]*)```json forma-diagram\n([\s\S]*?)^\1```[ \t]*$/gm)].map(match => {
    const picture = JSON.parse(match[2]);
    const expected = JSON.stringify(picture, null, 2).split('\n').map(line => match[1] + line).join('\n') + '\n';
    assert.equal(match[2], expected, 'retained picture uses deterministic two-space JSON');
    return picture;
  });
}
// decisions.md §decision-file: filename uses At to the second and the first 12 hex digits of the bytes' SHA-256.
function decisionName(text) {
  const f = fieldsOf(text);
  return `${f.At.replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z')}-${f.Kind}-${sha256(text).slice(0, 12)}`;
}
// decisions.md §decision-file: reconstruct a synthetic merged field table in
// the fixed row order without assuming the original writer's Markdown padding.
function withDecisionField(text, field, value) {
  const rows = fieldRows(text).map(([key, old]) => [key, key === field ? value : old]);
  return `${text.split('\n')[0]}\n\n${table(rows)}\n${text.slice(headings(text)[0].start)}`;
}
// decisions.md §decision-file to §kinds; door.md §receipts:
// handwritten historical decisions follow the exact form and need no receipt.
async function historical(dir, { kind, on, pin, rows = [], words, shown = `${kind} ${on}`, at = AT, folder = 'design/decisions', extras = '', session = MAKER }) {
  const text = `# ${kind} ${on}\n\n${table([['Kind', kind], ['On', on], ['Pin', pin ?? sha256(`${shown}\n`)], ...rows,
    ['Provider', session.provider], ['Model', session.model], ['Session', session.session], ['By', BY], ['At', at]])}\n`
    + (words === undefined ? '' : `## Words\n\n${fence(words)}\n`)
    + (extras.startsWith('## Surprises') ? `${extras}\n` : '')
    + `## Shown\n\n${fence(shown)}`
    + (extras && !extras.startsWith('## Surprises') ? `\n${extras}` : '');
  const name = decisionName(text);
  const path = `${folder}/${name}.md`;
  await writeFiles(dir, { [path]: text });
  return { name, path, text, fields: fieldsOf(text) };
}
// door.md §receipts: receipts certify supplied bytes and name authors,
// pins and repair history in this order; all base pages were authored by AUTHOR.
async function accepted(dir, files, extra = {}) {
  await writeFiles(dir, files);
  const folders = new Map();
  for (const [path, content] of Object.entries(files)) {
    const slash = path.lastIndexOf('/');
    const folder = path.slice(0, slash);
    if (!folders.has(folder)) {
      const old = await read(dir, `${folder}/receipt`);
      folders.set(folder, old ? old.trim().split('\n').map(JSON.parse) : []);
    }
    const file = path.slice(slash + 1);
    const rows = folders.get(folder).filter((line) => line.file !== file);
    rows.push({ file, sha256: sha256(content), at: AT, session: AUTHOR, authors: [AUTHOR], ...extra });
    folders.set(folder, rows);
  }
  for (const [folder, rows] of folders) {
    rows.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
    await writeFiles(dir, { [`${folder}/receipt`]: rows.map(JSON.stringify).join('\n') + '\n' });
  }
}
// project.md §commands: success status and JSON object.
function ok(result) {
  assert.equal(result.status, 0, `Forma should succeed:\n${result.stderr}\n${result.stdout}`);
  assert.ok(result.json && typeof result.json === 'object' && !Array.isArray(result.json), 'one JSON object');
  return result.json;
}
// decisions.md §forma-show to §forma-decide; door.md §forma-answer:
// refusal status/object and structured reasons where a contract check gave them.
function refused(result) {
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.ok(result.json, `Forma must emit refusal JSON, not a missing CLI/error:\n${result.stderr}`);
  assert.deepEqual(Object.keys(result.json), ['refused']);
  assert.ok(Array.isArray(result.json.refused) && result.json.refused.length > 0);
  for (const reason of result.json.refused) {
    if (typeof reason === 'string') assert.ok(reason.length > 0);
    else {
      assert.deepEqual(Object.keys(reason).sort(), ['check', 'entry', 'field', 'file', 'says']);
      assert.equal(typeof reason.check, 'string');
      assert.equal(typeof reason.says, 'string');
      for (const key of ['entry', 'field', 'file']) assert.ok(reason[key] === null || typeof reason[key] === 'string');
    }
  }
  return result.json.refused;
}
async function refusesUnchanged(dir, args) {
  // decisions.md §forma-show to §forma-decide: refusal writes no decision.
  // door.md §lock, §copies: a refusal found under the writer's lock may have
  // written work/.gitignore; every other byte must remain.
  const before = await snapshot(dir, { skip: ['work/.gitignore'] });
  const reasons = refused(forma(dir, [...args, '--json']));
  assert.deepEqual(await snapshot(dir, { skip: ['work/.gitignore'] }), before);
  return reasons;
}
// decisions.md §forma-decide: exact successful decision JSON.
function resultPaths(result) {
  const value = ok(result);
  assert.deepEqual(Object.keys(value).sort(), ['recorded', 'removed', 'written']);
  for (const key of ['recorded', 'removed', 'written']) assert.ok(Array.isArray(value[key]));
  return value;
}
async function intake(dir, opts = [], who = MAKER) {
  const result = forma(dir, ['decide', 'intake', '--situation', 'design new', '--words', 'Reporting is outside scope because it is independent.',
    '--answers', '100', '--runs', '100', '--lifecycle-seconds', '10', ...opts, ...identity(who), '--json']);
  return resultPaths(result);
}
async function base({ initialized = true, confirmed = true, files = {}, omit = [] } = {}) {
  let dir = await project('decisions/base', files);
  if (omit.length) dir = await project(null, Object.fromEntries(Object.entries(await snapshot(dir)).filter(([path]) => !omit.some((prefix) => path.startsWith(prefix)))));
  const source = await snapshot(dir);
  await accepted(dir, Object.fromEntries(Object.entries(source).filter(([path]) => !path.startsWith('design/brief/'))));
  if (initialized) await intake(dir);
  if (initialized && confirmed) await decide(dir, 'confirm', 'parts');
  return dir;
}
function show(dir, kind, on, args = []) {
  return ok(forma(dir, ['show', kind, ...(on ? [on] : []), ...args, '--json']));
}
async function decide(dir, kind, on, args = [], showArgs = []) {
  // presentation.md §showings, decisions.md §forma-decide: SHA-256 token and
  // each returned recorded path denotes the decision just written.
  const showing = show(dir, kind, on, showArgs);
  assert.match(showing.token, /^[a-f0-9]{64}$/);
  const result = resultPaths(forma(dir, ['decide', kind, on, '--shown', showing.token, ...args, ...identity(), '--json']));
  const records = [];
  for (const path of result.recorded) {
    const text = await read(dir, path);
    assert.ok(text);
    records.push({ name: path.split('/').at(-1).slice(0, -3), path, text, fields: fieldsOf(text) });
  }
  return { ...result, records, showing };
}
async function inspectRecord(dir, path, { kind, on, rows = [], sections = ['Shown'], words, shown, pin }) {
  // decisions.md §decision-file, §kinds, presentation.md §showings:
  // exact filename, UTC time, field/section order, literal words and showing.
  const text = await read(dir, path);
  assert.ok(text && text.endsWith('\n') && !text.includes('\r'));
  assert.equal(text.split('\n')[0], `# ${kind} ${on}`);
  const f = fieldsOf(text);
  assert.deepEqual(fieldRows(text).map(([key]) => key), ['Kind', 'On', 'Pin', ...rows.map(([key]) => key), 'Provider', 'Model', 'Session', 'By', 'At']);
  assert.equal(f.Kind, kind);
  assert.equal(f.On, on);
  for (const [key, value] of rows) assert.equal(f[key], String(value));
  assert.match(f.Pin, /^[a-f0-9]{64}$/);
  if (pin) assert.equal(f.Pin, pin);
  assert.match(f.At, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  assert.equal(new Date(f.At).toISOString(), f.At);
  assert.equal(path.split('/').at(-1), `${decisionName(text)}.md`);
  assert.deepEqual(sectionNames(text), sections);
  if (words !== undefined) assert.equal(fenced(text, 'Words'), words);
  if (shown !== undefined) assert.equal(fenced(text, 'Shown'), shown);
  else fenced(text, 'Shown');
  return { text, fields: f, name: decisionName(text), path };
}
const missing = (dir) => ok(forma(dir, ['missing', '--json'])).items;
const account = (dir, ref) => ok(forma(dir, ['account', ...(ref ? [ref] : []), '--json']));
const itemNames = (dir) => missing(dir).map((item) => item.item);
const decisionEntry = (dir, ref, name) => {
  // decisions.md §in-force; presentation.md §reading.
  const found = account(dir, ref).thing.decisions.find((d) => d.decision === name);
  assert.ok(found, `account must list ${name} for ${ref}`);
  return found;
};
const strings = (value) => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(strings)
  : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];

// design.md §passages, §pins: this fixture's CommonMark passage
// consists of a heading and one paragraph, already in canonical whitespace.
async function passageHash(dir) {
  const source = await read(dir, 'design/brief/system.md');
  return sha256(source.split('\n\n# Outside')[0].trim());
}
// forms.md §claims, design.md §pins:
// the simple claim has no references except Parts and, optionally, Rests on.
async function claimPin(dir, ref = CLAIM, changes = {}) {
  const f = { ...fieldsOf(await read(dir, pathOf(ref))), ...changes };
  const purposes = { alpha: 'Process requests.', beta: 'Observe completions.' };
  const rests = { reliable: 'The worker behaves reliably.', 'alpha/reliable': 'The worker behaves reliably.', fair: 'The worker eventually acts.', 'alpha/fair': 'The worker eventually acts.', 'store:records': 'store Records', 'choice:policy': 'choice Should the worker advance or wait?' };
  return sha256(['Sentence', 'Kind', 'Stake', 'Rests on', 'Parts', 'Cites'].map((key) => {
    let value = f[key];
    if (key === 'Cites') value = null;
    else if (key === 'Parts') value = value.split(', ').map((p) => purposes[p]).sort().join(', ');
    else if (key === 'Rests on') value = value === 'none' ? '' : value.split(', ').map((p) => rests[p]).sort().join(', ');
    return [key, value];
  }).map(([key, value]) => `${key}: ${value ?? '__CITATION__'}`).join('\n').replace('__CITATION__', await passageHash(dir)));
}
// forms.md §premises, design.md §pins:
// no field of this world premise is an entry reference.
async function premisePin(dir) {
  const f = fieldsOf(await read(dir, pathOf(PREMISE)));
  return sha256(['Statement', 'Class', 'Why not examined', 'Falsifier', 'Provider', 'Cites']
    .map((key) => `${key}: ${key === 'Cites' ? '__CITATION__' : f[key]}`).join('\n').replace('__CITATION__', await passageHash(dir)));
}
// design.md §pins: parts entries are sorted by their canonical text.
async function partsPin(dir) {
  const hash = await passageHash(dir);
  return sha256(['Process requests.', 'Observe completions.'].map((purpose) => `Purpose: ${purpose}\nCites: ${hash}`).sort().join('\n'));
}

// forms.md §page-rules, design.md §pins: compare named cells,
// not a chosen column order or spacing. This is a parser for these small fixtures.
function dataRows(text, columns) {
  const lines = text.split('\n');
  const at = lines.findIndex((line) => {
    const cells = tableCells(line);
    return cells?.length === columns.length && columns.every((column) => cells.some((cell) => cell.toLowerCase() === column.toLowerCase()));
  });
  assert.ok(at >= 0, columns.join(', '));
  const header = tableCells(lines[at]);
  const indexes = columns.map((column) => header.findIndex((cell) => cell.toLowerCase() === column.toLowerCase()));
  const rows = [];
  for (let i = at + 2; i < lines.length && tableCells(lines[i]); i++) {
    const cells = tableCells(lines[i]);
    rows.push(Object.fromEntries(columns.map((key, index) => [key, cells[indexes[index]]])));
  }
  return rows;
}
async function lifecyclePin(dir, ref = LIFE) {
  const part = ref.split('/')[0];
  const page = await read(dir, pathOf(ref));
  const f = fieldsOf(page);
  const actions = dataRows(await read(dir, `design/parts/${part}/actions.md`), ['Action', 'Actor', 'Sentence', 'Cases', 'Guard', 'Origin', 'Cites']);
  const names = Object.fromEntries(actions.map((a) => [a.Action, a.Sentence + (a.Cases === 'none' ? '' : ` (cases ${a.Cases})`) + (a.Guard === 'none' ? '' : ` (guard ${a.Guard})`)]));
  const boundary = dataRows(await read(dir, `design/parts/${part}/boundary.md`), ['Row', 'Names', 'Kind', 'Side', 'Seam', 'Isolation', 'Reads', 'Writes', 'Origin', 'Cites']);
  const entity = boundary.find((row) => row.Row === f.Entity);
  assert.ok(entity);
  // forms.md §page-rules, §lifecycles allow Phase anywhere.
  const columns = page.split('\n').filter((line) => line.startsWith('|'))
    .map((line) => line.slice(1, -1).split('|').map((cell) => cell.trim()))
    .find((cells) => cells.some((cell) => cell.toLowerCase() === 'phase'));
  const phaseColumn = columns.find((column) => column.toLowerCase() === 'phase');
  const cells = [];
  for (const row of dataRows(page, columns)) for (const action of columns.filter((column) => column !== phaseColumn)) {
    let outcome = row[action] || '(empty)';
    if (outcome.includes('<br>')) outcome = outcome.split('<br>').map((s) => s.trim()).sort().join('; ');
    if (outcome.startsWith('choice:')) outcome = `choice ${fieldsOf(await read(dir, pathOf(`${part}/choices/${outcome.slice(7)}`))).Question}`;
    cells.push(`Cell: ${row[phaseColumn]} | ${names[action]} | ${outcome}`);
  }
  const initial = f.Initial.replace(/, entered by (.+)$/, (_, action) => `, entered by ${names[action]}`);
  return sha256([`Entity: ${entity.Names} (${entity.Kind}, ${entity.Side}, ${entity.Seam}, ${entity.Isolation})`, `Initial: ${initial}`, `Ends: ${f.Ends === 'none' ? '' : f.Ends.split(', ').sort().join(', ')}`, `Unaffected: ${f.Unaffected === 'none' ? '' : f.Unaffected.split(', ').map((key) => names[key]).sort().join(', ')}`, `Cites: ${await passageHash(dir)}`, ...cells.sort()].join('\n'));
}
// design.md §pins: this fixture's choice has no effects, and its alternatives differ at one step.
async function choicePin(dir) {
  return sha256(['Question: Should the worker advance or wait?', 'Recommendation: a: complete promptly', `Cites: ${await passageHash(dir)}`,
    'Alternative a', 'Polarity: should happen', 'Expected end: The policy is followed.', 'Refused step: -', 'Step 1: Worker | Complete the request. | - | - | -',
    'Alternative b', 'Polarity: should happen', 'Expected end: The policy is followed.', 'Refused step: -', 'Step 1: Worker | Leave the request unchanged. | - | - | -'].join('\n'));
}
// engines.md §slot-forms, models.md §slot-currency; door.md §receipts:
// these slots pin the claim and every lifecycle of its part, in byte order of entry.
async function slots(dir, ref = CLAIM, { violation = false, initial = false } = {}) {
  const folder = `models/lifecycles-alpha/${ref.startsWith('together/') ? 'spans/together' : 'parts/alpha'}/claims/${ref.split('/').at(-1)}`;
  const encoding = violation
    ? `| Lifecycle | Phase |\n| --- | --- |\n| request | ${initial ? 'ready' : 'done'} |\n`
    : '| Lifecycle | From | Action | To |\n| --- | --- | --- | --- |\n| request | done | wait | ready |\n';
  const pins = [{ entry: ref, pin: await claimPin(dir, ref) }, { entry: LIFE, pin: await lifecyclePin(dir) }]
    .sort((a, b) => Buffer.compare(Buffer.from(a.entry), Buffer.from(b.entry)));
  await accepted(dir, {
    [`${folder}/encoding.md`]: encoding,
    [`${folder}/fault-unchanged.md`]: table([['Action', '-'], ['Mechanism', 'The unchanged waiting step.']]) + '\n| Lifecycle | Phase | Action | Outcome |\n| --- | --- | --- | --- |\n| request | ready | wait | ready |\n',
  }, { pins });
}
// evidence.md §explain; door.md §receipts:
// an independent, handwritten explanation for one actual lifecycle surprise.
async function explain(dir, surprise, verdict = 'model wrong') {
  const explanation = table([['Question', surprise.data.question], ['Basis', surprise.basis.slice(0, 12)], ['Verdict', verdict], ['Level', 'specification'], ['Weaker', 'none']])
    + '\n## Trace\n\nThe worker leaves the request in its current phase.\n\n## Failure shape\n\nThe expected protection is not demonstrated.\n\n## Mechanism\n\nThe waiting transition has no additional protection.\n';
  const author = { provider: 'independent', model: 'explainer', session: 'explanation' };
  await accepted(dir, { [surprise.path.replace(/\.json$/, '.explained.md')]: explanation }, { session: author, authors: [author] });
  return explanation;
}
// evidence.md §stems, §basis, §own-check:
// derive a surprise's whole basis digest from its canonical JSON.
async function surpriseRecords(dir) {
  const paths = (await tree(dir)).filter((path) => /\.surprise-[a-f0-9]{12}\.json$/.test(path));
  const records = [];
  for (const path of paths) {
    const data = JSON.parse(await read(dir, path));
    records.push({ path, data, name: data.name, basis: sha256(jsonText(data.basis)) });
  }
  return records.sort((a, b) => a.name < b.name ? -1 : 1);
}
async function rulingBase({ violation = false, initial = false, explained = true, refs = [CLAIM], shared = false, rests = {}, prepare } = {}) {
  const dir = await base();
  if (prepare) await prepare(dir);
  if (shared) await accepted(dir, { [pathOf(CLAIM)]: (await read(dir, pathOf(CLAIM))).replace('| Rests on | none |', '| Rests on | reliable |') });
  for (const [ref, value] of Object.entries(rests)) {
    const page = await read(dir, pathOf(ref)) ?? await read(dir, pathOf(CLAIM));
    await accepted(dir, { [pathOf(ref)]: page.replace(/\| Rests on \| [^\n]+/, `| Rests on | ${value} |`) });
  }
  await decide(dir, 'confirm', LIFE);
  await decide(dir, 'confirm', 'alpha/journeys/complete');
  for (const ref of refs) {
    await decide(dir, 'confirm', ref);
    await slots(dir, ref, { violation, initial });
  }
  ok(forma(dir, ['run', '--json']));
  const surprises = await surpriseRecords(dir);
  // evidence.md §questions, §surprise-file: a reachable forbidden
  // phase or uncaught planted fault does not match and opens a surprise.
  assert.ok(surprises.length > 0, 'the lifecycle run must find the fixture’s forbidden phase or uncaught fault');
  if (explained) for (const s of surprises) await explain(dir, s);
  return { dir, surprises };
}
function waiting(dir) {
  return missing(dir).filter((item) => item.item.startsWith('rule:')).map((item) => item.item.slice(5));
}
async function rule(dir, names, verdict = 'model wrong', extra = []) {
  return decide(dir, 'rule', names.join(','), ['--verdict', verdict, '--level', 'specification', '--words', 'Repair the stated mechanism.', ...extra]);
}
async function poseChoice(dir) {
  const page = (await read(dir, pathOf(LIFE))).replace('| ready | done | ready |', '| ready | choice:policy | ready |');
  const effects = '\n| Lifecycle | Phase | Action | Outcome |\n| --- | --- | --- | --- |\n| request | ready | advance | done |\n';
  const choice = (await read(dir, pathOf(CHOICE))).replace('\n## b\n', `${effects}\n## b\n`) + effects;
  await accepted(dir, { [pathOf(LIFE)]: page, [pathOf(CHOICE)]: choice });
}
async function journeySurprise() {
  const dir = await base();
  const ref = 'alpha/journeys/no-repeat';
  const page = '# Do not complete twice\n\n' + table([['Polarity', 'must not'], ['Expected end', '-'], ['Refused step', 2], ['Origin', 'added'], ['Cites', CITE]])
    + '\n| Step | Actor | Action | Arguments | Entity | Case |\n| --- | --- | --- | --- | --- | --- |\n| 1 | Worker | advance | - | - | - |\n| 2 | Worker | advance | - | - | - |\n';
  await accepted(dir, { [pathOf(ref)]: page });
  await decide(dir, 'confirm', LIFE);
  await decide(dir, 'confirm', 'alpha/journeys/complete');
  await decide(dir, 'confirm', ref);
  ok(forma(dir, ['run', '--json']));
  await accepted(dir, { [pathOf(LIFE)]: (await read(dir, pathOf(LIFE))).replace('| done | None. | done |', '| done | done | done |') });
  await decide(dir, 'confirm', LIFE);
  ok(forma(dir, ['run', '--json']));
  const surprises = await surpriseRecords(dir);
  // evidence.md §lifecycle-journeys, §surprise-file: after confirming
  // admission of the previously refused second step, only this journey fails.
  assert.equal(surprises.length, 1);
  assert.equal(surprises[0].data.kind, 'lifecycle-path');
  await explain(dir, surprises[0]);
  return { dir, ref, surprise: surprises[0] };
}
async function betaEvidence(dir, { cyclic = false } = {}) {
  const fixture = await project('decisions/beta-lifecycle');
  await accepted(dir, await snapshot(fixture));
  const boundary = await read(dir, 'design/parts/beta/boundary.md');
  await accepted(dir, { 'design/parts/beta/boundary.md': boundary.replace('\n\n## Surface', `\n| observation | Observation | entity | machine | - | - | observer | observer | stated | ${CITE} |\n\n## Surface`) });
  const ref = 'beta/claims/safe';
  if (cyclic) await accepted(dir, { [pathOf(ref)]: (await read(dir, pathOf(ref))).replace('| Rests on | none |', '| Rests on | alpha/reliable |') });
  const life = 'beta/lifecycles/observation';
  await decide(dir, 'confirm', life);
  await decide(dir, 'confirm', 'beta/journeys/observe');
  await decide(dir, 'confirm', ref);
  const folder = 'models/lifecycles-beta/parts/beta/claims/safe';
  await accepted(dir, {
    [`${folder}/encoding.md`]: '| Lifecycle | From | Action | To |\n| --- | --- | --- | --- |\n| observation | observed | observe | pending |\n',
    [`${folder}/witness-observed.md`]: table([['Meaning', 'An observation completes.']]) + '\n| Lifecycle | Phase |\n| --- | --- |\n| observation | observed |\n',
    [`${folder}/fault-return.md`]: table([['Action', '-'], ['Mechanism', 'The observed phase cannot return to pending.']]) + '\n| Lifecycle | Phase | Action | Outcome |\n| --- | --- | --- | --- |\n| observation | observed | observe | pending |\n',
  }, { pins: [{ entry: ref, pin: await claimPin(dir, ref) }, { entry: life, pin: await lifecyclePin(dir, life) }] });
  await decide(dir, 'carry', 'bound:lifecycles-beta/beta/safe', ['--choice', 'carry', '--words', 'The claim depends on data beyond phases.']);
  ok(forma(dir, ['run', '--json']));
}
async function nativeSurprise({ typeFailure = false, liveness = false } = {}) {
  const dir = await base({ initialized: false });
  resultPaths(forma(dir, ['decide', 'intake', '--situation', 'design new', '--words', 'Only observations are examined.', '--answers', '10', '--runs', liveness ? '3' : '2', '--tlc-seconds', '10', '--tlc-megabytes', '512', ...identity(), '--json']));
  await decide(dir, 'confirm', 'parts');
  const fixture = await project('decisions/tlc');
  const files = await snapshot(fixture);
  files['models/tiny/Tiny.tla'] = files['models/tiny/Tiny.tla'].replace("Observe == x' = x", typeFailure ? "Observe == /\\ x < 2\n           /\\ x' = x + 1" : "Observe == x' = 1");
  if (liveness) {
    const fixture = await project('decisions/beta-lifecycle');
    await accepted(dir, {
      [pathOf('beta/lifecycles/observation')]: await read(fixture, pathOf('beta/lifecycles/observation')),
      'design/parts/beta/boundary.md': (await read(dir, 'design/parts/beta/boundary.md')).replace('\n\n## Surface', `\n| observation | Observation | entity | machine | - | - | observer | observer | stated | ${CITE} |\n\n## Surface`),
      [pathOf('beta/claims/safe')]: (await read(dir, pathOf('beta/claims/safe'))).replace('| Kind | safety |', '| Kind | liveness |').replace('| Rests on | none |', '| Rests on | alpha/fair |'),
    });
    files['models/tiny/model.md'] = files['models/tiny/model.md'].replace('| Lifecycle | Over | Expression |\n| --- | --- | --- |', '| Lifecycle | Over | Expression |\n| --- | --- | --- |\n| beta/observation | e \\in {1} | IF x = 0 THEN "pending" ELSE "observed" |');
  }
  await accepted(dir, files);
  await accepted(dir, { 'models/tiny/model.md': files['models/tiny/model.md'] }, { strikes: [] });
  const journeyFixture = await project('decisions/beta-lifecycle');
  const ref = 'beta/journeys/observe';
  await accepted(dir, { [pathOf(ref)]: await read(journeyFixture, pathOf(ref)) });
  await decide(dir, 'confirm', ref);
  await decide(dir, 'confirm', 'beta/claims/safe');
  const citation = await passageHash(dir);
  // design.md §pins and engines.md §slot-forms, models.md §slot-currency: schedule pins the journey and
  // its action; End reads the observed state that its Expected end promises.
  const actionPin = sha256(`Actor: Observer (actor, machine, -, -)\nSentence: Observe the completion.\nCases: \nGuard: none\nCites: ${citation}`);
  const journeyPin = sha256(`Polarity: should happen\nExpected end: The completion is observed.\nRefused step: -\nCites: ${citation}\nStep 1: Observer | Observe the completion. | - | - | -`);
  await accepted(dir, { 'models/tiny/parts/beta/journeys/observe/schedule.md': '| Entity | Value |\n| --- | --- |\n\n| Step | Bindings |\n| --- | --- |\n| 1 | none |\n\n| Field | Value |\n| --- | --- |\n| Meaning | The completion is observed. |\n\n```tla\nEnd == x = 1\n```\n' }, { pins: [{ entry: 'beta/actions/observe', pin: actionPin }, { entry: ref, pin: journeyPin }] });
  await accepted(dir, { 'models/tiny/parts/beta/claims/safe/encoding.tla': liveness ? 'Property == []<>(x = 2)\nFairness == WF_vars(Observe)\n' : typeFailure ? 'Invariant == x >= 0\n' : 'Invariant == x = 0\n' }, { pins: [{ entry: 'beta/claims/safe', pin: await claimPin(dir, 'beta/claims/safe') }] });
  ok(forma(dir, ['run', '--json']));
  // evidence.md §questions, §forma-run, §surprise-file:
  // the allowed conformance runs precede base and match; one further run reaches
  // the failing base property (or TypeOK). Liveness additionally checks phases.
  assert.equal((await surpriseRecords(dir)).length, 0, 'the enabled and one-step path questions match before the base question');
  resultPaths(forma(dir, ['decide', 'allow', '--runs', '1', ...identity(), '--json']));
  ok(forma(dir, ['run', '--json']));
  const surprises = await surpriseRecords(dir);
  assert.equal(surprises.length, 1);
  const surprise = surprises[0];
  assert.equal(surprise.data.kind, 'base');
  const author = { provider: 'independent-native', model: 'explainer', session: 'explanation' };
  // evidence.md §weaker, §explain: only a violation of the encoding's own property
  // requires weaker forms; a TypeOK violation must have none.
  const explanation = table([['Question', surprise.data.question], ['Basis', surprise.basis.slice(0, 12)], ['Verdict', 'model wrong'], ['Level', 'specification'], ['Weaker', typeFailure ? 'none' : 'relaxed']])
    + '\n## Trace\n\nThe observer makes a completion visible.\n\n## Failure shape\n\nAn observation exceeds the declared expectation.\n\n## Mechanism\n\nThe observation updates the counter.\n';
  const stem = surprise.path.slice(0, -5);
  await accepted(dir, { [`${stem}.explained.md`]: explanation,
    ...(typeFailure ? {} : { [`${stem}.weaker-relaxed.tla`]: liveness ? 'Property == []<>(x = 1)\nFairness == WF_vars(Observe)\n' : 'Invariant == x >= 0\n' }),
  }, { session: author, authors: [author] });
  return { dir, surprise, explanation, author, stem };
}

// Known contract gaps are deliberately not filled in here: decisions.md §forma-show takes/pins JSON
// shapes; presentation.md §showings showing punctuation/diff layout and final token LF; engines.md §trace
// phases JSON; and presentation.md §reading's state for a decision with no surviving subject.

describe('decisions.md §who-decides — who decides', () => {
  // decisions.md §who-decides; decisions.md §decision-file (escaped table cells).
  test('decisions.md §who-decides records the maker and all three declared session values verbatim', async () => {
    const dir = await project();
    const who = { provider: 'Unverified | provider', model: 'Imagined model Ω', session: 'unverified-session' };
    const result = resultPaths(forma(dir, ['decide', 'intake', '--situation', 'design new', '--words', 'Scope is limited.', ...identity(who, 'Owner | Ω'), '--json']));
    const f = fieldsOf(await read(dir, result.recorded[0]));
    assert.equal(f.By, 'Owner | Ω');
    for (const [key, value] of Object.entries(who)) assert.equal(f[key[0].toUpperCase() + key.slice(1)], value);
  });
  for (const source of ['session', 'authors', 'machine']) {
    // decisions.md §who-decides; door.md §sessions, §scratch.
    test(`decisions.md §who-decides refuses a session known through ${source}`, async () => {
      const dir = await base();
      if (source === 'machine') await writeFiles(dir, { 'work/sessions.json': jsonText([MAKER]) });
      else await accepted(dir, { [pathOf(CLAIM)]: await read(dir, pathOf(CLAIM)) }, source === 'session'
        ? { session: MAKER, authors: [MAKER] } : { authors: [MAKER, AUTHOR].sort((a, b) => a.provider < b.provider ? -1 : 1) });
      await refusesUnchanged(dir, ['decide', 'allow', '--answers', '1', ...identity()]);
    });
  }
  for (const changed of ['provider', 'model', 'session']) {
    // decisions.md §who-decides; door.md §sessions defines equality of all three.
    test(`decisions.md §who-decides distinguishes a session with a different ${changed}`, async () => {
      const dir = await base();
      await writeFiles(dir, { 'work/sessions.json': jsonText([MAKER]) });
      const who = { ...MAKER, [changed]: `${MAKER[changed]}-different` };
      const result = resultPaths(forma(dir, ['decide', 'allow', '--answers', '1', ...identity(who), '--json']));
      assert.equal(result.recorded.length, 1);
    });
  }
  // decisions.md §who-decides; door.md §forma-answer, §sessions.
  test('decisions.md §who-decides remembers a session even when its submitted answer was refused', async () => {
    const dir = await base();
    const who = { provider: 'attempt', model: 'writer', session: 'refused' };
    const folder = await answerFolder({ 'unexpected.txt': 'not an answer\n' });
    const result = forma(dir, ['answer', `repair:not-a-decision`, folder, ...sessionArgs(who), '--json']);
    assert.equal(result.status, 1);
    assert.ok(result.json, result.stderr);
    await refusesUnchanged(dir, ['decide', 'allow', '--answers', '1', ...identity(who)]);
  });
  // decisions.md §who-decides; door.md §sessions; presentation.md §reading.
  test('decisions.md §who-decides a merged session conflict discounts its answer and preserves its decision', async () => {
    const dir = await base();
    const path = pathOf(CLAIM);
    await accepted(dir, { [path]: await read(dir, path) }, { session: MAKER, authors: [MAKER] });
    const names = itemNames(dir);
    assert.ok(names.includes(`change:${path}`));
    assert.ok(!names.includes('intake'));
    assert.equal(account(dir).here.answers.allowed, 100);
  });
  // decisions.md §who-decides; door.md §forma-answer: no tracked file changes.
  test('decisions.md §who-decides answers cannot introduce a decision', async () => {
    const dir = await base();
    const saved = await historical(await project(), { kind: 'decline', on: 'parts', pin: await partsPin(dir), words: 'Do not confirm.' });
    const folder = await answerFolder({ [`design/decisions/${saved.name}.md`]: saved.text });
    const before = await snapshot(dir, { skip: ['work'] });
    const result = forma(dir, ['answer', `passage:${CITE}`, folder, ...sessionArgs(AUTHOR), '--json']);
    assert.equal(result.status, 1);
    assert.ok(result.json, result.stderr);
    assert.deepEqual(await snapshot(dir, { skip: ['work'] }), before);
  });
  // decisions.md §who-decides; door.md §gives, §repair-answer.
  test('decisions.md §who-decides packets retain decision content and omit its file and maker identity', async () => {
    const dir = await base();
    const d = (await decide(dir, 'decline', 'parts', ['--words', 'Use a narrower decomposition.'])).records[0];
    const folder = await tempFolder('decisions-packet-');
    ok(forma(dir, ['give', `repair:${d.name}`, folder, '--json']));
    const files = await snapshot(folder);
    // door.md §gives adds decisions.md to the contracts every repair packet holds.
    for (const name of ['door', 'account', 'design', 'decisions']) assert.ok(files[`forma/${name}.md`], name);
    for (const path of Object.keys(files)) assert.ok(!/(^|\/)(decisions|receipt|work)(\/|$)/.test(path), path);
    const packet = JSON.parse(files['item.json']);
    const content = JSON.stringify(packet.decision);
    for (const secret of [...Object.values(MAKER), BY]) assert.ok(!JSON.stringify(files).includes(secret), secret);
    for (const value of ['Use a narrower decomposition.', d.fields.Pin, d.fields.At]) assert.ok(content.includes(value), value);
  });
  // door.md §sessions discounts only the entry's session; decisions.md §who-decides
  // still remembers earlier authors when checking a new decision.
  test('decisions.md §who-decides a decision maker in earlier authors does not discount another session’s current page', async () => {
    const dir = await base();
    const path = pathOf(CLAIM);
    await accepted(dir, { [path]: await read(dir, path) }, { session: AUTHOR, authors: [MAKER, AUTHOR].sort((a, b) => a.provider < b.provider ? -1 : 1) });
    assert.ok(!itemNames(dir).includes(`change:${path}`));
    assert.ok(itemNames(dir).includes(`confirm:${CLAIM}`));
    await refusesUnchanged(dir, ['decide', 'allow', '--answers', '1', ...identity()]);
  });
  // door.md §receipts: a final receipt line without LF does not
  // parse, cannot accept the page, and is ignored by the session rule (door.md §sessions).
  test('decisions.md §who-decides an unterminated receipt line cannot prohibit its session from deciding', async () => {
    const dir = await base();
    const path = pathOf(CLAIM);
    const who = { provider: 'unterminated', model: 'fixture', session: 'receipt-only' };
    await accepted(dir, { [path]: await read(dir, path) }, { session: who, authors: [who] });
    const receipt = path.replace('README.md', 'receipt');
    await writeFiles(dir, { [receipt]: (await read(dir, receipt)).trimEnd() });
    const names = itemNames(dir);
    assert.ok(names.includes(`change:${receipt}`));
    assert.ok(names.includes(`change:${path}`));
    const r = resultPaths(forma(dir, ['decide', 'allow', '--answers', '1', ...identity(who), '--json']));
    assert.equal(r.recorded.length, 1);
  });
});

describe('decisions.md §who-decides — receipt and packet boundaries', () => {
  for (const form of ['outer whitespace', 'escaped Unicode']) {
    // door.md §receipts requires JSON.stringify's exact text; door.md §receipts to §sessions ignore a line
    // outside that form, including for the decision-side session rule (door.md §door).
    test(`decisions.md §who-decides a receipt with ${form} cannot prohibit its session from deciding`, async () => {
      const dir = await base();
      const path = pathOf(CLAIM);
      const who = { provider: 'receipt-Ω', model: 'fixture', session: 'noncanonical-only' };
      await accepted(dir, { [path]: await read(dir, path) }, { session: who, authors: [who] });
      const receipt = path.replace('README.md', 'receipt');
      const canonical = await read(dir, receipt);
      const malformed = form === 'outer whitespace' ? ` ${canonical}` : canonical.replaceAll('Ω', '\\u03a9');
      await writeFiles(dir, { [receipt]: malformed });
      assert.ok(itemNames(dir).includes(`change:${receipt}`));
      assert.ok(itemNames(dir).includes(`change:${path}`));
      const result = resultPaths(forma(dir, ['decide', 'allow', '--answers', '1', ...identity(who), '--json']));
      assert.equal(result.recorded.length, 1);
    });
  }
  // door.md §gives includes evidence.md, models.md and decisions.md because an
  // explanation recommends the verdict the developer decides (decisions.md §rulings).
  test('decisions.md §who-decides explain packets supply the evidence, models and decisions contracts', async () => {
    const { dir, surprises } = await rulingBase({ explained: false });
    const folder = await tempFolder('decisions-explain-packet-');
    ok(forma(dir, ['give', `explain:${surprises[0].name}`, folder, '--json']));
    const files = await snapshot(folder);
    for (const name of ['door', 'account', 'evidence', 'models', 'decisions']) assert.ok(files[`forma/${name}.md`], name);
    assert.equal(files[surprises[0].path], await read(dir, surprises[0].path));
    assert.equal(JSON.parse(files['item.json']).item.item, `explain:${surprises[0].name}`);
  });
  // decisions.md §rulings permits either restating a claim or refilling its encoding;
  // door.md §gives supplies both kinds' inputs and contracts in its repair packet.
  test('decisions.md §who-decides a property-wrong repair packet supplies both restatement and model inputs', async () => {
    const { dir } = await rulingBase();
    const ruling = (await rule(dir, waiting(dir), 'property wrong')).records[0];
    // account.md §items fixes the repair decision prefix. Its unsuffixed versus
    // model-suffixed naming for this dual-kind case is not settled by door.md §gives.
    const repair = missing(dir).find((item) => item.item === `repair:${ruling.name}` || item.item.startsWith(`repair:${ruling.name}/`));
    assert.ok(repair);
    const folder = await tempFolder('decisions-property-packet-');
    ok(forma(dir, ['give', repair.item, folder, '--json']));
    const files = await snapshot(folder);
    for (const name of ['door', 'account', 'design', 'models', 'evidence', 'decisions']) assert.ok(files[`forma/${name}.md`], name);
    for (const path of ['design/brief/system.md', pathOf(CLAIM), pathOf(LIFE),
      'models/lifecycles-alpha/parts/alpha/claims/safe/encoding.md',
      'models/lifecycles-alpha/parts/alpha/claims/safe/fault-unchanged.md']) assert.equal(files[path], await read(dir, path), path);
    const packet = JSON.parse(files['item.json']);
    assert.ok(JSON.stringify(packet.decision).includes('property wrong'));
    assert.ok(JSON.stringify(packet.decision).includes('Repair the stated mechanism.'));
  });
  for (const kind of ['witness', 'fault']) {
    // door.md §forma-give and models.md §owed allow another witness/fault packet even
    // after the first fills that kind. account.md §items fixes the extension-free item.
    test(`decisions.md §who-decides give supplies another ${kind} packet when that claim slot kind is not missing`, async () => {
      const dir = await base();
      await decide(dir, 'confirm', LIFE);
      await decide(dir, 'confirm', CLAIM);
      const encodingItem = missing(dir).find((entry) => entry.item.startsWith('slot:') && entry.item.endsWith('/claims/safe/encoding'));
      assert.ok(encodingItem);
      await slots(dir);
      const folder = 'models/lifecycles-alpha/parts/alpha/claims/safe';
      if (kind === 'witness') {
        // engines.md §slot-forms fixes a lifecycle witness as Meaning and one phase row.
        await accepted(dir, { [`${folder}/witness-ready.md`]: table([['Meaning', 'The request can be ready.']])
          + '\n| Lifecycle | Phase |\n| --- | --- |\n| request | ready |\n' },
        { pins: [{ entry: CLAIM, pin: await claimPin(dir) }, { entry: LIFE, pin: await lifecyclePin(dir) }] });
      }
      const item = encodingItem.item.replace(/encoding$/, kind);
      assert.ok(!itemNames(dir).includes(item));
      const packet = await tempFolder('decisions-extra-slot-');
      const result = ok(forma(dir, ['give', item, packet, '--json']));
      assert.equal(result.item, item);
      assert.equal(JSON.parse(await read(packet, 'item.json')).item.item, item);
      assert.equal(await read(packet, pathOf(CLAIM)), await read(dir, pathOf(CLAIM)));
    });
  }
});

describe('decisions.md §decision-file — decision files', () => {
  // decisions.md §decision-file; decisions.md §kinds; design.md §pins.
  test('decisions.md §decision-file writes a hash-named UTF-8 LF file with exactly ordered fields and sections', async () => {
    const dir = await base();
    const d = await decide(dir, 'decline', CLAIM, ['--words', 'Keep `one` and ``two`` and `````five````` verbatim.\nA second line.']);
    await inspectRecord(dir, d.recorded[0], { kind: 'decline', on: CLAIM, sections: ['Words', 'Shown'], words: 'Keep `one` and ``two`` and `````five````` verbatim.\nA second line.', shown: d.showing.shown, pin: await claimPin(dir) });
  });
  // decisions.md §decision-file, §in-force.
  test('decisions.md §decision-file all earlier decision bytes remain unchanged after an override', async () => {
    const dir = await base();
    const first = await decide(dir, 'confirm', CLAIM);
    const bytes = await read(dir, first.recorded[0]);
    await decide(dir, 'decline', CLAIM, ['--words', 'Revise the claim.']);
    assert.equal(await read(dir, first.recorded[0]), bytes);
  });
  // decisions.md §decision-file; door.md §clock.
  test('decisions.md §decision-file At is later than tracked receipt times, advancing one millisecond while the clock lags', async () => {
    const dir = await base();
    const future = new Date(Date.now() + 45_000).toISOString();
    await accepted(dir, { [pathOf(CLAIM)]: await read(dir, pathOf(CLAIM)) }, { at: future });
    const d = await decide(dir, 'accept', CLAIM, ['--choice', 'accept', '--words', 'Accept this risk.']);
    const recorded = d.records[0].fields.At;
    assert.ok(recorded > future);
    if (Date.now() < Date.parse(future)) assert.equal(Date.parse(recorded), Date.parse(future) + 1);
  });
  for (const folder of ['design/decisions', 'design/parts/alpha/decisions', 'design/spans/together/decisions',
    ...['lifecycles/request', 'journeys/complete', 'claims/safe', 'premises/reliable', 'choices/policy'].map((ref) => `design/parts/alpha/${ref}/decisions`),
    'design/spans/together/journeys/observe/decisions', 'design/spans/together/claims/safe/decisions']) {
    // decisions.md §decision-file: every listed folder is read by name.
    test(`decisions.md §decision-file reads and rejects a wrongly named file in ${folder}`, async () => {
      const dir = await base();
      const path = `${folder}/not-its-name.md`;
      await writeFiles(dir, { [path]: '# not a decision\n' });
      assert.ok(itemNames(dir).includes(`change:${path}`));
    });
  }
  for (const mutation of ['hash', 'field', 'section', 'nested-folder']) {
    // decisions.md §decision-file; account.md §items (confirmation owed).
    test(`decisions.md §decision-file ${mutation} corruption counts for nothing and is a change`, async () => {
      const dir = await base();
      const scratch = await project();
      const good = await historical(scratch, { kind: 'decline', on: CLAIM, pin: await claimPin(dir), words: 'Reject this unit.' });
      let text = good.text;
      if (mutation === 'field') text = text.replace('| By |', '| Unexpected |');
      if (mutation === 'section') text = text.replace('## Words', '## Extra');
      const filename = mutation === 'hash' ? `${good.name.slice(0, -12)}000000000000.md` : `${decisionName(text)}.md`;
      const path = mutation === 'nested-folder' ? 'design/decisions/nested' : `design/decisions/${filename}`;
      await writeFiles(dir, { [mutation === 'nested-folder' ? `${path}/file.md` : path]: text });
      assert.ok(itemNames(dir).includes(`change:${path}`));
      assert.ok(itemNames(dir).includes(`confirm:${CLAIM}`));
    });
  }
});

describe('decisions.md §kinds — kinds and forms', () => {
  const cases = [
    ['confirm', CLAIM, [], [], ['Shown']],
    ['decline', CLAIM, ['--words', 'Revise it.'], [], ['Words', 'Shown'], 'Revise it.'],
    ['pick', CHOICE, ['--choice', 'a'], [['Choice', 'a']], ['Shown']],
    ['carry', PREMISE, ['--choice', 'carry', '--words', 'A worker loses a request.'], [['Choice', 'carry'], ['Basis', '-']], ['Words', 'Shown'], 'A worker loses a request.'],
    ['carry', PREMISE, ['--choice', 'withdraw'], [['Choice', 'withdraw'], ['Basis', '-']], ['Shown']],
    ['accept', CLAIM, ['--choice', 'accept', '--words', 'Risk is tolerable.'], [['Choice', 'accept']], ['Words', 'Shown'], 'Risk is tolerable.'],
    ['accept', CLAIM, ['--choice', 'withdraw'], [['Choice', 'withdraw']], ['Shown']],
    ['redirect', CLAIM, ['--words', 'A request completes exactly once.'], [], ['Words', 'Shown'], 'A request completes exactly once.'],
  ];
  for (const [kind, on, args, rows, sections, words] of cases) {
    // decisions.md §kinds; decisions.md §decision-file; design.md §pins.
    test(`decisions.md §kinds ${kind} ${rows[0]?.[1] ?? 'unit'} has its exact rows, sections and pin`, async () => {
      const dir = await base();
      const d = await decide(dir, kind, on, args, kind === 'redirect' ? args : []);
      const expectedPin = kind === 'carry' ? await premisePin(dir) : kind === 'pick' ? await choicePin(dir) : await claimPin(dir);
      await inspectRecord(dir, d.recorded[0], { kind, on, rows, sections, words, shown: d.showing.shown, pin: expectedPin });
    });
  }
  // decisions.md §kinds, §intake: default allowances and settings.
  test('decisions.md §kinds intake pins its showing including the final line feed', async () => {
    const dir = await project();
    const r = await intake(dir);
    const text = await read(dir, r.recorded[0]);
    const rows = [['Situation', 'design new'], ...ALLOWANCE.map((key) => [key, key === 'Answers' || key === 'Runs' ? 100 : key === 'Lifecycle seconds' ? 10 : 0]), ['Cadence', 'span'], ['Inbox cap', 7]];
    await inspectRecord(dir, r.recorded[0], { kind: 'intake', on: 'intake', rows, sections: ['Words', 'Shown'], words: 'Reporting is outside scope because it is independent.', pin: sha256(fenced(text, 'Shown') + '\n') });
  });
  // decisions.md §kinds; decisions.md §intake: allowance rows and explicit settings.
  test('decisions.md §kinds allow has no Words and includes only explicitly supplied settings', async () => {
    const dir = await base();
    const r = resultPaths(forma(dir, ['decide', 'allow', '--runs', '2', '--inbox-cap', '0', ...identity(), '--json']));
    const text = await read(dir, r.recorded[0]);
    await inspectRecord(dir, r.recorded[0], { kind: 'allow', on: 'allow', rows: [...ALLOWANCE.map((key) => [key, key === 'Runs' ? 2 : 0]), ['Inbox cap', 0]], pin: sha256(fenced(text, 'Shown') + '\n') });
  });
  for (const kind of ['intake', 'allow', 'rule']) {
    // decisions.md §kinds, §decision-file: even a correctly named
    // file is no decision if the saved showing's SHA-256 differs from its Pin.
    test(`decisions.md §kinds a hash-named ${kind} with a wrong showing pin counts for nothing`, async () => {
      let dir;
      let record;
      if (kind === 'rule') {
        ({ dir } = await rulingBase());
        record = (await rule(dir, waiting(dir), 'real finding', ['--target', 'brief'])).records[0];
      } else {
        dir = await base();
        const files = await snapshot(dir);
        if (kind === 'intake') {
          const path = Object.keys(files).find((path) => /-intake-[a-f0-9]{12}\.md$/.test(path));
          record = { path, text: files[path] };
        } else {
          const result = resultPaths(forma(dir, ['decide', 'allow', '--answers', '7', ...identity(), '--json']));
          record = { path: result.recorded[0], text: await read(dir, result.recorded[0]) };
        }
      }
      const files = await snapshot(dir);
      delete files[record.path];
      const text = withDecisionField(record.text, 'Pin', '0'.repeat(64));
      const badPath = record.path.slice(0, record.path.lastIndexOf('/') + 1) + `${decisionName(text)}.md`;
      files[badPath] = text;
      const changed = await project(null, files);
      assert.ok(itemNames(changed).includes(`change:${badPath}`));
      // decisions.md §intake; account.md §items: invalid intake
      // supplies no allowance; invalid allow contributes nothing to its total.
      if (kind === 'intake') assert.ok(itemNames(changed).includes('intake'));
      if (kind === 'allow') assert.equal(account(changed).here.answers.allowed, 100);
    });
  }
});

describe('decisions.md §filing — filing', () => {
  const cases = [
    ['confirm', 'parts', [], 'design'],
    ['confirm', 'alpha/stated', [], 'design/parts/alpha'],
    ['confirm', 'together/stated', [], 'design/spans/together'],
    ['confirm', 'alpha/actions/wait', [], 'design/parts/alpha'],
    ['confirm', 'alpha/boundary/remote', [], 'design/parts/alpha'],
    ['confirm', `alpha/omissions/${OUTSIDE}`, [], 'design/parts/alpha'],
    ['confirm', LIFE, [], 'design/parts/alpha/lifecycles/request'],
    ['confirm', 'alpha/journeys/complete', [], 'design/parts/alpha/journeys/complete'],
    ['confirm', 'together/journeys/observe', [], 'design/spans/together/journeys/observe'],
    ['accept', CLAIM, ['--choice', 'accept', '--words', 'Accept.'], 'design/parts/alpha/claims/safe'],
    ['accept', 'together/claims/safe', ['--choice', 'accept', '--words', 'Accept.'], 'design/spans/together/claims/safe'],
    ['carry', PREMISE, ['--choice', 'carry', '--words', 'Observe failure.'], 'design/parts/alpha/premises/reliable'],
    ['pick', CHOICE, ['--choice', 'a'], 'design/parts/alpha/choices/policy'],
    ['carry', 'store:alpha/records', ['--choice', 'carry', '--words', 'Observe prevented anomaly.'], 'design/parts/alpha'],
    ['carry', 'strike:alpha/remote/drop', ['--choice', 'carry'], 'design/parts/alpha'],
    ['carry', 'span:alpha+beta', ['--choice', 'carry', '--words', 'Observe interaction.'], 'design'],
  ];
  for (const [kind, on, args, folder] of cases) {
    // decisions.md §filing, §forma-decide: one file in its subject's folder.
    test(`decisions.md §filing files ${kind} on ${on} in ${folder}/decisions`, async () => {
      const dir = await base();
      const r = await decide(dir, kind, on, args);
      assert.equal(r.recorded.length, 1);
      assert.equal(r.recorded[0].slice(0, r.recorded[0].lastIndexOf('/')), `${folder}/decisions`);
      assert.deepEqual((await tree(dir)).filter((path) => path.endsWith(`${r.records[0].name}.md`)), r.recorded);
    });
  }
  // decisions.md §filing; decisions.md §confirm: offered journeys live in decisions only.
  test('decisions.md §filing bounds are filed with their claim and offered journeys with their part', async () => {
    const dir = await base({ omit: ['design/parts/alpha/journeys/complete', 'design/spans/together/journeys/observe'] });
    await decide(dir, 'confirm', LIFE);
    const bound = await decide(dir, 'carry', 'bound:lifecycles-alpha/alpha/safe', ['--choice', 'carry', '--words', 'Phase-level behavior misses the risk.']);
    assert.ok(bound.recorded[0].startsWith('design/parts/alpha/claims/safe/decisions/'));
    const offered = await decide(dir, 'confirm', 'alpha/journeys/reach-request--done');
    assert.ok(offered.recorded[0].startsWith('design/parts/alpha/decisions/'));
    assert.equal(await read(dir, 'design/parts/alpha/journeys/reach-request--done/README.md'), null);
  });
});

describe('presentation.md §showings — showing', () => {
  // presentation.md §showings: expanded fields in order and indented cited passages.
  test('presentation.md §showings shows expanded fields and the cited passage beside an entry', async () => {
    const dir = await base();
    const s = show(dir, 'accept', CLAIM);
    assert.ok(s.shown.split('\n')[0].includes('accept') && s.shown.split('\n')[0].includes(CLAIM));
    for (const line of ['  Sentence: A request completes safely.', '  Kind: safety', '  Stake: A request could be lost.', '  Parts: Process requests.']) assert.ok(s.shown.includes(line), line);
    assert.ok(s.shown.includes(`Cites ${CITE}:\n  # Workflow`));
    assert.ok(s.shown.includes('  A worker advances a request from ready to done.'));
  });
  // presentation.md §showings: subsequent citations show the address alone.
  test('presentation.md §showings a repeated cited passage is expanded only once in a showing', async () => {
    const dir = await base();
    const s = show(dir, 'confirm', 'alpha/stated');
    assert.equal(s.shown.split('A worker advances a request from ready to done.').length - 1, 1);
    assert.ok(s.shown.split(CITE).length - 1 > 1);
  });
  // presentation.md §showings; lifecycle-tool.md §as-read fixes retained diagram data.
  test('presentation.md §showings lifecycle showing retains its table and deterministic structured picture', async () => {
    const dir = await base();
    const s = show(dir, 'confirm', LIFE);
    for (const part of ['ready |', 'done |', 'forma-explorer']) assert.ok(s.shown.includes(part), part);
    const pictures = retainedPictures(s.shown);
    assert.equal(pictures.length, 1);
    const [picture] = pictures;
    assert.equal(picture.format, 1);
    assert.equal(picture.lifecycle, LIFE);
    assert.deepEqual(picture.phases.map(phase => phase.key), ['ready', 'done']);
    assert.equal(picture.initial.phase, 'ready');
    assert.deepEqual(picture.ends, ['done']);
    assert.deepEqual(picture.moves.map(move => [move.from, move.to, move.action, move.case]),
      [['ready', 'done', 'advance', null], ['ready', 'ready', 'wait', null], ['done', 'done', 'wait', null]]);
    assert.equal(picture.cells.done.advance.kind, 'refused');
    assert.equal(picture.source, null);
    assert.deepEqual(picture.marks, []);
    assert.deepEqual(picture.basis.files.find(file => file.path === pathOf(LIFE)), { path: pathOf(LIFE), sha256: sha256(await read(dir, pathOf(LIFE))) });
    const fields = ['format', 'lifecycle', 'basis', 'source', 'entity', 'initial', 'ends', 'phases', 'actions', 'cells', 'moves', 'machine', 'mapping', 'marks', 'facts'];
    assert.deepEqual(Object.keys(picture).filter(key => fields.includes(key)), fields);
    const repeated = show(dir, 'confirm', LIFE);
    assert.equal(repeated.shown, s.shown);
    assert.equal(repeated.token, s.token);
    const recorded = await decide(dir, 'confirm', LIFE);
    assert.equal(fenced(recorded.records[0].text, 'Shown'), s.shown);
    assert.deepEqual(retainedPictures(fenced(recorded.records[0].text, 'Shown')), pictures);
  });
  // presentation.md §showings, decisions.md §forma-decide: same input, same SHA-256;
  // a changed showing invalidates the old token. Final-pin LF is not fixed, so
  // no guessed serialization is asserted.
  test('presentation.md §showings token binds the showing and pin and remains stable on identical reads', async () => {
    const dir = await base();
    const a = show(dir, 'confirm', CLAIM);
    const b = show(dir, 'confirm', CLAIM);
    assert.equal(a.token, b.token);
    assert.match(a.token, /^[a-f0-9]{64}$/);
    await accepted(dir, { [pathOf(CLAIM)]: (await read(dir, pathOf(CLAIM))).replace('completes safely', 'completes exactly once') });
    assert.notEqual(show(dir, 'confirm', CLAIM).token, a.token);
    await refusesUnchanged(dir, ['decide', 'confirm', CLAIM, '--shown', a.token, ...identity()]);
  });
  // presentation.md §showings, decisions.md §decision-file: comparison and immutable old file.
  test('presentation.md §showings a lapsed showing names the old decision, time, removed and added lines', async () => {
    const dir = await base();
    const d = (await decide(dir, 'confirm', CLAIM)).records[0];
    await accepted(dir, { [pathOf(CLAIM)]: (await read(dir, pathOf(CLAIM))).replace('A request completes safely.', 'A request completes exactly once.') });
    const s = show(dir, 'confirm', CLAIM);
    for (const text of [d.name, d.fields.At, 'A request completes safely.', 'A request completes exactly once.']) assert.ok(s.shown.includes(text), text);
    assert.equal(await read(dir, d.path), d.text);
  });
});

describe('decisions.md §intake — intake and allowances', () => {
  for (const situation of ['document a known system', 'showcase a fixed bug', 'localize a live bug', 'understand an unfamiliar system', 'change against a new requirement', 'design new']) {
    test(`decisions.md §intake intake accepts situation ${situation} and defaults every omitted allowance row`, async () => {
      // decisions.md §intake fixes situations, zero rows and settings; decisions.md §kinds fixes the showing hash.
      const dir = await project();
      const r = resultPaths(forma(dir, ['decide', 'intake', '--situation', situation, '--words', 'Only the workflow matters.', ...identity(), '--json']));
      const d = await inspectRecord(dir, r.recorded[0], { kind: 'intake', on: 'intake', rows: [['Situation', situation], ...ALLOWANCE.map((key) => [key, 0]), ['Cadence', 'span'], ['Inbox cap', 7]], sections: ['Words', 'Shown'], words: 'Only the workflow matters.' });
      assert.equal(d.fields.Pin, sha256(fenced(d.text, 'Shown') + '\n'));
    });
  }
  for (const cadence of ['span', 'question', 'session']) {
    test(`decisions.md §intake records cadence ${cadence} and zero inbox cap`, async () => {
      // decisions.md §intake permits these cadences and a nonnegative inbox cap.
      const dir = await project();
      const r = resultPaths(forma(dir, ['decide', 'intake', '--situation', 'design new', '--words', 'Limited scope.', '--cadence', cadence, '--inbox-cap', '0', ...identity(), '--json']));
      const f = fieldsOf(await read(dir, r.recorded[0]));
      assert.equal(f.Cadence, cadence);
      assert.equal(f['Inbox cap'], '0');
    });
  }
  test('decisions.md §intake all allowances add row by row and earlier records remain', async () => {
    // decisions.md §intake fixes additive rows and optional setting rows; presentation.md §reading fixes allowed totals.
    const dir = await base();
    const first = resultPaths(forma(dir, ['decide', 'allow', ...OPTIONS.flatMap((option, index) => [option, String(index + 1)]), '--cadence', 'question', ...identity(), '--json']));
    const firstText = await read(dir, first.recorded[0]);
    const second = resultPaths(forma(dir, ['decide', 'allow', '--answers', '3', '--runs', '4', '--inbox-cap', '0', ...identity(), '--json']));
    assert.equal(account(dir).here.answers.allowed, 104);
    assert.equal(account(dir).here.runs.allowed, 106);
    const f = fieldsOf(await read(dir, first.recorded[0]));
    ALLOWANCE.forEach((key, index) => assert.equal(f[key], String(index + 1)));
    assert.equal(f.Cadence, 'question');
    assert.equal(fieldsOf(await read(dir, second.recorded[0]))['Inbox cap'], '0');
    assert.ok(!Object.hasOwn(fieldsOf(await read(dir, second.recorded[0])), 'Cadence'));
    // decisions.md §decision-file keeps the earlier allowance file unchanged.
    assert.equal(await read(dir, first.recorded[0]), firstText);
  });
  test('decisions.md §intake refuses a second intake without changing the first', async () => {
    // decisions.md §intake permits exactly one intake; decisions.md §forma-decide requires refusal without recording another.
    const dir = await base();
    await refusesUnchanged(dir, ['decide', 'intake', '--situation', 'design new', '--words', 'Again.', ...identity()]);
  });
});

describe('decisions.md §confirm — confirmations and declines', () => {
  test('decisions.md §confirm stated entries are confirmed together and an individual stated claim is not a unit', async () => {
    // decisions.md §confirm; design.md §units; account.md §items fixes the confirmation item.
    const dir = await base();
    await decide(dir, 'confirm', 'alpha/stated');
    assert.ok(!itemNames(dir).includes('confirm:alpha/stated'));
    await refusesUnchanged(dir, ['show', 'confirm', 'alpha/claims/stated']);
  });
  test('decisions.md §confirm a lifecycle finding prevents confirmation but permits decline', async () => {
    // decisions.md §confirm; lifecycle-tool.md §findings; account.md §items fixes the repair item.
    const dir = await base();
    await accepted(dir, { [pathOf(LIFE)]: (await read(dir, pathOf(LIFE))).replace('| ready | done | ready |', '| ready |  | ready |') });
    await refusesUnchanged(dir, ['show', 'confirm', LIFE]);
    const d = await decide(dir, 'decline', LIFE, ['--words', 'Fill the missing transition.']);
    assert.ok(itemNames(dir).includes(`repair:${d.records[0].name}`));
  });
  test('decisions.md §confirm an offered confirmation preserves its complete journey under its stable key', async () => {
    // decisions.md §confirm fixes the key and Journey section; design.md §code-journeys fixes its fields and step; account.md §items removes its confirmation item.
    const dir = await base({ omit: ['design/parts/alpha/journeys/complete', 'design/spans/together/journeys/observe'] });
    await decide(dir, 'confirm', LIFE);
    const on = 'alpha/journeys/reach-request--done';
    const r = await decide(dir, 'confirm', on);
    const d = await inspectRecord(dir, r.recorded[0], { kind: 'confirm', on, sections: ['Shown', 'Journey'], shown: r.showing.shown });
    const journey = section(d.text, 'Journey');
    assert.ok(journey.includes(`### ${on}\n`));
    const fields = fieldsOf(journey);
    for (const [field, value] of [['Polarity', 'should happen'], ['Expected end', 'Request reaches done.'], ['Origin', 'added'], ['Cites', CITE]]) assert.equal(fields[field], value);
    assert.deepEqual(dataRows(journey, ['Step', 'Actor', 'Action', 'Arguments', 'Entity', 'Case']), [{ Step: '1', Actor: 'Worker', Action: 'advance', Arguments: '-', Entity: '-', Case: '-' }]);
    assert.ok(!itemNames(dir).includes(`confirm:${on}`));
  });
  test('decisions.md §confirm confirming another offered journey leaves existing offered keys unchanged', async () => {
    // decisions.md §confirm and design.md §code-journeys: keys never depend on confirmations; confirmed contents persist.
    const dir = await base({ omit: ['design/parts/alpha/journeys/complete', 'design/spans/together/journeys/observe'] });
    const page = (await read(dir, pathOf(LIFE)))
      .replace('| ready | done | ready |', '| ready | middle | ready |\n| middle | done | middle |');
    await accepted(dir, { [pathOf(LIFE)]: page });
    await decide(dir, 'confirm', LIFE);
    const done = 'alpha/journeys/reach-request--done';
    const middle = 'alpha/journeys/reach-request--middle';
    assert.equal(show(dir, 'confirm', done).on, done);
    const first = (await decide(dir, 'confirm', middle)).records[0];
    const second = await decide(dir, 'confirm', done);
    assert.equal(first.fields.On, middle);
    assert.equal(second.records[0].fields.On, done);
    // decisions.md §decision-file preserves the earlier confirmation's bytes.
    assert.equal(await read(dir, first.path), first.text);
    assert.ok(section(first.text, 'Journey').includes(`### ${middle}\n`));
    assert.ok(section(second.records[0].text, 'Journey').includes(`### ${done}\n`));
    // account.md §items: each confirmation is in force on its unchanged journey pin.
    assert.ok(!itemNames(dir).includes(`confirm:${middle}`));
    assert.ok(!itemNames(dir).includes(`confirm:${done}`));
  });
  test('decisions.md §confirm a later decline of a broken confirmed offered journey owes its lifecycle repair without rewriting the confirmation', async () => {
    // decisions.md §decision-file, §confirm, §expects and design.md §code-journeys: declining the broken offered
    // journey preserves the confirmation's bytes and is met as it is read afresh.
    const dir = await base({ omit: ['design/parts/alpha/journeys/complete', 'design/spans/together/journeys/observe'] });
    await decide(dir, 'confirm', LIFE);
    const on = 'alpha/journeys/reach-request--done';
    const confirmed = (await decide(dir, 'confirm', on)).records[0];
    const changed = (await read(dir, pathOf(LIFE))).replace('| ready | done | ready |', '| ready | None. | done |');
    await accepted(dir, { [pathOf(LIFE)]: changed });
    const declined = await decide(dir, 'decline', on, ['--words', 'The offered route changed.']);
    assert.equal(await read(dir, confirmed.path), confirmed.text);
    assert.ok(!itemNames(dir).includes(`repair:${declined.records[0].name}`));
  });
});

describe('decisions.md §pick — picks', () => {
  for (const choice of ['a', 'b']) {
    test(`decisions.md §pick picking ${choice} confirms its journeys and carries its choice premise`, async () => {
      // decisions.md §pick; design.md §code-journeys fixes added keys; presentation.md §reading, account.md §box fix pick readouts.
      const dir = await base();
      const s = show(dir, 'pick', CHOICE);
      for (const text of ['Should the worker advance or wait?', 'complete promptly', 'Complete the request.', 'Leave the request unchanged.', CITE]) assert.ok(s.shown.includes(text), text);
      const d = await decide(dir, 'pick', CHOICE, ['--choice', choice]);
      const names = itemNames(dir);
      assert.ok(!names.includes(`confirm:alpha/journeys/policy-${choice}`));
      assert.ok(!names.includes(`confirm:alpha/journeys/policy-not-${choice === 'a' ? 'b' : 'a'}`));
      assert.equal(account(dir, CHOICE).thing.pick.decision, d.records[0].name);
      const box = ok(forma(dir, ['box', '--json']));
      assert.ok(box.premises.some((p) => p.premise === 'choice:alpha/policy' && p.pick));
    });
  }
  test('decisions.md §pick never preselects the recommended alternative', async () => {
    // presentation.md §showings, decisions.md §pick require an explicit choice; decisions.md §forma-decide refuses missing choices without recording one.
    const dir = await base();
    const s = show(dir, 'pick', CHOICE);
    await refusesUnchanged(dir, ['decide', 'pick', CHOICE, '--shown', s.token, ...identity()]);
  });
  test('decisions.md §pick refuses a pick whose added journey has a refused step', async () => {
    // decisions.md §pick and lifecycle-tool.md §findings block the added should-happen journey; show availability is left open.
    const dir = await base();
    const path = pathOf(CHOICE);
    const source = await read(dir, path);
    const changed = source.replace('## a\n', '## a\n').replace('| 1 | Worker | advance | - | - | - |', '| 1 | Worker | advance | - | - | - |\n| 2 | Worker | advance | - | - | - |');
    await accepted(dir, { [path]: changed });
    const showing = forma(dir, ['show', 'pick', CHOICE, '--json']);
    if (showing.status === 1) refused(showing);
    else await refusesUnchanged(dir, ['decide', 'pick', CHOICE, '--shown', ok(showing).token, '--choice', 'a', ...identity()]);
  });
});

describe('decisions.md §rulings — waiting decisions and rulings', () => {
  test('decisions.md §rulings a surprise waits for an accepted explanation before it can be ruled', async () => {
    // decisions.md §rulings; account.md §items fixes waits and the complete explanation/verdict showing.
    const { dir, surprises } = await rulingBase({ explained: false });
    const name = waiting(dir)[0];
    assert.ok(missing(dir).find((item) => item.item === `rule:${name}`).waits.includes(`explain:${surprises[0].name}`));
    await refusesUnchanged(dir, ['show', 'rule', name]);
    for (const s of surprises) await explain(dir, s);
    const s = show(dir, 'rule', name);
    for (const words of ['The expected protection is not demonstrated.', 'The waiting transition has no additional protection.', 'model wrong', 'property wrong', 'abstraction too coarse', 'real finding', 'specification']) assert.ok(s.shown.includes(words), words);
  });
  test('decisions.md §rulings shared premises group surprises under their smallest question and basis name', async () => {
    // decisions.md §rulings fixes connected grouping, waiting name and the first list's order.
    const { dir, surprises } = await rulingBase({ refs: [CLAIM, 'alpha/claims/dependent'], shared: true });
    assert.equal(surprises.length, 2);
    assert.deepEqual(waiting(dir), [surprises[0].name]);
    // decisions.md §rulings offers the explained group; does not require each surprise's identifier in the showing.
    show(dir, 'rule', surprises[0].name);
    const r = await rule(dir, waiting(dir));
    const text = r.records[0].text;
    assert.deepEqual(dataRows(section(text, 'Surprises'), ['Surprise', 'Question', 'Basis', 'Parts', 'Expected', 'Found']).map((row) => row.Surprise), surprises.map((s) => s.name));
  });
  test('decisions.md §rulings unrelated surprises stay separate and several waiting names make one ruling', async () => {
    // decisions.md §rulings, §kinds, §filing, §forma-show fixes grouping, On, one file and filing.
    const { dir, surprises } = await rulingBase({ refs: [CLAIM, 'alpha/claims/dependent'] });
    const names = waiting(dir);
    assert.equal(names.length, 2);
    const s = show(dir, 'rule', [...names].reverse().join(','));
    assert.ok(Array.isArray(s.on));
    assert.deepEqual([...s.on].sort(), [...names].sort());
    const r = await rule(dir, [...names].reverse());
    assert.equal(r.recorded.length, 1);
    assert.equal(r.records[0].fields.On, [...names].sort().join(', '));
    assert.ok(r.recorded[0].startsWith(`design/parts/alpha/claims/${surprises[0].data.question.split('/')[4]}/decisions/`));
    assert.deepEqual((await tree(dir)).filter((p) => p.endsWith(`${r.records[0].name}.md`)), r.recorded);
  });
  for (const [verdict, target] of [['model wrong'], ['property wrong'], ['abstraction too coarse'], ['real finding', 'brief'], ['real finding', 'lifecycles-alpha'], ['real finding', `premise:${PREMISE}`]]) {
    test(`decisions.md §rulings ${verdict}${target ? ` on ${target}` : ''} records exact ruling rows and dispatches its repair`, async () => {
      // decisions.md §rulings, §kinds, decisions.md §expects fixes records and dispatch; account.md §items fixes every model suffix.
      const { dir, surprises } = await rulingBase();
      const names = waiting(dir);
      const r = await rule(dir, names, verdict, target ? ['--target', target] : []);
      const rows = [['Verdict', verdict], ['Level', 'specification'], ['Target', target ?? '-'], ['Target pin', target?.startsWith('premise:') ? await premisePin(dir) : '-'], ['Basis', '-']];
      const d = await inspectRecord(dir, r.recorded[0], { kind: 'rule', on: names.sort().join(', '), rows, sections: ['Words', 'Surprises', 'Shown', ...(verdict === 'model wrong' ? ['Kept'] : [])], words: 'Repair the stated mechanism.', shown: r.showing.shown, pin: sha256(r.showing.shown + '\n') });
      const content = section(d.text, 'Surprises');
      const surpriseRows = dataRows(content, ['Surprise', 'Question', 'Basis', 'Parts', 'Expected', 'Found']);
      const entryRows = dataRows(content, ['Surprise', 'Entry', 'Pin']);
      for (const s of surprises) {
        const row = surpriseRows.find((row) => row.Surprise === s.name);
        assert.ok(row);
        assert.equal(row.Question, s.data.question);
        assert.equal(row.Basis, s.basis);
        assert.equal(row.Parts, 'alpha');
        assert.ok(row.Expected.includes(s.data.expected.outcome));
        assert.ok(row.Found.includes(s.data.found.outcome));
        for (const e of s.data.basis.entries) assert.ok(entryRows.some((row) => row.Surprise === s.name && row.Entry === e.entry && row.Pin === e.pin));
      }
      const repair = itemNames(dir).filter((name) => name.startsWith(`repair:${d.name}`));
      if (verdict === 'model wrong') assert.deepEqual(repair, [`repair:${d.name}/lifecycles-alpha`]);
      else if (target === 'lifecycles-alpha') {
        assert.deepEqual(repair, [`repair:${d.name}/lifecycles-alpha`]);
      }
      else if (verdict === 'property wrong') assert.ok(repair.length > 0);
      else if (verdict === 'abstraction too coarse') assert.deepEqual(repair, [`repair:${d.name}`]);
      else assert.deepEqual(repair, []);
    });
  }
  for (const level of ['implementation', 'specification', 'requirement']) {
    test(`decisions.md §rulings accepts level ${level} and preserves a ruling's external basis`, async () => {
      // decisions.md §rulings fixes the level menu, literal external basis and requirement-level brief target.
      const { dir } = await rulingBase();
      const names = waiting(dir);
      const r = await decide(dir, 'rule', names.join(','), ['--verdict', 'real finding', '--level', level, '--target', 'brief', '--basis', 'incident:42: the worker lost a request.', '--words', 'Change the requirement.']);
      assert.equal(r.records[0].fields.Level, level);
      assert.equal(r.records[0].fields.Basis, 'incident:42: the worker lost a request.');
    });
  }
  test('decisions.md §rulings closes only named surprises, removes their own files, and preserves question evidence', async () => {
    // decisions.md §rulings and evidence.md §at-ruling fixes removal, preserved evidence and merged closed surprises.
    const { dir, surprises } = await rulingBase({ refs: [CLAIM, 'alpha/claims/dependent'] });
    const before = await snapshot(dir);
    const first = surprises[0];
    const r = await rule(dir, [first.name]);
    const expected = Object.keys(before).filter((path) => path.startsWith(first.path.slice(0, -5) + '.') && !path.endsWith('/receipt'));
    for (const path of expected) {
      assert.equal(await read(dir, path), null, path);
      assert.ok(r.removed.includes(path));
    }
    assert.equal(await read(dir, `models/${first.data.question}.json`), before[`models/${first.data.question}.json`]);
    assert.equal(await read(dir, surprises[1].path), before[surprises[1].path]);
    assert.ok(!waiting(dir).includes(first.name));
    assert.ok(waiting(dir).includes(surprises[1].name));
    await writeFiles(dir, { [first.path]: before[first.path] });
    assert.ok(!waiting(dir).includes(first.name), 'a merged closed surprise does not reopen');
  });
});

describe('decisions.md §kept-journeys — kept journeys', () => {
  test('decisions.md §kept-journeys model wrong records why a fault surprise is not a kept base-claim journey', async () => {
    // decisions.md §kept-journeys limits eligibility to base questions and requires each Not kept reason.
    const { dir, surprises } = await rulingBase();
    const r = await rule(dir, waiting(dir));
    const kept = section(r.records[0].text, 'Kept');
    for (const s of surprises) assert.ok(kept.includes(`### ${s.name}\n`));
    assert.ok(fieldsOf(kept)['Not kept']);
    assert.ok(!Object.hasOwn(fieldsOf(kept), 'Journey'));
  });
  test('decisions.md §kept-journeys a base violation keeps its shortest trace as a confirmed must-not journey', async () => {
    // decisions.md §kept-journeys fixes eligibility, fields, stored-only journey and confirmation; engines.md §lifecycle-engine gives shortest traces.
    const { dir, surprises } = await rulingBase({ violation: true });
    const baseSurprise = surprises.find((s) => s.data.kind === 'base');
    assert.ok(baseSurprise);
    const r = await rule(dir, [baseSurprise.name]);
    const kept = section(r.records[0].text, 'Kept');
    const key = `kept-${baseSurprise.basis.slice(0, 12)}`;
    const ref = `alpha/journeys/${key}`;
    assert.ok(kept.includes(`### ${baseSurprise.name}\n`));
    const fields = fieldsOf(kept);
    for (const [field, value] of [['Journey', ref], ['Polarity', 'must not'], ['Refused step', '1'], ['Expected end', '-'], ['Origin', 'added'], ['Cites', CITE]]) assert.equal(fields[field], value);
    assert.deepEqual(dataRows(kept, ['Step', 'Actor', 'Action', 'Arguments', 'Entity', 'Case']), [{ Step: '1', Actor: 'Worker', Action: 'advance', Arguments: '-', Entity: '-', Case: '-' }]);
    // design.md §pins fixes the canonical pin of this one-step kept journey.
    const pin = sha256(['Polarity: must not', 'Expected end: -', 'Refused step: 1', `Cites: ${await passageHash(dir)}`, 'Step 1: Worker | Complete the request. | - | - | -'].join('\n'));
    assert.equal(fields.Pin, pin);
    assert.equal(await read(dir, pathOf(ref)), null);
    assert.ok(!itemNames(dir).includes(`confirm:${ref}`));
    assert.equal(decisionEntry(dir, ref, r.records[0].name).state, 'in force');
  });
  test('decisions.md §kept-journeys a violation in the first state has no journey and records why', async () => {
    // decisions.md §kept-journeys excludes zero-step traces and requires the explanation under the surprise's name.
    const { dir, surprises } = await rulingBase({ violation: true, initial: true });
    const s = surprises.find((entry) => entry.data.kind === 'base');
    const r = await rule(dir, [s.name]);
    const kept = section(r.records[0].text, 'Kept');
    assert.ok(kept.includes(`### ${s.name}`));
    assert.ok(fieldsOf(kept)['Not kept']);
    assert.ok(!Object.hasOwn(fieldsOf(kept), 'Journey'));
  });
  test('decisions.md §kept-journeys a later decline retains the kept journey as declined while preserving its ruling', async () => {
    // decisions.md §expects keeps the declined journey, counting nowhere, and meets its repair at once; decisions.md §decision-file preserves its ruling.
    const { dir, surprises } = await rulingBase({ violation: true });
    const s = surprises.find((entry) => entry.data.kind === 'base');
    const r = (await rule(dir, [s.name])).records[0];
    const ref = `alpha/journeys/kept-${s.basis.slice(0, 12)}`;
    const d = await decide(dir, 'decline', ref, ['--words', 'Do not retain this path.']);
    assert.equal(await read(dir, r.path), r.text);
    assert.ok(!itemNames(dir).includes(`repair:${d.records[0].name}`));
    const view = account(dir, ref).thing;
    assert.ok(Object.hasOwn(view, 'page'));
    assert.equal(decisionEntry(dir, ref, d.records[0].name).state, 'in force');
    assert.equal(decisionEntry(dir, ref, r.name).state, 'superseded');
    assert.ok(!itemNames(dir).includes(`confirm:${ref}`));
    // presentation.md §reading lists only counted journeys under Open and Established.
    const part = account(dir, 'alpha').parts.find((part) => part.ref === 'alpha');
    assert.ok(![...part.open, ...part.established].some((entry) => entry.ref === ref));
  });
});

describe('decisions.md §carry — carry and strike', () => {
  test('decisions.md §carry a page premise pins canonical meaning and shows its falsifier and citations', async () => {
    // decisions.md §carry fixes the pin and cited premise showing; decisions.md §kinds fixes Basis.
    const dir = await base();
    const r = await decide(dir, 'carry', PREMISE, ['--choice', 'carry', '--words', 'A worker loses a request.']);
    assert.equal(r.records[0].fields.Pin, await premisePin(dir));
    assert.equal(r.records[0].fields.Basis, '-');
    for (const value of ['The worker behaves reliably.', 'A worker loses a request.', CITE]) assert.ok(r.showing.shown.includes(value));
  });
  test('decisions.md §carry store carry pins exactly statement, falsifier and provider without final LF', async () => {
    // decisions.md §carry; forms.md §store-premises fixes the serializable premise and its exact canonical lines.
    const dir = await base();
    const r = await decide(dir, 'carry', 'store:alpha/records', ['--choice', 'carry', '--words', 'An anomaly is observed.']);
    const text = "Statement: Records permits exactly no anomaly and prevents the rest.\nFalsifier: an observed prevented anomaly\nProvider: the store's documented and measured isolation";
    assert.equal(r.records[0].fields.Pin, sha256(text));
    assert.ok(r.showing.shown.includes('Records') && r.showing.shown.includes('serializable'));
  });
  test('decisions.md §carry lifecycle bounds pin the model, claim pin and phase-level bound', async () => {
    // decisions.md §carry fixes the bounds pin and showing; models.md §lifecycle-model fixes phase level.
    const dir = await base();
    await decide(dir, 'confirm', LIFE);
    await slots(dir);
    const r = await decide(dir, 'carry', 'bound:lifecycles-alpha/alpha/safe', ['--choice', 'carry', '--words', 'Data outside phases matters.']);
    assert.equal(r.records[0].fields.Pin, sha256(`Model: lifecycles-alpha\nClaim: ${await claimPin(dir)}\nBound: phase level`));
    assert.ok(r.showing.shown.includes('A request completes safely.') && r.showing.shown.includes('phase level'));
  });
  for (const [item, words] of [['drop', 'drop'], ['duplicate', 'duplicate'], ['delay', 'delay'], ['reorder', 'reorder'], ['fail-forever', 'fail forever'], ['fail-then-succeed', 'fail then succeed'], ['crash', 'crash'], ['go-silent', 'go silent mid-step']]) {
    test(`decisions.md §carry strike ${item} pins its path name and keeps its default developer falsifier`, async () => {
      // decisions.md §carry fixes strike hashes, default literal falsifiers and their showing; forms.md §menu fixes menu names.
      const dir = await base();
      const r = await decide(dir, 'carry', `strike:alpha/remote/${item}`, ['--choice', 'carry']);
      assert.equal(r.records[0].fields.Pin, sha256(`Strike: ${item} at Remote service`));
      assert.equal(fenced(r.records[0].text, 'Words'), `an observed ${words} at Remote service`);
      for (const value of ['Remote service', words, `an observed ${words} at Remote service`]) assert.ok(r.showing.shown.includes(value), value);
    });
  }
  test('decisions.md §carry an edited strike falsifier is kept and withdrawal removes its carry', async () => {
    // decisions.md §carry, §kinds fixes edited words and wordless withdrawal; account.md §box fixes box membership; account.md §standing preserves files.
    const dir = await base();
    const on = 'strike:alpha/remote/drop';
    const r = await decide(dir, 'carry', on, ['--choice', 'carry', '--words', 'The remote service discards a message.']);
    assert.equal(fenced(r.records[0].text, 'Words'), 'The remote service discards a message.');
    assert.ok(ok(forma(dir, ['box', '--json'])).premises.some((p) => p.premise === on));
    const withdrawal = await decide(dir, 'carry', on, ['--choice', 'withdraw']);
    assert.ok(!sectionNames(withdrawal.records[0].text).includes('Words'));
    assert.ok(!ok(forma(dir, ['box', '--json'])).premises.some((p) => p.premise === on));
    assert.equal(await read(dir, r.recorded[0]), r.records[0].text);
  });
  test('decisions.md §carry a span carry pins the two purposes and their shared surface in part order', async () => {
    // decisions.md §carry fixes ordered part/surface lines; design.md §pins expands an external event's part.
    const dir = await base();
    const r = await decide(dir, 'carry', 'span:alpha+beta', ['--choice', 'carry', '--words', 'The completion interaction fails.']);
    assert.equal(r.records[0].fields.Pin, sha256('Part: Process requests.\nSurface: emits completed\nPart: Observe completions.\nSurface: consumes completed (Process requests.)'));
    for (const value of ['Process requests.', 'Observe completions.', 'completed']) assert.ok(r.showing.shown.includes(value));
  });
  test('decisions.md §carry several premises share a token but each decision keeps its own complete showing', async () => {
    // decisions.md §carry fixes one showing, one decision per premise, deduplicated passages and complete individual showings; decisions.md §forma-show fixes on as a list.
    const dir = await base();
    const refs = [PREMISE, 'store:alpha/records'];
    const singles = refs.map((ref) => show(dir, 'carry', ref).shown);
    const r = await decide(dir, 'carry', refs.join(','), ['--choice', 'carry', '--words', 'A request is lost.']);
    assert.equal(r.recorded.length, 2);
    assert.deepEqual([...r.showing.on].sort(), refs.sort());
    for (const d of r.records) assert.equal(fenced(d.text, 'Shown'), singles[[PREMISE, 'store:alpha/records'].indexOf(d.fields.On)]);
    assert.equal(r.showing.shown.split('A worker advances a request from ready to done.').length - 1, 1);
  });
  test('decisions.md §carry several strikes can each retain their own default falsifier', async () => {
    // decisions.md §carry permits default-falsifier strike batches and requires one complete decision per strike.
    const dir = await base();
    const r = await decide(dir, 'carry', 'strike:alpha/remote/drop,strike:alpha/remote/go-silent', ['--choice', 'carry']);
    assert.equal(r.recorded.length, 2);
    for (const d of r.records) assert.equal(fenced(d.text, 'Words'), `an observed ${d.fields.On.endsWith('drop') ? 'drop' : 'go silent mid-step'} at Remote service`);
  });
  test('decisions.md §carry bound:model expands exactly the claims awaiting bounds carries', async () => {
    // decisions.md §carry expands only awaiting bounds; account.md §standing, §items defines those items.
    const dir = await base();
    await decide(dir, 'confirm', LIFE);
    await slots(dir, CLAIM);
    await slots(dir, 'alpha/claims/dependent');
    const owed = itemNames(dir).filter((name) => name.startsWith('carry:bound:lifecycles-alpha/')).map((name) => name.slice(6));
    assert.equal(owed.length, 2);
    const r = await decide(dir, 'carry', 'bound:lifecycles-alpha', ['--choice', 'carry', '--words', 'A phase abstraction omits needed data.']);
    assert.deepEqual(r.records.map((d) => d.fields.On).sort(), owed.sort());
  });
  test('decisions.md §carry an external basis claim can be named but an unestablished basis lapses the carry', async () => {
    // decisions.md §carry, §in-force fixes Basis and lapse; presentation.md §reading lists carries and account.md §box excludes uncarried premises.
    const dir = await base();
    const r = await decide(dir, 'carry', PREMISE, ['--choice', 'carry', '--words', 'A worker loses a request.', '--basis', 'beta/claims/safe']);
    assert.equal(r.records[0].fields.Basis, 'beta/claims/safe');
    assert.equal(decisionEntry(dir, PREMISE, r.records[0].name).state, 'lapsed');
    assert.ok(!ok(forma(dir, ['box', '--json'])).premises.some((p) => p.premise === PREMISE));
    // presentation.md §reading does not specify each carries member's representation.
    assert.equal(account(dir, 'beta/claims/safe').thing.carries.length, 1);
  });
  for (const [on, basis] of [[PREMISE, CLAIM], ['store:alpha/records', CLAIM], ['strike:alpha/remote/drop', CLAIM], ['span:alpha+beta', 'beta/claims/safe'], [PREMISE, LIFE]]) {
    test(`decisions.md §carry refuses basis ${basis} for ${on}`, async () => {
      // decisions.md §carry requires a claim outside every premise part; decisions.md §forma-decide refuses an invalid basis without recording a carry.
      const dir = await base();
      const s = show(dir, 'carry', on);
      await refusesUnchanged(dir, ['decide', 'carry', on, '--shown', s.token, '--choice', 'carry', '--words', 'Failure is observable.', '--basis', basis, ...identity()]);
    });
  }
  test('decisions.md §carry an invalid member refuses a batch without recording any carry', async () => {
    // decisions.md §carry prohibits a separate choice-premise carry and makes the batch atomic.
    const dir = await base();
    await refusesUnchanged(dir, ['show', 'carry', `${PREMISE},choice:alpha/policy`]);
    await refusesUnchanged(dir, ['decide', 'carry', `${PREMISE},choice:alpha/policy`, '--shown', '0'.repeat(64), '--choice', 'carry', '--words', 'One falsifier.', ...identity()]);
  });
});

describe('decisions.md §carry — the meaning of premises code adds', () => {
  // presentation.md §reading fixes a premise entry's keys but forms.md §premise-says does not
  // fix which part lists a span premise; find its entry without fixing that.
  const premiseEntries = (value) => !value || typeof value !== 'object' ? []
    : [...(Object.hasOwn(value, 'premise') && Object.hasOwn(value, 'class') ? [value] : []), ...Object.values(value).flatMap(premiseEntries)];
  const cases = [
    { on: 'store:alpha/records', class: 'store phenomena', statement: 'Records permits exactly no anomaly and prevents the rest.', falsifier: 'an observed prevented anomaly', provider: "the store's documented and measured isolation" },
    { on: 'strike:alpha/remote/go-silent', class: 'world', statement: 'Remote service never does go silent mid-step.', falsifier: 'The service stops during the request.', provider: "the developer's strike" },
    { on: 'span:alpha+beta', class: 'span', falsifier: 'The shared completion is lost.', provider: "the developer's carry" },
    { on: 'bound:lifecycles-alpha/alpha/safe', class: 'bound', statement: 'Beyond phase level on lifecycles-alpha: A request completes safely.', falsifier: 'Data beyond the phase abstraction loses a request.', provider: "the developer's carry" },
  ];
  for (const expected of cases) {
    // forms.md §premise-says fixes each class, statement, falsifier and provider;
    // decisions.md §carry supplies the carry. presentation.md §reading to account.md §box fixes premise,
    // statement and falsifier JSON keys, but no provider key, so inspect its text.
    test(`decisions.md §carry ${expected.on} shows its code-added premise meaning before and after carry`, async () => {
      const dir = await base();
      if (expected.class === 'bound') {
        await decide(dir, 'confirm', LIFE);
        await slots(dir);
      }
      const before = premiseEntries(account(dir)).find((entry) => entry.premise === expected.on);
      assert.ok(before);
      assert.equal(before.class, expected.class);
      assert.equal(before.falsifier, expected.class === 'store phenomena' ? expected.falsifier
        : expected.class === 'world' ? 'an observed go silent mid-step at Remote service' : '-');
      await decide(dir, 'carry', expected.on, ['--choice', 'carry', '--words', expected.falsifier]);
      const premise = ok(forma(dir, ['box', '--json'])).premises.find((entry) => entry.premise === expected.on);
      assert.ok(premise);
      if (expected.class === 'span') {
        // forms.md §premise-says fixes the purposes in key order, but does not order surface rows.
        const prefix = 'Process requests. and Observe completions. hold together over what they share: ';
        assert.ok(premise.statement.startsWith(prefix));
        assert.ok(premise.statement.endsWith('.'));
        assert.deepEqual(premise.statement.slice(prefix.length, -1).split(', ').sort(), ['consumes alpha/completed', 'emits completed']);
      } else assert.equal(premise.statement, expected.statement);
      assert.equal(before.statement, premise.statement);
      assert.equal(premise.falsifier, expected.falsifier);
      for (const command of ['account', 'box']) {
        const output = forma(dir, [command]);
        assert.equal(output.status, 0, output.stderr);
        for (const value of [expected.class, premise.statement, expected.falsifier, expected.provider]) assert.ok(output.stdout.includes(value), `${command}: ${value}`);
      }
    });
  }
  for (const choice of ['a', 'b']) {
    // forms.md §premise-says gives the unpicked and picked statements, including the
    // alternative's expected end, plus class/falsifier/provider. forms.md §thing-pages carries it.
    test(`decisions.md §carry choice premise changes from unpicked to ${choice} with its prescribed meaning`, async () => {
      const dir = await base();
      const premiseName = 'choice:alpha/policy';
      const before = account(dir, 'alpha').parts.find((part) => part.ref === 'alpha').assumed.find((entry) => entry.premise === premiseName);
      assert.ok(before);
      assert.equal(before.class, 'choice');
      assert.equal(before.statement, 'Should the worker advance or wait? Not yet picked.');
      assert.equal(before.falsifier, 'a pick of the other alternative');
      await decide(dir, 'pick', CHOICE, ['--choice', choice]);
      const expected = `Should the worker advance or wait? Picked ${choice}. The policy is followed.`;
      const after = account(dir, 'alpha').parts.find((part) => part.ref === 'alpha').assumed.find((entry) => entry.premise === premiseName);
      assert.equal(after.class, 'choice');
      assert.equal(after.statement, expected);
      assert.equal(after.falsifier, 'a pick of the other alternative');
      const boxed = ok(forma(dir, ['box', '--json'])).premises.find((entry) => entry.premise === premiseName);
      assert.equal(boxed.statement, expected);
      assert.equal(boxed.falsifier, 'a pick of the other alternative');
      for (const command of ['account', 'box']) {
        const output = forma(dir, [command]);
        assert.equal(output.status, 0, output.stderr);
        assert.ok(output.stdout.includes("the developer's pick"));
      }
    });
  }
});

describe('decisions.md §accept — accepting risk', () => {
  // decisions.md §accept; account.md §basis-line, §box fix admission and acceptance metadata.
  test('decisions.md §accept acceptance enters the box with its reason, maker and time, without examination', async () => {
    const dir = await base();
    const r = await decide(dir, 'accept', CLAIM, ['--choice', 'accept', '--words', 'The cost is bounded and understood.']);
    const claim = ok(forma(dir, ['box', '--json'])).claims.find((entry) => entry.ref === CLAIM);
    assert.ok(claim);
    assert.equal(claim.standing, 'accepted');
    assert.deepEqual(claim.acceptance, { decision: r.records[0].name, words: 'The cost is bounded and understood.', by: BY, at: r.records[0].fields.At });
  });
  // decisions.md §accept; account.md §box excludes accepted claims until every page premise is carried.
  test('decisions.md §accept an accepted claim waits outside the box until its premises are carried', async () => {
    const dir = await base();
    const ref = 'alpha/claims/dependent';
    await decide(dir, 'accept', ref, ['--choice', 'accept', '--words', 'Accept conditional risk.']);
    assert.ok(!ok(forma(dir, ['box', '--json'])).claims.some((entry) => entry.ref === ref));
    await decide(dir, 'carry', PREMISE, ['--choice', 'carry', '--words', 'A worker loses a request.']);
    assert.ok(ok(forma(dir, ['box', '--json'])).claims.some((entry) => entry.ref === ref));
  });
  // decisions.md §accept, §in-force; decisions.md §decision-file preserves the earlier record.
  test('decisions.md §accept withdrawal removes acceptance but preserves its record', async () => {
    const dir = await base();
    const first = (await decide(dir, 'accept', CLAIM, ['--choice', 'accept', '--words', 'Temporary risk.'])).records[0];
    await decide(dir, 'accept', CLAIM, ['--choice', 'withdraw']);
    assert.ok(!ok(forma(dir, ['box', '--json'])).claims.some((entry) => entry.ref === CLAIM));
    assert.equal(await read(dir, first.path), first.text);
  });
  // decisions.md §accept; presentation.md §reading puts accepted claims under Accepted,
  // including before their premises are carried, with the acceptance metadata.
  for (const ref of [CLAIM, 'alpha/claims/dependent']) {
    test(`decisions.md §accept accepted ${ref} appears only under Accepted and returns to Open on withdrawal`, async () => {
      const dir = await base();
      const acceptedRisk = (await decide(dir, 'accept', ref, ['--choice', 'accept', '--words', 'The conditional risk is understood.'])).records[0];
      const part = account(dir, 'alpha').parts.find((entry) => entry.ref === 'alpha');
      assert.ok(!part.open.some((entry) => entry.ref === ref));
      assert.ok(!part.established.some((entry) => entry.ref === ref));
      assert.deepEqual(part.accepted.find((entry) => entry.ref === ref).acceptance, {
        decision: acceptedRisk.name, words: 'The conditional risk is understood.', by: BY, at: acceptedRisk.fields.At,
      });
      await decide(dir, 'accept', ref, ['--choice', 'withdraw']);
      const withdrawn = account(dir, 'alpha').parts.find((entry) => entry.ref === 'alpha');
      assert.ok(withdrawn.open.some((entry) => entry.ref === ref));
      assert.ok(!withdrawn.accepted.some((entry) => entry.ref === ref));
      assert.ok(!withdrawn.established.some((entry) => entry.ref === ref));
    });
  }
  // account.md §commands, door.md §lock: a read writes nothing in the project.
  for (const command of ['missing', 'account', 'box', 'diff']) {
    test(`decisions.md §accept ${command} reads accepted decisions without changing a file`, async () => {
      const original = await base();
      await decide(original, 'accept', CLAIM, ['--choice', 'accept', '--words', 'Accept the bounded risk.']);
      const dir = await project(null, await snapshot(original, { skip: ['work'] }));
      const before = await snapshot(dir);
      ok(forma(dir, [command, ...(command === 'diff' ? [original] : []), '--json']));
      assert.deepEqual(await snapshot(dir), before);
    });
  }
});

describe('decisions.md §redirect — redirects', () => {
  // decisions.md §redirect: editing the brief directly records no decision.
  test('decisions.md §redirect editing the brief directly creates no decision', async () => {
    const dir = await base();
    const before = (await tree(dir)).filter((path) => path.includes('/decisions/'));
    await writeFiles(dir, { 'design/brief/system.md': (await read(dir, 'design/brief/system.md')).replace('may fail', 'may fail silently') });
    account(dir);
    assert.deepEqual((await tree(dir)).filter((path) => path.includes('/decisions/')), before);
  });
  // decisions.md §redirect, §forma-decide fix page, pin and output; door.md §receipts fixes receipt authors and decision.
  test('decisions.md §redirect a claim redirect changes only its sentence, receipts the page and confirms the resulting unit', async () => {
    const dir = await base();
    const before = await read(dir, pathOf(CLAIM));
    const words = 'A request completes exactly once.';
    const r = await decide(dir, 'redirect', CLAIM, ['--words', words], ['--words', words]);
    const after = await read(dir, pathOf(CLAIM));
    assert.deepEqual(fieldsOf(after), { ...fieldsOf(before), Sentence: words });
    assert.deepEqual(r.written, [pathOf(CLAIM)]);
    assert.deepEqual(r.removed, []);
    assert.equal(r.records[0].fields.Pin, await claimPin(dir));
    assert.ok(!itemNames(dir).includes(`confirm:${CLAIM}`));
    // door.md §receipts: each line is exactly JSON.stringify, including its escaping,
    // with the applicable keys in their fixed order and a final LF.
    const receipt = await read(dir, pathOf(CLAIM).replace('README.md', 'receipt'));
    assert.ok(receipt.endsWith('\n'));
    const rawLines = receipt.slice(0, -1).split('\n');
    const lines = rawLines.map(JSON.parse);
    rawLines.forEach((line, index) => assert.equal(line, JSON.stringify(lines[index])));
    const entry = lines.find((line) => line.file === 'README.md' && line.sha256 === sha256(after));
    assert.equal(entry.decision, r.records[0].name);
    assert.deepEqual(Object.keys(entry), ['file', 'sha256', 'at', 'decision', 'authors']);
    assert.ok(!Object.hasOwn(entry, 'session'));
    assert.deepEqual(entry.authors, [AUTHOR]);
  });
  // decisions.md §redirect; design.md §units makes all stated entries one unit; account.md §items omits its confirmation item.
  test('decisions.md §redirect a stated claim redirect pins and confirms its whole stated unit after the change', async () => {
    const dir = await base();
    const ref = 'alpha/claims/stated';
    const words = 'A completion is recorded once.';
    const r = await decide(dir, 'redirect', ref, ['--words', words], ['--words', words]);
    const s = show(dir, 'confirm', 'alpha/stated');
    // decisions.md §forma-show fixes contained pins, without specifying their container structure.
    assert.ok(JSON.stringify(s.pins).includes(r.records[0].fields.Pin));
    assert.ok(!itemNames(dir).includes('confirm:alpha/stated'));
  });
  for (const where of ['alpha', 'together']) {
    // decisions.md §redirect, §decision-file, §filing fix page, Words, filing and confirmation; door.md §receipts fixes the receipt.
    test(`decisions.md §redirect adds and receipts a new journey in ${where} from the supplied page`, async () => {
      const dir = await base();
      const fixture = await project('decisions/journey');
      let page = await read(fixture, 'README.md');
      if (where === 'together') page = page.replace('| wait |', '| alpha/wait |');
      const input = await answerFolder({ 'journey.md': page });
      const on = `${where}/journeys/new-wait`;
      const r = await decide(dir, 'redirect', on, ['--from', `${input}/journey.md`], ['--from', `${input}/journey.md`]);
      assert.equal(await read(dir, pathOf(on)), page);
      assert.equal(fenced(r.records[0].text, 'Words'), page);
      assert.ok(r.recorded[0].startsWith(pathOf(on).replace('README.md', 'decisions/')));
      assert.ok(!itemNames(dir).includes(`confirm:${on}`));
      const receipt = JSON.parse((await read(dir, pathOf(on).replace('README.md', 'receipt'))).trim());
      assert.equal(receipt.decision, r.records[0].name);
    });
  }
  for (const on of ['alpha/claims/new-claim', 'alpha/journeys/complete', 'alpha/journeys/reach-request--done', 'alpha/journeys/kept-0123456789ab', 'alpha/journeys/policy-a']) {
    // decisions.md §redirect, §forma-show refuse absent claims, existing journeys and reserved keys.
    test(`decisions.md §redirect refuses redirect creation at ${on}`, async () => {
      const dir = await base();
      const fixture = await project('decisions/journey');
      const folder = await answerFolder({ 'journey.md': await read(fixture, 'README.md') });
      await refusesUnchanged(dir, ['show', 'redirect', on, ...(on.includes('/claims/') ? ['--words', 'New claim.'] : ['--from', `${folder}/journey.md`])]);
    });
  }
  for (const problem of ['form', 'reference', 'finding', 'unaccepted edit']) {
    // decisions.md §redirect, §forma-show; design.md §restate-checks, lifecycle-tool.md §findings fix these refusals.
    test(`decisions.md §redirect refuses a redirect with ${problem} without losing existing bytes`, async () => {
      const dir = await base();
      if (problem === 'unaccepted edit') {
        await writeFiles(dir, { [pathOf(CLAIM)]: (await read(dir, pathOf(CLAIM))).replace('completes safely', 'has an unaccepted change') });
        await refusesUnchanged(dir, ['show', 'redirect', CLAIM, '--words', 'Replace it.']);
      } else {
        const fixture = await project('decisions/journey');
        let page = await read(fixture, 'README.md');
        if (problem === 'form') page = page.replace('| Origin | added |', '| Origin | invented |');
        if (problem === 'reference') page = page.replace('| wait |', '| absent |');
        if (problem === 'finding') page = page.replace('| 1 | Worker | wait | - | - | - |', '| 1 | Worker | advance | - | - | - |\n| 2 | Worker | advance | - | - | - |');
        const folder = await answerFolder({ 'journey.md': page });
        await refusesUnchanged(dir, ['show', 'redirect', 'alpha/journeys/bad', '--from', `${folder}/journey.md`]);
      }
    });
  }
});

describe('decisions.md §in-force — which decision is in force', () => {
  // decisions.md §in-force, §expects; account.md §items, presentation.md §reading fix repair item and decision states.
  test('decisions.md §in-force the latest confirmation or decline wins and names what it supersedes', async () => {
    const dir = await base();
    const first = (await decide(dir, 'confirm', CLAIM)).records[0];
    const second = (await decide(dir, 'decline', CLAIM, ['--words', 'Reconsider the claim.'])).records[0];
    const old = decisionEntry(dir, CLAIM, first.name);
    assert.equal(old.state, 'superseded');
    assert.equal(old.supersededBy, second.name);
    assert.equal(decisionEntry(dir, CLAIM, second.name).state, 'in force');
    assert.ok(itemNames(dir).includes(`repair:${second.name}`));
  });
  // decisions.md §decision-file, §in-force order equal times by name; presentation.md §reading fixes the state fields.
  test('decisions.md §in-force decisions tied at At are ordered by their full names', async () => {
    const dir = await base();
    const folder = 'design/parts/alpha/claims/safe/decisions';
    const pin = await claimPin(dir);
    const at = new Date(Date.now() + 1000).toISOString();
    const a = await historical(dir, { kind: 'confirm', on: CLAIM, pin, folder, at });
    const b = await historical(dir, { kind: 'decline', on: CLAIM, pin, folder, words: 'Same-time decline.', at });
    const [earlier, later] = [a, b].sort((x, y) => x.name < y.name ? -1 : 1);
    assert.equal(decisionEntry(dir, CLAIM, earlier.name).state, 'superseded');
    assert.equal(decisionEntry(dir, CLAIM, earlier.name).supersededBy, later.name);
    assert.equal(decisionEntry(dir, CLAIM, later.name).state, 'in force');
  });
  // decisions.md §in-force, presentation.md §showings; account.md §items, presentation.md §reading fix lapse, reason and comparison.
  test('decisions.md §in-force a changed pin lapses the decision and owes confirmation with a change comparison', async () => {
    const dir = await base();
    const old = (await decide(dir, 'confirm', CLAIM)).records[0];
    await accepted(dir, { [pathOf(CLAIM)]: (await read(dir, pathOf(CLAIM))).replace('completes safely', 'finishes exactly once') });
    assert.equal(decisionEntry(dir, CLAIM, old.name).state, 'lapsed');
    const item = missing(dir).find((entry) => entry.item === `confirm:${CLAIM}`);
    assert.equal(item.why, 'lapsed');
    assert.ok(show(dir, 'confirm', CLAIM).shown.includes(old.name));
  });
  // decisions.md §in-force, §decision-file; account.md §box fixes acceptance at the same pin under another name.
  test('decisions.md §in-force an old decision follows identical meaning to a new name without moving its file', async () => {
    const dir = await base();
    const old = (await decide(dir, 'accept', CLAIM, ['--choice', 'accept', '--words', 'Accept these exact words.'])).records[0];
    const page = await read(dir, pathOf(CLAIM));
    const files = await snapshot(dir);
    delete files[pathOf(CLAIM)];
    delete files[pathOf(CLAIM).replace('README.md', 'receipt')];
    const renamed = await project(null, files);
    const ref = 'alpha/claims/renamed';
    await accepted(renamed, { [pathOf(ref)]: page.replace('# Safe completion', '# Renamed heading') });
    assert.equal(decisionEntry(renamed, ref, old.name).state, 'in force');
    assert.equal(await read(renamed, old.path), old.text);
    assert.ok(ok(forma(renamed, ['box', '--json'])).claims.some((claim) => claim.ref === ref && claim.acceptance.decision === old.name));
  });
  // decisions.md §in-force, §decision-file; presentation.md §reading fixes the removed page and listed decisions; account.md §items owes only standing units.
  test('decisions.md §in-force an absent subject decides nothing, retains its file and revives at the same pin', async () => {
    const dir = await base();
    const old = (await decide(dir, 'confirm', CLAIM)).records[0];
    const page = await read(dir, pathOf(CLAIM));
    const files = await snapshot(dir);
    delete files[pathOf(CLAIM)];
    delete files[pathOf(CLAIM).replace('README.md', 'receipt')];
    const removed = await project(null, files);
    const view = account(removed, CLAIM).thing;
    assert.ok(!Object.hasOwn(view, 'page'));
    assert.ok(view.decisions.some((d) => d.decision === old.name));
    // presentation.md §reading has no state name for this inert decision: assert no invented label.
    assert.ok(!itemNames(removed).includes(`confirm:${CLAIM}`));
    assert.equal(await read(removed, old.path), old.text);
    await accepted(removed, { [pathOf(CLAIM)]: page });
    assert.equal(decisionEntry(removed, CLAIM, old.name).state, 'in force');
    assert.ok(!itemNames(removed).includes(`confirm:${CLAIM}`));
  });
  // decisions.md §in-force; account.md §items, presentation.md §reading, account.md §box fix carry revocation and restoration.
  test('decisions.md §in-force a finding revokes all earlier carries at its target pin and a later carry restores it', async () => {
    const { dir } = await rulingBase();
    const a = (await decide(dir, 'carry', PREMISE, ['--choice', 'carry', '--words', 'Observe a loss.'])).records[0];
    const b = (await decide(dir, 'carry', PREMISE, ['--choice', 'carry', '--words', 'Observe a new loss.'])).records[0];
    const ruling = (await rule(dir, waiting(dir), 'real finding', ['--target', `premise:${PREMISE}`])).records[0];
    for (const prior of [a, b]) {
      const entry = decisionEntry(dir, PREMISE, prior.name);
      assert.equal(entry.revokedBy, ruling.name);
      assert.equal(await read(dir, prior.path), prior.text);
    }
    assert.equal(decisionEntry(dir, PREMISE, b.name).state, 'revoked');
    assert.ok(itemNames(dir).includes(`carry:${PREMISE}`));
    assert.ok(account(dir, PREMISE).thing.decisions.some((d) => d.decision === ruling.name));
    const again = (await decide(dir, 'carry', PREMISE, ['--choice', 'carry', '--words', 'Observe another loss.'])).records[0];
    assert.equal(decisionEntry(dir, PREMISE, again.name).state, 'in force');
    assert.ok(ok(forma(dir, ['box', '--json'])).premises.some((p) => p.premise === PREMISE && p.decision === again.name));
  });
  // decisions.md §in-force; account.md §items, presentation.md §reading, account.md §box fix the pick and revoked premise.
  test('decisions.md §in-force a finding revokes only a pick’s carry, leaving its journeys and cells in force', async () => {
    const { dir } = await rulingBase();
    const pick = (await decide(dir, 'pick', CHOICE, ['--choice', 'a'])).records[0];
    const ruling = (await rule(dir, waiting(dir), 'real finding', ['--target', 'choice:alpha/policy'])).records[0];
    const entry = decisionEntry(dir, CHOICE, pick.name);
    assert.equal(entry.state, 'in force');
    assert.equal(entry.revokedBy, ruling.name);
    assert.ok(itemNames(dir).includes(`pick:${CHOICE}`));
    assert.ok(!itemNames(dir).includes('confirm:alpha/journeys/policy-a'));
    assert.ok(!ok(forma(dir, ['box', '--json'])).premises.some((p) => p.premise === 'choice:alpha/policy'));
    const again = await decide(dir, 'pick', CHOICE, ['--choice', 'b']);
    assert.equal(account(dir, CHOICE).thing.pick.decision, again.records[0].name);
  });
  // decisions.md §in-force uses each claim’s Parts; account.md §items, presentation.md §reading fix lapsed confirmation and its item.
  test('decisions.md §in-force abstraction too coarse lapses earlier claim-unit confirmations only over recorded parts', async () => {
    const { dir } = await rulingBase();
    const alpha = (await decide(dir, 'confirm', CLAIM)).records[0];
    const beta = (await decide(dir, 'confirm', 'beta/claims/safe')).records[0];
    const span = (await decide(dir, 'confirm', 'together/claims/safe')).records[0];
    const statedSpan = (await decide(dir, 'confirm', 'together/stated')).records[0];
    await rule(dir, waiting(dir), 'abstraction too coarse');
    assert.equal(decisionEntry(dir, CLAIM, alpha.name).state, 'lapsed');
    assert.equal(decisionEntry(dir, 'beta/claims/safe', beta.name).state, 'in force');
    assert.equal(decisionEntry(dir, 'together/claims/safe', span.name).state, 'lapsed');
    assert.equal(decisionEntry(dir, 'together/claims/stated', statedSpan.name).state, 'lapsed');
    assert.ok(itemNames(dir).includes(`confirm:${CLAIM}`));
  });
  // decisions.md §in-force identifies a redirect by its current holding unit; decisions.md §redirect and design.md §units define that unit.
  test('decisions.md §in-force a redirect lapses when another entry changes its stated unit', async () => {
    const dir = await base();
    const ref = 'alpha/claims/stated';
    const words = 'Every completion has one record.';
    const redirect = (await decide(dir, 'redirect', ref, ['--words', words], ['--words', words])).records[0];
    const actionPath = 'design/parts/alpha/actions.md';
    await accepted(dir, { [actionPath]: (await read(dir, actionPath)).replace('Complete the request.', 'Complete the request and retain its record.') });
    assert.equal(decisionEntry(dir, ref, redirect.name).state, 'lapsed');
    // account.md §items and presentation.md §showings expose the lapsed unit and prior showing.
    assert.equal(missing(dir).find((item) => item.item === 'confirm:alpha/stated').why, 'lapsed');
    assert.ok(show(dir, 'confirm', 'alpha/stated').shown.includes(redirect.name));
  });
  // decisions.md §in-force, §intake; account.md §items, presentation.md §reading fix continued allowance and force.
  test('decisions.md §in-force intake, allowances and rulings do not lapse when the brief changes', async () => {
    const { dir } = await rulingBase();
    const r = (await rule(dir, waiting(dir), 'real finding', ['--target', 'brief'])).records[0];
    resultPaths(forma(dir, ['decide', 'allow', '--answers', '2', ...identity(), '--json']));
    await writeFiles(dir, { 'design/brief/system.md': (await read(dir, 'design/brief/system.md')).replace('may fail', 'fails silently') });
    assert.equal(account(dir).here.answers.allowed, 102);
    assert.ok(!itemNames(dir).includes('intake'));
    assert.equal(decisionEntry(dir, CLAIM, r.name).state, 'in force');
  });
});

describe('decisions.md §expects — what decisions expect', () => {
  // decisions.md §expects, §decision-file; door.md §repair-answer, §receipts, §forma-answer fix repair receipts and acceptance.
  test('decisions.md §expects a decline is owed as a named repair until its unit is rewritten', async () => {
    const dir = await base();
    const d = (await decide(dir, 'decline', CLAIM, ['--words', 'Make the safety obligation precise.'])).records[0];
    assert.ok(itemNames(dir).includes(`repair:${d.name}`));
    const page = (await read(dir, pathOf(CLAIM))).replace('completes safely', 'completes exactly once');
    const folder = await answerFolder({ [pathOf(CLAIM)]: page, 'repair.md': table([['Mechanism', 'An explicit completion obligation.']]) });
    const result = ok(forma(dir, ['answer', `repair:${d.name}`, folder, ...sessionArgs(AUTHOR), '--json']));
    assert.equal(result.accepted, true);
    assert.ok(!itemNames(dir).includes(`repair:${d.name}`));
    assert.ok(itemNames(dir).includes(`confirm:${CLAIM}`));
    const line = JSON.parse((await read(dir, pathOf(CLAIM).replace('README.md', 'receipt'))).trim());
    assert.ok(line.answers.includes(d.name));
    assert.notEqual(line.before, line.sha256);
    assert.deepEqual(line.mechanisms, [{ decision: d.name, mechanism: 'An explicit completion obligation.' }]);
    assert.equal(await read(dir, d.path), d.text);
  });
  // decisions.md §expects; door.md §repair-answer, §receipts and design.md §removal fix retained decisions and removal receipts.
  test('decisions.md §expects removing a declined thing retains only its decisions and records the repair’s removal', async () => {
    const dir = await base();
    const before = await read(dir, pathOf(CLAIM));
    const d = (await decide(dir, 'decline', CLAIM, ['--words', 'Remove this obligation.'])).records[0];
    const folder = await answerFolder({ 'removed.md': 'design/parts/alpha/claims/safe\n', 'repair.md': table([['Mechanism', 'Remove the unsupported claim.']]) });
    assert.equal(ok(forma(dir, ['answer', `repair:${d.name}`, folder, ...sessionArgs(AUTHOR), '--json'])).accepted, true);
    const surviving = (await tree(dir)).filter((path) => path.startsWith('design/parts/alpha/claims/safe/'));
    assert.deepEqual(surviving, [d.path]);
    const line = (await read(dir, 'design/parts/alpha/receipt')).trim().split('\n').map(JSON.parse).find((entry) => entry.file === 'README.md');
    assert.ok(line.answers.includes(d.name));
    assert.ok(line.removed.some((entry) => entry.file === 'claims/safe/README.md' && entry.before === sha256(before)));
    assert.ok(!itemNames(dir).includes(`repair:${d.name}`));
  });
  // decisions.md §expects; door.md §repair-answer refuses a no-change repair; door.md §forma-answer leaves tracked files unchanged.
  test('decisions.md §expects a repair marker alone cannot satisfy a repair when no bytes change', async () => {
    const dir = await base();
    const d = (await decide(dir, 'decline', CLAIM, ['--words', 'Change this claim.'])).records[0];
    const folder = await answerFolder({ [pathOf(CLAIM)]: await read(dir, pathOf(CLAIM)), 'repair.md': table([['Mechanism', 'No actual change.']]) });
    const before = await snapshot(dir, { skip: ['work', 'runs'] });
    const result = forma(dir, ['answer', `repair:${d.name}`, folder, ...sessionArgs(AUTHOR), '--json']);
    assert.equal(result.status, 1);
    assert.ok(result.json, result.stderr);
    assert.equal(result.json.accepted, false);
    assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
    assert.ok(itemNames(dir).includes(`repair:${d.name}`));
  });
  // decisions.md §expects; door.md §receipts carries repair history into later receipts; door.md §change permits the change answer.
  test('decisions.md §expects once a repair is met later file versions retain its answers history', async () => {
    const dir = await base();
    const original = await read(dir, pathOf(CLAIM));
    const d = (await decide(dir, 'decline', CLAIM, ['--words', 'Refine the wording.'])).records[0];
    const changed = original.replace('completes safely', 'completes exactly once');
    const folder = await answerFolder({ [pathOf(CLAIM)]: changed, 'repair.md': table([['Mechanism', 'Clarify completion.']]) });
    assert.equal(ok(forma(dir, ['answer', `repair:${d.name}`, folder, ...sessionArgs(AUTHOR), '--json'])).accepted, true);
    await writeFiles(dir, { [pathOf(CLAIM)]: original });
    const another = await answerFolder({ [pathOf(CLAIM)]: original });
    assert.equal(ok(forma(dir, ['answer', `change:${pathOf(CLAIM)}`, another, ...sessionArgs(AUTHOR), '--json'])).accepted, true);
    const line = JSON.parse((await read(dir, pathOf(CLAIM).replace('README.md', 'receipt'))).trim());
    assert.ok(line.answers.includes(d.name));
    assert.ok(!itemNames(dir).includes(`repair:${d.name}`));
  });
  // decisions.md §expects, §redirect, §decision-file; account.md §items fixes when the repair disappears.
  test('decisions.md §expects a property-wrong repair is met by a redirect changing the ruled claim pin', async () => {
    const { dir } = await rulingBase();
    const d = (await rule(dir, waiting(dir), 'property wrong')).records[0];
    assert.ok(itemNames(dir).some((name) => name.startsWith(`repair:${d.name}`)));
    await decide(dir, 'redirect', CLAIM, ['--words', 'A request has a bounded completion risk.'], ['--words', 'A request has a bounded completion risk.']);
    assert.ok(!itemNames(dir).some((name) => name.startsWith(`repair:${d.name}`)));
    assert.equal(await read(dir, d.path), d.text);
  });
  for (const verdict of ['model wrong', 'real finding']) {
    // decisions.md §expects; account.md §items fixes even a single model suffix; models.md §model-repair and door.md §receipts fix its mechanism and receipt.
    test(`decisions.md §expects ${verdict} on a lifecycle model is met by a changed model slot receipt`, async () => {
      const { dir } = await rulingBase();
      const d = (await rule(dir, waiting(dir), verdict, verdict === 'real finding' ? ['--target', 'lifecycles-alpha'] : [])).records[0];
      const repairItems = itemNames(dir).filter((name) => name.startsWith(`repair:${d.name}`));
      assert.deepEqual(repairItems, [`repair:${d.name}/lifecycles-alpha`]);
      const mechanism = 'A refusal prevents an unsafe waiting transition.';
      const path = 'models/lifecycles-alpha/parts/alpha/claims/safe/fault-unchanged.md';
      const before = await read(dir, path);
      const folder = await answerFolder({
        [path]: table([['Action', '-'], ['Mechanism', mechanism]]) + '\n| Lifecycle | Phase | Action | Outcome |\n| --- | --- | --- | --- |\n| request | done | wait | ready |\n',
        'repair.md': table([['Mechanism', mechanism]]),
      });
      assert.equal(ok(forma(dir, ['answer', repairItems[0], folder, ...sessionArgs(AUTHOR), '--json'])).accepted, true);
      const lines = (await read(dir, path.slice(0, path.lastIndexOf('/')) + '/receipt')).trim().split('\n').map(JSON.parse);
      const line = lines.find((entry) => entry.file === 'fault-unchanged.md');
      assert.ok(line.answers.includes(d.name));
      assert.equal(line.before, sha256(before));
      assert.deepEqual(line.mechanisms, [{ decision: d.name, mechanism: mechanism }]);
      assert.ok(!itemNames(dir).some((name) => name.startsWith(`repair:${d.name}`)));
    });
  }
  // decisions.md §expects, §in-force; account.md §items fixes repair completion and new confirmation.
  test('decisions.md §expects abstraction-too-coarse repair is met by a changed restatement receipt', async () => {
    const { dir } = await rulingBase();
    const d = (await rule(dir, waiting(dir), 'abstraction too coarse')).records[0];
    const folder = await answerFolder({ [pathOf(CLAIM)]: (await read(dir, pathOf(CLAIM))).replace('completes safely', 'completes with an explicit receipt'), 'repair.md': table([['Mechanism', 'Record the completion receipt.']]) });
    assert.equal(ok(forma(dir, ['answer', `repair:${d.name}`, folder, ...sessionArgs(AUTHOR), '--json'])).accepted, true);
    assert.ok(!itemNames(dir).includes(`repair:${d.name}`));
    assert.ok(itemNames(dir).includes(`confirm:${CLAIM}`));
  });
});

describe('decisions.md §forma-show — forma show', () => {
  // decisions.md §forma-show, presentation.md §showings fix output and token; door.md §lock: a read writes nothing.
  test('decisions.md §forma-show show emits exactly its JSON keys and does not change project files', async () => {
    const dir = await base();
    const before = await snapshot(dir);
    const s = show(dir, 'accept', CLAIM);
    assert.deepEqual(Object.keys(s).sort(), ['kind', 'on', 'pins', 'shown', 'takes', 'token']);
    assert.equal(s.kind, 'accept');
    assert.equal(s.on, CLAIM);
    assert.equal(typeof s.shown, 'string');
    assert.ok(JSON.stringify(s.pins).includes(await claimPin(dir)));
    const takes = JSON.stringify(s.takes);
    for (const value of ['--choice', 'accept', 'withdraw', '--words', '--shown', '--by', '--provider', '--model', '--session']) assert.ok(takes.includes(value), value);
    assert.match(s.token, /^[a-f0-9]{64}$/);
    assert.deepEqual(await snapshot(dir), before);
  });
  for (const kind of ['intake', 'allow']) {
    // decisions.md §forma-show, §kinds fix options, subject and absent token.
    test(`decisions.md §forma-show show ${kind} supplies options with no token`, async () => {
      const dir = await base({ initialized: kind === 'allow', confirmed: false });
      const s = show(dir, kind);
      assert.deepEqual(Object.keys(s).sort(), ['kind', 'on', 'pins', 'shown', 'takes']);
      assert.equal(s.kind, kind);
      assert.equal(s.on, kind);
      const output = forma(dir, ['show', kind]);
      assert.equal(output.status, 0, output.stderr);
      assert.ok(output.stdout.includes('This decision takes:'));
      assert.ok(!/^shown: /m.test(output.stdout));
    });
  }
  // decisions.md §forma-show fixes showing, option marker and last token line; presentation.md §showings fixes token identity.
  test('decisions.md §forma-show text output ends with the options and matching shown token', async () => {
    const dir = await base();
    const s = show(dir, 'carry', PREMISE);
    const result = forma(dir, ['show', 'carry', PREMISE]);
    assert.equal(result.status, 0, result.stderr);
    const cut = result.stdout.indexOf('This decision takes:');
    assert.ok(cut >= 0 && result.stdout.slice(0, cut).includes(s.shown));
    assert.equal(result.stdout.trimEnd().split('\n').at(-1), `shown: ${s.token}`);
  });
  for (const kind of ['allow', 'confirm', 'decline', 'pick', 'rule', 'carry', 'accept', 'redirect']) {
    // decisions.md §forma-show refuses every kind but intake before intake.
    test(`decisions.md §forma-show refuses ${kind} before intake`, async () => {
      const dir = await base({ initialized: false });
      const on = { confirm: 'parts', decline: 'parts', pick: CHOICE, rule: 'no-surprise', carry: PREMISE, accept: CLAIM, redirect: CLAIM }[kind];
      await refusesUnchanged(dir, ['show', kind, ...(on ? [on] : []), ...(kind === 'redirect' ? ['--words', 'New sentence.'] : [])]);
    });
  }
  for (const [kind, on] of [['unknown', CLAIM], ['confirm', 'absent'], ['confirm', CHOICE], ['decline', CHOICE], ['pick', CLAIM], ['carry', CLAIM], ['carry', 'choice:alpha/policy'], ['accept', LIFE], ['rule', 'not-a-waiting-decision']]) {
    // decisions.md §forma-show fixes subject refusals; design.md §units says choices are no unit.
    test(`decisions.md §forma-show refuses ${kind} on unsuitable subject ${on}`, async () => {
      const dir = await base();
      await refusesUnchanged(dir, ['show', kind, on]);
    });
  }
  // decisions.md §forma-show restricts confirmation until parts are confirmed; it places no such restriction on declines.
  test('decisions.md §forma-show confirms the parts first but still allows a decline beforehand', async () => {
    const dir = await base({ confirmed: false });
    await refusesUnchanged(dir, ['show', 'confirm', CLAIM]);
    await decide(dir, 'decline', CLAIM, ['--words', 'Reject even before decomposition confirmation.']);
    await decide(dir, 'confirm', 'parts');
    show(dir, 'confirm', CLAIM);
  });
  for (const kind of ['confirm', 'decline']) {
    // decisions.md §forma-show and models.md §freeze freeze lifecycle decisions until the ruling.
    test(`decisions.md §forma-show an open lifecycle surprise freezes ${kind} on its lifecycle`, async () => {
      const { dir } = await rulingBase();
      await refusesUnchanged(dir, ['show', kind, LIFE]);
      await rule(dir, waiting(dir), 'real finding', ['--target', 'brief']);
      show(dir, kind, LIFE);
    });
  }
  for (const args of [['show', 'confirm', CLAIM, '--unknown'], ['show', 'redirect', CLAIM, '--words'], ['show', 'redirect', CLAIM, '--words', 'A.', '--words', 'B.']]) {
    // decisions.md §forma-show and project.md §commands refuse unknown, repeated and valueless options.
    test(`decisions.md §forma-show shared command refusal: ${args.join(' ')}`, async () => {
      const dir = await base();
      await refusesUnchanged(dir, args);
    });
  }
  // decisions.md §forma-show and project.md §commands refuse a nonexistent project folder without writing.
  test('decisions.md §forma-show refuses a project option that names no folder', async () => {
    const parent = await tempFolder('decisions-absent-');
    refused(forma(`${parent}/not-created`, ['show', 'intake', '--json']));
    assert.deepEqual(await tree(parent), []);
  });
});

describe('decisions.md §forma-decide — forma decide', () => {
  // decisions.md §forma-decide fixes success arrays and exit status; decisions.md §filing fixes filing.
  test('decisions.md §forma-decide successful JSON lists only recorded decisions, written pages and removed files', async () => {
    const dir = await base();
    const r = await decide(dir, 'confirm', CLAIM);
    assert.equal(r.recorded.length, 1);
    assert.deepEqual(r.written, []);
    assert.deepEqual(r.removed, []);
  });
  // decisions.md §forma-decide prints every recorded path with successful exit status.
  test('decisions.md §forma-decide text output names the recorded path', async () => {
    const dir = await base();
    const s = show(dir, 'confirm', CLAIM);
    const result = forma(dir, ['decide', 'confirm', CLAIM, '--shown', s.token, ...identity()]);
    assert.equal(result.status, 0, result.stderr);
    const path = result.stdout.trim();
    assert.ok(path.startsWith('design/parts/alpha/claims/safe/decisions/'));
    assert.ok(await read(dir, path));
  });
  for (const kind of ['intake', 'allow', 'confirm']) {
    // decisions.md §forma-decide refuses prompting without terminal input and output.
    test(`decisions.md §forma-decide refuses to prompt for ${kind} through nonterminal input and output`, async () => {
      const dir = await base({ initialized: kind !== 'intake' });
      await refusesUnchanged(dir, ['decide', kind, ...(kind === 'confirm' ? [CLAIM] : []), ...identity()]);
    });
  }
  for (const absent of ['--by', '--provider', '--model', '--session', 'all-session', '--shown']) {
    // decisions.md §forma-decide requires name, whole declared session and token in this nonterminal command.
    test(`decisions.md §forma-decide refuses a given confirmation missing ${absent}`, async () => {
      const dir = await base();
      const args = ['--shown', show(dir, 'confirm', CLAIM).token, ...identity()];
      if (absent === 'all-session') args.splice(args.indexOf('--provider'), 6);
      else args.splice(args.indexOf(absent), 2);
      await refusesUnchanged(dir, ['decide', 'confirm', CLAIM, ...args]);
    });
  }
  for (const [kind, on, args] of [
    ['confirm', CLAIM, ['--words', 'Not a confirmation option.']],
    ['decline', CLAIM, []],
    ['pick', CHOICE, ['--choice', 'c']],
    ['carry', PREMISE, ['--choice', 'keep', '--words', 'Observe failure.']],
    ['carry', PREMISE, ['--choice', 'carry']],
    ['accept', CLAIM, ['--choice', 'keep', '--words', 'Accept risk.']],
    ['accept', CLAIM, ['--choice', 'accept']],
    ['accept', CLAIM, []],
    ['confirm', CLAIM, ['--basis', 'beta/claims/safe']],
    ['confirm', CLAIM, ['--choice', 'a']],
  ]) {
    // decisions.md §forma-decide, §kinds fixes permitted options, choices and required words.
    test(`decisions.md §forma-decide refuses ${kind} with invalid or missing options ${args.join(' ') || '(none)'}`, async () => {
      const dir = await base();
      await refusesUnchanged(dir, ['decide', kind, on, '--shown', show(dir, kind, on).token, ...args, ...identity()]);
    });
  }
  for (const [flag, value] of [['--situation', 'invented'], ['--cadence', 'weekly'], ...[...OPTIONS, '--inbox-cap'].flatMap((flag) => ['-1', '1.5', 'abc'].map((value) => [flag, value]))]) {
    // decisions.md §forma-decide, §intake fixes intake lists and nonnegative whole numbers.
    test(`decisions.md §forma-decide refuses malformed intake ${flag} ${value}`, async () => {
      const dir = await project();
      const args = ['decide', 'intake', '--situation', flag === '--situation' ? value : 'design new', '--words', 'Limit the scope.', ...identity()];
      if (flag !== '--situation') args.push(flag, value);
      await refusesUnchanged(dir, args);
    });
  }
  for (const absent of ['--situation', '--words', '--by']) {
    // decisions.md §forma-decide, §kinds requires intake situation, words and name.
    test(`decisions.md §forma-decide intake with explicit choices refuses missing ${absent}`, async () => {
      const dir = await project();
      const args = ['decide', 'intake', '--situation', 'design new', '--words', 'Limited scope.', '--answers', '1', ...identity()];
      args.splice(args.indexOf(absent), 2);
      await refusesUnchanged(dir, args);
    });
  }
  for (const args of [['--unknown', 'x'], ['--answers'], ['--answers', '1', '--answers', '2'], ['--words', 'Allow has no words.']]) {
    // decisions.md §forma-decide, §kinds and project.md §commands refuse unsupported, repeated and valueless options.
    test(`decisions.md §forma-decide allow rejects unsupported, repeated or valueless options ${args.join(' ')}`, async () => {
      const dir = await base();
      await refusesUnchanged(dir, ['decide', 'allow', ...identity(), ...args]);
    });
  }
  // decisions.md §forma-decide refuses a token unlike the current showing’s.
  test('decisions.md §forma-decide rejects a well-formed but incorrect token', async () => {
    const dir = await base();
    await refusesUnchanged(dir, ['decide', 'confirm', CLAIM, '--shown', '0'.repeat(64), ...identity()]);
  });
  for (const source of ['receipt', 'decision']) {
    // decisions.md §forma-decide and door.md §clock name the ahead time and forbid every project write.
    test(`decisions.md §forma-decide a ${source} more than a minute ahead refuses all decision writes`, async () => {
      const dir = await base();
      const at = new Date(Date.now() + 86_400_000).toISOString();
      if (source === 'receipt') await accepted(dir, { [pathOf(CLAIM)]: await read(dir, pathOf(CLAIM)) }, { at });
      else await historical(dir, { kind: 'confirm', on: CLAIM, pin: await claimPin(dir), at, folder: 'design/parts/alpha/claims/safe/decisions' });
      const before = await snapshot(dir);
      const reasons = refused(forma(dir, ['decide', 'allow', '--answers', '1', ...identity(), '--json']));
      assert.ok(strings(reasons).join('\n').includes(at));
      assert.deepEqual(await snapshot(dir), before, 'a clock refusal writes nothing, not in work/ either');
    });
  }
  for (const [label, args] of [
    ['missing target', ['--verdict', 'real finding', '--level', 'specification']],
    ['absent target', ['--verdict', 'real finding', '--level', 'specification', '--target', 'missing-model']],
    ['requirement model target', ['--verdict', 'real finding', '--level', 'requirement', '--target', 'lifecycles-alpha']],
    ['invalid verdict', ['--verdict', 'incorrect', '--level', 'specification']],
    ['invalid level', ['--verdict', 'model wrong', '--level', 'global']],
    ['missing verdict', ['--level', 'specification']],
    ['missing level', ['--verdict', 'model wrong']],
  ]) {
    // decisions.md §forma-decide, §rulings fix ruling verdict, level and target refusals.
    test(`decisions.md §forma-decide refuses ruling with ${label}`, async () => {
      const { dir } = await rulingBase();
      const on = waiting(dir).join(',');
      const s = show(dir, 'rule', on);
      await refusesUnchanged(dir, ['decide', 'rule', on, '--shown', s.token, ...args, '--words', 'Direction.', ...identity()]);
    });
  }
  // decisions.md §kinds, §forma-decide require the ruling’s direction and forbid recording a refusal.
  test('decisions.md §forma-decide a ruling must give its direction and records nothing without it', async () => {
    const { dir } = await rulingBase();
    const on = waiting(dir).join(',');
    await refusesUnchanged(dir, ['decide', 'rule', on, '--shown', show(dir, 'rule', on).token, '--verdict', 'model wrong', '--level', 'specification', ...identity()]);
  });
  // decisions.md §forma-decide expressly refuses required words holding only whitespace; decisions.md §kinds fixes which kinds require them.
  for (const [label, words] of [['empty', ''], ['spaces', '   '], ['tabs and newlines', '\t\n\r\n\t']]) {
    for (const kind of ['intake', 'decline', 'carry', 'accept', 'rule', 'redirect']) {
      test(`decisions.md §forma-decide refuses ${kind} whose required words are ${label}`, async () => {
        const dir = kind === 'intake' ? await project() : kind === 'rule' ? (await rulingBase()).dir : await base();
        let on;
        let options;
        if (kind === 'intake') options = ['--situation', 'design new'];
        else {
          on = kind === 'rule' ? waiting(dir).join(',') : kind === 'carry' ? PREMISE : CLAIM;
          let showing;
          if (kind === 'redirect') {
            // decisions.md §redirect, §forma-show:
            // show may already refuse the invalid proposed page. If it shows
            // one, use that exact showing's token so stale-token refusal cannot
            // mask the required-words check in decide (decisions.md §forma-decide).
            const before = await snapshot(dir);
            const result = forma(dir, ['show', kind, on, '--words', words, '--json']);
            if (result.status === 1) {
              refused(result);
              assert.deepEqual(await snapshot(dir), before);
              return;
            }
            showing = ok(result);
          } else showing = show(dir, kind, on);
          options = ['--shown', showing.token];
          if (kind === 'carry') options.push('--choice', 'carry');
          if (kind === 'accept') options.push('--choice', 'accept');
          if (kind === 'rule') options.push('--verdict', 'model wrong', '--level', 'specification');
        }
        await refusesUnchanged(dir, ['decide', kind, ...(on ? [on] : []), ...options, '--words', words, ...identity()]);
      });
    }
  }
  // decisions.md §forma-decide inherits decisions.md §forma-show and requires an acceptance’s subject to be a claim.
  test('decisions.md §forma-decide rejects acceptance of a non-claim and every inherited show refusal', async () => {
    const dir = await base();
    for (const [kind, on, args] of [['accept', LIFE, ['--choice', 'accept', '--words', 'Risk.']], ['carry', 'choice:alpha/policy', ['--choice', 'carry', '--words', 'Failure.']], ['rule', 'absent-surprise', ['--verdict', 'model wrong', '--level', 'specification', '--words', 'Repair.']], ['confirm', 'missing-unit', []]]) {
      await refusesUnchanged(dir, ['decide', kind, on, '--shown', '0'.repeat(64), ...args, ...identity()]);
    }
  });
});

describe('decisions.md §filing — remaining filing cases', () => {
  // decisions.md §filing; forms.md §surface: an uncited-in-brief
  // surface row is added and its confirmation is filed with the part.
  test('decisions.md §filing an added surface row is filed at its part', async () => {
    const dir = await base();
    const source = 'design/brief/sources/event.md';
    await writeFiles(dir, { [source]: '---\ntitle: Event\nauthor: Example\ndate: "2025"\norigin: Supplied for this fixture\n---\n# Event\n\nEmit completion.\n' });
    await accepted(dir, { 'design/parts/alpha/boundary.md': (await read(dir, 'design/parts/alpha/boundary.md')).replace(`| emits | completed | ${CITE} |`, `| emits | completed | ${source}#event |`) });
    const r = await decide(dir, 'confirm', 'alpha/surface/emits/completed');
    assert.ok(r.recorded[0].startsWith('design/parts/alpha/decisions/'));
  });
  // decisions.md §filing: the first surprise's journey owns the ruling.
  test('decisions.md §filing a ruling on a written journey is filed with that journey', async () => {
    const { dir, ref, surprise } = await journeySurprise();
    const r = await rule(dir, [surprise.name], 'real finding', ['--target', 'brief']);
    assert.ok(r.recorded[0].startsWith(pathOf(ref).replace('README.md', 'decisions/')));
  });
});

describe('presentation.md §showings — changed and picked showings', () => {
  // presentation.md §showings fixes the posed key, alternative and outcome text.
  test('presentation.md §showings a picked cell shows its posed key, alternative and resulting outcome', async () => {
    const dir = await base();
    await poseChoice(dir);
    await decide(dir, 'pick', CHOICE, ['--choice', 'a']);
    const s = show(dir, 'confirm', LIFE);
    assert.ok(s.shown.includes('choice policy, picked a: done'));
    const picture = retainedPictures(s.shown).find(value => value.lifecycle === LIFE);
    assert.ok(picture);
    assert.equal(picture.cells.ready.advance.phase, 'done');
    assert.equal(picture.cells.ready.advance.filledBy, CHOICE);
    assert.equal(picture.cells.ready.advance.pick, 'a');
    assert.ok(picture.basis.picks.some(fill => fill.choice === CHOICE && fill.pick === 'a'));
  });
  // presentation.md §showings, decisions.md §in-force select the latest lapsed record.
  test('presentation.md §showings the latest lapsed decision supplies the comparison', async () => {
    const dir = await base();
    await decide(dir, 'confirm', 'alpha/stated');
    const last = (await decide(dir, 'decline', 'alpha/stated', ['--words', 'Use precise statements.'])).records[0];
    await accepted(dir, { [pathOf('alpha/claims/stated')]: (await read(dir, pathOf('alpha/claims/stated'))).replace('A completion is recorded.', 'A completion is recorded once.') });
    const s = show(dir, 'confirm', 'alpha/stated');
    assert.ok(s.shown.includes(last.name));
    assert.ok(s.shown.includes(last.fields.At));
    assert.ok(s.shown.includes('A completion is recorded.') && s.shown.includes('A completion is recorded once.'));
    // presentation.md §showings does not fix the count label or diff markers.
  });
});

describe('decisions.md §rulings — grouping and non-claim refusals', () => {
  for (const common of ['store:records', 'choice:policy']) {
    test(`decisions.md §rulings shared ${common} groups distinct claims' surprises`, async () => {
      // decisions.md §rulings groups these two failures by shared store/choice premise and the smallest surprise name.
      const refs = [CLAIM, 'alpha/claims/dependent'];
      const { dir, surprises } = await rulingBase({ refs, rests: Object.fromEntries(refs.map((ref) => [ref, common])) });
      assert.equal(surprises.length, 2);
      assert.deepEqual(waiting(dir), [surprises[0].name]);
    });
  }
  test('decisions.md §rulings grouping closes transitively across shared premise and store premise links', async () => {
    // decisions.md §rulings closes grouping transitively; requires every grouped surprise in the record.
    const refs = [CLAIM, 'alpha/claims/dependent', 'alpha/claims/third'];
    const { dir, surprises } = await rulingBase({ refs, rests: { [CLAIM]: 'reliable', 'alpha/claims/dependent': 'reliable, store:records', 'alpha/claims/third': 'store:records' } });
    assert.equal(surprises.length, 3);
    assert.deepEqual(waiting(dir), [surprises[0].name]);
    const r = await rule(dir, waiting(dir));
    for (const s of surprises) assert.ok(section(r.records[0].text, 'Surprises').includes(s.name));
  });
  test('decisions.md §rulings property wrong refuses when no ruled surprise is on a claim', async () => {
    // decisions.md §rulings, §forma-decide expressly refuses property wrong with only a journey surprise.
    const { dir, surprise } = await journeySurprise();
    const s = show(dir, 'rule', surprise.name);
    await refusesUnchanged(dir, ['decide', 'rule', surprise.name, '--shown', s.token, '--verdict', 'property wrong', '--level', 'specification', '--words', 'Restate.', ...identity()]);
  });
});

describe('decisions.md §kept-journeys — lifecycle cases and kept currency', () => {
  test('decisions.md §kept-journeys a kept journey may enter an initially absent entity without a start row', async () => {
    // decisions.md §kept-journeys permits absence until the entering action; fixes its steps and omits that entity's start row.
    // engines.md §lifecycle-engine gives the initially absent entity and the shortest create/advance trace, without assuming a phases JSON representation.
    const { dir, surprises } = await rulingBase({ violation: true, prepare: async (dir) => {
      const actionPath = 'design/parts/alpha/actions.md';
      await accepted(dir, {
        [actionPath]: (await read(dir, actionPath)) + `| create | worker | Create the request. | none | none | added | ${CITE} |\n`,
        [pathOf(LIFE)]: (await read(dir, pathOf(LIFE)))
          .replace('| Initial | ready |', '| Initial | ready, entered by create |')
          .replace('| Phase | advance | wait |\n| --- | --- | --- |\n| ready | done | ready |\n| done | None. | done |',
            '| Phase | advance | wait | create |\n| --- | --- | --- | --- |\n| ready | done | ready | None. |\n| done | None. | done | None. |'),
        [pathOf('alpha/journeys/complete')]: (await read(dir, pathOf('alpha/journeys/complete')))
          .replace('| 1 | Worker | advance | - | - | - |', '| 1 | Worker | create | - | - | - |\n| 2 | Worker | advance | - | - | - |'),
        // lifecycle-tool.md §stepping: the span journey must also enter the entity before advancing it.
        [pathOf('together/journeys/observe')]: (await read(dir, pathOf('together/journeys/observe')))
          .replace('| 1 | Worker | alpha/advance | - | - | - |', '| 1 | Worker | alpha/create | - | - | - |\n| 2 | Worker | alpha/advance | - | - | - |')
          .replace('| 2 | Observer | beta/observe | - | - | - |', '| 3 | Observer | beta/observe | - | - | - |'),
      });
    } });
    const surprise = surprises.find((entry) => entry.data.kind === 'base');
    assert.ok(surprise);
    const d = (await rule(dir, [surprise.name])).records[0];
    const kept = section(d.text, 'Kept');
    assert.equal(fieldsOf(kept).Journey, `alpha/journeys/kept-${surprise.basis.slice(0, 12)}`);
    assert.equal(fieldsOf(kept)['Refused step'], '2');
    assert.deepEqual(dataRows(kept, ['Step', 'Actor', 'Action', 'Arguments', 'Entity', 'Case']), [
      { Step: '1', Actor: 'Worker', Action: 'create', Arguments: '-', Entity: '-', Case: '-' },
      { Step: '2', Actor: 'Worker', Action: 'advance', Arguments: '-', Entity: '-', Case: '-' },
    ]);
    // decisions.md §kept-journeys gives no start row for an absent entity; do not mandate whether an empty start table is printed.
    const hasStart = kept.split('\n').some((line) => {
      const cells = line.split('|').slice(1, -1).map((cell) => cell.trim().toLowerCase());
      return cells.length === 3 && ['lifecycle', 'entity', 'phase'].every((name) => cells.includes(name));
    });
    if (hasStart) assert.deepEqual(dataRows(kept, ['Lifecycle', 'Entity', 'Phase']), []);
  });
  test('decisions.md §kept-journeys the unique lifecycle case is retained in each kept step', async () => {
    // decisions.md §kept-journeys requires exactly one matching case, retained in Case.
    const { dir, surprises } = await rulingBase({ violation: true, prepare: async (dir) => {
      const actionPath = 'design/parts/alpha/actions.md';
      await accepted(dir, {
        [actionPath]: (await read(dir, actionPath)).replace('| Complete the request. | none |', '| Complete the request. | bad, good |'),
        [pathOf(LIFE)]: (await read(dir, pathOf(LIFE))).replace('| ready | done | ready |', '| ready | bad: ready<br>good: done | ready |').replace('| done | None. | done |', '| done | bad: None.<br>good: None. | done |'),
        [pathOf('alpha/journeys/complete')]: (await read(dir, pathOf('alpha/journeys/complete'))).replace('| advance | - | - | - |', '| advance | - | - | good |'),
        [pathOf('together/journeys/observe')]: (await read(dir, pathOf('together/journeys/observe'))).replace('| alpha/advance | - | - | - |', '| alpha/advance | - | - | good |'),
        [pathOf(CHOICE)]: (await read(dir, pathOf(CHOICE))).replace('| advance | - | - | - |', '| advance | - | - | good |'),
      });
    } });
    const s = surprises.find((entry) => entry.data.kind === 'base');
    const r = await rule(dir, [s.name]);
    assert.deepEqual(dataRows(section(r.records[0].text, 'Kept'), ['Step', 'Actor', 'Action', 'Arguments', 'Entity', 'Case']), [{ Step: '1', Actor: 'Worker', Action: 'advance', Arguments: '-', Entity: '-', Case: 'good' }]);
  });
  test('decisions.md §kept-journeys changing a kept journey citation lapses its confirming pin while retaining the ruling', async () => {
    // decisions.md §kept-journeys requires the recorded current pin; design.md §pins changes citation pins; account.md §items owes confirmation.
    const { dir, surprises } = await rulingBase({ violation: true });
    const s = surprises.find((entry) => entry.data.kind === 'base');
    const d = (await rule(dir, [s.name])).records[0];
    const ref = `alpha/journeys/kept-${s.basis.slice(0, 12)}`;
    await writeFiles(dir, { 'design/brief/system.md': (await read(dir, 'design/brief/system.md')).replace('may fail', 'may lose replies') });
    assert.ok(itemNames(dir).includes(`confirm:${ref}`));
    assert.equal(await read(dir, d.path), d.text);
  });
});

describe('decisions.md §carry — external basis and native bounds', () => {
  test('decisions.md §carry an independently established claim supports an external carry', async () => {
    // decisions.md §carry, §in-force; account.md §standing, §box fixes established basis, carry state and box membership.
    const dir = await base();
    await betaEvidence(dir);
    assert.equal(account(dir, 'beta/claims/safe').thing.standing, 'established');
    const r = await decide(dir, 'carry', PREMISE, ['--choice', 'carry', '--words', 'Observe a worker failure.', '--basis', 'beta/claims/safe']);
    assert.equal(decisionEntry(dir, PREMISE, r.records[0].name).state, 'in force');
    assert.ok(ok(forma(dir, ['box', '--json'])).premises.some((p) => p.premise === PREMISE));
  });
  test('decisions.md §carry a claim cannot establish itself through the carry it is used to support', async () => {
    // decisions.md §carry, §in-force; account.md §standing prohibits circular establishment and fixes the resulting labels.
    const dir = await base();
    await betaEvidence(dir, { cyclic: true });
    const r = await decide(dir, 'carry', PREMISE, ['--choice', 'carry', '--words', 'Observe a worker failure.', '--basis', 'beta/claims/safe']);
    assert.equal(decisionEntry(dir, PREMISE, r.records[0].name).state, 'lapsed');
    assert.equal(account(dir, 'beta/claims/safe').thing.standing, 'not established');
  });
  test('decisions.md §carry a bound carry cannot use a claim from any of its bounded claim’s parts', async () => {
    // decisions.md §carry, §forma-decide excludes all bounded-claim parts from an external basis.
    const dir = await base();
    await decide(dir, 'confirm', LIFE);
    await slots(dir);
    const on = 'bound:lifecycles-alpha/alpha/safe';
    await refusesUnchanged(dir, ['decide', 'carry', on, '--shown', show(dir, 'carry', on).token, '--choice', 'carry', '--words', 'Bounds fail.', '--basis', 'alpha/claims/dependent', ...identity()]);
  });
  for (const engine of ['tlc', 'alloy']) {
    test(`decisions.md §carry ${engine} bounds pin rows in model order with their meanings`, { skip: !hasToolchain && 'toolchain absent' }, async () => {
      // decisions.md §carry fixes ordered bounds hashes and each meaning in the showing.
      const dir = await base();
      const fixture = await project(`decisions/${engine}`);
      const files = await snapshot(fixture);
      const model = files['models/tiny/model.md'];
      await accepted(dir, files);
      // door.md §receipts: model.md records the strikes accepted with it; beta has no world row.
      await accepted(dir, { 'models/tiny/model.md': model }, { strikes: [] });
      const ref = 'beta/claims/safe';
      const extension = engine === 'tlc' ? 'tla' : 'als';
      await accepted(dir, { [`models/tiny/parts/beta/claims/safe/encoding.${extension}`]: engine === 'tlc' ? 'Invariant == x >= 0\n' : 'assert Claim { always no Flag }\n' }, { pins: [{ entry: ref, pin: await claimPin(dir, ref) }] });
      const r = await decide(dir, 'carry', 'bound:tiny/beta/safe', ['--choice', 'carry', '--words', 'Larger bounds expose another behavior.']);
      const rows = dataRows(model, ['Bound', 'Value', 'Meaning']);
      const expected = [`Model: tiny`, `Claim: ${await claimPin(dir, ref)}`, ...rows.map((row) => `Bound: ${row.Bound} | ${row.Value} | ${row.Meaning}`)].join('\n');
      assert.equal(r.records[0].fields.Pin, sha256(expected));
      for (const row of rows) assert.ok(r.showing.shown.includes(row.Meaning));
      // forms.md §premise-says fixes the bounds premise's statement in model order;
      // account.md §box fixes its statement and falsifier in the box.
      const premise = ok(forma(dir, ['box', '--json'])).premises.find((entry) => entry.premise === 'bound:tiny/beta/safe');
      const sentence = fieldsOf(await read(dir, pathOf(ref))).Sentence;
      assert.equal(premise.statement, `Beyond its bounds on tiny (${rows.map((row) => `${row.Bound} = ${row.Value}`).join(', ')}): ${sentence}`);
      assert.equal(premise.falsifier, 'Larger bounds expose another behavior.');
    });
  }
  test('decisions.md §carry TLC liveness excludes the constraint and shows the choose trade', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // decisions.md §carry excludes the TLC liveness constraint and displays the choose trade.
    const dir = await base();
    const fixture = await project('decisions/tlc');
    const files = await snapshot(fixture);
    await accepted(dir, files);
    await accepted(dir, { 'models/tiny/model.md': files['models/tiny/model.md'] }, { strikes: [] });
    const ref = 'beta/claims/safe';
    await accepted(dir, { [pathOf(ref)]: (await read(dir, pathOf(ref))).replace('| Kind | safety |', '| Kind | liveness |').replace('| Rests on | none |', '| Rests on | alpha/fair |') });
    // design.md §pins: the fairness reference expands to its statement in the claim pin.
    const f = fieldsOf(await read(dir, pathOf(ref)));
    const pin = sha256(`Sentence: ${f.Sentence}\nKind: liveness\nStake: ${f.Stake}\nRests on: The worker eventually acts.\nParts: Observe completions.\nCites: ${await passageHash(dir)}`);
    await accepted(dir, { 'models/tiny/parts/beta/claims/safe/encoding.tla': 'Property == []<>(x = 0)\nFairness == WF_vars(Observe)\n' }, { pins: [{ entry: ref, pin }] });
    const r = await decide(dir, 'carry', 'bound:tiny/beta/safe', ['--choice', 'carry', '--words', 'Larger bounds may fail to progress.']);
    const rows = dataRows(files['models/tiny/model.md'], ['Bound', 'Value', 'Meaning']);
    assert.equal(r.records[0].fields.Pin, sha256(['Model: tiny', `Claim: ${pin}`, ...rows.filter((row) => row.Bound !== 'constraint').map((row) => `Bound: ${row.Bound} | ${row.Value} | ${row.Meaning}`)].join('\n')));
    assert.ok(!r.showing.shown.includes('Only values up to the limit are explored.'));
    assert.ok(r.showing.shown.includes('One number is chosen; the other numbers are not explored.'));
  });
});

describe('decisions.md §expects — repairs from other answers and removal', () => {
  // decisions.md §expects; door.md §repair-answer records before and answers without a mechanism for another answer.
  test('decisions.md §expects another Restate answer can meet a decline and records its before and answers', async () => {
    const dir = await base();
    const d = (await decide(dir, 'decline', CLAIM, ['--words', 'Clarify completion.'])).records[0];
    await writeFiles(dir, { 'design/brief/addition.md': '# Addition\n\nRecord completion explicitly.\n' });
    const page = (await read(dir, pathOf(CLAIM))).replace('completes safely', 'completes explicitly').replace(CITE, `${CITE}, design/brief/addition.md#addition`);
    const folder = await answerFolder({ [pathOf(CLAIM)]: page });
    assert.equal(ok(forma(dir, ['answer', 'passage:design/brief/addition.md#addition', folder, ...sessionArgs(AUTHOR), '--json'])).accepted, true);
    const line = JSON.parse((await read(dir, pathOf(CLAIM).replace('README.md', 'receipt'))).trim());
    assert.ok(line.answers.includes(d.name));
    assert.notEqual(line.before, line.sha256);
    assert.ok(!Object.hasOwn(line, 'mechanisms'));
    assert.ok(!itemNames(dir).includes(`repair:${d.name}`));
  });
  // decisions.md §expects requires every ruled claim’s pin to change; account.md §items fixes the repair item.
  test('decisions.md §expects a grouped property-wrong repair waits until all ruled claims have changed', async () => {
    const { dir } = await rulingBase({ refs: [CLAIM, 'alpha/claims/dependent'], shared: true });
    const d = (await rule(dir, waiting(dir), 'property wrong')).records[0];
    await decide(dir, 'redirect', CLAIM, ['--words', 'A request completes exactly once.'], ['--words', 'A request completes exactly once.']);
    assert.ok(itemNames(dir).some((name) => name.startsWith(`repair:${d.name}`)));
    await decide(dir, 'redirect', 'alpha/claims/dependent', ['--words', 'A reliable worker records one completion.'], ['--words', 'A reliable worker records one completion.']);
    assert.ok(!itemNames(dir).some((name) => name.startsWith(`repair:${d.name}`)));
  });
  // decisions.md §expects; models.md §model-repair and door.md §repair-answer fix lifecycle repair and mechanism receipt.
  test('decisions.md §expects a lifecycle-page repair satisfies model wrong and preserves its mechanism', async () => {
    const { dir } = await rulingBase();
    const d = (await rule(dir, waiting(dir))).records[0];
    const page = (await read(dir, pathOf(LIFE))).replace('| done | None. | done |', '| done | None. | None. |');
    const folder = await answerFolder({ [pathOf(LIFE)]: page, 'repair.md': table([['Mechanism', 'Completed requests refuse further waiting.']]) });
    assert.equal(ok(forma(dir, ['answer', `repair:${d.name}/lifecycles-alpha`, folder, ...sessionArgs(AUTHOR), '--json'])).accepted, true);
    const line = JSON.parse((await read(dir, pathOf(LIFE).replace('README.md', 'receipt'))).trim());
    assert.ok(line.answers.includes(d.name));
    assert.deepEqual(line.mechanisms, [{ decision: d.name, mechanism: 'Completed requests refuse further waiting.' }]);
    assert.ok(!itemNames(dir).includes(`repair:${d.name}/lifecycles-alpha`));
  });
  // decisions.md §rulings, §expects and models.md §model-repair allow a non-claim real finding’s repair with no fault slot.
  test('decisions.md §expects a real finding on a journey repairs its model without a claim fault and reruns the surprised question', async () => {
    const { dir, surprise } = await journeySurprise();
    const d = (await rule(dir, waiting(dir), 'real finding', ['--target', 'lifecycles-alpha'])).records[0];
    // account.md §items fixes the suffix even for one model; door.md §repair-answer records the mechanism.
    const item = `repair:${d.name}/lifecycles-alpha`;
    assert.ok(itemNames(dir).includes(item));
    const mechanism = 'A completed request refuses another completion.';
    const page = (await read(dir, pathOf(LIFE))).replace('| done | done | done |', '| done | None. | done |');
    const folder = await answerFolder({ [pathOf(LIFE)]: page, 'repair.md': table([['Mechanism', mechanism]]) });
    assert.equal(ok(forma(dir, ['answer', item, folder, ...sessionArgs(AUTHOR), '--json'])).accepted, true);
    const line = JSON.parse((await read(dir, pathOf(LIFE).replace('README.md', 'receipt'))).trim());
    assert.ok(line.answers.includes(d.name));
    assert.deepEqual(line.mechanisms, [{ decision: d.name, mechanism: mechanism }]);
    assert.ok(!itemNames(dir).includes(item));
    // evidence.md §lifecycle-journeys keeps the original refusal question; evidence.md §keys fixes its matching result.
    await decide(dir, 'confirm', LIFE);
    ok(forma(dir, ['run', '--json']));
    const evidence = JSON.parse(await read(dir, `models/${surprise.data.question}.json`));
    assert.equal(evidence.found.outcome, 'refused');
    assert.equal(evidence.found.step, 2);
    assert.equal(evidence.matches, true);
  });
  // decisions.md §expects meets the decline of a picked journey at once; account.md §items therefore owes no repair.
  test('decisions.md §expects a declined picked journey owes no agent repair', async () => {
    const dir = await base();
    await decide(dir, 'pick', CHOICE, ['--choice', 'a']);
    const d = (await decide(dir, 'decline', 'alpha/journeys/policy-a', ['--words', 'Do not retain this confirmation.'])).records[0];
    assert.ok(!itemNames(dir).includes(`repair:${d.name}`));
  });
});

describe('decisions.md §forma-show — frozen choice', () => {
  // decisions.md §forma-show and models.md §freeze freezes a posed choice until ruling.
  test('decisions.md §forma-show an open lifecycle surprise freezes a choice whose cells that model poses', async () => {
    const { dir } = await rulingBase({ prepare: async (dir) => { await poseChoice(dir); await decide(dir, 'pick', CHOICE, ['--choice', 'a']); } });
    await refusesUnchanged(dir, ['show', 'pick', CHOICE]);
    await rule(dir, waiting(dir), 'real finding', ['--target', 'brief']);
    show(dir, 'pick', CHOICE);
  });
});

describe('decisions.md §decision-file — literal words', () => {
  // decisions.md §decision-file: literal UTF-8 words and one added LF inside the fence.
  test('decisions.md §decision-file preserves heading-like words, Unicode, backticks and an existing final LF', async () => {
    const dir = await base();
    const words = '## This is inside Words\nUse ```code``` literally, Ω.\n';
    const r = await decide(dir, 'decline', CLAIM, ['--words', words]);
    await inspectRecord(dir, r.recorded[0], { kind: 'decline', on: CLAIM, sections: ['Words', 'Shown'], words, shown: r.showing.shown });
  });
});

describe('decisions.md §in-force — merged rulings and revocation boundaries', () => {
  test('decisions.md §in-force a kept journey follows only its own surprise when a merged ruling partly supersedes its ruling', async () => {
    // decisions.md §kept-journeys, §in-force: revocation may follow any still-ruled surprise, but each kept journey follows its own.
    // design.md §code-journeys and presentation.md §reading expose the journeys code adds through lifecycle readings.
    const { dir, surprises } = await rulingBase({ violation: true, refs: [CLAIM, 'alpha/claims/dependent'] });
    const bases = surprises.filter((s) => s.data.kind === 'base');
    assert.equal(bases.length, 2);
    const clone = await project(null, await snapshot(dir));
    const original = (await rule(dir, waiting(dir))).records[0];
    const refs = bases.map((s) => `alpha/journeys/kept-${s.basis.slice(0, 12)}`);
    const journeys = () => account(dir, 'alpha').parts.find((part) => part.ref === 'alpha').lifecycles.flatMap((life) => life.journeys.map((journey) => journey.ref));
    for (const ref of refs) assert.ok(journeys().includes(ref));
    const later = (await rule(clone, [bases[0].name], 'real finding', ['--target', 'brief'])).records[0];
    // decisions.md §decision-file: simulate a later valid decision merged from the independently unruled clone.
    const text = withDecisionField(later.text, 'At', new Date(Date.parse(original.fields.At) + 1).toISOString());
    await writeFiles(dir, { [later.path.replace(`${later.name}.md`, `${decisionName(text)}.md`)]: text });
    assert.ok(!journeys().includes(refs[0]));
    assert.ok(journeys().includes(refs[1]));
    assert.equal(decisionEntry(dir, refs[1], original.name).state, 'in force');
    assert.equal(await read(dir, original.path), original.text);
  });
  // decisions.md §in-force applies revocation while a ruling remains in force for any surprise; and presentation.md §reading fix the carry’s state.
  test('decisions.md §in-force a merged ruling keeps its revocation until its last surprise is superseded', async () => {
    const { dir, surprises } = await rulingBase({ refs: [CLAIM, 'alpha/claims/dependent'] });
    const carry = (await decide(dir, 'carry', PREMISE, ['--choice', 'carry', '--words', 'Observe a lost request.'])).records[0];
    const unruled = await snapshot(dir);
    const ruling = (await rule(dir, waiting(dir), 'real finding', ['--target', `premise:${PREMISE}`])).records[0];
    for (let i = 0; i < surprises.length; i++) {
      const clone = await project(null, unruled);
      const replacement = (await rule(clone, [surprises[i].name], 'real finding', ['--target', 'brief'])).records[0];
      // decisions.md §decision-file: hand-built merged decisions use valid names and an explicit order across independent clones.
      const text = withDecisionField(replacement.text, 'At', new Date(Date.parse(ruling.fields.At) + i + 1).toISOString());
      await writeFiles(dir, { [replacement.path.replace(`${replacement.name}.md`, `${decisionName(text)}.md`)]: text });
      const current = decisionEntry(dir, PREMISE, carry.name);
      if (i + 1 < surprises.length) {
        assert.equal(current.state, 'revoked');
        assert.equal(current.revokedBy, ruling.name);
      } else {
        assert.equal(current.state, 'in force');
        assert.ok(!Object.hasOwn(current, 'revokedBy'));
      }
    }
  });
  // decisions.md §in-force, §expects restrict repair to still-ruled surprises; decisions.md §decision-file keeps the record.
  test('decisions.md §in-force a later merged ruling supersedes only the surprises it names', async () => {
    const { dir, surprises } = await rulingBase({ refs: [CLAIM, 'alpha/claims/dependent'] });
    const clone = await project(null, await snapshot(dir));
    const first = (await rule(dir, waiting(dir), 'property wrong')).records[0];
    const second = (await rule(clone, [surprises[0].name], 'real finding', ['--target', 'brief'])).records[0];
    // decisions.md §decision-file permits merged times; a clone need not record after the other clone’s latest time. Arrange the strict order explicitly.
    const mergedText = withDecisionField(second.text, 'At', new Date(Date.parse(first.fields.At) + 1).toISOString());
    const mergedPath = second.path.replace(`${second.name}.md`, `${decisionName(mergedText)}.md`);
    await writeFiles(dir, { [mergedPath]: mergedText });
    const remaining = surprises[1].data.question.includes('/dependent/') ? 'alpha/claims/dependent' : CLAIM;
    await decide(dir, 'redirect', remaining, ['--words', 'The remaining obligation is revised.'], ['--words', 'The remaining obligation is revised.']);
    assert.ok(!itemNames(dir).some((name) => name.startsWith(`repair:${first.name}`)));
    assert.equal(await read(dir, first.path), first.text);
  });
  // decisions.md §rulings, §in-force use Target pin, not reused name; presentation.md §reading fixes revokedBy.
  test('decisions.md §in-force revocation follows the target pin rather than a reused premise name', async () => {
    const { dir } = await rulingBase();
    const old = (await decide(dir, 'carry', PREMISE, ['--choice', 'carry', '--words', 'Observe failure.'])).records[0];
    await accepted(dir, { [pathOf(PREMISE)]: (await read(dir, pathOf(PREMISE))).replace('The worker behaves reliably.', 'The worker never drops a request.') });
    const current = (await decide(dir, 'carry', PREMISE, ['--choice', 'carry', '--words', 'Observe a dropped request.'])).records[0];
    const ruling = (await rule(dir, waiting(dir), 'real finding', ['--target', `premise:${PREMISE}`])).records[0];
    assert.notEqual(old.fields.Pin, ruling.fields['Target pin']);
    assert.equal(current.fields.Pin, ruling.fields['Target pin']);
    assert.ok(!Object.hasOwn(decisionEntry(dir, PREMISE, old.name), 'revokedBy'));
    assert.equal(decisionEntry(dir, PREMISE, current.name).revokedBy, ruling.name);
  });
  // decisions.md §in-force revokes only carries strictly before the ruling by At; presentation.md §reading fixes the current state.
  test('decisions.md §in-force a carry at exactly the ruling At is not an earlier carry to revoke', async () => {
    const { dir } = await rulingBase();
    const ruling = (await rule(dir, waiting(dir), 'real finding', ['--target', `premise:${PREMISE}`])).records[0];
    const carry = await historical(dir, { kind: 'carry', on: PREMISE, pin: await premisePin(dir), rows: [['Choice', 'carry'], ['Basis', '-']], words: 'Observe a worker loss.', at: ruling.fields.At, folder: 'design/parts/alpha/premises/reliable/decisions' });
    assert.equal(decisionEntry(dir, PREMISE, carry.name).state, 'in force');
    assert.ok(!Object.hasOwn(decisionEntry(dir, PREMISE, carry.name), 'revokedBy'));
  });
});

describe('decisions.md §expects — removed abstraction targets', () => {
  // decisions.md §expects, §decision-file and design.md §removal fix completion and retained decision files.
  test('decisions.md §expects removing every recorded part meets an abstraction repair and retains the ruling', async () => {
    const { dir } = await rulingBase();
    const d = (await rule(dir, waiting(dir), 'abstraction too coarse')).records[0];
    const folder = await answerFolder({
      'design/README.md': `# Remaining scope\n\n| Part | Purpose | Cites |\n| --- | --- | --- |\n| beta | Observe completions. | ${CITE} |\n\n1. [Beta](parts/beta/)\n`,
      'design/parts/beta/boundary.md': (await read(dir, 'design/parts/beta/boundary.md')).split('\n## Surface')[0] + '\n',
      'removed.md': 'design/parts/alpha\ndesign/spans/together\n',
      'repair.md': table([['Mechanism', 'Remove the unsupported component and its span.']]),
    });
    assert.equal(ok(forma(dir, ['answer', `repair:${d.name}`, folder, ...sessionArgs(AUTHOR), '--json'])).accepted, true);
    assert.ok(!itemNames(dir).includes(`repair:${d.name}`));
    assert.equal(await read(dir, d.path), d.text);
    assert.ok((await tree(dir)).filter((path) => path.startsWith('design/parts/alpha/')).every((path) => path.includes('/decisions/')));
  });
});

describe('decisions.md §rulings — native reductions and weaker forms', () => {
  for (const [typeFailure, includeWeaker, acceptedAnswer] of [[true, false, true], [true, true, false], [false, false, false]]) {
    test(`decisions.md §rulings an explanation of ${typeFailure ? 'TypeOK' : 'the encoded property'} with ${includeWeaker ? 'a weaker form' : 'no weaker form'} is ${acceptedAnswer ? 'accepted' : 'refused'}`, { skip: !hasToolchain && 'toolchain absent' }, async () => {
      // evidence.md §weaker, §explain check 3: only an encoding's own violated property requires, and permits, weaker forms.
      // decisions.md §rulings offers rulings only after the explanation is accepted.
      const fixture = await nativeSurprise({ typeFailure });
      const files = await snapshot(fixture.dir);
      const stemFile = fixture.stem.split('/').at(-1);
      const receipt = fixture.stem.slice(0, fixture.stem.lastIndexOf('/')) + '/receipt';
      for (const path of Object.keys(files)) if (path.startsWith(`${fixture.stem}.explained.`) || path.startsWith(`${fixture.stem}.weaker-`)) delete files[path];
      files[receipt] = files[receipt].trim().split('\n').map(JSON.parse).filter((line) => !line.file.startsWith(`${stemFile}.explained.`) && !line.file.startsWith(`${stemFile}.weaker-`)).map(JSON.stringify).join('\n') + '\n';
      const dir = await project(null, files);
      const explanation = fixture.explanation.replace(/\| Weaker \| [^\n]+/, `| Weaker | ${includeWeaker ? 'relaxed' : 'none'} |`);
      const answer = await answerFolder({ 'explain.md': explanation, ...(includeWeaker ? { 'weaker/relaxed.tla': 'Invariant == x >= 0\n' } : {}) });
      const before = await snapshot(dir, { skip: ['work', 'runs'] });
      const result = forma(dir, ['answer', `explain:${fixture.surprise.name}`, answer, ...sessionArgs(fixture.author), '--json']);
      assert.equal(result.status, acceptedAnswer ? 0 : 1);
      assert.ok(result.json, result.stderr);
      assert.equal(result.json.accepted, acceptedAnswer);
      if (acceptedAnswer) {
        assert.ok(!itemNames(dir).includes(`explain:${fixture.surprise.name}`));
        assert.equal(fieldsOf(await read(dir, `${fixture.stem}.explained.md`)).Weaker, 'none');
      } else {
        assert.ok(result.json.reasons.length > 0);
        assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
        assert.ok(itemNames(dir).includes(`explain:${fixture.surprise.name}`));
      }
    });
  }
  for (const changed of ['new engine file', 'held model file']) {
    test(`decisions.md §rulings an open native surprise discounts a merged ${changed} and refuses an answer holding frozen files`, { skip: !hasToolchain && 'toolchain absent' }, async () => {
      // models.md §freeze and evidence.md §surprise-file freeze all native model files and claim slots in held, including merged additions at read.
      const { dir, surprise } = await nativeSurprise();
      const model = 'models/tiny/model.md';
      const engine = 'models/tiny/Tiny.tla';
      const encoding = 'models/tiny/parts/beta/claims/safe/encoding.tla';
      assert.deepEqual(surprise.data.held, await Promise.all([engine, model, encoding].sort().map(async (path) => ({ path, sha256: sha256(await read(dir, path)) }))));
      const originals = { [model]: await read(dir, model), [engine]: await read(dir, engine) };
      const path = changed === 'new engine file' ? 'models/tiny/Rulings2Extra.tla' : model;
      const added = '---- MODULE Rulings2Extra ----\nHarmless == TRUE\n====\n';
      await accepted(dir, { [path]: changed === 'new engine file' ? added : originals[model] + '\n' });
      assert.ok(itemNames(dir).includes(`change:${path}`));
      // A change answer can restore the held bytes, but holding those files is still refused, even byte-for-byte.
      const answer = await answerFolder({ ...originals, ...(changed === 'new engine file' ? { [path]: added } : {}) });
      const before = await snapshot(dir, { skip: ['work', 'runs'] });
      const result = forma(dir, ['answer', `change:${path}`, answer, ...sessionArgs(AUTHOR), '--json']);
      assert.equal(result.status, 1);
      assert.ok(result.json, result.stderr);
      assert.equal(result.json.accepted, false);
      assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
      assert.equal(await read(dir, surprise.path), before[surprise.path]);
    });
  }
  test('decisions.md §rulings a fully explained surprise still waits while a reduction is owed', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // decisions.md §rulings and account.md §items keeps the reduction wait but removes the accepted-explanation wait.
    const { dir, surprise } = await nativeSurprise();
    const item = missing(dir).find((entry) => entry.item === `rule:${surprise.name}`);
    assert.ok(item.waits.includes(`run:${surprise.name}/reduction`));
    assert.ok(!item.waits.includes(`explain:${surprise.name}`));
    await refusesUnchanged(dir, ['show', 'rule', surprise.name]);
    await refusesUnchanged(dir, ['decide', 'rule', surprise.name, '--shown', '0'.repeat(64), '--verdict', 'model wrong', '--level', 'specification', '--words', 'Repair it.', ...identity()]);
  });
  test('decisions.md §rulings an offered ruling preserves explanation and weaker outcomes and removes all surprise stems', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // decisions.md §rulings; evidence.md §reductions, §weaker, §at-ruling fixes showing, stem removal and retained question evidence.
    const { dir, surprise, stem } = await nativeSurprise();
    resultPaths(forma(dir, ['decide', 'allow', '--runs', '20', ...identity(), '--json']));
    ok(forma(dir, ['run', '--json']));
    const s = show(dir, 'rule', surprise.name);
    for (const text of ['The observer makes a completion visible.', 'An observation exceeds the declared expectation.', 'The observation updates the counter.', 'relaxed', 'no violation']) assert.ok(s.shown.includes(text), text);
    const owned = (await tree(dir)).filter((path) => path.startsWith(`${stem}.`));
    assert.ok(owned.some((path) => path.includes('.reduction-')));
    assert.ok(owned.some((path) => path.endsWith('.weaker-relaxed.json')));
    const evidence = await read(dir, `models/${surprise.data.question}.json`);
    const r = await rule(dir, [surprise.name]);
    for (const path of owned) { assert.equal(await read(dir, path), null); assert.ok(r.removed.includes(path)); }
    assert.equal(await read(dir, `models/${surprise.data.question}.json`), evidence);
  });
});

describe('decisions.md §kept-journeys — native type-invariant trace', () => {
  test('decisions.md §kept-journeys a type-invariant violation with no lifecycle entities keeps its action trace', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // decisions.md §kept-journeys includes TypeOK violations and fixes the assessment; evidence.md §outcomes names the violated property.
    const { dir, surprise } = await nativeSurprise({ typeFailure: true });
    assert.equal(surprise.data.found.outcome, 'violation');
    assert.equal(surprise.data.found.property, 'TypeOK');
    // evidence.md §weaker, §explain: TypeOK is not the encoding's own property, so its accepted explanation has no weaker forms.
    assert.equal(fieldsOf(await read(dir, surprise.path.replace(/\.json$/, '.explained.md'))).Weaker, 'none');
    assert.ok(!(await tree(dir)).some((path) => path.startsWith(surprise.path.slice(0, -5) + '.weaker-')));
    assert.ok(!itemNames(dir).some((name) => name.startsWith(`run:${surprise.name}/weaker-`)));
    resultPaths(forma(dir, ['decide', 'allow', '--runs', '20', ...identity(), '--json']));
    ok(forma(dir, ['run', '--json']));
    const r = await rule(dir, [surprise.name]);
    const kept = section(r.records[0].text, 'Kept');
    assert.ok(kept.includes(`### ${surprise.name}\n`));
    // decisions.md §kept-journeys quantifies the entities/lifecycles present: this model has none, and its two steps each take the sole action row.
    const fields = fieldsOf(kept);
    assert.equal(fields.Journey, `beta/journeys/kept-${surprise.basis.slice(0, 12)}`);
    assert.match(fields.Pin, /^[a-f0-9]{64}$/);
    assert.equal(fields.Polarity, 'must not');
    assert.equal(fields['Refused step'], '2');
    assert.deepEqual(dataRows(kept, ['Step', 'Actor', 'Action', 'Arguments', 'Entity', 'Case']), [
      { Step: '1', Actor: 'Observer', Action: 'observe', Arguments: '-', Entity: '-', Case: '-' },
      { Step: '2', Actor: 'Observer', Action: 'observe', Arguments: '-', Entity: '-', Case: '-' },
    ]);
  });
});

describe('decisions.md §filing — native ruling subjects', () => {
  for (const subject of ['action', 'world row', 'phases', 'facts']) {
    // decisions.md §filing fixes each subject's filing; evidence.md §questions
    // and evidence.md §question-names fix the question kind/name used to find it.
    test(`decisions.md §filing files a ruling whose first surprise serves ${subject}`, { skip: !hasToolchain && 'toolchain absent' }, async () => {
      const dir = await base();
      const engine = subject === 'facts' ? 'alloy' : 'tlc';
      resultPaths(forma(dir, ['decide', 'allow', `--${engine}-seconds`, '10', `--${engine}-megabytes`, '512', ...identity(), '--json']));
      const fixture = await project(`decisions/${engine}`);
      const files = await snapshot(fixture);
      if (subject === 'action') files['models/tiny/Tiny.tla'] = files['models/tiny/Tiny.tla'].replace("Observe == x' = x", 'Observe == FALSE /\\ UNCHANGED x');
      if (subject === 'facts') files['models/tiny/Tiny.als'] = files['models/tiny/Tiny.als'].replace('no Flag and always Observe', 'some Flag and no Flag');
      if (subject === 'world row') {
        await accepted(dir, { 'design/parts/beta/boundary.md': (await read(dir, 'design/parts/beta/boundary.md')).replace('\n\n## Surface', `\n| remote | Remote observer | service | world | request-response | - | - | - | added | ${CITE} |\n\n## Surface`) });
        const menu = [['drop', 'Drop'], ['duplicate', 'Duplicate'], ['delay', 'Delay'], ['reorder', 'Reorder'], ['fail-forever', 'FailForever'], ['fail-then-succeed', 'Recover'], ['crash', 'Crash'], ['go-silent', 'Silent']];
        files['models/tiny/model.md'] = files['models/tiny/model.md'].replace('| Row | Item | Operator | Parameters |\n| --- | --- | --- | --- |', '| Row | Item | Operator | Parameters |\n| --- | --- | --- | --- |\n' + menu.map(([item, operator]) => `| beta/remote | ${item} | ${operator} | none |`).join('\n'));
        files['models/tiny/Tiny.tla'] = files['models/tiny/Tiny.tla'].replace('====', menu.map(([, operator]) => `${operator} == ${operator === 'Drop' ? 'FALSE /\\ ' : ''}UNCHANGED x`).join('\n') + '\n====');
      }
      if (subject === 'phases') {
        const life = await project('decisions/beta-lifecycle');
        await accepted(dir, { [pathOf('beta/lifecycles/observation')]: await read(life, pathOf('beta/lifecycles/observation')), 'design/parts/beta/boundary.md': (await read(dir, 'design/parts/beta/boundary.md')).replace('\n\n## Surface', `\n| observation | Observation | entity | machine | - | - | observer | observer | stated | ${CITE} |\n\n## Surface`) });
        files['models/tiny/model.md'] = files['models/tiny/model.md'].replace('| Lifecycle | Over | Expression |\n| --- | --- | --- |', '| Lifecycle | Over | Expression |\n| --- | --- | --- |\n| beta/observation | e \\in {1} | IF x = 0 THEN "outside" ELSE "pending" |');
      }
      await accepted(dir, files);
      await accepted(dir, { 'models/tiny/model.md': files['models/tiny/model.md'] }, { strikes: [] });
      ok(forma(dir, ['run', '--json']));
      const surprises = await surpriseRecords(dir);
      const marker = { action: '/actions/beta/observe.', 'world row': '/world/beta/remote/drop.enabled.', phases: '/phases.', facts: '/facts.' }[subject];
      const s = surprises.find((entry) => entry.data.question.includes(marker));
      assert.ok(s, `expected a ${subject} surprise`);
      await explain(dir, s);
      const r = await rule(dir, [s.name], 'real finding', ['--target', 'brief']);
      const folder = subject === 'action' || subject === 'world row' ? 'design/parts/beta/decisions/' : 'design/decisions/';
      assert.ok(r.recorded[0].startsWith(folder));
      assert.equal(r.recorded.length, 1);
    });
  }
});

describe('decisions.md §rulings — native world-row grouping', () => {
  test('decisions.md §rulings claims with no shared premise group when their traces take one world row', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // decisions.md §rulings fixes grouping by a shared world row; engines.md §trace fixes trace misbehaviour rows.
    const dir = await base();
    resultPaths(forma(dir, ['decide', 'allow', '--tlc-seconds', '10', '--tlc-megabytes', '512', ...identity(), '--json']));
    await accepted(dir, { 'design/parts/beta/boundary.md': (await read(dir, 'design/parts/beta/boundary.md')).replace('\n\n## Surface', `\n| remote | Remote observer | service | world | request-response | - | - | - | added | ${CITE} |\n\n## Surface`) });
    const struck = ['duplicate', 'delay', 'reorder', 'fail-forever', 'fail-then-succeed', 'crash', 'go-silent'].map((item) => `strike:beta/remote/${item}`);
    await decide(dir, 'carry', struck.join(','), ['--choice', 'carry']);
    const fixture = await project('decisions/tlc');
    const files = await snapshot(fixture);
    files['models/tiny/model.md'] = files['models/tiny/model.md'].replace('| Row | Item | Operator | Parameters |\n| --- | --- | --- | --- |', '| Row | Item | Operator | Parameters |\n| --- | --- | --- | --- |\n| beta/remote | drop | Drop | none |');
    // engines.md §slot-forms: observation has its own state, so its End does not
    // depend on the separate world-row drop that violates the claims.
    files['models/tiny/Tiny.tla'] = files['models/tiny/Tiny.tla']
      .replace('VARIABLE x', 'VARIABLE x, observed').replace('vars == <<x>>', 'vars == <<x, observed>>')
      .replace('Init == x = 0', 'Init == /\\ x = 0 /\\ observed = FALSE')
      .replace("Observe == x' = x", "Observe == /\\ x' = x /\\ observed' = TRUE")
      .replace('====', "Drop == /\\ x' = 1 /\\ UNCHANGED observed\n====");
    await accepted(dir, files);
    await accepted(dir, { 'models/tiny/model.md': files['models/tiny/model.md'] }, { strikes: struck.sort() });
    const journeyFixture = await project('decisions/beta-lifecycle');
    await accepted(dir, { [pathOf('beta/journeys/observe')]: await read(journeyFixture, pathOf('beta/journeys/observe')), [pathOf('beta/claims/other')]: (await read(dir, pathOf('beta/claims/safe'))).replace('A request completes safely.', 'Every completion remains visible.') });
    await decide(dir, 'confirm', 'beta/journeys/observe');
    const hash = await passageHash(dir);
    // design.md §pins fixes the action, journey and world-row receipt pins.
    const actionPin = sha256(`Actor: Observer (actor, machine, -, -)\nSentence: Observe the completion.\nCases: \nGuard: none\nCites: ${hash}`);
    const journeyPin = sha256(`Polarity: should happen\nExpected end: The completion is observed.\nRefused step: -\nCites: ${hash}\nStep 1: Observer | Observe the completion. | - | - | -`);
    const rowPin = sha256(`Names: Remote observer\nKind: service\nSide: world\nSeam: request-response\nIsolation: -\nReads: -\nWrites: -\nCites: ${hash}`);
    await accepted(dir, { 'models/tiny/parts/beta/journeys/observe/schedule.md': '| Entity | Value |\n| --- | --- |\n\n| Step | Bindings |\n| --- | --- |\n| 1 | none |\n\n| Field | Value |\n| --- | --- |\n| Meaning | The completion is observed. |\n\n```tla\nEnd == observed\n```\n' }, { pins: [{ entry: 'beta/actions/observe', pin: actionPin }, { entry: 'beta/journeys/observe', pin: journeyPin }] });
    await accepted(dir, { 'models/tiny/world/beta/remote/drop.tla': 'Target == x = 1\n' }, { pins: [{ entry: 'beta/boundary/remote', pin: rowPin }] });
    for (const ref of ['beta/claims/safe', 'beta/claims/other']) {
      await decide(dir, 'confirm', ref);
      await accepted(dir, { [`models/tiny/parts/beta/claims/${ref.split('/').at(-1)}/encoding.tla`]: 'Invariant == x = 0\n' }, { pins: [{ entry: ref, pin: await claimPin(dir, ref) }] });
    }
    ok(forma(dir, ['run', '--json']));
    const surprises = await surpriseRecords(dir);
    assert.equal(surprises.length, 2);
    for (const s of surprises) assert.ok(s.data.trace.states.some((state) => state.rows?.some((row) => row.misbehaviour === 'beta/remote/drop')));
    assert.deepEqual(waiting(dir), [surprises[0].name]);
  });
});

describe('decisions.md §rulings — same-question basis ordering', () => {
  test('decisions.md §rulings two failures of one question are distinct and ordered by their basis digests', async () => {
    // decisions.md §rulings orders same-question failures by basis; evidence.md §surprise-file makes a changed basis a distinct surprise.
    const { dir, surprises } = await rulingBase({ shared: true });
    const old = surprises[0];
    const files = await snapshot(dir);
    for (const path of Object.keys(files)) if (path.includes('.surprise-') || path === `models/${old.data.question}.json`) delete files[path];
    const clone = await project(null, files);
    const slot = 'models/lifecycles-alpha/parts/alpha/claims/safe/fault-unchanged.md';
    const receipt = (await read(clone, slot.slice(0, slot.lastIndexOf('/')) + '/receipt')).trim().split('\n').map(JSON.parse).find((entry) => entry.file === 'fault-unchanged.md');
    await accepted(clone, { [slot]: (await read(clone, slot)).replace('The unchanged waiting step.', 'The still unchanged waiting step.') }, { pins: receipt.pins });
    ok(forma(clone, ['run', '--json']));
    const fresh = (await surpriseRecords(clone))[0];
    assert.ok(fresh && fresh.data.question === old.data.question && fresh.basis !== old.basis);
    await writeFiles(dir, { [fresh.path]: await read(clone, fresh.path) });
    await explain(dir, fresh);
    const ordered = [old, fresh].sort((a, b) => a.basis < b.basis ? -1 : 1);
    assert.deepEqual(waiting(dir), [ordered[0].name]);
    const r = await rule(dir, waiting(dir));
    assert.deepEqual(dataRows(section(r.records[0].text, 'Surprises'), ['Surprise', 'Question', 'Basis', 'Parts', 'Expected', 'Found']).map((row) => row.Surprise), ordered.map((s) => s.name));
  });
});

describe('decisions.md §expects — repair evidence and multiple models', () => {
  test('decisions.md §expects property-wrong encoding repairs remain owed on each unrepaired model', async () => {
    // decisions.md §rulings, §expects: the encoding route meets the ruling only on every model its claim surprises ran on.
    // models.md §model-repair requires each accepted model repair to change a ruled input and preserve that model's own files.
    const { dir } = await rulingBase();
    await betaEvidence(dir);
    const fault = 'models/lifecycles-beta/parts/beta/claims/safe/fault-return.md';
    const line = (await read(dir, fault.slice(0, fault.lastIndexOf('/')) + '/receipt')).trim().split('\n').map(JSON.parse).find((line) => line.file === 'fault-return.md');
    await accepted(dir, { [fault]: (await read(dir, fault)).replace('| observation | observed | observe | pending |', '| observation | observed | observe | None. |') }, { pins: line.pins });
    ok(forma(dir, ['run', '--json']));
    const surprises = await surpriseRecords(dir);
    assert.equal(surprises.length, 2);
    for (const s of surprises) if (s.data.question.startsWith('lifecycles-beta/')) await explain(dir, s);
    const d = (await rule(dir, waiting(dir), 'property wrong')).records[0];
    for (const [index, part] of ['alpha', 'beta'].entries()) {
      const remaining = itemNames(dir).filter((name) => name.startsWith(`repair:${d.name}`));
      const item = remaining.find((name) => name.endsWith(`/lifecycles-${part}`)) ?? remaining.find((name) => name === `repair:${d.name}`);
      assert.ok(item);
      const life = part === 'alpha' ? 'request' : 'observation';
      const phase = part === 'alpha' ? 'done' : 'observed';
      const modelPage = pathOf(`${part}/lifecycles/${life}`);
      const before = await read(dir, modelPage);
      const path = `models/lifecycles-${part}/parts/${part}/claims/safe/encoding.md`;
      const folder = await answerFolder({ [path]: `| Lifecycle | Phase |\n| --- | --- |\n| ${life} | ${phase} |\n`, 'repair.md': table([['Mechanism', 'Correct the prohibited phase.']]) });
      assert.equal(ok(forma(dir, ['answer', item, folder, ...sessionArgs(AUTHOR), '--json'])).accepted, true);
      assert.equal(await read(dir, modelPage), before);
      const receipt = (await read(dir, path.slice(0, path.lastIndexOf('/')) + '/receipt')).trim().split('\n').map(JSON.parse).find((line) => line.file === 'encoding.md');
      assert.ok(receipt.answers.includes(d.name));
      assert.equal(itemNames(dir).some((name) => name.startsWith(`repair:${d.name}`)), index === 0);
    }
  });
  test('decisions.md §expects an offered journey decline requires its lifecycle part repair and is offered afresh after that lifecycle changes', async () => {
    // decisions.md §expects: unlike a picked or kept journey, an offered decline sends a repair of its lifecycle's part.
    // design.md §code-journeys regenerates the declined offer; door.md §repair-answer refuses an answer that does not meet its decision.
    const dir = await base({ omit: ['design/parts/alpha/journeys/complete', 'design/spans/together/journeys/observe'] });
    await decide(dir, 'confirm', LIFE);
    const ref = 'alpha/journeys/reach-request--done';
    const decline = (await decide(dir, 'decline', ref, ['--words', 'Reach completion through an intermediate phase.'])).records[0];
    const item = `repair:${decline.name}`;
    assert.ok(itemNames(dir).includes(item));
    const unrelated = await answerFolder({ [pathOf(CLAIM)]: (await read(dir, pathOf(CLAIM))).replace('completes safely', 'completes exactly once'), 'repair.md': table([['Mechanism', 'Clarify an unrelated claim.']]) });
    const before = await snapshot(dir, { skip: ['work', 'runs'] });
    const rejected = forma(dir, ['answer', item, unrelated, ...sessionArgs(AUTHOR), '--json']);
    assert.equal(rejected.status, 1);
    assert.ok(rejected.json, rejected.stderr);
    assert.equal(rejected.json.accepted, false);
    assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
    assert.ok(itemNames(dir).includes(item));
    const page = (await read(dir, pathOf(LIFE))).replace('| ready | done | ready |', '| ready | middle | ready |\n| middle | done | middle |');
    const folder = await answerFolder({ [pathOf(LIFE)]: page, 'repair.md': table([['Mechanism', 'Complete through the intermediate phase.']]) });
    assert.equal(ok(forma(dir, ['answer', item, folder, ...sessionArgs(AUTHOR), '--json'])).accepted, true);
    assert.ok(!itemNames(dir).includes(item));
    assert.ok(itemNames(dir).includes(`confirm:${LIFE}`));
    const line = JSON.parse((await read(dir, pathOf(LIFE).replace('README.md', 'receipt'))).trim());
    assert.ok(line.answers.includes(decline.name));
    await decide(dir, 'confirm', LIFE);
    const offer = await decide(dir, 'confirm', ref);
    assert.notEqual(offer.records[0].fields.Pin, decline.fields.Pin);
    assert.equal(dataRows(section(offer.records[0].text, 'Journey'), ['Step', 'Actor', 'Action', 'Arguments', 'Entity', 'Case']).length, 2);
    assert.equal(await read(dir, decline.path), decline.text);
  });
  test('decisions.md §expects property wrong is met by refilling its claim encoding without rewriting the model or claim page', async () => {
    // decisions.md §rulings, §expects and models.md §model-repair permit an encoding repair on the model, whose receipt meets the ruling.
    // door.md §gives gives either repair kind; use the emitted item without imposing an unresolved dual-route suffix choice.
    const { dir } = await rulingBase();
    const d = (await rule(dir, waiting(dir), 'property wrong')).records[0];
    const item = itemNames(dir).find((name) => name.startsWith(`repair:${d.name}`));
    assert.ok(item);
    const path = 'models/lifecycles-alpha/parts/alpha/claims/safe/encoding.md';
    const before = await read(dir, path);
    const model = await read(dir, pathOf(LIFE));
    const claim = await read(dir, pathOf(CLAIM));
    const folder = await answerFolder({ [path]: '| Lifecycle | Phase |\n| --- | --- |\n| request | done |\n', 'repair.md': table([['Mechanism', 'Forbid the completed phase rather than a return transition.']]) });
    assert.equal(ok(forma(dir, ['answer', item, folder, ...sessionArgs(AUTHOR), '--json'])).accepted, true);
    const line = (await read(dir, path.slice(0, path.lastIndexOf('/')) + '/receipt')).trim().split('\n').map(JSON.parse).find((line) => line.file === 'encoding.md');
    assert.ok(line.answers.includes(d.name));
    assert.equal(line.before, sha256(before));
    assert.equal(line.sha256, sha256(await read(dir, path)));
    assert.equal(await read(dir, pathOf(LIFE)), model);
    assert.equal(await read(dir, pathOf(CLAIM)), claim);
    assert.ok(!itemNames(dir).some((name) => name.startsWith(`repair:${d.name}`)));
    assert.ok(!itemNames(dir).includes(`confirm:${CLAIM}`));
  });
  for (const change of ['model only', 'encoding and model', 'fault only']) {
    test(`decisions.md §expects property wrong refuses a model repair changing ${change}`, async () => {
      // models.md §model-repair requires the ruled claim's encoding to change, with none of the model's own files changed.
      const { dir } = await rulingBase();
      const d = (await rule(dir, waiting(dir), 'property wrong')).records[0];
      const item = itemNames(dir).find((name) => name.startsWith(`repair:${d.name}`));
      assert.ok(item);
      const files = { 'repair.md': table([['Mechanism', 'Attempt the wrong property repair.']]) };
      if (change.includes('model')) files[pathOf(LIFE)] = (await read(dir, pathOf(LIFE))).replace('| done | None. | done |', '| done | None. | None. |');
      if (change.includes('encoding')) files['models/lifecycles-alpha/parts/alpha/claims/safe/encoding.md'] = '| Lifecycle | Phase |\n| --- | --- |\n| request | done |\n';
      if (change === 'fault only') files['models/lifecycles-alpha/parts/alpha/claims/safe/fault-unchanged.md'] = table([['Action', '-'], ['Mechanism', 'An altered defect.']]) + '\n| Lifecycle | Phase | Action | Outcome |\n| --- | --- | --- | --- |\n| request | done | wait | ready |\n';
      const before = await snapshot(dir, { skip: ['work', 'runs'] });
      const answer = await answerFolder(files);
      const result = forma(dir, ['answer', item, answer, ...sessionArgs(AUTHOR), '--json']);
      assert.equal(result.status, 1);
      assert.ok(result.json, result.stderr);
      assert.equal(result.json.accepted, false);
      if (change !== 'model only') assert.ok(result.json.reasons.length > 0);
      assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
      assert.ok(itemNames(dir).some((name) => name.startsWith(`repair:${d.name}`)));
    });
  }
  for (const verdict of ['model wrong', 'real finding']) {
    test(`decisions.md §expects ${verdict} refuses a repair that only adds a slot the ruled question never read`, async () => {
      // models.md §model-repair now requires changing a held input in a ruled question's basis; a new fault is insufficient even with the required mechanism.
      const { dir } = await rulingBase();
      const d = (await rule(dir, waiting(dir), verdict, verdict === 'real finding' ? ['--target', 'lifecycles-alpha'] : [])).records[0];
      const item = `repair:${d.name}/lifecycles-alpha`;
      const mechanism = 'A waiting step cannot return completed requests.';
      const folder = await answerFolder({
        'models/lifecycles-alpha/parts/alpha/claims/safe/fault-rulings2-added.md': table([['Action', '-'], ['Mechanism', mechanism]]) + '\n| Lifecycle | Phase | Action | Outcome |\n| --- | --- | --- | --- |\n| request | done | wait | ready |\n',
        'repair.md': table([['Mechanism', mechanism]]),
      });
      const before = await snapshot(dir, { skip: ['work', 'runs'] });
      const result = forma(dir, ['answer', item, folder, ...sessionArgs(AUTHOR), '--json']);
      assert.equal(result.status, 1);
      assert.ok(result.json, result.stderr);
      assert.equal(result.json.accepted, false);
      assert.ok(result.json.reasons.length > 0);
      assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
      assert.ok(itemNames(dir).includes(item));
    });
  }
  for (const heldModelPage of ['omitted', 'unchanged', 'changed']) {
    test(`decisions.md §expects a slot repair with the frozen model page ${heldModelPage} respects another claim's open surprise`, async () => {
      // models.md §model-repair, §freeze allow an unfrozen claim-slot repair, but an answer holding another surprise's held page is refused whatever its bytes.
      const { dir, surprises } = await rulingBase({ refs: [CLAIM, 'alpha/claims/dependent'] });
      const first = surprises.find((s) => s.data.question.includes('/safe/'));
      const other = surprises.find((s) => s.data.question.includes('/dependent/'));
      assert.ok(first && other);
      const d = (await rule(dir, [first.name])).records[0];
      const item = `repair:${d.name}/lifecycles-alpha`;
      const path = 'models/lifecycles-alpha/parts/alpha/claims/safe/fault-unchanged.md';
      const files = { [path]: table([['Action', '-'], ['Mechanism', 'Catch an unsafe return transition.']]) + '\n| Lifecycle | Phase | Action | Outcome |\n| --- | --- | --- | --- |\n| request | done | wait | ready |\n', 'repair.md': table([['Mechanism', 'Catch an unsafe return transition.']]) };
      if (heldModelPage !== 'omitted') files[pathOf(LIFE)] = heldModelPage === 'unchanged' ? await read(dir, pathOf(LIFE)) : (await read(dir, pathOf(LIFE))).replace('| done | None. | done |', '| done | None. | None. |');
      const before = await snapshot(dir, { skip: ['work', 'runs'] });
      const folder = await answerFolder(files);
      const result = forma(dir, ['answer', item, folder, ...sessionArgs(AUTHOR), '--json']);
      if (heldModelPage === 'omitted') {
        assert.equal(ok(result).accepted, true);
        assert.ok(!itemNames(dir).includes(item));
      } else {
        assert.equal(result.status, 1);
        assert.ok(result.json, result.stderr);
        assert.equal(result.json.accepted, false);
        assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
        assert.ok(itemNames(dir).includes(item));
      }
      assert.ok(waiting(dir).includes(other.name));
      assert.equal(await read(dir, other.path), before[other.path]);
    });
  }
  // decisions.md §expects ignores markers with unchanged before and sha256; account.md §items keeps the model repair item.
  test('decisions.md §expects an unchanged receipt marker does not meet a model repair', async () => {
    const { dir } = await rulingBase();
    const d = (await rule(dir, waiting(dir))).records[0];
    const path = 'models/lifecycles-alpha/parts/alpha/claims/safe/encoding.md';
    const bytes = await read(dir, path);
    const old = (await read(dir, path.slice(0, path.lastIndexOf('/')) + '/receipt')).trim().split('\n').map(JSON.parse).find((entry) => entry.file === 'encoding.md');
    await accepted(dir, { [path]: bytes }, { pins: old.pins, answers: [d.name], mechanisms: [{ decision: d.name, mechanism: 'A mark with no change.' }], before: sha256(bytes) });
    assert.ok(itemNames(dir).includes(`repair:${d.name}/lifecycles-alpha`));
  });
  // decisions.md §rulings, §expects; account.md §items fixes one repair per model; models.md §model-repair fixes this slot repair.
  test('decisions.md §expects one ruling owes a separate repair for every model and partial repair leaves the other owed', async () => {
    const { dir } = await rulingBase();
    await betaEvidence(dir);
    const slot = 'models/lifecycles-beta/parts/beta/claims/safe/fault-return.md';
    const old = (await read(dir, slot.slice(0, slot.lastIndexOf('/')) + '/receipt')).trim().split('\n').map(JSON.parse).find((entry) => entry.file === 'fault-return.md');
    await accepted(dir, { [slot]: (await read(dir, slot)).replace('| observation | observed | observe | pending |', '| observation | observed | observe | None. |') }, { pins: old.pins });
    ok(forma(dir, ['run', '--json']));
    const surprises = await surpriseRecords(dir);
    assert.equal(surprises.length, 2);
    for (const s of surprises) if (s.data.question.startsWith('lifecycles-beta/')) await explain(dir, s);
    const d = (await rule(dir, waiting(dir))).records[0];
    assert.deepEqual(itemNames(dir).filter((name) => name.startsWith(`repair:${d.name}`)).sort(), [`repair:${d.name}/lifecycles-alpha`, `repair:${d.name}/lifecycles-beta`]);
    const folder = await answerFolder({
      'models/lifecycles-alpha/parts/alpha/claims/safe/fault-unchanged.md': table([['Action', '-'], ['Mechanism', 'A waiting step cannot return completed requests.']]) + '\n| Lifecycle | Phase | Action | Outcome |\n| --- | --- | --- | --- |\n| request | done | wait | ready |\n',
      'repair.md': table([['Mechanism', 'A waiting step cannot return completed requests.']]),
    });
    assert.equal(ok(forma(dir, ['answer', `repair:${d.name}/lifecycles-alpha`, folder, ...sessionArgs(AUTHOR), '--json'])).accepted, true);
    assert.deepEqual(itemNames(dir).filter((name) => name.startsWith(`repair:${d.name}`)), [`repair:${d.name}/lifecycles-beta`]);
  });
});

describe('presentation.md §showings — added and removed showing blocks', () => {
  // presentation.md §showings: new block names and removed text appear;
  // the old showing remains whole, with no guessed diff punctuation.
  test('presentation.md §showings a lapsed unit names new blocks and retains the complete removed block in its comparison', async () => {
    const dir = await base();
    const d = (await decide(dir, 'confirm', 'alpha/stated')).records[0];
    const oldPath = pathOf('alpha/claims/stated');
    const page = await read(dir, oldPath);
    const files = await snapshot(dir);
    delete files[oldPath];
    delete files[oldPath.replace('README.md', 'receipt')];
    const changed = await project(null, files);
    await accepted(changed, { [pathOf('alpha/claims/replacement')]: page.replace('# Safe completion', '# Replacement obligation').replace('A completion is recorded.', 'A completion is acknowledged once.') });
    const s = show(changed, 'confirm', 'alpha/stated');
    assert.ok(s.shown.includes(d.name));
    assert.ok(s.shown.includes('A completion is recorded.'));
    assert.ok(s.shown.includes('A completion is acknowledged once.'));
    assert.match(s.shown, /replacement/i);
    assert.equal(await read(changed, d.path), d.text);
  });
});

describe('decisions.md §kept-journeys — span ownership and liveness exclusion', () => {
  test('decisions.md §kept-journeys a kept journey stays in the span where its claim was filed', async () => {
    // decisions.md §kept-journeys fixes span ownership, rows and confirmation; decisions.md §filing files the ruling with its claim; forms.md §page-rules qualifies span actions.
    const ref = 'together/claims/safe';
    const { dir, surprises } = await rulingBase({ violation: true, refs: [ref], prepare: async (dir) => {
      await accepted(dir, { [pathOf(ref)]: (await read(dir, pathOf(ref))).replace('| Parts | alpha, beta |', '| Parts | alpha |') });
    } });
    const s = surprises.find((entry) => entry.data.kind === 'base');
    const d = (await rule(dir, [s.name])).records[0];
    const journey = `together/journeys/kept-${s.basis.slice(0, 12)}`;
    assert.ok(d.path.startsWith('design/spans/together/claims/safe/decisions/'));
    assert.equal(fieldsOf(section(d.text, 'Kept')).Journey, journey);
    assert.deepEqual(dataRows(section(d.text, 'Kept'), ['Step', 'Actor', 'Action', 'Arguments', 'Entity', 'Case']), [{ Step: '1', Actor: 'Worker', Action: 'alpha/advance', Arguments: '-', Entity: '-', Case: '-' }]);
    assert.equal(await read(dir, pathOf(journey)), null);
    assert.equal(decisionEntry(dir, journey, d.name).state, 'in force');
  });
  test('decisions.md §kept-journeys a nonempty liveness counterexample is not kept as a finite must-not journey', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // decisions.md §kept-journeys excludes liveness despite a nonempty trace; evidence.md §outcomes, engines.md §trace fixes its property and states.
    const { dir, surprise } = await nativeSurprise({ liveness: true });
    assert.equal(surprise.data.found.property, 'Property');
    assert.ok(surprise.data.trace.states.length >= 2);
    resultPaths(forma(dir, ['decide', 'allow', '--runs', '20', ...identity(), '--json']));
    ok(forma(dir, ['run', '--json']));
    const d = (await rule(dir, [surprise.name])).records[0];
    const kept = section(d.text, 'Kept');
    assert.ok(kept.includes(`### ${surprise.name}\n`));
    assert.ok(fieldsOf(kept)['Not kept']);
    assert.ok(!Object.hasOwn(fieldsOf(kept), 'Journey'));
  });
});

describe('decisions.md §confirm to §pick — newly explicit own-form checks at read', () => {
  test('decisions.md §confirm a should-happen journey with a numbered refused step is a change and cannot be confirmed', async () => {
    const dir = await base();
    const ref = 'alpha/journeys/complete';
    const path = pathOf(ref);
    await accepted(dir, { [path]: (await read(dir, path)).replace('| Refused step | - |', '| Refused step | 1 |') });
    // design.md §at-read makes this an own-form failure, rather than a resolution
    // failure left as restate:. decisions.md §forma-show refuses a subject that is absent.
    assert.ok(itemNames(dir).includes(`change:${path}`));
    refused(forma(dir, ['show', 'confirm', ref, '--json']));
  });

  test('decisions.md §pick identical choice alternatives are a change and cannot be picked', async () => {
    const dir = await base();
    const path = pathOf(CHOICE);
    await accepted(dir, { [path]: (await read(dir, path)).replace('| 1 | Worker | wait |', '| 1 | Worker | advance |') });
    // forms.md §choices, design.md §at-read explicitly puts differing alternatives in the
    // page's own form. decisions.md §forma-show refuses picking a page read as absent.
    assert.ok(itemNames(dir).includes(`change:${path}`));
    refused(forma(dir, ['show', 'pick', CHOICE, '--json']));
  });
});

// presentation.md §showings: action meanings appear once at the head; entries refer to
// their keys, and Rests on refers to named premises whose meanings have one block.
describe('presentation.md §showings actions and premises blocks', () => {
  test('presentation.md §showings: lifecycle actions have one ordered block and cells use keys', async () => {
    const dir = await base();
    const shown = show(dir, 'confirm', LIFE).shown;
    assert.equal(shown.split('\n').find((line, i) => i > 0 && line.trim()), 'Actions:');
    const advance = '  alpha/advance | Complete the request. | none | none';
    const wait = '  alpha/wait | Leave the request unchanged. | none | none';
    assert.ok(shown.includes(advance));
    assert.ok(shown.includes(wait));
    assert.ok(shown.indexOf(advance) < shown.indexOf(wait));
    assert.equal(shown.split('Complete the request.').length - 1, 1);
    assert.equal(shown.split('Leave the request unchanged.').length - 1, 1);
    assert.ok(shown.includes('advance') && shown.includes('wait'));
  });

  test('presentation.md §showings: a shared premise changes once and dependent claims keep names in Rests on', async () => {
    const dir = await base();
    const first = 'alpha/claims/stated', second = 'alpha/claims/dependent';
    await accepted(dir, {
      [pathOf(first)]: (await read(dir, pathOf(first))).replace('| Rests on | none |', '| Rests on | reliable |'),
      [pathOf(second)]: (await read(dir, pathOf(second))).replace('| Origin | added |', '| Origin | stated |'),
    });
    const shown = show(dir, 'confirm', 'alpha/stated').shown;
    assert.ok(shown.includes('Premises:\n  alpha/premises/reliable | The worker behaves reliably.'));
    assert.equal(shown.split('The worker behaves reliably.').length - 1, 1);
    assert.equal(shown.split('  Rests on: alpha/premises/reliable').length - 1, 2);
    const old = (await decide(dir, 'confirm', 'alpha/stated')).records[0];
    await accepted(dir, { [pathOf(PREMISE)]: (await read(dir, pathOf(PREMISE))).replace('The worker behaves reliably.', 'The worker reports every completion.') });
    const changed = show(dir, 'confirm', 'alpha/stated').shown;
    const delta = 'alpha/premises/reliable: The worker behaves reliably. → The worker reports every completion.';
    assert.equal(changed.split(delta).length - 1, 1);
    assert.ok(changed.includes(old.name));
    assert.ok(changed.includes(old.fields.At));
    // presentation.md §showings: name the dependent blocks under the premise's change, without
    // choosing labels for the comparison's headings or unchanged-block count.
    const dependentHeaders = [];
    let header;
    for (const line of shown.split('\n')) {
      if (line && !line.startsWith(' ')) header = line;
      if (line === '  Rests on: alpha/premises/reliable') dependentHeaders.push(header);
    }
    assert.equal(dependentHeaders.length, 2);
    for (const header of dependentHeaders) assert.ok(changed.slice(changed.indexOf(delta)).includes(header));
    assert.ok(!changed.includes('Rests on: The worker'));
  });
});

// presentation.md §showings, decisions.md §pick and design.md §code-journeys: before choosing, each alternative
// previews every journey that its pick would confirm, including the negative.
describe('decisions.md §pick added journey previews', () => {
  test('decisions.md §pick: a pick showing lists the positive and negative journey for each alternative', async () => {
    const dir = await base();
    const shown = show(dir, 'pick', CHOICE).shown;
    const blocks = [];
    for (const line of shown.split('\n')) {
      if (line && !line.startsWith(' ')) blocks.push({ head: line, text: '' });
      else if (blocks.length) blocks.at(-1).text += `${line}\n`;
    }
    for (const [key, polarity, action, refused] of [
      ['policy-a', 'should happen', 'advance', '-'], ['policy-not-b', 'must not', 'wait', '1'],
      ['policy-b', 'should happen', 'wait', '-'], ['policy-not-a', 'must not', 'advance', '1'],
    ]) {
      const block = blocks.find(row => row.head.includes(key));
      assert.ok(block, key);
      assert.ok(block.text.includes(`Polarity: ${polarity}`));
      assert.ok(block.text.includes(`Refused step: ${refused}`));
      assert.ok(block.text.includes('Expected end: ' + (polarity === 'must not' ? '-' : 'The policy is followed.')));
      assert.ok(block.text.includes(`1 | Worker | ${action} | - | - | -`));
    }
  });
  test('decisions.md §pick: alternatives differing at two steps preview no derived must-not journey', async () => {
    const dir = await base();
    const bytes = (await read(dir, pathOf(CHOICE)))
      .replace('| 1 | Worker | advance | - | - | - |', '| 1 | Worker | advance | - | - | - |\n| 2 | Worker | wait | - | - | - |')
      .replace('| 1 | Worker | wait | - | - | - |', '| 1 | Worker | wait | - | - | - |\n| 2 | Worker | advance | - | - | - |');
    await accepted(dir, { [pathOf(CHOICE)]: bytes });
    const shown = show(dir, 'pick', CHOICE).shown;
    assert.ok(shown.includes('policy-a') && shown.includes('policy-b'));
    assert.ok(!shown.includes('policy-not-a') && !shown.includes('policy-not-b'));
  });
});
