import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { forma, project, read, snapshot, writeFiles, sha256, hasToolchain } from './helpers/forma.mjs';

// These fixtures are handwritten inputs. Pins, receipts and decision names below
// implement the cited contract rules, never values learned from Forma output.
// Actual lifecycle runs are test actions, not a source of fixture expectations.
const CITE = 'design/brief/ticket.md#ticket';
const CLAIM = 'p/claims/sticks';
const LIFE = 'p/lifecycles/state';
const JOURNEY = 'p/journeys/complete';
const MODEL = 'lifecycles-p';
// account.md §items names slot items from models/, while files keep that folder.
const SLOT = `models/${MODEL}/parts/p/claims/sticks`;
const QUESTION = `${MODEL}/parts/p/claims/sticks`;
const CP = 'design/parts/p/claims/sticks/README.md';
const LP = 'design/parts/p/lifecycles/state/README.md';
const JP = 'design/parts/p/journeys/complete/README.md';
const PP = 'design/parts/p/premises/trust/README.md';
const WHEN = '2020-01-01T00:00:01.500Z';
const WRITER = { provider: 'fixture', model: 'writer', session: 'restatement' };
// account.md §cannot-know: the nine sentences, verbatim.
const CANNOT_KNOW = [
  'An engine checks the encoding, not its fidelity to the design; fidelity rests only on the journeys a model passes.',
  'A result holds within its stated bounds only, and a lifecycle engine result at phase level only.',
  'A `CHOOSE` in a model that its bounds do not record as a trade is not seen.',
  'Staleness follows citations, so a dependence nobody cited is not tracked.',
  'An interaction nobody wrote down is not found.',
  'Who wrote a brief passage is not recorded.',
  'Who made a decision is as declared, and is not checked; so is the session an agent declares with an answer.',
  'What one machine spent or refused is not known to another, and a session known only by answers refused is known only where it submitted.',
  'What an agent spends inside its own work is not seen: only the answers it submits count against the allowance.',
];
// door.md §copies: tracked-byte preservation and receipt union rules.
const DESIGN_ATTRIBUTES = '* -text -ident -filter -working-tree-encoding\nreceipt merge=union\nbrief/** !text !ident !filter !working-tree-encoding !merge\n';
const MODEL_ATTRIBUTES = '* -text -ident -filter -working-tree-encoding\n*.json -merge\nreceipt merge=union\n';
const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;
const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
const required = (value, names) => names.forEach((name) => assert.ok(Object.hasOwn(value, name), `missing ${name}`));
const table = (columns, rows) => `| ${columns.join(' | ')} |\n| ${columns.map(() => '---').join(' | ')} |\n${rows.map((r) => `| ${r.join(' | ')} |\n`).join('')}`;
const fields = (rows) => table(['Field', 'Value'], rows);
const page = (name, rows) => `# ${name}\n\n${fields(rows)}`;
function field(text, name) {
  return text?.split('\n').find((line) => line.startsWith(`| ${name} | `))?.split('|')[2].trim();
}
function replaceField(text, name, value) {
  return text.replace(new RegExp(`^\\| ${name} \\| .* \\|$`, 'm'), `| ${name} | ${value} |`);
}

// design.md §passages; design.md §pins: this fixture has a heading and one paragraph, and
// deliberately simple fields. Only its known references need substitution.
function fixturePins(files) {
  const brief = files['design/brief/ticket.md'];
  const passage = sha256(brief.trim().split(/\n\s*\n/).map((s) => s.replace(/\p{White_Space}+/gu, ' ').trim()).join('\n\n'));
  const cite = (value) => value === CITE ? passage : `missing ${value}`;
  const hash = (lines) => sha256(lines.join('\n'));
  // design.md §pins: every part row contributes, sorted by content.
  const partRows = files['design/README.md'].split('\n').filter((s) => /^\| [a-z][a-z0-9-]* \|/.test(s));
  const result = { parts: hash(partRows.map((s) => {
    const [, , purpose, cites] = s.split('|').map((value) => value.trim());
    return `Purpose: ${purpose}\nCites: ${cites.split(', ').map(cite).sort().join(', ')}`;
  }).sort()) };
  const references = {
    p: 'Completes tickets.', q: 'Stores receipts.',
    ticket: 'Ticket (entity, machine, -, -)', worker: 'Ticket worker (service, machine, -, -)',
    finish: 'Complete the ticket.', reset: 'Reset the ticket.', tick: 'Observe the ticket.', trust: 'The worker reports completion faithfully.',
    'choice:route': 'choice Which completion path should be used?',
    'store:records': 'store Receipt store',
  };
  // design.md §pins: expand the simple fixture rows by their
  // current names/sentences, including additional entities and actions.
  for (const line of (files['design/parts/p/boundary.md'] ?? '').split('\n')) {
    const row = line.split('|').slice(1, -1).map((s) => s.trim());
    if (row.length === 10 && /^[a-z]/.test(row[0])) references[row[0]] = `${row[1]} (${row[2]}, ${row[3]}, ${row[4]}, ${row[5]})`;
  }
  for (const line of (files['design/parts/p/actions.md'] ?? '').split('\n')) {
    const row = line.split('|').slice(1, -1).map((s) => s.trim());
    if (row.length !== 7 || !/^[a-z]/.test(row[0])) continue;
    const [key, actor, sentence, cases, guard, , cites] = row;
    references[key] = `${sentence}${cases === 'none' ? '' : ` (cases ${cases})`}${guard === 'none' ? '' : ` (guard ${guard})`}`;
    result[`p/actions/${key}`] = hash([`Actor: ${references[actor]}`, `Sentence: ${sentence}`, `Cases: ${cases === 'none' ? '' : cases.split(', ').sort().join(', ')}`, `Guard: ${guard}`, `Cites: ${cites.split(', ').map(cite).sort().join(', ')}`]);
  }
  function ordinary(path, order, lists = []) {
    return order.map((name) => {
      let value = field(files[path], name);
      if (name === 'Cites') value = value.split(', ').map(cite).sort().join(', ');
      else if (lists.includes(name)) value = value === 'none' ? '' : value.split(', ').map((x) => references[x] ?? x).sort().join(', ');
      else if (['Entity', 'Actor'].includes(name)) value = references[value] ?? value;
      return `${name}: ${value}`;
    });
  }
  if (files[CP]) result[CLAIM] = hash(ordinary(CP, ['Sentence', 'Kind', 'Stake', 'Rests on', 'Parts', 'Cites'], ['Rests on', 'Parts']));
  if (files[PP]) result['p/premises/trust'] = hash(ordinary(PP, ['Statement', 'Class', 'Why not examined', 'Falsifier', 'Provider', 'Cites']));
  for (const path of Object.keys(files).filter((path) => /^design\/parts\/p\/lifecycles\/[^/]+\/README\.md$/.test(path))) {
    // forms.md §lifecycles: Phase may be any column. These hand-built
    // fixture matrices contain no escaped pipes or code spans.
    const lines = files[path].split('\n');
    const start = lines.findIndex((s) => s.startsWith('|') && s.split('|').some((cell) => cell.trim() === 'Phase'));
    const columns = lines[start].split('|').slice(1, -1).map((s) => s.trim());
    const phaseIndex = columns.indexOf('Phase');
    const cells = lines.slice(start + 2).filter((s) => s.startsWith('|')).flatMap((s) => {
      const values = s.split('|').slice(1, -1).map((x) => x.trim());
      return columns.flatMap((action, i) => i === phaseIndex ? [] : [`Cell: ${values[phaseIndex]} | ${references[action]} | ${values[i] === 'choice:route' ? 'choice Which completion path should be used?' : values[i] || '(empty)'}`]);
    }).sort();
    result[path.slice('design/parts/'.length, -'/README.md'.length)] = hash([...ordinary(path, ['Entity', 'Initial', 'Ends', 'Unaffected', 'Cites'], ['Ends', 'Unaffected']), ...cells]);
  }
  if (files[JP]) {
    const steps = files[JP].split('\n').filter((s) => /^\| \d+ \|/.test(s)).map((s) => {
      const [, n, actor, action, args, entity, which] = s.split('|').map((x) => x.trim());
      return `Step ${n}: ${actor} | ${references[action] ?? action} | ${args} | ${entity} | ${which}`;
    });
    result[JOURNEY] = hash([...ordinary(JP, ['Polarity', 'Expected end', 'Refused step', 'Cites']), ...steps]);
  }
  if (result[CLAIM]) result.bound = hash([`Model: ${MODEL}`, `Claim: ${result[CLAIM]}`, 'Bound: phase level']);
  return result;
}

// door.md §receipts; models.md §slot-currency: accepted files get
// per-folder, sorted, compact JSONL receipts, including the final line feed.
function seal(files, pins, { writer = WRITER } = {}) {
  const folders = {};
  for (const [path, bytes] of Object.entries(files)) {
    if (path.includes('/decisions/') || path.startsWith('design/brief/') || path.endsWith('/receipt') || path.endsWith('/.gitattributes')) continue;
    if (!path.startsWith('design/') && !path.startsWith('models/')) continue;
    if (path.endsWith('.json')) continue;
    const split = path.lastIndexOf('/');
    const folder = path.slice(0, split);
    const line = { file: path.slice(split + 1), sha256: sha256(bytes), at: WHEN, session: writer, authors: [writer] };
    if (folder.startsWith(SLOT)) {
      const previous = files[`${folder}/receipt`]?.trimEnd().split('\n').map(JSON.parse).find((r) => r.file === line.file);
      line.pins = [CLAIM, LIFE].sort().map((entry) => ({ entry, pin: pins[entry] ?? previous?.pins?.find((p) => p.entry === entry)?.pin }));
    }
    if (path.endsWith('/model.md')) line.strikes = [];
    (folders[folder] ??= []).push(line);
  }
  for (const [folder, lines] of Object.entries(folders)) files[`${folder}/receipt`] = lines.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0).map((line) => JSON.stringify(line) + '\n').join('');
  files['design/.gitattributes'] = DESIGN_ATTRIBUTES;
  if (Object.keys(files).some((p) => p.startsWith('models/'))) files['models/.gitattributes'] = MODEL_ATTRIBUTES;
  return files;
}

// presentation.md §showings: known fixture subjects, in entry and passage blocks. Block
// labels are not prescribed; the fields, references, table and picture are.
function showing(files, kind, on, rows, words) {
  const lines = [`${kind} ${on}`];
  if (kind === 'intake' || kind === 'allow') {
    lines.push('Choices', ...rows.map(([k, v]) => `  ${k}: ${v}`));
    if (words !== undefined) lines.push('Words', `  ${words}`);
    return lines.join('\n');
  }
  let path;
  if (on === CLAIM || on === `bound:${MODEL}/p/sticks` || on === 'bound:core/p/sticks') path = CP;
  else if (on === LIFE) path = LP;
  else if (on === JOURNEY) path = JP;
  else if (on === 'p/premises/trust') path = PP;
  if (on === 'parts') {
    for (const line of files['design/README.md'].split('\n').filter((s) => /^\| [a-z][a-z0-9-]* \|/.test(s))) {
      const [, key, purpose, cites] = line.split('|').map((s) => s.trim());
      lines.push(key, `  Purpose: ${purpose}`, `  Cites: ${cites}`);
    }
  } else if (path && files[path]) {
    // presentation.md §showings: these handwritten showings keep action meanings in
    // one head block; table rows and Rests on retain keys/names.
    if (on === LIFE || on === JOURNEY) {
      const actions = files['design/parts/p/actions.md'].split('\n')
        .filter(line => /^\| [a-z][a-z0-9-]* \|/.test(line))
        .map(line => line.split('|').slice(1, -1).map(cell => cell.trim()));
      const named = actions.filter(([key]) => files[path].split('\n').some(line =>
        line.startsWith('|') && line.split('|').some(cell => cell.trim() === key)));
      if (named.length) lines.push('Actions:', ...named.sort((a, b) => a[0] < b[0] ? -1 : 1)
        .map(([key, , sentence, cases, guard]) => `  p/${key} | ${sentence} | ${cases} | ${guard}`));
    }
    if (field(files[path], 'Rests on') === 'trust') lines.push('Premises:', `  p/premises/trust | ${field(files[PP], 'Statement')}`);
    lines.push(`${on.split('/')[1]} ${files[path].split('\n')[0].slice(2)}`);
    let inFields = false;
    for (const line of files[path].split('\n')) {
      if (line === '| Field | Value |') { inFields = true; continue; }
      if (!line.startsWith('|') || line.includes('---')) continue;
      const cells = line.split('|').slice(1, -1).map((s) => s.trim());
      if (inFields && cells.length === 2 && ['Phase', 'Step'].includes(cells[0])) inFields = false;
      if (inFields && ['Sentence', 'Kind', 'Stake', 'Rests on', 'Parts', 'Origin', 'Cites', 'Entity', 'Initial', 'Ends', 'Unaffected', 'Polarity', 'Expected end', 'Refused step', 'Statement', 'Class', 'Why not examined', 'Falsifier', 'Provider'].includes(cells[0])) {
        let value = cells[1];
        if (cells[0] === 'Entity') value = 'Ticket (entity, machine, -, -)';
        if (cells[0] === 'Parts') value = value === 'p' ? 'Completes tickets.' : value;
        if (cells[0] === 'Rests on' && value === 'trust') value = 'p/premises/trust';
        lines.push(`  ${cells[0]}: ${value}`);
      } else lines.push(`  ${cells.join(' | ')}`);
    }
    if (on === `bound:${MODEL}/p/sticks`) lines.push(`Bounds ${MODEL}`, '  phase level');
    if (on === 'bound:core/p/sticks') {
      lines.push('Bounds core');
      const bounds = files['models/core/model.md'].split('## Bounds\n')[1].split('\n## ')[0];
      lines.push(...bounds.trim().split('\n').filter((s) => s.startsWith('|') && !s.includes('---')).map((s) => `  ${s.slice(2, -2)}`));
    }
  }
  if (on.startsWith('strike:p/delivery/')) lines.push('boundary Delivery service', '  Kind: service', '  Side: world', '  Seam: request-response', `Strike ${on.slice('strike:p/delivery/'.length)}`, `  Falsifier: ${words}`);
  lines.push(`Cites ${CITE}:`, ...files['design/brief/ticket.md'].trimEnd().split('\n').map((s) => `  ${s}`));
  return lines.join('\n');
}

// decisions.md §decision-file; decisions.md §kinds; decisions.md §filing:
// decision bytes, pins, names and filing. The Shown fence's final LF is hashed.
function decision(files, { kind, on, pin, rows = [], words, folder, index = 1, at: recordedAt, by = 'Ada', shown, extra = '', afterShown = '' }) {
  shown ??= showing(files, kind, on, rows, words);
  const at = recordedAt ?? `2020-01-01T00:${String(Math.floor(index / 60)).padStart(2, '0')}:${String(index % 60).padStart(2, '0')}.000Z`;
  if (kind === 'intake' || kind === 'allow' || kind === 'rule') pin = sha256(`${shown}\n`);
  let text = page(`${kind} ${on}`, [['Kind', kind], ['On', on], ['Pin', pin], ...rows,
    ['Provider', 'fixture'], ['Model', 'developer'], ['Session', 'human-review'], ['By', by], ['At', at]]);
  if (words !== undefined) text += `\n## Words\n\n\`\`\`text\n${words}\n\`\`\`\n`;
  text += extra;
  text += `\n## Shown\n\n\`\`\`text\n${shown}\n\`\`\`\n`;
  // decisions.md §decision-file: Journey and Kept follow Shown in the fixed section order.
  text += afterShown;
  const name = `${at.replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}/, '')}-${kind}-${sha256(text).slice(0, 12)}`;
  if (!folder) {
    if (on === CLAIM || on === `bound:${MODEL}/p/sticks`) folder = 'design/parts/p/claims/sticks/decisions';
    else if (on === LIFE) folder = 'design/parts/p/lifecycles/state/decisions';
    else if (on === JOURNEY) folder = 'design/parts/p/journeys/complete/decisions';
    else if (on === 'p/premises/trust') folder = 'design/parts/p/premises/trust/decisions';
    else folder = 'design/decisions';
  }
  const path = `${folder}/${name}.md`;
  files[path] = text;
  return { name, path, at, by, words };
}
const allowanceRows = ({ answers = 100, runs = 100, seconds = 30, cadence = 'question', cap = 100 } = {}) => [
  ['Answers', answers], ['Runs', runs], ['TLC seconds', seconds], ['TLC megabytes', 256],
  ['Alloy seconds', seconds], ['Alloy megabytes', 256], ['Lifecycle seconds', seconds],
  ['Cadence', cadence], ['Inbox cap', cap],
];
function intake(files, opts) {
  return decision(files, { kind: 'intake', on: 'intake', rows: [['Situation', 'design new'], ...allowanceRows(opts)], words: 'Ticket completion only; billing is out of scope.' });
}

async function fixture(options = {}) {
  const source = await project('account/lifecycle');
  const files = await snapshot(source);
  const originalPins = fixturePins(files);
  if (options.noLifecycle) {
    for (const path of Object.keys(files)) if (path.startsWith('models/') || path === LP || path === JP || path.endsWith('/actions.md') || path.endsWith('/boundary.md')) delete files[path];
    files['design/parts/p/README.md'] = '# Tickets\n\n1. [Completion sticks](claims/sticks/)\n';
  }
  if (options.premise) {
    files[PP] = page('Faithful completion', [['Statement', 'The worker reports completion faithfully.'], ['Class', 'world'], ['Why not examined', 'not verifiable here'], ['Falsifier', 'A completion report disagrees with the ticket.'], ['Provider', 'Ticket operator'], ['Origin', 'added'], ['Cites', CITE]]);
    files[CP] = replaceField(files[CP], 'Rests on', 'trust');
  }
  for (const path of options.omit ?? []) delete files[path];
  options.edit?.(files);
  const pins = fixturePins(files);
  seal(files, { ...originalPins, ...pins }, options);
  const decisions = {};
  if (options.intake !== false) decisions.intake = intake(files, options);
  if (options.confirmParts !== false) decisions.parts = decision(files, { kind: 'confirm', on: 'parts', pin: pins.parts, index: 2 });
  if (files[LP] && options.confirmLifecycle !== false) decisions.lifecycle = decision(files, { kind: 'confirm', on: LIFE, pin: pins[LIFE], index: 3 });
  if (files[JP] && options.confirmJourney !== false) decisions.journey = decision(files, { kind: 'confirm', on: JOURNEY, pin: pins[JOURNEY], index: 4 });
  if (files[CP] && options.confirmClaim !== false) decisions.claim = decision(files, { kind: 'confirm', on: CLAIM, pin: pins[CLAIM], index: 5 });
  if (files[LP] && options.carryBound !== false) decisions.bound = decision(files, { kind: 'carry', on: `bound:${MODEL}/p/sticks`, pin: pins.bound, rows: [['Choice', 'carry'], ['Basis', '-']], words: 'A data-level behavior differs from this phase abstraction.', index: 6 });
  if (options.carryPremise) decisions.premise = decision(files, { kind: 'carry', on: 'p/premises/trust', pin: pins['p/premises/trust'], rows: [['Choice', 'carry'], ['Basis', options.basis ?? '-']], words: 'A completion report disagrees with the ticket.', index: 7 });
  if (options.accept) decisions.acceptance = decision(files, { kind: 'accept', on: CLAIM, pin: pins[CLAIM], rows: [['Choice', 'accept']], words: 'We accept duplicate processing during the pilot.', index: 8 });
  if (options.intake === false) for (const value of Object.values(decisions)) delete files[value.path];
  files['work/.gitignore'] = '*\n';
  const dir = await project(null, files);
  return { dir, files, pins, decisions };
}

function success(dir, args) {
  // project.md §commands: a completed command exits zero.
  const result = forma(dir, args);
  assert.equal(result.status, 0, `${args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}
function json(dir, args) {
  // project.md §commands; account.md §commands: one JSON object.
  const result = success(dir, [...args, '--json']);
  assert.ok(result.json && typeof result.json === 'object' && !Array.isArray(result.json), `expected one JSON object: ${result.stdout}`);
  return result.json;
}
const account = (dir, scope) => json(dir, ['account', ...(scope ? [scope] : [])]);
const missing = (dir) => json(dir, ['missing']).items;
const names = (items) => items.map((entry) => entry.item);
// presentation.md §reading; account.md §commands: embedded references have
// no prescribed wrapper. Compare fixed item names within just this field's
// serialized content, without choosing strings, objects, or a nested key.
const itemNames = (items) => JSON.stringify(items ?? null);
function item(items, name) {
  const entry = items.find((entry) => entry.item === name);
  assert.ok(entry, `missing item ${name}; got ${names(items).join(', ')}`);
  return entry;
}
function claim(reading, ref = CLAIM) {
  // presentation.md §reading: the three distinct claim headings each have their JSON list.
  const found = reading.parts.flatMap((p) => [...p.open, ...p.accepted, ...p.established]).find((entry) => entry.ref === ref);
  assert.ok(found, `claim ${ref} missing from reading`);
  return found;
}
function modelClaim(reading, model = MODEL) {
  const found = claim(reading).models.find((entry) => entry.model === model);
  assert.ok(found, `claim standing missing for ${model}`);
  return found;
}
function failure(reading, condition) {
  const found = modelClaim(reading).fails.find((entry) => entry.condition === condition);
  assert.ok(found, `expected ${condition} to fail`);
  return found;
}
async function examined(options = {}) {
  const result = await fixture(options);
  json(result.dir, ['run']);
  return result;
}
async function cloneWithout(dir, paths) {
  const files = await snapshot(dir, { skip: ['work', 'runs'] });
  for (const path of paths) delete files[path];
  return project(null, files);
}
async function refusal(dir, args) {
  const before = await snapshot(dir);
  const result = forma(dir, [...args, '--json']);
  assert.equal(result.status, 1);
  // project.md §commands; account.md §commands:
  // these read/invalid-command refusals give a reason and change nothing.
  // Do not use this helper for answer refusals, whose scratch records may change.
  assert.ok(result.json && typeof result.json === 'object' && !Array.isArray(result.json), `expected JSON refusal, got ${result.stdout}\n${result.stderr}`);
  assert.notEqual(JSON.stringify(result.json), '{}', 'a refusal must print why');
  assert.deepEqual(await snapshot(dir), before, 'a refused command changes nothing');
  return result.json;
}
function assertItem(entry, { supply, on, why }) {
  // account.md §commands: the complete item schema and optional fields.
  const expected = ['item', 'supply', 'on'];
  if (why !== undefined) expected.push('why');
  for (const optional of ['why', 'found', 'waits', 'refused']) if (Object.hasOwn(entry, optional) && !expected.includes(optional)) expected.push(optional);
  keys(entry, expected);
  assert.deepEqual(entry.supply, supply);
  assert.equal(entry.on, on);
  if (why !== undefined) assert.equal(entry.why, why);
}
const agent = (answer) => ({ by: 'agent', answer });
const developer = (decision, checkpoint) => ({ by: 'developer', decision, checkpoint });
const carried = developer('carry', 'carry or allow');

function addSpan(files, withClaim = false) {
  files['design/README.md'] = files['design/README.md'].replace(`| p | Completes tickets. | ${CITE} |`, `| p | Completes tickets. | ${CITE} |\n| q | Stores receipts. | ${CITE} |`);
  files['design/parts/q/README.md'] = '# Receipts\n';
  files['design/parts/p/boundary.md'] = (files['design/parts/p/boundary.md'] ?? '# Ticket boundary\n') + `\n## Surface\n\n${table(['Direction', 'Name', 'Cites'], [['emits', 'completed', CITE]])}`;
  files['design/parts/q/boundary.md'] = `# Receipt boundary\n\n## Surface\n\n${table(['Direction', 'Name', 'Cites'], [['consumes', 'p/completed', CITE]])}`;
  if (withClaim) files[CP] = replaceField(files[CP], 'Parts', 'p, q');
}

const MENU = ['drop', 'duplicate', 'delay', 'reorder', 'fail-forever', 'fail-then-succeed', 'crash', 'go-silent'];
function nativePins(f) {
  // design.md §pins: action and world-row fields in form order.
  const cites = sha256(f.files['design/brief/ticket.md'].trim().split(/\n\s*\n/).map((s) => s.replace(/\p{White_Space}+/gu, ' ').trim()).join('\n\n'));
  return {
    action: sha256(`Actor: Ticket worker (service, machine, -, -)\nSentence: Complete the ticket.\nCases: \nGuard: none\nCites: ${cites}`),
    world: sha256(`Names: Delivery service\nKind: service\nSide: world\nSeam: request-response\nIsolation: -\nReads: -\nWrites: -\nCites: ${cites}`),
  };
}
async function native(engine = 'tlc', options = {}) {
  const f = await fixture(options);
  Object.assign(f.files, await snapshot(await project(`account/${engine}`)));
  if (options.world) {
    f.files['design/parts/p/boundary.md'] += `| delivery | Delivery service | service | world | request-response | - | - | - | added | ${CITE} |\n`;
    const rows = MENU.map((name, i) => `| p/delivery | ${name} | World${i} | none |\n`).join('');
    f.files['models/core/model.md'] = f.files['models/core/model.md'].replace('\n\n## Phases', `\n${rows}\n## Phases`);
    f.files['models/core/Ticket.tla'] = f.files['models/core/Ticket.tla'].replace('====', MENU.map((_, i) => `World${i} == UNCHANGED vars\n`).join('') + '====');
    for (const name of MENU) f.files[`models/core/world/p/delivery/${name}.tla`] = 'Target == TRUE\n';
  }
  options.editNative?.(f.files);
  seal(f.files, f.pins);
  const extra = nativePins(f);
  for (const [path, bytes] of Object.entries(f.files)) if (path.startsWith('models/core/') && path.endsWith('/receipt')) {
    const lines = bytes.trimEnd().split('\n').map(JSON.parse);
    for (const line of lines) {
      let entries;
      if (path.includes('/claims/')) entries = [{ entry: CLAIM, pin: f.pins[CLAIM] }, ...(line.file.startsWith('fault-') ? [{ entry: 'p/actions/finish', pin: extra.action }] : [])];
      else if (path.includes('/journeys/')) entries = [{ entry: JOURNEY, pin: f.pins[JOURNEY] }, { entry: 'p/actions/finish', pin: extra.action }];
      else if (path.includes('/world/')) entries = [{ entry: 'p/boundary/delivery', pin: extra.world }];
      if (entries) line.pins = entries.sort((a, b) => a.entry < b.entry ? -1 : 1);
    }
    f.files[path] = lines.map((line) => JSON.stringify(line) + '\n').join('');
  }
  const bounds = f.files['models/core/model.md'].split('## Bounds\n')[1].split('\n## ')[0].split('\n')
    .filter((line) => line.startsWith('| ') && !line.startsWith('| Bound |') && !line.includes('---'))
    .map((line) => line.split('|').slice(1, -1).map((s) => s.trim()))
    .filter(([bound]) => !(engine === 'tlc' && field(f.files[CP], 'Kind') === 'liveness' && bound === 'constraint'))
    .map(([bound, value, meaning]) => `Bound: ${bound} | ${value} | ${meaning}`);
  f.decisions.coreBound = decision(f.files, { kind: 'carry', on: 'bound:core/p/sticks', pin: sha256([`Model: core`, `Claim: ${f.pins[CLAIM]}`, ...bounds].join('\n')), rows: [['Choice', 'carry'], ['Basis', '-']], words: 'Another ticket or trace length changes the result.', index: 9, folder: 'design/parts/p/claims/sticks/decisions' });
  f.dir = await project(null, f.files);
  return f;
}

// evidence.md §stems, §basis, §own-check, §surprise-file; models.md §lifecycle-model, §freeze:
// a deliberately old, but intact, surprise, with its freeze recorded separately.
// Openness does not depend on currency. Generated bytes are opaque here; no test
// claims that these historical hashes are current on this machine.
async function addSurprise(f, { question = `${QUESTION}/witness-done`, kind = 'witness', expected = { outcome: 'reached' }, found = { outcome: 'not reached' } } = {}) {
  // evidence.md §lifecycle-journeys, engines.md §lifecycle-engine, evidence.md §basis: the lifecycle model reads confirmed
  // lifecycles, actions, and the question's subject and slots.
  const pins = fixturePins(f.files);
  const lifecyclePaths = Object.keys(f.files).filter((path) => {
    if (!/^design\/parts\/p\/lifecycles\/[^/]+\/README\.md$/.test(path)) return false;
    const entry = path.slice('design/parts/'.length, -'/README.md'.length);
    return Object.entries(f.files).some(([p, text]) => p.includes('/decisions/') && field(text, 'Kind') === 'confirm' && field(text, 'On') === entry && field(text, 'Pin') === pins[entry]);
  });
  const claimQuestion = question.includes('/claims/');
  const slotPaths = Object.keys(f.files).filter((path) => path.startsWith(`${SLOT}/`) && /\/(?:encoding|witness-[^/]+|fault-[^/]+)\.md$/.test(path));
  const entries = [...Object.keys(pins).filter((entry) => entry.startsWith('p/actions/')), ...lifecyclePaths.map((path) => path.slice('design/parts/'.length, -'/README.md'.length)), claimQuestion ? CLAIM : JOURNEY];
  const readSlots = claimQuestion ? slotPaths.filter((path) => path === `${SLOT}/encoding.md` || path === `models/${question}.md`) : [];
  const basis = {
    // The historical composition recorded these project reads. Its precise
    // generated-file serialization is not asserted (engines.md §lifecycle-engine).
    files: [claimQuestion ? CP : JP, 'design/parts/p/actions.md', ...lifecyclePaths, ...readSlots].filter((path) => f.files[path]).sort().map((path) => ({ path, sha256: sha256(f.files[path]) })),
    entries: entries.sort().map((entry) => ({ entry, pin: pins[entry] })),
    engine: { name: 'lifecycle', version: '0.0.0' }, runtime: { name: 'node', version: 'v0.0.0' },
    library: { name: 'xstate', version: '0.0.0' }, forma: { version: '0.0.0', source: '000000000000' },
  };
  const digest = sha256(jsonText(basis));
  const name = `${question}.surprise-${digest.slice(0, 12)}`;
  // models.md §freeze; evidence.md §surprise-file: all claim slots are held, including
  // those not read by this question; a journey surprise holds no claim slots.
  const held = [...lifecyclePaths, ...(claimQuestion ? slotPaths : [])].sort().map((path) => ({ path, sha256: sha256(f.files[path]) }));
  const value = { name, question, kind, expected, bounds: 'phase level', limits: { seconds: 30 }, basis, held, found, matches: false,
    // evidence.md §measures: duration and only the lifecycle engine's measure.
    measures: { duration: 1, combinations: 2 }, flags: [], established: '2020-01-01T00:00:20.000Z' };
  f.files[`models/${name}.json`] = evidenceFile(value);
  await writeFiles(f.dir, { [`models/${name}.json`]: f.files[`models/${name}.json`] });
  return { name, question, digest, value };
}

// evidence.md §keys; evidence.md §own-check:
// hand-authored evidence uses the specified JSON digest.
function evidenceFile(value) {
  const whole = { ...value, digest: '' };
  whole.digest = sha256(jsonText(whole));
  return jsonText(whole);
}

function addChoice(files) {
  const alternative = (steps) => fields([['Polarity', 'should happen'], ['Expected end', 'The ticket is done.'], ['Refused step', '-']]) + '\n' + table(['Step', 'Actor', 'Action', 'Arguments', 'Entity', 'Case'], Array.from({ length: steps }, (_, i) => [i + 1, 'Ticket worker', 'finish', '-', '-', '-']));
  files['design/parts/p/choices/route/README.md'] = page('Completion route', [['Question', 'Which completion path should be used?'], ['Recommendation', 'a: Complete directly.'], ['Cites', CITE]]) + `\n## a\n\n${alternative(1)}\n## b\n\n${alternative(2)}`;
  files[CP] = replaceField(files[CP], 'Rests on', 'choice:route');
}
function choicePin(files) {
  // design.md §pins: fields, then alternatives in order.
  const passage = sha256(files['design/brief/ticket.md'].trim().split(/\n\s*\n/).map((s) => s.replace(/\s+/g, ' ')).join('\n\n'));
  const lines = ['Question: Which completion path should be used?', 'Recommendation: a: Complete directly.', `Cites: ${passage}`];
  for (const [key, count] of [['a', 1], ['b', 2]]) {
    lines.push(`Alternative ${key}`, 'Polarity: should happen', 'Expected end: The ticket is done.', 'Refused step: -');
    for (let n = 1; n <= count; n++) lines.push(`Step ${n}: Ticket worker | Complete the ticket. | - | - | -`);
  }
  return sha256(lines.join('\n'));
}
async function pickChoice(f) {
  // presentation.md §showings, decisions.md §pick: meanings appear once; each alternative also names
  // the journey its pick would add. These alternatives have different lengths.
  const lines = ['pick p/choices/route', 'Actions:', '  p/finish | Complete the ticket. | none | none',
    'choices Completion route', '  Question: Which completion path should be used?', '  Recommendation: a: Complete directly.'];
  for (const [key, count] of [['a', 1], ['b', 2]]) {
    for (const head of [`Alternative ${key}`, `journeys route-${key}`]) {
      lines.push(head, '  Polarity: should happen', '  Expected end: The ticket is done.', '  Refused step: -');
      for (let n = 1; n <= count; n++) lines.push(`  ${n} | Ticket worker | finish | - | - | -`);
    }
  }
  lines.push(`Cites ${CITE}:`, ...f.files['design/brief/ticket.md'].trimEnd().split('\n').map(s => `  ${s}`));
  const showingText = lines.join('\n');
  const picked = decision(f.files, { kind: 'pick', on: 'p/choices/route', pin: choicePin(f.files), rows: [['Choice', 'a']], index: 12, folder: 'design/parts/p/choices/route/decisions', shown: showingText });
  await writeFiles(f.dir, f.files);
  return picked;
}

// account.md §standing: the least fixed point needs independent parts. Each fragment has
// a distinct claim sentence and premise Provider. Refiling with the same Purpose
// preserves the canonical Parts value (design.md §pins); model-bound pins do
// change, so they are computed again under the new model name.
async function carryGraph({ cycle = false, rootBound = true } = {}) {
  const ids = cycle ? ['p', 'q'] : ['p', 'q', 'r'];
  const files = {}, fragments = {}, allPins = {};
  for (const id of ids) {
    const hasPremise = cycle || id !== 'p';
    const f = await fixture({ premise: hasPremise, edit: (input) => {
      input[CP] = replaceField(input[CP], 'Sentence', `A done ${id} ticket never becomes idle.`);
      if (hasPremise) input[PP] = replaceField(input[PP], 'Provider', `${id} operator`);
    } });
    fragments[id] = f;
    files['design/brief/ticket.md'] = f.files['design/brief/ticket.md'];
    for (const [path, value] of Object.entries(f.files)) {
      if (path.includes('/decisions/') || path.endsWith('/receipt') || (!path.startsWith('design/parts/p/') && !path.startsWith('models/lifecycles-p/'))) continue;
      const newPath = path.replaceAll('/p/', `/${id}/`).replace('lifecycles-p', `lifecycles-${id}`);
      files[newPath] = path === CP ? replaceField(value, 'Parts', id) : value;
    }
    for (const [entry, pin] of Object.entries(f.pins)) if (entry.startsWith('p/')) allPins[entry.replace('p/', `${id}/`)] = pin;
  }
  files['design/README.md'] = `# Ticket family\n\n${table(['Part', 'Purpose', 'Cites'], ids.map((id) => [id, 'Completes tickets.', CITE]))}`;
  seal(files, allPins);
  for (const id of ids) {
    const folder = `models/lifecycles-${id}/parts/${id}/claims/sticks`;
    const lines = files[`${folder}/receipt`].trimEnd().split('\n').map(JSON.parse);
    for (const line of lines) line.pins = ['claims/sticks', 'lifecycles/state'].map((suffix) => ({ entry: `${id}/${suffix}`, pin: allPins[`${id}/${suffix}`] }));
    files[`${folder}/receipt`] = lines.map((line) => JSON.stringify(line) + '\n').join('');
  }
  intake(files);
  const passage = sha256(files['design/brief/ticket.md'].trim().split(/\n\s*\n/).map((s) => s.replace(/\s+/g, ' ')).join('\n\n'));
  const partPin = sha256(ids.map(() => `Purpose: Completes tickets.\nCites: ${passage}`).join('\n'));
  decision(files, { kind: 'confirm', on: 'parts', pin: partPin, index: 2, shown: `confirm parts\n${ids.map((id) => `${id}\n  Purpose: Completes tickets.\n  Cites: ${CITE}`).join('\n')}\nCites ${CITE}:\n${files['design/brief/ticket.md'].trimEnd().split('\n').map((s) => `  ${s}`).join('\n')}` });
  for (const [i, id] of ids.entries()) {
    const f = fragments[id];
    for (const [offset, suffix] of [[0, 'lifecycles/state'], [1, 'journeys/complete'], [2, 'claims/sticks']]) {
      const on = `${id}/${suffix}`;
      decision(files, { kind: 'confirm', on, pin: allPins[on], folder: `design/parts/${id}/${suffix}/decisions`, index: 3 + 10 * i + offset, shown: showing(f.files, 'confirm', `p/${suffix}`, [], undefined).replaceAll('p/', `${id}/`) });
    }
    if (id !== 'p' || rootBound) decision(files, { kind: 'carry', on: `bound:lifecycles-${id}/${id}/sticks`, pin: sha256(`Model: lifecycles-${id}\nClaim: ${allPins[`${id}/claims/sticks`]}\nBound: phase level`), rows: [['Choice', 'carry'], ['Basis', '-']], words: 'Data-level behavior differs.', folder: `design/parts/${id}/claims/sticks/decisions`, index: 6 + 10 * i, shown: showing(f.files, 'carry', `bound:${MODEL}/p/sticks`, [], 'Data-level behavior differs.').replaceAll('p/', `${id}/`).replaceAll(MODEL, `lifecycles-${id}`) });
    if (cycle || id !== 'p') {
      const basis = `${cycle ? (id === 'p' ? 'q' : 'p') : ids[i - 1]}/claims/sticks`;
      decision(files, { kind: 'carry', on: `${id}/premises/trust`, pin: allPins[`${id}/premises/trust`], rows: [['Choice', 'carry'], ['Basis', basis]], words: 'A completion report disagrees with the ticket.', folder: `design/parts/${id}/premises/trust/decisions`, index: 7 + 10 * i, shown: showing(f.files, 'carry', 'p/premises/trust', [], 'A completion report disagrees with the ticket.').replaceAll('p/', `${id}/`) + `\nBasis\n  ${basis}` });
    }
  }
  files['work/.gitignore'] = '*\n';
  return { dir: await project(null, files), files, ids };
}

describe('account.md §what-it-is — clarified record forms', () => {
  for (const kind of ['intake', 'allow', 'rule']) {
    test(`account.md §what-it-is ${kind}: a decision with a valid filename but an invalid Shown pin counts for nothing`, async () => {
      // decisions.md §kinds; decisions.md §decision-file; account.md §what-it-is
      // and account.md §items: isolate the invalid pin from
      // the valid filename hash, and compute items without that decision.
      const f = await fixture({ premise: true });
      let record = f.decisions.intake, surprise;
      if (kind === 'allow') record = decision(f.files, { kind, on: 'allow', rows: allowanceRows({ answers: 7 }), index: 20 });
      if (kind === 'rule') { surprise = await addSurprise(f); record = await ruling(f, surprise); }
      const broken = replaceField(f.files[record.path], 'Pin', '0'.repeat(64));
      const path = record.path.replace(/-[a-f0-9]{12}\.md$/, `-${sha256(broken).slice(0, 12)}.md`);
      delete f.files[record.path];
      f.files[path] = broken;
      const result = json(await project(null, f.files), ['missing']);
      assert.ok(names(result.items).includes(`change:${path}`));
      if (kind === 'intake') assert.ok(names(result.items).includes('intake'));
      // decisions.md §intake: malformed allowances add no budget.
      if (kind === 'allow') assert.equal(result.here.answers.allowed, 100);
      if (kind === 'rule') {
        assert.ok(names(result.items).includes(`rule:${surprise.name}`));
        assert.ok(names(result.items).includes(`explain:${surprise.name}`));
      }
    });
  }

  test('account.md §what-it-is receipt: a missing final line feed invalidates the receipt line', async () => {
    // door.md §receipts; door.md §change;
    // account.md §what-it-is: an unterminated JSONL line does not parse.
    const f = await fixture();
    const path = 'design/parts/p/claims/sticks/receipt';
    await writeFiles(f.dir, { [path]: f.files[path].slice(0, -1) });
    assert.ok(names(missing(f.dir)).includes(`change:${path}`));
  });

  test('account.md §what-it-is session rule: a prior author who decided does not discount a different current writer', async () => {
    // door.md §sessions: the entry's session is checked, not every
    // historical author; door.md §receipts preserves those authors.
    // account.md §what-it-is: the accepted claim remains readable.
    const f = await fixture();
    const path = 'design/parts/p/claims/sticks/receipt';
    const line = JSON.parse(f.files[path]);
    line.authors = [{ provider: 'fixture', model: 'developer', session: 'human-review' }, WRITER];
    await writeFiles(f.dir, { [path]: `${JSON.stringify(line)}\n` });
    assert.ok(!names(missing(f.dir)).includes(`change:${CP}`));
    assert.equal(claim(account(f.dir)).ref, CLAIM);
  });

  test('account.md §items lifecycle weaker forms: an imported explanation with a weaker form is discounted and explanation stays owed', async () => {
    // evidence.md §questions; evidence.md §weaker; evidence.md §explain limits
    // weaker forms to native base questions. door.md §change repeats
    // those checks at read; account.md §items gives the items.
    const f = await fixture();
    const s = await addSurprise(f, { question: `${QUESTION}/base`, kind: 'base', expected: { outcome: 'no violation' }, found: { outcome: 'violation', property: 'forbidden form' } });
    const stem = `models/${s.name}`;
    const explanation = fields([['Question', s.question], ['Basis', s.digest.slice(0, 12)], ['Verdict', 'real finding'], ['Level', 'specification'], ['Weaker', 'loose']])
      + '\n## Trace\n\nThe completed ticket becomes idle.\n\n## Failure shape\n\nCompletion is lost.\n\n## Mechanism\n\nThe reset transition reopens the ticket.\n';
    const additions = { [`${stem}.explained.md`]: explanation, [`${stem}.weaker-loose.md`]: f.files[`${SLOT}/encoding.md`] };
    // evidence.md §writers; door.md §receipts: explanatory
    // files have receipts, without slot pins, from a separate session.
    const writer = { provider: 'fixture', model: 'reviewer', session: 'explanation' };
    const lines = f.files[`${SLOT}/receipt`].trimEnd().split('\n').map(JSON.parse);
    for (const [path, bytes] of Object.entries(additions)) lines.push({ file: path.slice(path.lastIndexOf('/') + 1), sha256: sha256(bytes), at: WHEN, session: writer, authors: [writer] });
    additions[`${SLOT}/receipt`] = lines.sort((a, b) => a.file < b.file ? -1 : 1).map((line) => `${JSON.stringify(line)}\n`).join('');
    await writeFiles(f.dir, additions);
    const items = names(missing(f.dir));
    assert.ok(items.includes(`change:${stem}.explained.md`));
    assert.ok(items.includes(`change:${stem}.weaker-loose.md`));
    assert.ok(items.includes(`explain:${s.name}`));
    assert.ok(!items.includes(`run:${s.name}/weaker-loose`));
  });

  for (const [authorSource, disqualified] of [['a union-merged prior lifecycle version', true], ['an unconfirmed lifecycle page', false]]) {
    test(`account.md §what-it-is explanation authors: ${authorSource} ${disqualified ? 'disqualifies' : 'does not disqualify'} its author at read`, async () => {
      // door.md §receipts, §read-checks: union all historical authors of confirmed lifecycle
      // pages only. door.md §change check 2 at read checks the explanation's stem identity.
      // account.md §what-it-is, §items: only a disqualified explanation leaves Explain owed.
      const f = await fixture();
      const writer = { provider: 'fixture', model: 'reviewer', session: 'explanation' };
      if (authorSource === 'an unconfirmed lifecycle page') {
        f.files['design/parts/p/boundary.md'] += `| gate | Gate | entity | machine | - | - | worker | worker | added | ${CITE} |\n`;
        const path = 'design/parts/p/lifecycles/gate/README.md';
        f.files[path] = page('Gate state', [['Entity', 'gate'], ['Initial', 'closed'], ['Ends', 'closed'], ['Unaffected', 'finish'], ['Origin', 'added'], ['Cites', CITE]]) + '\n' + table(['Phase'], [['closed']]);
        seal(f.files, f.pins);
        f.files['design/parts/p/lifecycles/gate/receipt'] = `${JSON.stringify({ file: 'README.md', sha256: sha256(f.files[path]), at: WHEN, session: writer, authors: [writer] })}\n`;
      } else {
        f.files['design/parts/p/lifecycles/state/receipt'] += `${JSON.stringify({ file: 'README.md', sha256: sha256(f.files[LP].replace('Ticket state', 'Earlier ticket state')), at: '2019-12-31T23:59:59.000Z', session: writer, authors: [writer] })}\n`;
      }
      const s = await addSurprise(f);
      const path = `models/${s.name}.explained.md`;
      f.files[path] = fields([['Question', s.question], ['Basis', s.digest.slice(0, 12)], ['Verdict', 'real finding'], ['Level', 'specification'], ['Weaker', 'none']])
        + '\n## Trace\n\nThe ticket cannot complete.\n\n## Failure shape\n\nCompletion is missing.\n\n## Mechanism\n\nThe completion transition is absent.\n';
      const lines = f.files[`${SLOT}/receipt`].trimEnd().split('\n').map(JSON.parse);
      lines.push({ file: path.slice(path.lastIndexOf('/') + 1), sha256: sha256(f.files[path]), at: WHEN, session: writer, authors: [writer] });
      f.files[`${SLOT}/receipt`] = lines.sort((a, b) => a.file < b.file ? -1 : 1).map((line) => `${JSON.stringify(line)}\n`).join('');
      await writeFiles(f.dir, f.files);
      const items = names(missing(f.dir));
      assert.equal(items.includes(`change:${path}`), disqualified);
      assert.equal(items.includes(`explain:${s.name}`), disqualified);
    });
  }

  for (const [label, path, held] of [
    ['unconfirmed lifecycle', 'design/parts/p/lifecycles/gate/README.md', false],
    ['journey', JP, false],
  ]) {
    test(`account.md §what-it-is freeze membership: ${label === 'unconfirmed lifecycle' ? 'an' : 'a'} ${label} is outside the frozen file kinds`, async () => {
      // models.md §lifecycle-model, §freeze: only lifecycles confirmed at opening are held;
      // journey pages are not model files. account.md §what-it-is and door.md §read-checks
      // therefore do not discount these receipted edits as freeze violations.
      const f = await fixture({ edit: (files) => {
        files['design/parts/p/boundary.md'] += `| gate | Gate | entity | machine | - | - | worker | worker | added | ${CITE} |\n`;
        files['design/parts/p/lifecycles/gate/README.md'] = page('Gate state', [['Entity', 'gate'], ['Initial', 'closed'], ['Ends', 'closed'], ['Unaffected', 'finish'], ['Origin', 'added'], ['Cites', CITE]]) + '\n' + table(['Phase'], [['closed']]);
      } });
      const s = await addSurprise(f);
      f.files[path] = f.files[path].replace(/^# (.*)$/m, '# $1 renamed');
      seal(f.files, f.pins);
      await writeFiles(f.dir, f.files);
      const items = names(missing(f.dir));
      assert.equal(items.includes(`change:${path}`), held);
      assert.ok(items.includes(`rule:${s.name}`));
    });
  }

  test('account.md §what-it-is orphan page: a missing part front page owes restatement without discounting the child page', async () => {
    // design.md §at-read; account.md §items:
    // missing parent README is check 2, rather than the child's own form error.
    const f = await fixture({ noLifecycle: true });
    const dir = await cloneWithout(f.dir, ['design/parts/p/README.md']);
    const items = missing(dir);
    assert.equal(item(items, 'restate:p').why, 'unresolved');
    assert.ok(!names(items).includes(`change:${CP}`));
  });

  for (const key of ['title', 'author', 'date', 'origin']) {
    test(`account.md §items sources: whitespace-only ${key} makes a cited source passage missing work`, async () => {
      // design.md §brief; design.md §at-read;
      // account.md §items: provenance must contain non-whitespace text.
      const path = 'design/brief/sources/reference.md';
      const address = `${path}#completion`;
      const f = await fixture({ noLifecycle: true });
      Object.assign(f.files, await snapshot(await project('account/source')));
      f.files[path] = f.files[path].replace(new RegExp(`^${key}:.*$`, 'm'), `${key}: "   "`);
      f.files[CP] = replaceField(f.files[CP], 'Cites', address);
      seal(f.files, f.pins);
      const dir = await project(null, f.files);
      // The table does not prioritize uncovered versus unresolved when both
      // apply to an uncitable source. Assert the owed item, not that precedence.
      assert.ok(names(missing(dir)).includes(`passage:${address}`));
    });
  }

  test('account.md §items passage addresses: Unicode letters and decimal digits survive while other number categories do not', async () => {
    // design.md §passages; account.md §items: these uncited
    // headings exercise L, Nd, excluded Nl/No, and duplicate slug numbering.
    const f = await fixture({ noLifecycle: true });
    await writeFiles(f.dir, { 'design/brief/unicode.md': '# Å中 ١Ⅳ²\n\nFirst.\n\n# Å中 ١\n\nSecond.\n' });
    const items = missing(f.dir);
    for (const slug of ['å中-١', 'å中-١-1']) assert.equal(item(items, `passage:design/brief/unicode.md#${slug}`).why, 'uncovered');
  });

  for (const [label, separator, state] of [['NEL collapses as whitespace', '\u0085', 'in force'], ['BOM is retained as content', '\ufeff', 'lapsed']]) {
    test(`account.md §what-it-is passage hashes: ${label}`, async () => {
      // design.md §passages; design.md §pins;
      // decisions.md §in-force; account.md §items, presentation.md §reading,
      //: Unicode White_Space determines whether the pin changes.
      const f = await fixture({ noLifecycle: true });
      await writeFiles(f.dir, { 'design/brief/ticket.md': f.files['design/brief/ticket.md'].replace('ticket starts', `ticket${separator}starts`) });
      const record = walkObjects(account(f.dir, CLAIM)).find((entry) => entry.decision === f.decisions.claim.name && entry.state);
      assert.equal(record.state, state);
      assert.equal(names(missing(f.dir)).includes(`confirm:${CLAIM}`), state === 'lapsed');
    });
  }
});

describe('account.md §standing — premise dependency computation', () => {
  test('account.md §standing basis carries: established roots support successive carries to a fixed point', async () => {
    // account.md §standing; decisions.md §in-force; account.md §box; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir, ids } = await carryGraph();
    json(dir, ['run']);
    const reading = account(dir);
    for (const id of ids) assert.equal(claim(reading, `${id}/claims/sticks`).standing, 'established');
    const dependent = claim(reading, 'r/claims/sticks').models.find((m) => m.model === 'lifecycles-r').basis.premises.find((p) => p.premise === 'r/premises/trust');
    // account.md §basis-line to presentation.md §reading: basis entries name premises, whose full carry is under Assumed.
    assert.deepEqual(dependent, { premise: 'r/premises/trust' });
    const assumed = reading.parts.find(part => part.ref === 'r').assumed.find(p => p.premise === dependent.premise);
    assert.ok(JSON.stringify(assumed).includes('q/claims/sticks'));
  });

  test('account.md §standing basis carries: unsupported cycles cannot establish their own basis claims', async () => {
    // account.md §standing; decisions.md §in-force; account.md §box; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir, ids } = await carryGraph({ cycle: true });
    json(dir, ['run']);
    for (const id of ids) {
      const c = claim(account(dir), `${id}/claims/sticks`);
      assert.equal(c.standing, 'not established');
      assert.ok(c.models.find((m) => m.model === `lifecycles-${id}`).fails.some((f) => f.condition === 'carried'));
      assert.equal(item(missing(dir), `carry:${id}/premises/trust`).why, 'lapsed');
    }
    assert.ok(!json(dir, ['box']).premises.some((p) => p.premise.endsWith('/premises/trust')));
  });

  test('account.md §standing basis carries: losing the root’s independent bounds carry invalidates the whole chain', async () => {
    // account.md §standing; decisions.md §in-force; account.md §box; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir, ids } = await carryGraph({ rootBound: false });
    json(dir, ['run']);
    for (const id of ids) assert.equal(claim(account(dir), `${id}/claims/sticks`).standing, 'not established');
  });

  test('account.md §standing choice premise: an unpicked choice fails carried and owes pick rather than carry', async () => {
    // account.md §standing; account.md §items; decisions.md §pick; design.md §code-journeys; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await examined({ edit: addChoice });
    failure(account(dir), 'carried');
    assertItem(item(missing(dir), 'pick:p/choices/route'), { on: 'p/choices/route', why: 'unpicked', supply: [developer('pick', 'decide')] });
    assert.ok(!names(missing(dir)).includes('carry:choice:p/route'));
  });

  test('account.md §standing choice premise: a pick carries the premise and its generated journey participates in conformance', async () => {
    // account.md §standing; account.md §items; decisions.md §pick; design.md §code-journeys; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await fixture({ edit: addChoice });
    const picked = await pickChoice(f);
    assert.ok(names(missing(f.dir)).includes(`run:${MODEL}/parts/p/journeys/route-a/lifecycle-path`));
    json(f.dir, ['run']);
    const reading = account(f.dir);
    assert.equal(claim(reading).standing, 'established');
    const premise = modelClaim(reading).basis.premises.find((p) => p.premise === 'choice:p/route');
    // account.md §basis-line to presentation.md §reading: the claim names its premise; Assumed holds its pick.
    assert.deepEqual(premise, { premise: 'choice:p/route' });
    const assumed = reading.parts[0].assumed.find(p => p.premise === premise.premise);
    assert.ok(assumed.pick);
    assert.ok(JSON.stringify(assumed.pick).includes(picked.name));
    assert.ok(json(f.dir, ['box']).premises.some((p) => p.premise === 'choice:p/route' && p.pick));
  });
});

describe('account.md §journey-rules — lifecycle exploration', () => {
  test('account.md §journey-rules explored: an untaken action remains a model failure despite caught faults and reached witnesses', async () => {
    // account.md §journey-rules; account.md §standing; account.md §items; evidence.md §flags; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await examined({ edit: (files) => {
      files['design/parts/p/actions.md'] += `| reset | worker | Reset the ticket. | none | none | stated | ${CITE} |\n`;
      files[LP] = files[LP].replace('| Phase | finish |', '| Phase | finish | reset |').replace('| --- | --- |\n| idle', '| --- | --- | --- |\n| idle').replace('| idle | done |', '| idle | done | None. |').replace('| done | done |', '| done | done | None. |');
    } });
    const reading = account(dir);
    const m = reading.models.find((m) => m.model === MODEL);
    const explored = m.fails.find((f) => f.rule === 'explored');
    assert.ok(explored);
    assert.ok(JSON.stringify(explored.found).includes('untaken-action'));
    assert.equal(claim(reading).standing, 'not established');
    failure(reading, 'conforming');
    assert.equal(item(missing(dir), 'restate:p').why, 'flagged');
    const base = JSON.parse(await read(dir, `models/${QUESTION}/base.json`));
    assert.equal(base.found.outcome, 'no violation');
    assert.ok(base.flags.some((flag) => flag.startsWith('untaken-action ')));
    assert.equal(JSON.parse(await read(dir, `models/${QUESTION}/fault-reset.json`)).matches, true);
    assert.equal(JSON.parse(await read(dir, `models/${QUESTION}/witness-done.json`)).found.outcome, 'reached');
  });
});

describe('presentation.md §reading — choice and generated-journey readings', () => {
  test('presentation.md §reading choice: recommendation, alternatives and selected decision remain readable', async () => {
    // presentation.md §reading gives the choice entry and pick;
    // forms.md §choices fixes the question/recommendation text and alternatives.
    const f = await fixture({ edit: addChoice });
    const picked = await pickChoice(f);
    const result = account(f.dir, 'p/choices/route');
    const entry = readingEntry(result.thing, 'p/choices/route', 'question');
    required(entry, ['ref', 'name', 'question', 'recommendation', 'alternatives', 'pick']);
    assert.equal(entry.question, 'Which completion path should be used?');
    assert.equal(entry.recommendation, 'a: Complete directly.');
    assert.deepEqual(entry.pick, { decision: picked.name, choice: 'a', by: 'Ada', at: picked.at });
  });

  test('presentation.md §reading generated journey: a picked reserved key is a readable thing without a page file', async () => {
    // presentation.md §reading includes code-added journey scope;
    // design.md §code-journeys derives route-a from the pick and creates no page.
    const f = await fixture({ edit: addChoice });
    await pickChoice(f);
    const result = account(f.dir, 'p/journeys/route-a');
    assert.equal(result.scope, 'p/journeys/route-a');
    readingEntry(result.thing, 'p/journeys/route-a', 'models');
    assert.equal(await read(f.dir, 'design/parts/p/journeys/route-a/README.md'), null);
  });

  test('presentation.md §reading claim: every carry that names the claim as its basis is included', async () => {
    // presentation.md §reading includes all carries naming the claim;
    // it does not prescribe their nested representation, so compare the premise name.
    const { dir } = await carryGraph();
    const result = account(dir, CLAIM);
    assert.ok(result.thing.carries.some((carry) => JSON.stringify(carry).includes('q/premises/trust')));
  });
});

describe('account.md §what-it-is — computed account', () => {
  test('account.md §what-it-is: reads compute the same account and store nothing', async () => {
    // account.md §what-it-is; account.md §commands; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture();
    const before = await snapshot(dir);
    const first = account(dir);
    assert.deepEqual(account(dir), first);
    assert.deepEqual(await snapshot(dir), before);
  });

  test('account.md §what-it-is: a changed page is absent from the record until its receipt matches again', async () => {
    // account.md §what-it-is; door.md §receipts, §read-checks; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir, files } = await fixture();
    await writeFiles(dir, { [CP]: files[CP].replace('never becomes', 'may become') });
    assert.ok(names(missing(dir)).includes(`change:${CP}`));
    assert.ok(!account(dir).parts.flatMap((p) => [...p.open, ...p.accepted, ...p.established]).some((entry) => entry.ref === CLAIM));
    await writeFiles(dir, { [CP]: files[CP] });
    assert.ok(!names(missing(dir)).includes(`change:${CP}`));
    assert.equal(claim(account(dir)).sentence, 'A done ticket never becomes idle.');
  });

  test('account.md §what-it-is: an unresolved citation is read as it stands and is not an unaccepted file', async () => {
    // account.md §what-it-is; design.md §at-read; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture({ edit: (files) => { files[CP] = replaceField(files[CP], 'Cites', 'design/brief/ticket.md#missing'); } });
    const items = missing(dir);
    assert.ok(names(items).includes('passage:design/brief/ticket.md#missing'));
    assert.ok(!names(items).includes(`change:${CP}`));
    assert.equal(claim(account(dir)).ref, CLAIM);
  });

  test('account.md §what-it-is: scratch deletion changes machine allowance, not the box or tracked reading', async () => {
    // account.md §what-it-is; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await examined();
    const clean = await cloneWithout(dir, []);
    const withScratch = account(dir), withoutScratch = account(clean);
    delete withScratch.here;
    delete withoutScratch.here;
    assert.deepEqual(withScratch, withoutScratch);
    assert.deepEqual(json(dir, ['box']), json(clean, ['box']));
  });

  test('account.md §what-it-is: unconfirmed journeys have lifecycle facts before any engine run', async () => {
    // account.md §what-it-is; lifecycle-tool.md §findings; presentation.md §reading fixes reading fields, lifecycle-tool.md fixes item fields.
    const { dir } = await fixture({ confirmJourney: false, confirmLifecycle: false, edit: (files) => { files[LP] = files[LP].replace('| idle | done |', '| idle | None. |'); } });
    assert.ok(names(missing(dir)).includes('findings:p'));
    assert.match(JSON.stringify(account(dir)), /step-refused/);
    assert.equal(await read(dir, `models/${MODEL}/parts/p/claims/sticks/base.json`), null);
  });

  test('account.md §what-it-is: changing a brief lapses its pins and restoring it restores the computed account', async () => {
    // account.md §what-it-is; account.md §items; decisions.md §in-force; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir, files } = await fixture();
    const before = account(dir);
    await writeFiles(dir, { 'design/brief/ticket.md': files['design/brief/ticket.md'].replace('never returns', 'sometimes returns') });
    assert.equal(item(missing(dir), `confirm:${CLAIM}`).why, 'lapsed');
    await writeFiles(dir, { 'design/brief/ticket.md': files['design/brief/ticket.md'] });
    assert.deepEqual(account(dir), before);
  });
});

describe('account.md §standing — standing', () => {
  test('account.md §standing: all seven conditions establish a claim on its lifecycle model at phase level', async () => {
    // account.md §standing; account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await examined();
    const reading = account(dir), c = claim(reading), local = modelClaim(reading);
    assert.equal(c.standing, 'established');
    assert.equal(local.standing, 'established');
    assert.deepEqual(local.fails, []);
    assert.equal(local.bounds, 'phase level');
    assert.ok(!names(missing(dir)).includes(`carry:bound:${MODEL}/p/sticks`));
  });

  test('account.md §standing confirmed: examination does not replace confirmation on the current unit pin', async () => {
    // account.md §standing; account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await examined({ confirmClaim: false });
    const reading = account(dir);
    assert.equal(claim(reading).standing, 'not established');
    assert.ok(itemNames(failure(reading, 'confirmed').items).includes(`confirm:${CLAIM}`));
  });

  test('account.md §standing examined: no base evidence leaves examination unsatisfied', async () => {
    // account.md §standing; account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await examined();
    const absent = await cloneWithout(dir, [`models/${QUESTION}/base.json`]);
    assert.ok(itemNames(failure(account(absent), 'examined').items).includes(`run:${QUESTION}/base`));
  });

  test('account.md §standing examined: a cannot-express reason is not a property or examination', async () => {
    // account.md §standing; account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture({ edit: (files) => { files[`${SLOT}/encoding.md`] = fields([['Cannot express', 'The phase abstraction has no data values.']]); } });
    assert.equal(claim(account(dir)).standing, 'not established');
    // account.md §basis-line supplies a reason for all three conditions with no slot work owed.
    for (const condition of ['examined', 'controlled', 'witnessed']) {
      const failed = failure(account(dir), condition);
      assert.equal(failed.reason, 'its encoding says why the engine cannot express it: The phase abstraction has no data values.');
      assert.deepEqual(failed.items, []);
    }
    assert.ok(names(missing(dir)).includes(`express:${CLAIM}`));
  });

  test('account.md §standing controlled: a claim without a fault is not established', async () => {
    // account.md §standing; account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await examined({ omit: [`${SLOT}/fault-reset.md`] });
    assert.ok(itemNames(failure(account(dir), 'controlled').items).includes(`slot:${QUESTION}/fault`));
  });

  test('account.md §standing controlled: an uncaught fault does not control a passing property', async () => {
    // account.md §standing; account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await examined({ edit: (files) => { files[`${SLOT}/fault-reset.md`] = files[`${SLOT}/fault-reset.md`].replace('| state | done | finish | idle |', '| state | done | finish | done |'); } });
    failure(account(dir), 'controlled');
    failure(account(dir), 'no open surprise');
  });

  test('account.md §standing witnessed: at least one witness is required', async () => {
    // account.md §standing; account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await examined({ omit: [`${SLOT}/witness-done.md`] });
    assert.ok(itemNames(failure(account(dir), 'witnessed').items).includes(`slot:${QUESTION}/witness`));
  });

  test('account.md §standing witnessed: every declared witness must reach, not just one', async () => {
    // account.md §standing; account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await examined({ edit: (files) => { files[`${SLOT}/witness-reset.md`] = files[`${SLOT}/witness-done.md`].replace('An idle ticket can complete.', 'A done ticket can reset.').replace('| state | idle | finish | done |', '| state | done | finish | idle |'); } });
    failure(account(dir), 'witnessed');
    failure(account(dir), 'no open surprise');
  });

  test('account.md §standing conforming: a model with no confirmed positive journey establishes no claim', async () => {
    // account.md §standing; account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture({ confirmJourney: false });
    failure(account(dir), 'conforming');
    assert.equal(modelClaim(account(dir)).standing, 'not established');
  });

  test('account.md §standing carried: the implicit phase-level bounds need their own carry', async () => {
    // account.md §standing; account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await examined({ carryBound: false });
    assert.ok(itemNames(failure(account(dir), 'carried').items).includes(`carry:bound:${MODEL}/p/sticks`));
  });

  test('account.md §standing carried: an explicit premise must be carried as well as the bounds', async () => {
    // account.md §standing; account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await examined({ premise: true });
    assert.ok(itemNames(failure(account(dir), 'carried').items).includes('carry:p/premises/trust'));
    assert.equal(claim(account(dir)).standing, 'not established');
  });

  test('account.md §standing carried: a carry without a basis supplies its premise', async () => {
    // account.md §standing; account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await examined({ premise: true, carryPremise: true });
    assert.equal(claim(account(dir)).standing, 'established');
  });

  test('account.md §standing labels: acceptance is used only when no model establishes the claim', async () => {
    // account.md §standing; account.md §items; decisions.md §accept; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture({ accept: true });
    assert.equal(claim(account(dir)).standing, 'accepted');
    assert.equal(modelClaim(account(dir)).standing, 'not established');
    json(dir, ['run']);
    assert.equal(claim(account(dir)).standing, 'established');
  });

  test('account.md §standing labels: an uncovered unaccepted claim names its cover item', async () => {
    // account.md §standing; account.md §items; decisions.md §accept; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture({ noLifecycle: true });
    const reading = account(dir);
    assert.equal(claim(reading).standing, 'not established');
    assert.deepEqual(claim(reading).models, []);
    assert.match(success(dir, ['account', CLAIM]).stdout, /cover:p/);
  });

  test('account.md §standing labels: withdrawing acceptance returns an unestablished claim to not established', async () => {
    // account.md §standing; account.md §items; decisions.md §accept; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await fixture({ noLifecycle: true, accept: true });
    decision(f.files, { kind: 'accept', on: CLAIM, pin: f.pins[CLAIM], rows: [['Choice', 'withdraw']], index: 9 });
    await writeFiles(f.dir, f.files);
    assert.equal(claim(account(f.dir)).standing, 'not established');
  });
});

describe('account.md §journey-rules — journey and span rules', () => {
  test('account.md §journey-rules journeys: missing lifecycle path evidence names the rule, subject, none and its run item', async () => {
    // account.md §journey-rules; evidence.md §question-names; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture();
    const m = account(dir).models.find((entry) => entry.model === MODEL);
    assert.equal(m.conforms, false);
    const fail = m.fails.find((entry) => entry.rule === 'journeys');
    assert.ok(fail);
    keys(fail, ['rule', 'on', 'found', 'items']);
    assert.equal(fail.found, 'none');
    assert.ok(JSON.stringify(fail.on).includes(JOURNEY));
    assert.ok(itemNames(fail.items).includes(`run:${MODEL}/parts/p/journeys/complete/lifecycle-path`));
  });

  test('account.md §journey-rules progress: an unconfirmed written positive journey waits for its confirmation', async () => {
    // account.md §journey-rules; account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture({ confirmJourney: false });
    const m = account(dir).models.find((entry) => entry.model === MODEL);
    assert.ok(m.fails.some((entry) => entry.rule === 'progress'));
    assert.ok(itemNames(item(missing(dir), 'journey:p').waits).includes(`confirm:${JOURNEY}`));
  });

  test('account.md §journey-rules progress: a negative journey alone does not supply progress', async () => {
    // account.md §journey-rules; account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture({ edit: (files) => {
      files[JP] = replaceField(replaceField(replaceField(files[JP], 'Polarity', 'must not'), 'Expected end', '-'), 'Refused step', '1');
    } });
    assert.ok(account(dir).models.find((entry) => entry.model === MODEL).fails.some((entry) => entry.rule === 'progress'));
    assert.ok(names(missing(dir)).includes('journey:p'));
  });

  test('account.md §journey-rules: current matching lifecycle paths meet journeys and progress before claims count', async () => {
    // account.md §journey-rules; account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await examined();
    const m = account(dir).models.find((entry) => entry.model === MODEL);
    assert.equal(m.conforms, true);
    assert.deepEqual(m.fails, []);
    assert.equal(claim(account(dir)).standing, 'established');
  });

  test('account.md §journey-rules span: shared surfaces create the no-entry obligation without a span folder', async () => {
    // account.md §journey-rules; account.md §items; forms.md §surface; account.md §box; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture({ noLifecycle: true, confirmParts: false, edit: (files) => addSpan(files) });
    const s = item(missing(dir), 'span:p+q');
    assertItem(s, { on: 'p+q', why: 'no-entry', supply: [agent('restate'), agent('model'), carried] });
  });

  test('account.md §journey-rules span: a claim of both parts needs one model covering both', async () => {
    // account.md §journey-rules; account.md §items; forms.md §surface; account.md §box; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture({ noLifecycle: true, confirmParts: false, edit: (files) => addSpan(files, true) });
    assert.equal(item(missing(dir), 'span:p+q').why, 'no-model');
  });

  test('account.md §journey-rules span: the developer can carry the unexamined interaction', async () => {
    // account.md §journey-rules; account.md §items; forms.md §surface; account.md §box; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await fixture({ noLifecycle: true, confirmParts: false, edit: (files) => addSpan(files, true) });
    // decisions.md §carry: purpose and shared surface rows in part-key order.
    const pin = sha256('Part: Completes tickets.\nSurface: emits completed\nPart: Stores receipts.\nSurface: consumes completed (Completes tickets.)');
    decision(f.files, { kind: 'carry', on: 'span:p+q', pin, rows: [['Choice', 'carry'], ['Basis', '-']], words: 'A completion has no corresponding receipt.', index: 9 });
    await writeFiles(f.dir, f.files);
    assert.ok(!names(missing(f.dir)).includes('span:p+q'));
    assert.ok(json(f.dir, ['box']).premises.some((entry) => entry.premise === 'span:p+q'));
  });
});

describe('account.md §items — items', () => {
  test('account.md §items intake: before intake the only item of an empty project is intake', async () => {
    // account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const dir = await project();
    const items = missing(dir);
    assert.deepEqual(names(items), ['intake']);
    assert.deepEqual(items[0].supply, [developer('intake', 'intake')]);
  });

  test('account.md §items before intake: change items are still reported and every other obligation is suppressed', async () => {
    // account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture({ intake: false });
    await writeFiles(dir, { 'design/unowned.txt': 'Not an accepted page.\n' });
    assert.deepEqual(names(missing(dir)).sort(), ['change:design/unowned.txt', 'intake']);
  });

  for (const [why, edit, address] of [
    ['uncovered', (files) => { files['design/brief/extra.md'] = '# Uncovered\n\nA second requirement.\n'; }, 'design/brief/extra.md#uncovered'],
    ['unresolved', (files) => { files[CP] = replaceField(files[CP], 'Cites', 'design/brief/ticket.md#missing'); }, 'design/brief/ticket.md#missing'],
  ]) test(`account.md §items passage: ${why} has its exact address and restate supplier`, async () => {
    // account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture({ edit });
    assertItem(item(missing(dir), `passage:${address}`), { on: address, why, supply: [agent('restate')] });
  });

  test('account.md §items restate: an unresolved non-citation reference is owed for its part with found reasons', async () => {
    // account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture({ edit: (files) => { files[CP] = replaceField(files[CP], 'Rests on', 'missing-premise'); } });
    const entry = item(missing(dir), 'restate:p');
    assertItem(entry, { on: 'p', why: 'unresolved', supply: [agent('restate')] });
    assert.ok(entry.found);
    assert.match(JSON.stringify(entry.found), /missing-premise/);
  });

  test('account.md §items restate:parts: a part-list mismatch is a project Restate item', async () => {
    // account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture({ edit: (files) => { files['design/parts/q/README.md'] = '# Receipts\n'; } });
    const entry = item(missing(dir), 'restate:parts');
    assertItem(entry, { on: 'parts', why: 'unresolved', supply: [agent('restate')] });
    assert.ok(entry.found);
  });

  test('account.md §items findings: a finding blocks an unconfirmed unit and its confirmation waits', async () => {
    // account.md §items; lifecycle-tool.md §findings; presentation.md §reading fixes reading fields, lifecycle-tool.md fixes item fields.
    const { dir } = await fixture({ confirmLifecycle: false, edit: (files) => { files[LP] = files[LP].replace('| idle | done |', '| idle |  |'); } });
    const entries = missing(dir);
    const found = item(entries, 'findings:p');
    assert.deepEqual(found.supply, [agent('restate')]);
    assert.match(JSON.stringify(found.found), /empty-cell/);
    assert.ok(itemNames(item(entries, `confirm:${LIFE}`).waits).includes('findings:p'));
  });

  test('account.md §items confirm: an added claim is its own unconfirmed unit and waits for parts first', async () => {
    // account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture({ confirmParts: false, confirmClaim: false });
    const c = item(missing(dir), `confirm:${CLAIM}`);
    assertItem(c, { on: CLAIM, why: 'unconfirmed', supply: [developer('confirm', 'confirm')] });
    assert.ok(itemNames(c.waits).includes('confirm:parts'));
  });

  test('account.md §items confirm: a changed citation lapses the old confirmation', async () => {
    // account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir, files } = await fixture();
    await writeFiles(dir, { 'design/brief/ticket.md': files['design/brief/ticket.md'].replace('never returns', 'may return') });
    assert.equal(item(missing(dir), `confirm:${CLAIM}`).why, 'lapsed');
  });

  test('account.md §items repair: a decline is named by its computed decision name and replaces confirm', async () => {
    // account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await fixture({ confirmClaim: false });
    const declined = decision(f.files, { kind: 'decline', on: CLAIM, pin: f.pins[CLAIM], words: 'Restate what completion means.', index: 10 });
    await writeFiles(f.dir, f.files);
    const entries = missing(f.dir);
    assertItem(item(entries, `repair:${declined.name}`), { on: declined.name, supply: [agent('repair')] });
    assert.ok(!names(entries).includes(`confirm:${CLAIM}`));
  });

  test('account.md §items journey: a written positive journey waits for its repair after a decline', async () => {
    // account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await fixture({ confirmJourney: false });
    const declined = decision(f.files, { kind: 'decline', on: JOURNEY, pin: f.pins[JOURNEY], words: 'Show the right completion.', index: 10 });
    await writeFiles(f.dir, f.files);
    assert.ok(itemNames(item(missing(f.dir), 'journey:p').waits).includes(`repair:${declined.name}`));
  });

  test('account.md §items cover: until a TLC or Alloy model exists all part keys share one sorted item', async () => {
    // account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture({ confirmParts: false, edit: (files) => addSpan(files) });
    const covers = missing(dir).filter((entry) => entry.item.startsWith('cover:'));
    assert.deepEqual(names(covers), ['cover:p+q']);
    assertItem(covers[0], { on: 'p+q', supply: [agent('model')] });
  });

  for (const [file, stem] of [['encoding.md', 'encoding'], ['witness-done.md', 'witness'], ['fault-reset.md', 'fault']]) {
    test(`account.md §items slot: missing ${stem} uses its prescribed extensionless path`, async () => {
      // account.md §items; models.md §slot-currency, §owed; presentation.md §reading fixes reading fields, models.md §slot-currency fixes item fields.
      const { dir } = await fixture({ omit: [`${SLOT}/${file}`] });
      assertItem(item(missing(dir), `slot:${QUESTION}/${stem}`), { on: `${QUESTION}/${stem}`, why: 'unfilled', supply: [agent('slot')] });
    });
  }

  test('account.md §items slot: a receipt pin for an older claim makes the accepted slot owed-again', async () => {
    // account.md §items; models.md §slot-currency, §owed; presentation.md §reading fixes reading fields, models.md §slot-currency fixes item fields.
    const f = await fixture();
    const rows = f.files[`${SLOT}/receipt`].trimEnd().split('\n').map(JSON.parse);
    for (const row of rows) for (const pin of row.pins) if (pin.entry === CLAIM) pin.pin = sha256('an earlier claim');
    await writeFiles(f.dir, { [`${SLOT}/receipt`]: rows.map((r) => JSON.stringify(r) + '\n').join('') });
    assert.equal(item(missing(f.dir), `slot:${QUESTION}/encoding`).why, 'owed-again');
    assert.ok(!names(missing(f.dir)).includes(`change:${SLOT}/encoding.md`));
  });

  test('account.md §items express: every covering encoding gives a reason, with model then accept as suppliers', async () => {
    // account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture({ edit: (files) => { files[`${SLOT}/encoding.md`] = fields([['Cannot express', 'No data values at phase level.']]); } });
    assertItem(item(missing(dir), `express:${CLAIM}`), { on: CLAIM, supply: [agent('model'), developer('accept', 'carry or allow')] });
  });

  test('account.md §items express: accepting the risk closes the express obligation', async () => {
    // account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture({ accept: true, edit: (files) => { files[`${SLOT}/encoding.md`] = fields([['Cannot express', 'No data values at phase level.']]); } });
    assert.ok(!names(missing(dir)).includes(`express:${CLAIM}`));
  });

  test('account.md §items run: a newly asked lifecycle path has why none and the run supplier', async () => {
    // account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture();
    const q = `${MODEL}/parts/p/journeys/complete/lifecycle-path`;
    assertItem(item(missing(dir), `run:${q}`), { on: q, why: 'none', supply: [{ by: 'run' }] });
  });

  test('account.md §items run: evidence from another runtime is not-current at ordinary reads', async () => {
    // account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await examined();
    const path = `models/${QUESTION}/base.json`;
    const value = JSON.parse(await read(dir, path));
    value.basis.runtime.version = 'v0.0.0';
    await writeFiles(dir, { [path]: evidenceFile(value) });
    assert.equal(item(missing(dir), `run:${QUESTION}/base`).why, 'not-current');
    failure(account(dir), 'examined');
  });

  test('account.md §items explain and rule: an old open surprise waits for an explanation and suppresses its normal run', async () => {
    // account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await fixture();
    const surprise = await addSurprise(f);
    const entries = missing(f.dir);
    assertItem(item(entries, `explain:${surprise.name}`), { on: surprise.name, supply: [agent('explain')] });
    const waiting = item(entries, `rule:${surprise.name}`);
    assertItem(waiting, { on: surprise.name, supply: [developer('rule', 'decide')] });
    assert.ok(itemNames(waiting.waits).includes(`explain:${surprise.name}`));
    assert.ok(!names(entries).includes(`run:${surprise.question}`));
    failure(account(f.dir), 'no open surprise');
  });

  test('account.md §items freeze: a missing claim slot waits for its ruling and a new fill is refused', async () => {
    // account.md §items: every slot of the surprised claim waits on that model.
    // models.md §freeze refuses new slots even though held cannot name them yet.
    const f = await fixture({ omit: [`${SLOT}/fault-reset.md`] });
    const surprise = await addSurprise(f);
    assert.ok(itemNames(item(missing(f.dir), `slot:${QUESTION}/fault`).waits).includes(`rule:${surprise.name}`));
    const source = await project('account/lifecycle');
    const answer = await project(null, { [`${SLOT}/fault-reset.md`]: await read(source, `${SLOT}/fault-reset.md`) });
    const before = await snapshot(f.dir, { skip: ['work', 'runs'] });
    const result = forma(f.dir, ['answer', `slot:${QUESTION}/fault`, answer, '--provider', 'fixture', '--model', 'writer', '--session', 'new-fault', '--json']);
    // door.md §forma-answer: answer refusals can write scratch, never tracked files.
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.json?.accepted, false, result.stderr);
    assert.deepEqual(await snapshot(f.dir, { skip: ['work', 'runs'] }), before);
    assert.ok(names(missing(f.dir)).includes(`rule:${surprise.name}`));
  });

  test('account.md §items carry: an explicit uncarried premise names its entry and carry checkpoint', async () => {
    // account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture({ premise: true });
    assertItem(item(missing(dir), 'carry:p/premises/trust'), { on: 'p/premises/trust', why: 'uncarried', supply: [carried] });
  });

  test('account.md §items carry: a changed premise lapses its old carry', async () => {
    // account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await fixture({ premise: true, carryPremise: true });
    f.files[PP] = replaceField(f.files[PP], 'Statement', 'The worker eventually reports completion.');
    seal(f.files, f.pins);
    await writeFiles(f.dir, f.files);
    assert.equal(item(missing(f.dir), 'carry:p/premises/trust').why, 'lapsed');
  });

  for (const [why, options, subject] of [
    ['answers', { answers: 0 }, 'cover:p'],
    ['runs', { runs: 0 }, `run:${MODEL}/parts/p/journeys/complete/lifecycle-path`],
    ['engine', { seconds: 0 }, `run:${MODEL}/parts/p/journeys/complete/lifecycle-path`],
  ]) test(`account.md §items allow: ${why} exhaustion directs the affected item to the developer`, async () => {
    // account.md §what-it-is, §items: allow is this machine's, beside the account, and
    // no item waits for it; account.md §commands shows it with this machine's allowance.
    const { dir } = await fixture(options);
    const result = json(dir, ['missing']);
    const entries = result.items;
    const allow = result.here.allow;
    assert.equal(allow.why, why);
    assert.deepEqual(allow.supply, [developer('allow', 'carry or allow')]);
    item(entries, subject);
    assert.ok(!names(entries).includes('allow'));
    for (const entry of entries) assert.ok(!itemNames(entry.waits).includes('allow'));
    const text = success(dir, ['missing']).stdout;
    const here = text.split(/^## /m).find((section) => /^[^\n]*this machine[^\n]*\n/i.test(section));
    assert.ok(here, 'allowance text is marked as this machine’s');
    assert.match(here, /\ballow\b/);
  });

  for (const [path, bytes, supplier] of [
    [CP, '# Unaccepted claim\n', [agent('restate'), { by: 'anyone' }]],
    ['design/foreign.txt', 'foreign\n', [{ by: 'anyone' }]],
    ['design/decisions/not-a-decision.md', '# No decision\n', [{ by: 'anyone' }]],
  ]) test(`account.md §items change: ${path} has the appropriate restoration suppliers`, async () => {
    // account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture();
    await writeFiles(dir, { [path]: bytes });
    const entry = item(missing(dir), `change:${path}`);
    assertItem(entry, { on: path, supply: supplier });
    assert.ok(entry.found);
  });

  test('account.md §items refused here: missing shows this machine’s recorded answer refusals beside the item', async () => {
    // account.md §items; door.md §scratch; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture();
    const name = 'cover:p';
    // door.md §forma-answer fixes reason objects, not strings.
    const reasons = [[{ check: 'models.md §model-answer', file: 'models/core/model.md', entry: null, field: 'Engine', says: 'Expected tlc or alloy.' }]];
    // door.md §scratch fixes both the filename digest and the refusal record form.
    await writeFiles(dir, { [`work/refused/${sha256(name).slice(0, 12)}.json`]: jsonText({ item: name, refusals: reasons }) });
    assert.ok(JSON.stringify(item(missing(dir), name).refused).includes(reasons[0][0].says));
    const clean = await cloneWithout(dir, []);
    assert.ok(!Object.hasOwn(item(missing(clean), name), 'refused'));
  });

  test('account.md §items waiting order: part-list confirmation precedes lifecycle findings', async () => {
    // account.md §items; lifecycle-tool.md §findings; presentation.md §reading fixes reading fields, lifecycle-tool.md fixes item fields.
    const { dir } = await fixture({ confirmParts: false, confirmLifecycle: false, edit: (files) => { files[LP] = files[LP].replace('| idle | done |', '| idle |  |'); } });
    const waits = itemNames(item(missing(dir), `confirm:${LIFE}`).waits);
    assert.ok(waits.includes('confirm:parts'));
    assert.ok(waits.indexOf('findings:p') > waits.indexOf('confirm:parts'));
  });

  test('account.md §items offered journey: its confirmation waits for the written journey reaching its phase', async () => {
    // account.md §items; design.md §code-journeys; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture({ confirmJourney: false });
    assert.ok(itemNames(item(missing(dir), 'confirm:p/journeys/reach-state--done').waits).includes(`confirm:${JOURNEY}`));
  });
});

describe('account.md §what-it-is to §items — clarified read and item boundaries', () => {
  test('account.md §items restate: premises and boundary rows cannot share a key in one part', async () => {
    // forms.md §page-rules; design.md §restate-checks; design.md §at-read; account.md §items.
    const { dir } = await fixture({ premise: true, confirmClaim: false, edit: (files) => {
      files['design/parts/p/boundary.md'] += `| trust | Trust service | service | machine | - | - | - | - | added | ${CITE} |\n`;
    } });
    const entries = missing(dir);
    assert.equal(item(entries, 'restate:p').why, 'unresolved');
    assert.ok(!names(entries).includes(`change:${PP}`));
    assert.ok(!names(entries).includes('change:design/parts/p/boundary.md'));
  });

  test('account.md §what-it-is lifecycle matrix: Phase may follow action columns without changing confirmation or standing', async () => {
    // forms.md §page-rules; forms.md §lifecycles; design.md §pins; account.md §standing.
    const f = await fixture();
    f.files[LP] = f.files[LP].replace('| Phase | finish |', '| finish | Phase |').replace('| idle | done |', '| done | idle |');
    seal(f.files, f.pins);
    await writeFiles(f.dir, f.files);
    const entries = names(missing(f.dir));
    assert.ok(!entries.includes(`change:${LP}`));
    assert.ok(!entries.includes('restate:p'));
    assert.ok(!entries.includes(`confirm:${LIFE}`));
    json(f.dir, ['run']);
    assert.equal(claim(account(f.dir)).standing, 'established');
  });

  for (const [location, change] of [
    ['Phase column', (text) => text.replace('| idle | done |', '|  | done |')],
    ['field value', (text) => replaceField(text, 'Ends', '')],
  ]) test(`account.md §what-it-is lifecycle matrix: an empty ${location} counts for nothing`, async () => {
    // forms.md §page-rules; design.md §at-read; account.md §what-it-is.
    const f = await fixture();
    f.files[LP] = change(f.files[LP]);
    seal(f.files, f.pins);
    await writeFiles(f.dir, f.files);
    assert.ok(names(missing(f.dir)).includes(`change:${LP}`));
  });

  for (const posed of [false, true]) test(`account.md §what-it-is lifecycle stepping: an ${posed ? 'unpicked posed' : 'empty'} cell ends the journey unchecked`, async () => {
    // forms.md §page-rules; forms.md §lifecycles; lifecycle-tool.md §stepping; lifecycle-tool.md §findings; account.md §what-it-is.
    const { dir } = await fixture({ confirmLifecycle: false, confirmJourney: false, edit: (files) => {
      files[LP] = files[LP].replace('| idle | done |', `| idle | ${posed ? 'choice:route' : ''} |`).replace('| done | done |', '| done | None. |');
      files[JP] += '| 2 | Ticket worker | finish | - | - | - |\n';
      if (posed) {
        const alternative = (negative) => fields([['Polarity', negative ? 'must not' : 'should happen'], ['Expected end', negative ? '-' : 'The ticket is done.'], ['Refused step', negative ? '1' : '-']])
          + '\n' + table(['Step', 'Actor', 'Action', 'Arguments', 'Entity', 'Case'], [[1, 'Ticket worker', 'finish', '-', '-', '-']])
          + '\n' + table(['Lifecycle', 'Phase', 'Action', 'Outcome'], [['state', 'idle', 'finish', negative ? 'None.' : 'done']]);
        files['design/parts/p/choices/route/README.md'] = page('Completion route', [['Question', 'Which completion path should be used?'], ['Recommendation', 'a: Complete directly.'], ['Cites', CITE]]) + `\n## a\n\n${alternative(false)}\n## b\n\n${alternative(true)}`;
      }
    } });
    const entries = missing(dir);
    assert.ok(!names(entries).includes(`change:${LP}`));
    assert.ok(!names(entries).includes('restate:p'));
    const findings = JSON.stringify(item(entries, 'findings:p').found);
    assert.match(findings, /unchecked/);
    assert.match(findings, /complete/);
    assert.doesNotMatch(findings, /step-refused/);
    assert.ok(itemNames(item(entries, `confirm:${JOURNEY}`).waits).includes('findings:p'));
  });

  test('account.md §items freeze: an owed slot not read by the question waits and even identical bytes are refused', async () => {
    // models.md §freeze freezes every slot of this claim, independently of basis;
    // account.md §items makes its owed slot wait. Answers holding it are refused
    // whatever their bytes (door.md §forma-answer preserves tracked files on refusal).
    const f = await fixture();
    const surprise = await addSurprise(f, { question: `${QUESTION}/base`, kind: 'base', expected: { outcome: 'no violation' }, found: { outcome: 'violation', property: 'forbidden form' } });
    const rows = f.files[`${SLOT}/receipt`].trimEnd().split('\n').map(JSON.parse);
    rows.find((row) => row.file === 'witness-done.md').pins.find((pin) => pin.entry === CLAIM).pin = sha256('older claim');
    f.files[`${SLOT}/receipt`] = rows.map((row) => JSON.stringify(row) + '\n').join('');
    await writeFiles(f.dir, f.files);
    assert.ok(itemNames(item(missing(f.dir), `slot:${QUESTION}/witness-done`).waits).includes(`rule:${surprise.name}`));
    const answer = await project(null, { [`${SLOT}/witness-done.md`]: f.files[`${SLOT}/witness-done.md`] });
    const before = await snapshot(f.dir, { skip: ['work', 'runs'] });
    const result = forma(f.dir, ['answer', `slot:${QUESTION}/witness-done`, answer, '--provider', 'fixture', '--model', 'writer', '--session', 'same-frozen', '--json']);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.json?.accepted, false, result.stderr);
    assert.deepEqual(await snapshot(f.dir, { skip: ['work', 'runs'] }), before);
    assert.ok(names(missing(f.dir)).includes(`rule:${surprise.name}`));
  });

  test('account.md §what-it-is freeze: a new accepted slot absent from held is discounted', async () => {
    // models.md §freeze: a slot of the surprised claim not in held is new and
    // counts for nothing, even with a matching receipt; door.md §read-checks to §change and
    // account.md §what-it-is, §items expose the change while the surprise remains open.
    const f = await fixture();
    const surprise = await addSurprise(f);
    f.files[`${SLOT}/witness-other.md`] = f.files[`${SLOT}/witness-done.md`].replace('An idle ticket can complete.', 'A second completion witness.');
    seal(f.files, f.pins);
    await writeFiles(f.dir, f.files);
    const entries = names(missing(f.dir));
    assert.ok(entries.includes(`change:${SLOT}/witness-other.md`));
    assert.ok(entries.includes(`rule:${surprise.name}`));
  });

  test('account.md §items offered journey: its exact key is stable when a written journey confirmation comes and goes', async () => {
    // design.md §code-journeys; account.md §items, §commands.
    const f = await fixture({ confirmJourney: false });
    const offered = 'p/journeys/reach-state--done';
    assert.ok(names(missing(f.dir)).includes(`confirm:${offered}`));
    assert.equal(account(f.dir, offered).scope, offered);
    const confirmedFiles = { ...f.files };
    const confirmed = decision(confirmedFiles, { kind: 'confirm', on: JOURNEY, pin: f.pins[JOURNEY], index: 20 });
    const confirmedDir = await project(null, confirmedFiles);
    assert.ok(!names(missing(confirmedDir)).includes(`confirm:${offered}`));
    delete confirmedFiles[confirmed.path];
    const restoredDir = await project(null, confirmedFiles);
    assert.ok(names(missing(restoredDir)).includes(`confirm:${offered}`));
    assert.equal(account(restoredDir, offered).scope, offered);
  });

  test('account.md §items repair model: a real finding on a journey accepts a model repair without a claim fault', async () => {
    // account.md §items; decisions.md §rulings, §expects; models.md §model-repair.
    const f = await fixture();
    const surprise = await addSurprise(f, { question: `${MODEL}/parts/p/journeys/complete/lifecycle-path`, kind: 'lifecycle-path', expected: { outcome: 'admitted' }, found: { outcome: 'refused', step: 1 } });
    const rule = await ruling(f, surprise, { target: MODEL, targetPin: '-' });
    const repair = `repair:${rule.name}/${MODEL}`;
    assert.ok(names(missing(f.dir)).includes(repair));
    assert.ok(!names(missing(f.dir)).includes(`repair:${rule.name}`));
    const beforeFault = await read(f.dir, `${SLOT}/fault-reset.md`);
    const answer = await project(null, {
      [LP]: f.files[LP].replace('| done | done |', '| done | None. |'),
      'repair.md': fields([['Mechanism', 'Refuse repeated completion after the ticket is done.']]),
    });
    const accepted = json(f.dir, ['answer', repair, answer, '--provider', 'fixture', '--model', 'writer', '--session', 'journey-repair']);
    // door.md §repair-answer; models.md §model-repair: the question is the expectation when no ruled surprise is on a claim.
    assert.equal(accepted.accepted, true);
    assert.equal(await read(f.dir, `${SLOT}/fault-reset.md`), beforeFault);
    assert.ok(!names(missing(f.dir)).includes(repair));
  });
});

describe('account.md §waits — developer checkpoints and settings', () => {
  test('account.md §waits: developer suppliers use confirm and carry or allow checkpoints and redirect is never an item', async () => {
    // account.md §waits fixes these checkpoints and excludes redirect items;
    // account.md §commands gives the supplier objects used here.
    const { dir } = await fixture({ confirmClaim: false, premise: true, carryBound: false });
    const items = missing(dir);
    assert.deepEqual(item(items, `confirm:${CLAIM}`).supply, [developer('confirm', 'confirm')]);
    assert.deepEqual(item(items, 'carry:p/premises/trust').supply, [carried]);
    assert.ok(items.every((entry) => !entry.item.startsWith('redirect')));
  });

  for (const cadence of ['span', 'question', 'session']) test(`account.md §waits cadence ${cadence}: presentation settings change neither the item set nor standing`, async () => {
    // account.md §waits limits cadence/cap to presentation; decisions.md
    // decisions.md §intake makes this zero-increment allowance change only those settings.
    const f = await fixture({ confirmClaim: false, premise: true });
    const beforeItems = missing(f.dir), beforeClaim = claim(account(f.dir));
    decision(f.files, { kind: 'allow', on: 'allow', rows: allowanceRows({ answers: 0, runs: 0, seconds: 0, cadence, cap: 0 }).map(([k, v]) => [k, k.endsWith('megabytes') ? 0 : v]), index: 9 });
    await writeFiles(f.dir, f.files);
    assert.deepEqual(names(missing(f.dir)).sort(), names(beforeItems).sort());
    assert.deepEqual(claim(account(f.dir)), beforeClaim);
  });

  test('account.md §waits inbox cap: zero still names every waiting developer item', async () => {
    // account.md §waits keeps every developer item named even at cap zero.
    const { dir } = await fixture({ cap: 0, confirmClaim: false, premise: true, carryBound: false });
    const items = missing(dir);
    const text = success(dir, ['missing']).stdout;
    for (const entry of items.filter((entry) => entry.supply.some((s) => s.by === 'developer'))) assert.ok(text.includes(entry.item));
  });
});

describe('account.md §basis-line — basis lines', () => {
  test('account.md §basis-line: an established lifecycle claim names phase bounds, caught faults, reached witnesses and their evidence', async () => {
    // account.md §basis-line specifies every contribution and its question;
    // presentation.md §reading fixes the basis fields and the literal lifecycle bound.
    const { dir, decisions } = await examined();
    const basis = modelClaim(account(dir)).basis;
    required(basis, ['bounds', 'faults', 'witnesses', 'premises', 'mechanisms', 'evidence']);
    assert.deepEqual(basis.mechanisms, []);
    assert.equal(basis.bounds, 'phase level');
    assert.deepEqual(basis.faults, [{ question: `${QUESTION}/fault-reset`, mechanism: 'Completion preserves the done phase.' }]);
    assert.equal(basis.witnesses.length, 1);
    keys(basis.witnesses[0], ['question', 'meaning', 'journey']);
    assert.equal(basis.witnesses[0].question, `${QUESTION}/witness-done`);
    assert.equal(basis.witnesses[0].meaning, 'An idle ticket can complete.');
    assert.ok(basis.witnesses[0].journey);
    assert.deepEqual(basis.evidence.map((e) => e.question).sort(), ['base', 'fault-reset', 'witness-done'].map((s) => `${QUESTION}/${s}`).sort());
    const bound = basis.premises.find((p) => p.premise === `bound:${MODEL}/p/sticks`);
    // account.md §basis-line to presentation.md §reading: a basis names the premise; Assumed owns its details.
    keys(bound, ['premise']);
    const assumed = account(dir).parts[0].assumed.find((p) => p.premise === bound.premise);
    required(assumed, ['statement', 'class', 'falsifier', 'carry']);
    assert.equal(assumed.carry.decision, decisions.bound.name);
    assert.equal(assumed.carry.by, 'Ada');
    assert.equal(assumed.carry.at, decisions.bound.at);
  });

  test('account.md §basis-line: evidence measures and versions in the basis agree with the files at each read', async () => {
    // account.md §basis-line, presentation.md §reading derive these values from evidence
    // at every read; evidence.md §keys fixes established's UTC timestamp.
    const { dir } = await examined();
    const basis = modelClaim(account(dir)).basis;
    for (const entry of basis.evidence) {
      const recorded = JSON.parse(await read(dir, `models/${entry.question}.json`));
      // presentation.md §reading calls these fields by evidence.md's names; versions live in its
      // basis, while limits/measures/flags are direct evidence fields.
      assert.deepEqual(entry.limits, recorded.limits);
      assert.deepEqual(entry.measures, recorded.measures);
      // evidence.md §measures: duration and this engine's own measures, no others.
      keys(entry.measures, ['duration', 'combinations']);
      assert.ok(JSON.stringify(entry).includes(recorded.basis.runtime.version));
      assert.ok(JSON.stringify(entry).includes(recorded.basis.forma.version));
      assert.match(recorded.established, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    }
    const old = JSON.parse(await read(dir, `models/${QUESTION}/base.json`));
    old.measures.duration += 17;
    await writeFiles(dir, { [`models/${QUESTION}/base.json`]: evidenceFile(old) });
    assert.equal(modelClaim(account(dir)).basis.evidence.find((e) => e.question === `${QUESTION}/base`).measures.duration, old.measures.duration);
  });

  test('account.md §basis-line: an unestablished claim still displays model bounds and uncarried premises', async () => {
    // account.md §basis-line qualifies unestablished claims too; presentation.md §reading
    // gives bounds/premises and reserves basis for established model standings.
    const { dir } = await fixture({ premise: true, carryBound: false });
    const local = modelClaim(account(dir));
    assert.equal(local.bounds, 'phase level');
    const text = JSON.stringify(local.premises);
    assert.ok(text.includes('p/premises/trust'));
    assert.ok(text.includes(`bound:${MODEL}/p/sticks`));
    assert.ok(!Object.hasOwn(local, 'basis'));
  });

  test('account.md §basis-line: accepted risk shows its words, author, time and lack of examination', async () => {
    // account.md §basis-line fixes accepted wording and premise status;
    // presentation.md §reading fixes acceptance fields and carry only when in force.
    const { dir, decisions } = await fixture({ noLifecycle: true, premise: true, accept: true });
    const c = claim(account(dir));
    assert.equal(c.standing, 'accepted');
    assert.deepEqual(c.acceptance, { decision: decisions.acceptance.name, words: decisions.acceptance.words, by: 'Ada', at: decisions.acceptance.at });
    const text = success(dir, ['account', CLAIM]).stdout;
    assert.match(text, /accepted/i);
    assert.match(text, /not examined/i);
    assert.ok(text.includes('The worker reports completion faithfully.'));
    assert.ok(!Object.hasOwn(account(dir).parts[0].assumed.find((p) => p.premise === 'p/premises/trust'), 'carry'));
  });
});

function walkObjects(value) {
  if (!value || typeof value !== 'object') return [];
  return [value, ...Object.values(value).flatMap(walkObjects)];
}
function readingEntry(value, ref, key) {
  const entry = walkObjects(value).find((e) => e.ref === ref && Object.hasOwn(e, key));
  assert.ok(entry, `missing ${ref} with ${key}`);
  return entry;
}
function assertOrder(text, needles) {
  let previous = -1;
  for (const needle of needles) {
    const index = text.indexOf(needle);
    assert.ok(index > previous, `expected ${needle} after previous heading`);
    previous = index;
  }
}

describe('presentation.md §reading — the reading', () => {
  test('presentation.md §reading JSON: project, allowance, coverage, model and part entries expose the fixed keys', async () => {
    // presentation.md §reading gives these fields; account.md §commands also requires
    // local refusals but gives no JSON location, so the root key set is not closed.
    // design.md §coverage defines covered passages; decisions.md §intake
    // gives allowance totals; presentation.md §reading keeps entry names.
    const { dir } = await fixture();
    const result = account(dir);
    required(result, ['scope', 'here', 'models', 'project', 'parts', 'cannotKnow']);
    assert.equal(result.scope, 'project');
    keys(result.here, ['answers', 'runs', 'engines']);
    assert.deepEqual(result.here.answers, { allowed: 100, spent: 0, left: 100 });
    assert.deepEqual(result.here.runs, { allowed: 100, spent: 0, left: 100 });
    keys(result.project, ['coverage', 'decided', 'items']);
    assert.deepEqual(result.project.coverage, { passages: 1, covered: 1 });
    const m = result.models.find((entry) => entry.model === MODEL);
    required(m, ['model', 'engine', 'parts', 'conforms', 'fails']);
    assert.equal(m.engine, 'lifecycle');
    assert.deepEqual(m.parts, ['p']);
    keys(result.parts[0], ['ref', 'name', 'span', 'open', 'accepted', 'established', 'assumed', 'decided', 'leftOut', 'lifecycles']);
    assert.equal(result.parts[0].ref, 'p');
    assert.equal(result.parts[0].name, 'Tickets');
    assert.equal(result.parts[0].span, false);
  });

  test('presentation.md §reading claim entry: developer language and entry name accompany every standing', async () => {
    // presentation.md §reading requires the developer's name, fields and ref.
    const { dir } = await fixture();
    const c = claim(account(dir));
    required(c, ['ref', 'name', 'sentence', 'kind', 'stake', 'standing', 'models']);
    assert.equal(c.name, 'Completion sticks');
    assert.equal(c.sentence, 'A done ticket never becomes idle.');
    assert.equal(c.kind, 'safety');
    assert.equal(c.stake, 'A completed ticket could be processed twice.');
    const text = success(dir, ['account']).stdout;
    assert.ok(text.includes(CLAIM));
    assert.ok(text.includes(c.name));
    // presentation.md §reading requires an addition marker but specifies neither its text syntax nor
    // a JSON field. Its exact representation is reported as a contract gap.
  });

  test('presentation.md §reading Markdown: project sections and nonempty part headings follow the prescribed order', async () => {
    // presentation.md §reading fixes omissions and section order;
    // fixes heading levels and list entries without prescribing the project display name.
    const { dir } = await fixture({ premise: true });
    const text = success(dir, ['account']).stdout;
    assert.match(text, /^# [^\n]+\n/);
    assertOrder(text, ['## On this machine', '## Models', '## The project', '## Tickets', '### Open', '### Assumed', '### Decided', '### Lifecycles', '## What it cannot know']);
    assert.ok(!text.includes('### Left out'));
    assert.match(text, /^(?:[-*+]|\d+[.)]) /m);
  });

  test('presentation.md §reading reading order: named parts and spans precede omitted entries in key order', async () => {
    // presentation.md §reading follows forms.md §reading-order:
    // listed destinations first, then unnamed parts/spans by key.
    const { dir } = await fixture({ noLifecycle: true, confirmParts: false, edit: (files) => {
      addSpan(files);
      files['design/spans/shared/README.md'] = '# Shared completion\n\nCompletion connects tickets and receipts.\n';
      files['design/README.md'] = files['design/README.md'].replace('1. [Tickets](parts/p/)', '1. [Receipts](parts/q/)\n2. [Shared completion](spans/shared/)');
    } });
    assert.deepEqual(account(dir).parts.map((p) => [p.ref, p.span]), [['q', false], ['shared', true], ['p', false]]);
  });

  test('presentation.md §reading exception order: open claims precede established claims and journeys', async () => {
    // presentation.md §reading places Open before Established; account.md §box
    // preserves developer language, including this added claim's word guarantee.
    const f = await examined();
    f.files = await snapshot(f.dir, { skip: ['work', 'runs'] });
    f.files['design/parts/p/claims/other/README.md'] = replaceField(f.files[CP].replace('# Completion sticks', '# Another guarantee candidate'), 'Sentence', 'No receipt can be lost.');
    seal(f.files, f.pins);
    const dir = await project(null, f.files);
    const text = success(dir, ['account']).stdout;
    assertOrder(text, ['### Open', '### Established']);
    assert.ok(account(dir).parts[0].open.some((e) => e.ref === 'p/claims/other'));
    assert.ok(account(dir).parts[0].established.some((e) => e.ref === CLAIM));
  });

  test('presentation.md §reading Accepted heading: Markdown places accepted risk between Open and Established', async () => {
    // presentation.md §reading's heading table orders Open, Accepted, Established. A current
    // journey still conforms when the claim loses its base evidence (account.md §standing to §journey-rules).
    const f = await examined({ accept: true });
    const files = await snapshot(f.dir, { skip: ['work', 'runs'] });
    delete files[`models/${QUESTION}/base.json`];
    files['design/parts/p/claims/other/README.md'] = replaceField(files[CP].replace('# Completion sticks', '# Receipt preservation'), 'Sentence', 'A receipt is never lost.');
    seal(files, f.pins);
    const dir = await project(null, files);
    for (const args of [['account'], ['account', 'p']]) {
      assertOrder(success(dir, args).stdout, ['### Open', '### Accepted', '### Established']);
    }
    const part = account(dir).parts[0];
    assert.ok(part.open.some((entry) => entry.ref === 'p/claims/other'));
    assert.deepEqual(part.accepted.map((entry) => entry.ref), [CLAIM]);
    assert.ok(part.established.some((entry) => entry.ref === JOURNEY));
  });

  test('presentation.md §reading Accepted heading: establishment moves an accepted claim and omits the now-empty heading', async () => {
    // account.md §standing gives establishment precedence over accepted risk; presentation.md §reading puts
    // it under Established and omits a heading holding nothing.
    const { dir } = await fixture({ accept: true });
    assert.ok(account(dir).parts[0].accepted.some((entry) => entry.ref === CLAIM));
    json(dir, ['run']);
    const part = account(dir).parts[0];
    assert.deepEqual(part.accepted, []);
    assert.ok(part.established.some((entry) => entry.ref === CLAIM && entry.standing === 'established'));
    assert.doesNotMatch(success(dir, ['account', 'p']).stdout, /^### Accepted\s*$/m);
  });

  test('presentation.md §reading scope: one part keeps its allowance, covering models, entries and limitations', async () => {
    // presentation.md §reading fixes part scope, content and its heading.
    const { dir } = await fixture();
    const result = account(dir, 'p');
    assert.equal(result.scope, 'p');
    required(result, ['here', 'models', 'parts', 'cannotKnow']);
    assert.deepEqual(result.parts.map((p) => p.ref), ['p']);
    assert.deepEqual(result.models.map((m) => m.model), [MODEL]);
    assert.match(success(dir, ['account', 'p']).stdout, /^# Tickets\n/);
  });

  test('presentation.md §reading scope: an explicitly filed span can be read by its key', async () => {
    // presentation.md §reading accepts a span's key and span flag.
    const { dir } = await fixture({ edit: (files) => { files['design/spans/shared/README.md'] = '# Shared completion\n\nCompletion connects the parts.\n'; } });
    const result = account(dir, 'shared');
    assert.equal(result.scope, 'shared');
    assert.deepEqual(result.parts.map((p) => [p.ref, p.span]), [['shared', true]]);
  });

  for (const [scope, fieldName] of [[CLAIM, 'standing'], [JOURNEY, 'models'], [LIFE, 'picture']]) {
    test(`presentation.md §reading thing: ${scope} gives its page, evidence, items and decisions`, async () => {
      // presentation.md §reading fixes scoped content and evidence
      // fields but leaves the nested location of the thing entry open.
      const { dir } = await examined();
      const result = account(dir, scope);
      assert.equal(result.scope, scope);
      required(result.thing, ['page', 'evidence', 'items', 'decisions']);
      readingEntry(result.thing, scope, fieldName);
      for (const entry of result.thing.evidence) {
        keys(entry, ['question', 'model', 'outcome', 'current']);
      }
      if (scope === CLAIM) required(result.thing, ['premises', 'carries']);
    });
  }

  test('presentation.md §reading premise: states its class, falsifier, dependent claims and carry author', async () => {
    // presentation.md §reading specifies the premise, dependent claims
    // and carry; the fixture's explicit premise supplies the words and class.
    const { dir, decisions } = await fixture({ premise: true, carryPremise: true });
    const p = account(dir).parts[0].assumed.find((p) => p.premise === 'p/premises/trust');
    required(p, ['premise', 'statement', 'class', 'falsifier', 'claims', 'carry']);
    assert.equal(p.statement, 'The worker reports completion faithfully.');
    assert.equal(p.class, 'world');
    assert.equal(p.falsifier, 'A completion report disagrees with the ticket.');
    // presentation.md §reading does not fix the representation of a claims reference.
    assert.ok(JSON.stringify(p.claims).includes(CLAIM));
    assert.deepEqual(p.carry, { decision: decisions.premise.name, by: 'Ada', at: decisions.premise.at });
    const result = account(dir, 'p/premises/trust');
    assert.equal(result.scope, 'p/premises/trust');
    assert.ok(JSON.stringify(result.thing).includes(CLAIM));
  });

  test('presentation.md §reading decisions: an override shows the superseded decision and which one replaced it', async () => {
    // presentation.md §reading gives decision state/path/override;
    // decisions.md §in-force makes the later same-pin withdrawal supersede.
    const f = await fixture({ accept: true });
    const later = decision(f.files, { kind: 'accept', on: CLAIM, pin: f.pins[CLAIM], rows: [['Choice', 'withdraw']], index: 9 });
    await writeFiles(f.dir, f.files);
    const records = account(f.dir, CLAIM).thing.decisions;
    const old = records.find((d) => d.decision === f.decisions.acceptance.name);
    assert.equal(old.state, 'superseded');
    assert.equal(old.supersededBy, later.name);
    assert.equal(old.path, f.decisions.acceptance.path);
    assert.equal(records.find((d) => d.decision === later.name).state, 'in force');
  });

  test('presentation.md §reading decisions: a thing’s decisions remain readable from another permitted decisions folder', async () => {
    // presentation.md §reading retains path/state wherever filed;
    // decisions.md §in-force attaches decisions to their subject, not folder.
    const f = await fixture();
    const bytes = f.files[f.decisions.claim.path];
    delete f.files[f.decisions.claim.path];
    const moved = `design/decisions/${f.decisions.claim.name}.md`;
    f.files[moved] = bytes;
    const dir = await project(null, f.files);
    const entry = account(dir, CLAIM).thing.decisions.find((d) => d.decision === f.decisions.claim.name);
    assert.equal(entry.path, moved);
    assert.equal(entry.state, 'in force');
  });

  test('presentation.md §reading removed thing: its remaining decisions are listed and its page is absent', async () => {
    // presentation.md §reading explicitly retains decisions and omits page.
    const f = await fixture({ noLifecycle: true });
    delete f.files[CP];
    delete f.files['design/parts/p/claims/sticks/receipt'];
    f.files['design/parts/p/README.md'] = '# Tickets\n';
    seal(f.files, f.pins);
    const dir = await project(null, f.files);
    const result = account(dir, CLAIM);
    assert.ok(!Object.hasOwn(result.thing, 'page'));
    assert.ok(result.thing.decisions.some((d) => d.decision === f.decisions.claim.name));
  });

  test('presentation.md §reading lifecycles: the table, structured picture, phase classes and reached flags are exposed', async () => {
    // presentation.md §reading fixes lifecycle content and reached flags;
    // lifecycle-tool.md §as-read keeps source phases and transitions in the picture.
    const { dir } = await fixture();
    const before = account(dir).parts[0].lifecycles.find((entry) => entry.ref === LIFE).phases.find((phase) => phase.phase === 'done').reached;
    json(dir, ['run']);
    const life = account(dir).parts[0].lifecycles.find((entry) => entry.ref === LIFE);
    required(life, ['ref', 'name', 'table', 'picture', 'facts', 'phases', 'journeys']);
    assert.equal(life.name, 'Ticket state');
    assert.equal(life.picture.format, 1);
    assert.equal(life.picture.lifecycle, LIFE);
    assert.deepEqual(life.picture.phases.map(phase => phase.key), ['idle', 'done']);
    assert.equal(life.picture.initial.phase, 'idle');
    assert.deepEqual(life.picture.ends, ['done']);
    assert.deepEqual(life.picture.moves.map(move => [move.from, move.action, move.case, move.to]),
      [['idle', 'finish', null, 'done'], ['done', 'finish', null, 'done']]);
    assert.equal(life.picture.source, null);
    assert.deepEqual(life.picture.marks, []);
    assert.deepEqual(life.picture.basis.files.find(file => file.path === LP), { path: LP, sha256: sha256(await read(dir, LP)) });
    assert.deepEqual(life.phases.map((p) => p.phase).sort(), ['done', 'idle']);
    // presentation.md §reading: initial needs no journey; done is reached by the confirmed journey.
    assert.equal(life.phases.find((p) => p.phase === 'idle').class, 'initial');
    assert.equal(life.phases.find((p) => p.phase === 'done').class, 'covered by a confirmed journey');
    for (const p of life.phases) {
      keys(p, ['phase', 'class', 'reached']);
    }
    // presentation.md §reading changes reached status once current witness evidence
    // reaches done; gives the field but no scalar encoding for that status.
    assert.notDeepEqual(life.phases.find((p) => p.phase === 'done').reached, before);
    assert.ok(life.journeys.some((j) => j.ref === JOURNEY));
  });

  test('presentation.md §reading omission: the left-out entry gives passage, reason and confirmation state', async () => {
    // presentation.md §reading gives omission fields; this added omission
    // has no confirmation (design.md §units makes it a separate unit).
    const { dir } = await fixture({ edit: (files) => {
      files['design/brief/excluded.md'] = '# Billing\n\nBilling belongs elsewhere.\n';
      files['design/parts/p/omissions.md'] = `# Left out\n\n${table(['Passage', 'Reason'], [['design/brief/excluded.md#billing', 'Billing is outside ticket completion.']])}`;
    } });
    const entries = account(dir).parts[0].leftOut;
    assert.equal(entries.length, 1);
    keys(entries[0], ['passage', 'reason', 'confirmed']);
    assert.equal(entries[0].passage, 'design/brief/excluded.md#billing');
    assert.equal(entries[0].reason, 'Billing is outside ticket completion.');
    // presentation.md §reading names confirmed but does not fix its scalar encoding.
  });

  test('presentation.md §reading placement: a span obligation is read under the project and both component parts', async () => {
    // presentation.md §reading puts span items under project and both parts.
    const { dir } = await fixture({ noLifecycle: true, confirmParts: false, edit: (files) => addSpan(files) });
    const result = account(dir);
    item(result.project.items, 'span:p+q');
    for (const p of result.parts) item(p.open.filter((e) => e.item), 'span:p+q');
  });

  test('presentation.md §reading surprise: reading supplies its question, rendered journey and waiting items', async () => {
    // presentation.md §reading fixes surprise content; account.md §items
    // owes an explanation and ruling for this open, unexplained surprise.
    const f = await fixture();
    const s = await addSurprise(f);
    const entry = account(f.dir).parts[0].open.find((e) => e.surprise === s.name);
    keys(entry, ['surprise', 'question', 'journey', 'waits']);
    assert.equal(entry.question, s.question);
    assert.ok(itemNames(entry.waits).includes(`explain:${s.name}`));
  });

  for (const premise of [false, true]) test(`presentation.md §reading accepted placement: a claim with ${premise ? 'an uncarried premise' : 'no explicit premise'} appears only under Accepted`, async () => {
    // account.md §basis-line to presentation.md §reading: Accepted is its own heading, with acceptance details and
    // every model's failures; an uncarried premise does not remove acceptance.
    const { dir, decisions } = await fixture({ premise, accept: true });
    const part = account(dir).parts.find((entry) => entry.ref === 'p');
    assert.ok(!part.open.some((entry) => entry.ref === CLAIM));
    assert.ok(!part.established.some((entry) => entry.ref === CLAIM));
    const accepted = part.accepted.filter((entry) => entry.ref === CLAIM);
    assert.equal(accepted.length, 1);
    assert.equal(accepted[0].standing, 'accepted');
    assert.deepEqual(accepted[0].acceptance, { decision: decisions.acceptance.name, words: decisions.acceptance.words, by: 'Ada', at: decisions.acceptance.at });
    assert.ok(accepted[0].models.find((model) => model.model === MODEL).fails.some((failure) => failure.condition === 'examined'));
    const scoped = account(dir, 'p').parts[0];
    assert.ok(scoped.accepted.some((entry) => entry.ref === CLAIM));
  });

  test('presentation.md §reading refused here: the reading displays this machine’s answer refusal reasons', async () => {
    // account.md §what-it-is, §commands includes machine-local
    // answer refusals in the reading; door.md §scratch fixes the scratch form.
    // No layout or nested representation for a reason is prescribed.
    const { dir } = await fixture();
    const name = 'cover:p';
    // door.md §forma-answer fixes the stored reason's five fields.
    const reason = { check: 'models.md §model-answer', file: 'models/core/model.md', entry: null, field: 'Engine', says: 'Expected tlc or alloy.' };
    await writeFiles(dir, { [`work/refused/${sha256(name).slice(0, 12)}.json`]: jsonText({ item: name, refusals: [[reason]] }) });
    assert.ok(JSON.stringify(account(dir)).includes(reason.says));
    assert.ok(success(dir, ['account']).stdout.includes(reason.says));
    const clean = await cloneWithout(dir, []);
    assert.ok(!JSON.stringify(account(clean)).includes(reason.says));
    // account.md §what-it-is, §box excludes local refusals from box.
    assert.ok(!JSON.stringify(json(dir, ['box'])).includes(reason.says));
  });
});

describe('account.md §box — the box', () => {
  test('account.md §box JSON: an empty box has only claims, premises and cannotKnow', async () => {
    // account.md §box admits no claims/premises from an empty project;
    // fixes these top-level JSON keys.
    const result = json(await project(), ['box']);
    keys(result, ['claims', 'premises', 'cannotKnow']);
    assert.deepEqual(result.claims, []);
    assert.deepEqual(result.premises, []);
  });

  test('account.md §box: established claims enter with their model, bounds and carried premises', async () => {
    // account.md §box fixes established entries and premises;
    // account.md §basis-line gives phase-level bounds and presentation.md §reading its literal JSON form.
    const { dir } = await examined();
    const box = json(dir, ['box']);
    assert.equal(box.claims.length, 1);
    const c = box.claims[0];
    keys(c, ['ref', 'name', 'sentence', 'standing', 'models']);
    assert.equal(c.ref, CLAIM);
    assert.equal(c.standing, 'established');
    assert.equal(c.models.length, 1);
    keys(c.models[0], ['model', 'bounds', 'premises', 'mechanisms']);
    assert.deepEqual(c.models[0].mechanisms, []);
    assert.equal(c.models[0].model, MODEL);
    assert.equal(c.models[0].bounds, 'phase level');
    assert.ok(box.premises.some((p) => p.premise === `bound:${MODEL}/p/sticks`));
  });

  test('account.md §box: an accepted claim with no explicit premises enters as accepted and not examined', async () => {
    // account.md §box admits this accepted claim with no
    // explicit premises; account.md §basis-line, presentation.md §reading fixes acceptance details.
    const { dir, decisions } = await fixture({ noLifecycle: true, accept: true });
    const box = json(dir, ['box']);
    assert.equal(box.claims.length, 1);
    const c = box.claims[0];
    keys(c, ['ref', 'name', 'sentence', 'standing', 'acceptance', 'premises']);
    assert.equal(c.standing, 'accepted');
    assert.deepEqual(c.acceptance, { decision: decisions.acceptance.name, words: decisions.acceptance.words, by: 'Ada', at: decisions.acceptance.at });
    assert.deepEqual(c.premises, []);
    assert.match(success(dir, ['box']).stdout, /not examined/i);
  });

  test('account.md §box: accepted risk does not admit a claim whose premise is uncarried', async () => {
    // account.md §standing labels accepted risk; account.md §box excludes an
    // accepted claim with an uncarried explicit premise and excludes that premise.
    const { dir } = await fixture({ noLifecycle: true, premise: true, accept: true });
    assert.equal(claim(account(dir)).standing, 'accepted');
    assert.deepEqual(json(dir, ['box']).claims, []);
    assert.deepEqual(json(dir, ['box']).premises, []);
  });

  test('account.md §box: carrying its premise admits an accepted claim and exposes the falsifier and author', async () => {
    // account.md §box admits the accepted claim and fixes
    // the carried premise's words, decision, author and time.
    const { dir, decisions } = await fixture({ noLifecycle: true, premise: true, carryPremise: true, accept: true });
    const box = json(dir, ['box']);
    assert.equal(box.claims[0].ref, CLAIM);
    assert.deepEqual(box.premises, [{ premise: 'p/premises/trust', statement: 'The worker reports completion faithfully.', falsifier: 'A completion report disagrees with the ticket.', decision: decisions.premise.name, by: 'Ada', at: decisions.premise.at }]);
  });

  test('account.md §box: no unestablished claim, journey, decision or missing-work item enters the box', async () => {
    // account.md §box admits only established/qualifying accepted claims
    // and carried premises; fixes the box's top-level JSON keys.
    const { dir } = await fixture({ carryBound: false });
    const box = json(dir, ['box']);
    assert.deepEqual(box.claims, []);
    assert.deepEqual(box.premises, []);
    keys(box, ['claims', 'premises', 'cannotKnow']);
  });

  test('account.md §box Markdown: only the box uses the prescribed guarantee heading', async () => {
    // account.md §box restricts Forma's own words. This fixture has no
    // developer text containing guarantee, so all occurrences here are Forma's.
    const { dir } = await fixture();
    assert.match(success(dir, ['box']).stdout, /^# What the software may be said to guarantee\n/);
    for (const command of ['account', 'missing']) assert.doesNotMatch(success(dir, [command]).stdout, /\bguarantee\b/i);
  });

  test('account.md §box developer language: guarantee in a developer’s claim name and sentence is preserved', async () => {
    // account.md §box explicitly preserves developer names/sentences;
    // presentation.md §reading, account.md §box puts both in the reading/box.
    const name = 'Completion guarantee';
    const sentence = 'We guarantee that a done ticket never becomes idle.';
    const { dir } = await fixture({ noLifecycle: true, accept: true, edit: (files) => {
      files[CP] = replaceField(files[CP].replace('# Completion sticks', `# ${name}`), 'Sentence', sentence);
    } });
    const entry = claim(account(dir));
    assert.equal(entry.name, name);
    assert.equal(entry.sentence, sentence);
    const boxed = json(dir, ['box']).claims.find((entry) => entry.ref === CLAIM);
    assert.equal(boxed.name, name);
    assert.equal(boxed.sentence, sentence);
    for (const command of ['account', 'box']) {
      const text = success(dir, [command]).stdout;
      assert.ok(text.includes(name));
      assert.ok(text.includes(sentence));
    }
  });
});

describe('account.md §journey-rules — native journey rules', () => {
  for (const engine of ['tlc', 'alloy']) {
    test(`account.md §journey-rules ${engine}: journeys, progress, enabled and phases require current matching evidence`, { skip: !hasToolchain && 'toolchain absent' }, async () => {
      // account.md §journey-rules; evidence.md §question-names; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
      const { dir } = await native(engine);
      const m = account(dir).models.find((m) => m.model === 'core');
      for (const rule of ['journeys', 'progress', 'enabled', 'phases', ...(engine === 'alloy' ? ['facts'] : [])]) assert.ok(m.fails.some((f) => f.rule === rule), rule);
      json(dir, ['run']);
      const after = account(dir).models.find((m) => m.model === 'core');
      assert.equal(after.conforms, true);
      assert.deepEqual(after.fails, []);
    });

    test(`account.md §journey-rules ${engine} rows: a missing action row owes a model and makes it nonconforming`, { skip: !hasToolchain && 'toolchain absent' }, async () => {
      // account.md §journey-rules; account.md §items; models.md §parts-change; evidence.md §questions; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
      const { dir } = await native(engine, { editNative: (files) => { files['models/core/model.md'] = files['models/core/model.md'].replace('| p/finish | Finish | none |\n', ''); } });
      const m = account(dir).models.find((m) => m.model === 'core');
      assert.equal(m.conforms, false);
      const rows = m.fails.find((f) => f.rule === 'rows');
      assert.ok(rows);
      assert.ok(itemNames(rows.items).includes('model:core'));
      assert.ok(rows.found);
      assertItem(item(missing(dir), 'model:core'), { on: 'core', supply: [agent('model')] });
      assert.ok(!names(missing(dir)).some((n) => n.startsWith('run:core/')));
    });
  }

  test('account.md §journey-rules misbehaviours: every unstruck world-menu row needs enabled and witness evidence', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // account.md §journey-rules; evidence.md §question-names; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await native('tlc', { world: true });
    const m = account(dir).models.find((m) => m.model === 'core');
    for (const name of MENU) {
      assert.ok(m.fails.some((f) => f.rule === 'misbehaviours' && JSON.stringify(f.on).includes(name)));
      assert.ok(names(missing(dir)).some((n) => n.startsWith(`run:core/world/p/delivery/${name}.enabled.`)));
    }
    json(dir, ['run']);
    assert.equal(account(dir).models.find((m) => m.model === 'core').conforms, true);
  });

  test('account.md §journey-rules enabled: an action that is never enabled prevents conformance', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // account.md §journey-rules; evidence.md §questions; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await native('tlc', { editNative: (files) => { files['models/core/Ticket.tla'] = files['models/core/Ticket.tla'].replace("Finish == state' = 1", "Finish == /\\ FALSE /\\ state' = 1"); } });
    json(dir, ['run']);
    const f = account(dir).models.find((m) => m.model === 'core').fails.find((f) => f.rule === 'enabled');
    assert.ok(f);
    assert.equal(f.found, 'not reached');
  });

  test('account.md §journey-rules facts: inconsistent Alloy facts do not permit vacuous establishment', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // account.md §journey-rules; account.md §standing; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await native('alloy', { editNative: (files) => { files['models/core/Ticket.als'] += 'fact Impossible { no Ticket }\n'; } });
    json(dir, ['run']);
    assert.equal(modelClaim(account(dir), 'core').standing, 'not established');
    assert.ok(account(dir).models.find((m) => m.model === 'core').fails.some((f) => f.rule === 'facts' && f.found === 'not reached'));
  });

  test('account.md §journey-rules span unexamined: a covering model alone does not examine a two-part claim', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // account.md §journey-rules; account.md §items; forms.md §surface; account.md §box; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await native('tlc', { confirmParts: false, edit: (files) => addSpan(files, true), editNative: (files) => { files['models/core/model.md'] = replaceField(files['models/core/model.md'], 'Parts', 'p, q'); } });
    assert.equal(item(missing(dir), 'span:p+q').why, 'unexamined');
  });
});

describe('account.md §standing — standing across native models', () => {
  for (const engine of ['tlc', 'alloy']) test(`account.md §standing ${engine}: one established model is sufficient and standing is retained separately on each`, { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // account.md §standing; account.md §items; decisions.md §accept; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await native(engine, { editNative: (files) => {
      const extension = engine === 'tlc' ? 'tla' : 'als';
      delete files[`models/core/parts/p/claims/sticks/encoding.${extension}`];
      files['models/core/parts/p/claims/sticks/encoding.md'] = fields([['Cannot express', 'This model omits the relevant data.']]);
    } });
    json(dir, ['run']);
    const reading = account(dir);
    assert.equal(claim(reading).standing, 'established');
    assert.equal(modelClaim(reading).standing, 'established');
    assert.equal(modelClaim(reading, 'core').standing, 'not established');
    assert.ok(modelClaim(reading, 'core').fails.some((f) => f.condition === 'examined'));
    assert.ok(!names(missing(dir)).includes(`express:${CLAIM}`));
  });

  test('account.md §standing same bytes and bounds: evidence from changed model bytes supplies neither control nor witnesses', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // account.md §standing; evidence.md §flags; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await native();
    json(f.dir, ['run']);
    const entries = await snapshot(f.dir, { skip: ['work', 'runs'] });
    const nativeEvidence = Object.keys(entries).filter((p) => p.startsWith('models/core/parts/p/claims/sticks/') && /\/(fault|witness)-.*\.json$/.test(p));
    for (const path of nativeEvidence) {
      const value = JSON.parse(entries[path]);
      value.basis.files.find((file) => file.path === 'models/core/Ticket.tla').sha256 = sha256('different engine bytes');
      await writeFiles(f.dir, { [path]: evidenceFile(value) });
    }
    const local = modelClaim(account(f.dir), 'core');
    assert.equal(local.standing, 'not established');
    for (const condition of ['controlled', 'witnessed']) assert.ok(local.fails.some((f) => f.condition === condition));
  });

  test('account.md §standing strikes: every strike in force over a model’s parts qualifies its claims', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // account.md §standing; evidence.md §questions; account.md §box; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await native('tlc', { world: true });
    // decisions.md §carry fixes a strike pin independently of model bytes.
    const struck = decision(f.files, { kind: 'carry', on: 'strike:p/delivery/drop', pin: sha256('Strike: drop at Delivery service'), rows: [['Choice', 'carry'], ['Basis', '-']], words: 'an observed drop at Delivery service', index: 10, folder: 'design/parts/p/decisions' });
    await writeFiles(f.dir, f.files);
    json(f.dir, ['run']);
    const local = modelClaim(account(f.dir), 'core');
    assert.equal(local.standing, 'established');
    const premise = local.basis.premises.find((p) => p.premise === 'strike:p/delivery/drop');
    // account.md §basis-line to presentation.md §reading: the strike's carry is shown once, under Assumed.
    assert.deepEqual(premise, { premise: 'strike:p/delivery/drop' });
    const assumed = account(f.dir).parts[0].assumed.find(p => p.premise === premise.premise);
    assert.equal(assumed.carry.decision, struck.name);
    assert.ok(!names(missing(f.dir)).some((n) => n.startsWith('run:core/world/p/delivery/drop.')));
    assert.ok(json(f.dir, ['box']).premises.some((p) => p.premise === 'strike:p/delivery/drop'));
  });
});

describe('account.md §basis-line — native evidence basis', () => {
  test('account.md §basis-line TLC: bounds retain their meaning and small-search flags name their corroborating questions', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // account.md §standing, §basis-line gives establishment, bounds,
    // cleared flags and symmetry; presentation.md §reading names clearedBy without fixing its
    // nesting. evidence.md §flags flags this three-state model.
    const { dir } = await native();
    json(dir, ['run']);
    const local = modelClaim(account(dir), 'core');
    assert.equal(local.standing, 'established');
    assert.deepEqual(local.basis.bounds, [{ bound: 'constant Tickets', value: '{ticket}', meaning: 'One ticket.' }]);
    const base = local.basis.evidence.find((e) => e.question.includes('/base.'));
    // evidence.md §measures fixes exactly duration and TLC's own measures.
    for (const entry of local.basis.evidence) keys(entry.measures, ['duration', 'states', 'depth']);
    const encoded = JSON.stringify(base);
    assert.ok(encoded.includes('tiny-state-space'));
    assert.ok(encoded.includes('clearedBy'));
    assert.ok(encoded.includes('fault-reset.'));
    assert.ok(encoded.includes('witness-done.'));
    const text = success(dir, ['account', CLAIM]).stdout;
    assert.match(text, /symmetry/i);
    assert.match(text, /\bnone\b/i);
  });

  test('account.md §basis-line Alloy: its scope and step bounds appear with their meanings', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // account.md §standing establishes this corroborated model; account.md §basis-line
    // and presentation.md §reading requires every bound with its meaning, without list ordering.
    // evidence.md §bounds keeps bound values as normalized cell text.
    const { dir } = await native('alloy');
    json(dir, ['run']);
    const local = modelClaim(account(dir), 'core');
    assert.equal(local.standing, 'established');
    // evidence.md §measures fixes exactly duration and Alloy's own measures.
    for (const entry of local.basis.evidence) keys(entry.measures, ['duration', 'scope', 'steps', 'bitwidth']);
    assert.deepEqual([...local.basis.bounds].sort((a, b) => a.bound < b.bound ? -1 : a.bound > b.bound ? 1 : 0), [
      { bound: 'scope', value: '2', meaning: 'Two atoms per unconstrained signature.' },
      { bound: 'steps', value: '3', meaning: 'Three transition states.' },
    ]);
  });
});

// account.md §diff: a handwritten Git history, independent of a shell or source
// imports. Git's SHA-256 objects are framed type/length/NUL/payload. Stored
// DEFLATE blocks and Adler-32 encode loose objects without extra dependencies.
function gitZlib(bytes) {
  const chunks = [Buffer.from([0x78, 0x01])];
  for (let at = 0; at < bytes.length || at === 0; at += 65535) {
    const block = bytes.subarray(at, at + 65535), n = block.length;
    const header = Buffer.alloc(5);
    header[0] = at + n >= bytes.length ? 1 : 0;
    header.writeUInt16LE(n, 1);
    header.writeUInt16LE(n ^ 0xffff, 3);
    chunks.push(header, block);
  }
  let a = 1, b = 0;
  for (const byte of bytes) { a = (a + byte) % 65521; b = (b + a) % 65521; }
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(((b << 16) | a) >>> 0);
  return Buffer.concat([...chunks, checksum]);
}
async function gitHistory(dir, copies) {
  const objects = {};
  function object(type, value) {
    const payload = Buffer.isBuffer(value) ? value : Buffer.from(value);
    const raw = Buffer.concat([Buffer.from(`${type} ${payload.length}\0`), payload]);
    const oid = sha256(raw);
    objects[`.git/objects/${oid.slice(0, 2)}/${oid.slice(2)}`] = gitZlib(raw);
    return oid;
  }
  function gitTree(files) {
    const directories = new Map(), entries = [];
    for (const [path, content] of Object.entries(files)) {
      const slash = path.indexOf('/');
      if (slash < 0) entries.push({ name: path, mode: '100644', oid: object('blob', content) });
      else {
        const name = path.slice(0, slash);
        if (!directories.has(name)) directories.set(name, {});
        directories.get(name)[path.slice(slash + 1)] = content;
      }
    }
    for (const [name, children] of directories) entries.push({ name, mode: '40000', oid: gitTree(children) });
    entries.sort((a, b) => Buffer.compare(Buffer.from(a.name + (a.mode === '40000' ? '/' : '')), Buffer.from(b.name + (b.mode === '40000' ? '/' : ''))));
    return object('tree', Buffer.concat(entries.map(({ name, mode, oid }) => Buffer.concat([Buffer.from(`${mode} ${name}\0`), Buffer.from(oid, 'hex')]))));
  }
  const commits = [];
  for (let i = 0; i < copies.length; i++) {
    const identity = `Contract Writer <writer@example.test> ${1704067200 + i * 60} +0000`;
    const parent = i ? `parent ${commits[i - 1]}\n` : '';
    commits.push(object('commit', `tree ${gitTree(copies[i])}\n${parent}author ${identity}\ncommitter ${identity}\n\nContract copy ${i + 1}\n`));
  }
  await writeFiles(dir, {
    ...objects,
    '.git/config': '[core]\n\trepositoryformatversion = 1\n\tbare = false\n[extensions]\n\tobjectFormat = sha256\n',
    '.git/HEAD': 'ref: refs/heads/main\n', '.git/refs/heads/main': `${commits.at(-1)}\n`, ...copies.at(-1),
  });
  return commits;
}
const diffLines = (groups) => groups.flatMap((group) => group.lines);
function diffShape(value) {
  // account.md §diff fixes these keys. It leaves the representation of a
  // group under no change open, including its change field.
  keys(value, ['from', 'stale', 'changedOutcome', 'opened', 'closed', 'waiting', 'cannotKnow']);
  for (const list of ['stale', 'changedOutcome', 'opened', 'closed']) {
    assert.ok(Array.isArray(value[list]));
    for (const group of value[list]) {
      keys(group, Object.hasOwn(group, 'change') ? ['change', 'lines'] : ['lines']);
      if (group.change && typeof group.change === 'object') keys(group.change, ['kind', 'ref', 'then', 'now']);
      assert.ok(Array.isArray(group.lines));
      for (const line of group.lines) keys(line, ['kind', 'ref', 'then', 'now']);
    }
  }
}

describe('account.md §diff — diff', () => {
  test('account.md §diff folder: two empty projects have no changes, and intake waits now', async () => {
    // account.md §diff; account.md §items.
    const before = await project(), now = await project();
    const d = json(now, ['diff', before]);
    diffShape(d);
    assert.ok(Object.hasOwn(d.from, 'folder'));
    for (const key of ['stale', 'changedOutcome', 'opened', 'closed']) assert.deepEqual(d[key], []);
    assert.deepEqual(names(d.waiting), ['intake']);
    assert.deepEqual(d.waiting[0].supply, [developer('intake', 'intake')]);
  });

  test('account.md §diff folder: an existing folder wins even when there is no Git repository', async () => {
    // account.md §diff: identical copies have no differences.
    const f = await fixture();
    const before = await project(null, f.files);
    const d = json(f.dir, ['diff', before]);
    assert.deepEqual(d.stale, []);
    assert.deepEqual(d.opened, []);
    assert.deepEqual(d.closed, []);
  });

  test('account.md §diff commit: explicit commits resolve to their full name and read the project’s subtree', async () => {
    // account.md §diff; account.md §items.
    const f = await fixture({ noLifecycle: true });
    const root = await project();
    const prefix = (files) => Object.fromEntries(Object.entries(files).map(([path, value]) => [`nested/account/${path}`, value]));
    const commits = await gitHistory(root, [{ 'outside.md': 'Not part of the project.\n' }, prefix(f.files)]);
    const d = json(`${root}/nested/account`, ['diff', commits[0].slice(0, 12)]);
    assert.deepEqual(d.from, { commit: commits[0] });
    assert.ok(diffLines(d.closed).some((line) => line.ref === 'intake'));
    assert.ok(diffLines(d.opened).some((line) => line.ref === 'cover:p'));
  });

  test('account.md §diff default: uses the commit adding the latest decision, not the latest commit', async () => {
    // account.md §diff: latest decision, then its adding commit.
    const f = await fixture({ noLifecycle: true });
    const first = { ...f.files };
    decision(f.files, { kind: 'accept', on: CLAIM, pin: f.pins[CLAIM], rows: [['Choice', 'accept']], words: 'Accept for the pilot.', index: 20 });
    const last = { ...f.files, 'outside.md': 'A later unrelated change.\n' };
    const dir = await project();
    const commits = await gitHistory(dir, [first, f.files, last]);
    assert.deepEqual(json(dir, ['diff']).from, { commit: commits[1] });
  });

  test('account.md §diff default: equal decision times are ordered by computed decision name', async () => {
    // account.md §diff: decision name breaks equal-time ties.
    const f = await fixture({ noLifecycle: true });
    const base = { ...f.files };
    const a = decision(f.files, { kind: 'accept', on: CLAIM, pin: f.pins[CLAIM], rows: [['Choice', 'accept']], words: 'Accept A.', index: 20 });
    const b = decision(f.files, { kind: 'accept', on: CLAIM, pin: f.pins[CLAIM], rows: [['Choice', 'accept']], words: 'Accept B.', index: 20 });
    const [smaller, larger] = [a, b].sort((a, b) => a.name < b.name ? -1 : 1);
    const middle = { ...base, [larger.path]: f.files[larger.path] };
    const dir = await project();
    const commits = await gitHistory(dir, [base, middle, { ...middle, [smaller.path]: f.files[smaller.path] }]);
    assert.deepEqual(json(dir, ['diff']).from, { commit: commits[1] });
  });

  test('account.md §diff went stale: a superseded decision is grouped under its overriding decision', async () => {
    // account.md §diff: the stale state and its cause are fixed;
    // leave a non-item decision line's ref representation open.
    const f = await fixture({ noLifecycle: true, accept: true });
    const before = await project(null, f.files);
    const newer = decision(f.files, { kind: 'accept', on: CLAIM, pin: f.pins[CLAIM], rows: [['Choice', 'withdraw']], index: 9 });
    await writeFiles(f.dir, f.files);
    const d = json(f.dir, ['diff', before]);
    diffShape(d);
    const group = d.stale.find((g) => g.change?.kind === 'decision' && g.change.ref === newer.name);
    assert.ok(group);
    assert.ok(JSON.stringify(group.lines).includes('superseded'));
  });

  test('account.md §diff entry and passage batches: a citation edit groups its dependent lapse with each cause', async () => {
    // account.md §diff; account.md §items.
    const f = await fixture();
    const before = await project(null, f.files);
    await writeFiles(f.dir, { 'design/brief/ticket.md': f.files['design/brief/ticket.md'].replace('never returns', 'may return') });
    const d = json(f.dir, ['diff', before]);
    const passage = d.stale.find((g) => g.change?.kind === 'passage' && g.change.ref === CITE);
    const entry = d.stale.find((g) => g.change?.kind === 'entry' && g.change.ref === CLAIM);
    assert.ok(passage);
    assert.ok(entry);
    // account.md §diff leaves the non-item line's ref and then/now payload shapes
    // open; each cause must still have a stale dependent showing the lapse.
    for (const group of [passage, entry]) assert.ok(JSON.stringify(group.lines).includes('lapsed'));
    assert.ok(diffLines(d.opened).some((line) => line.ref === `confirm:${CLAIM}`));
  });

  test('account.md §diff closed: a confirmation closes its item in its decision’s change group', async () => {
    // account.md §diff; account.md §items.
    const f = await fixture({ confirmClaim: false });
    const before = await project(null, f.files);
    const confirmed = decision(f.files, { kind: 'confirm', on: CLAIM, pin: f.pins[CLAIM], index: 10 });
    await writeFiles(f.dir, f.files);
    const d = json(f.dir, ['diff', before]);
    const group = d.closed.find((g) => g.change?.kind === 'decision' && g.change.ref === confirmed.name);
    assert.ok(group?.lines.some((line) => line.ref === `confirm:${CLAIM}`));
    assert.ok(!names(d.waiting).includes(`confirm:${CLAIM}`));
  });

  test('account.md §diff surprise batches: a newly open surprise and its explanation and ruling items arrive together', async () => {
    // account.md §diff; account.md §items.
    const f = await fixture();
    const before = await project(null, f.files);
    const s = await addSurprise(f);
    const d = json(f.dir, ['diff', before]);
    const group = d.opened.find((g) => g.change?.kind === 'surprise' && g.change.ref === s.name);
    assert.ok(group);
    for (const ref of [s.name, `explain:${s.name}`, `rule:${s.name}`]) assert.ok(group.lines.some((l) => l.ref === ref), ref);
    assert.ok(names(d.waiting).includes(`rule:${s.name}`));
  });

  test('account.md §diff file batches: rewriting a current slot with the same outcome still goes stale', async () => {
    // account.md §diff; account.md §items: a changed basis owes a run.
    const f = await examined();
    const before = await cloneWithout(f.dir, []);
    const files = await snapshot(f.dir, { skip: ['work', 'runs'] });
    const path = `${SLOT}/witness-done.md`;
    files[path] = files[path].replace('An idle ticket can complete.', 'Completion is reachable from idle.');
    seal(files, f.pins);
    const now = await project(null, files);
    const d = json(now, ['diff', before]);
    const group = d.stale.find((g) => g.change?.kind === 'file' && g.change.ref === path);
    assert.ok(group);
    assert.ok(group.lines.length > 0);
    // account.md §diff leaves non-item line identifiers/payloads open. The required cause is
    // fixed; do not invent the shape of a claim-on-model or evidence reference.
    assert.ok(diffLines(d.opened).some((l) => l.ref === `run:${QUESTION}/witness-done`));
  });

  test('account.md §diff changed outcome: compares evidence outcomes even when the newer evidence is not current', async () => {
    // account.md §diff compares both outcomes regardless of
    // currency; evidence.md §currency makes a changed source hash stale.
    const f = await examined();
    const before = await cloneWithout(f.dir, []);
    const path = `models/${QUESTION}/base.json`;
    const value = JSON.parse(await read(f.dir, path));
    value.found = { outcome: 'unanswered', reason: 'time limit' };
    delete value.matches;
    value.basis.files.find((file) => !file.generated).sha256 = sha256('An earlier input that is no longer present.');
    await writeFiles(f.dir, { [path]: evidenceFile(value) });
    const d = json(f.dir, ['diff', before]);
    const changed = diffLines(d.changedOutcome);
    // account.md §diff allows a line to repeat under several causes.
    assert.ok(changed.length > 0);
    for (const line of changed) {
      assert.ok(JSON.stringify(line.then).includes('no violation'));
      assert.ok(JSON.stringify(line.now).includes('unanswered'));
    }
  });

  test('account.md §diff currency: generated-file and machine-version changes alone stale nothing in diff', async () => {
    // account.md §diff exempts versions/generated bytes; account.md §what-it-is
    // and account.md §items still make the live account owe its run.
    const f = await examined();
    const before = await cloneWithout(f.dir, []);
    const path = `models/${QUESTION}/base.json`;
    const value = JSON.parse(await read(f.dir, path));
    value.basis.runtime.version = 'v0.0.0';
    value.basis.forma.source = '000000000000';
    for (const file of value.basis.files) if (file.generated) file.sha256 = sha256(`old ${file.generated}`);
    await writeFiles(f.dir, { [path]: evidenceFile(value) });
    assert.equal(item(missing(f.dir), `run:${QUESTION}/base`).why, 'not-current');
    const d = json(f.dir, ['diff', before]);
    for (const key of ['stale', 'changedOutcome', 'opened', 'closed']) assert.deepEqual(d[key], []);
  });

  test('account.md §diff local state: neither copy’s spent allowance or refusals appears in diff', async () => {
    // account.md §diff; door.md §scratch fixes these files.
    const f = await fixture();
    const before = await project(null, f.files);
    const without = json(f.dir, ['diff', before]);
    for (const dir of [before, f.dir]) await writeFiles(dir, {
      'work/spent.json': jsonText({ answers: 100, runs: 100 }),
      [`work/refused/${sha256('cover:p').slice(0, 12)}.json`]: jsonText({ item: 'cover:p', refusals: [[{ check: 'door.md §forma-answer', file: null, entry: null, field: null, says: 'Local refusal sentinel.' }]] }),
    });
    assert.deepEqual(json(f.dir, ['diff', before]), without);
  });

  test('account.md §diff earlier-copy checks: an earlier unaccepted page is not treated as an established claim', async () => {
    // account.md §diff; account.md §what-it-is requires change:<path>.
    const f = await examined();
    const files = await snapshot(f.dir, { skip: ['work', 'runs'] });
    const before = await project(null, { ...files, [CP]: files[CP] + '\nUnaccepted addition.\n' });
    const d = json(f.dir, ['diff', before]);
    assert.ok(diffLines(d.closed).some((line) => line.ref === `change:${CP}`));
  });

  test('account.md §diff Markdown: five lists appear in the prescribed order', async () => {
    // account.md §diff fixes heading levels and list order.
    const f = await fixture(), before = await project(null, f.files);
    const text = success(f.dir, ['diff', before]).stdout;
    const headings = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1].toLowerCase());
    assert.deepEqual(headings.slice(0, 5), ['went stale', 'changed outcome', 'opened', 'closed', 'waits for the developer']);
    // account.md §diff does not fix the chronology disclaimer's words.
    // account.md §box allows developer-authored uses of "guarantee".
  });

  test('account.md §diff refusal: an explicit commit in a project outside Git refuses without changes', async () => {
    // account.md §diff, §commands.
    const { dir } = await fixture();
    await refusal(dir, ['diff', 'HEAD']);
  });

  test('account.md §diff refusal: default diff outside Git refuses without changes', async () => {
    // account.md §diff, §commands.
    const { dir } = await fixture();
    await refusal(dir, ['diff']);
  });

  test('account.md §diff refusal: Git cannot resolve the requested commit', async () => {
    // account.md §diff, §commands.
    const f = await fixture();
    await gitHistory(f.dir, [f.files]);
    await refusal(f.dir, ['diff', 'refs/heads/does-not-exist']);
  });

  test('account.md §diff refusal: default diff with no developer decision requires an earlier folder', async () => {
    // account.md §diff, §commands.
    const dir = await project();
    await gitHistory(dir, [{}]);
    await refusal(dir, ['diff']);
  });

  test('account.md §diff refusal: default diff with a latest decision never added by a commit requires a folder', async () => {
    // account.md §diff, §commands.
    const f = await fixture();
    const dir = await project();
    await gitHistory(dir, [{}]);
    await writeFiles(dir, f.files);
    await refusal(dir, ['diff']);
  });
});

describe('account.md §cannot-know — limits of knowledge', () => {
  for (const command of ['account', 'box', 'diff']) {
    test(`account.md §cannot-know ${command}: JSON includes the nine exact limitation sentences in order`, async () => {
      // account.md §cannot-know; presentation.md §reading to account.md §diff places them in cannotKnow.
      const { dir } = await fixture();
      const args = command === 'diff' ? ['diff', await project()] : [command];
      const result = json(dir, args);
      assert.deepEqual(result.cannotKnow, CANNOT_KNOW);
    });
    test(`account.md §cannot-know ${command}: Markdown ends with all nine limitations, including an empty account`, async () => {
      // account.md §cannot-know requires these sentences last, always.
      const dir = await project();
      const args = command === 'diff' ? ['diff', await project()] : [command];
      const text = success(dir, args).stdout;
      const normalized = text.replace(/\r\n/g, '\n').replace(/^[ \t]*>[ \t]?/gm, '')
        .replace(/^[ \t]*(?:\d+[.)]|[-*+])[ \t]+/gm, '')
        .replace(/[`*_~"“”]/g, '').replace(/\s+/g, ' ').trim();
      const expected = CANNOT_KNOW.join(' ');
      // account.md §cannot-know fixes sentences, not Markdown wrappers.
      assert.ok(normalized.replaceAll('`', '').endsWith(expected.replaceAll('`', '')));
    });
  }
});

describe('account.md §commands — commands', () => {
  test('account.md §commands missing JSON: one object holds here and every item, with suppliers in their fixed order', async () => {
    // account.md §commands; account.md §waits orders checkpoints.
    const { dir } = await fixture({ confirmClaim: false, premise: true });
    const result = json(dir, ['missing']);
    keys(result, ['here', 'items']);
    for (const entry of result.items) required(entry, ['item', 'supply', 'on']);
    const rank = (entry) => {
      const first = entry.supply[0];
      if (first.by === 'agent') return 0;
      if (first.by === 'run') return 1;
      return 2 + ['intake', 'confirm', 'decide', 'carry or allow'].indexOf(first.checkpoint);
    };
    const groups = new Map();
    assert.deepEqual(result.items.map(rank), result.items.map(rank).sort((a, b) => a - b));
    for (const entry of result.items) (groups.get(rank(entry)) ?? (groups.set(rank(entry), []), groups.get(rank(entry)))).push(entry.item);
    assert.deepEqual([...groups.keys()], [...groups.keys()].sort((a, b) => a - b));
    // account.md §commands: within each group dependencies precede their waiters.
    // Name order applies to independent items, not a global lexical sort.
    for (const group of groups.values()) {
      let hasDependencies = false;
      for (const name of group) {
        for (const dependency of group.filter(candidate => itemNames(item(result.items, name).waits).includes(candidate))) {
          hasDependencies = true;
          assert.ok(group.indexOf(dependency) < group.indexOf(name));
        }
      }
      if (!hasDependencies) assert.deepEqual(group, [...group].sort());
    }
  });

  test('account.md §commands missing Markdown: allowance comes first, groups are level two, and each item is listed', async () => {
    // account.md §commands fixes allowance first, heading levels and items.
    const { dir } = await fixture();
    const text = success(dir, ['missing']).stdout;
    assert.match(text.trimStart(), /^## /);
    for (const entry of missing(dir)) assert.ok(text.includes(entry.item));
    assert.match(text, /^(?:[-*+]|\d+[.)]) /m);
  });

  for (const command of ['missing', 'account', 'box', 'diff']) test(`account.md §commands ${command}: a successful read changes no project file`, async () => {
    // account.md §commands, door.md §lock: a command that only reads writes nothing in the project.
    const { dir } = await fixture();
    const before = await snapshot(dir);
    const args = command === 'diff' ? ['diff', await project()] : [command];
    json(dir, args);
    assert.deepEqual(await snapshot(dir), before);
  });

  for (const command of ['missing', 'account', 'box', 'diff']) test(`account.md §commands ${command}: a read of a project with no work folder creates none`, async () => {
    // account.md §commands, door.md §lock: a read writes nothing, so it makes no work/ and no ignore file in it.
    const f = await fixture();
    const files = Object.fromEntries(Object.entries(f.files).filter(([path]) => !path.startsWith('work/')));
    const dir = await project(null, files);
    const args = command === 'diff' ? ['diff', await project()] : [command];
    const before = await snapshot(dir);
    json(dir, args);
    assert.deepEqual(await snapshot(dir), before);
  });

  for (const command of ['missing', 'account', 'box', 'diff']) for (const state of ['missing', 'altered']) {
    test(`account.md §commands ${command}: ${state} scratch gitignores are no changes and a read leaves them as they are`, async () => {
      // door.md §change item 7: neither scratch ignore is a change. door.md §copies writes each
      // again at the next write in its folder; a read writes nothing, so it repairs neither.
      const f = await fixture();
      const clean = await project(null, f.files);
      const files = { ...f.files, 'work/spent.json': jsonText({ answers: 0, runs: 0 }), 'runs/local.txt': 'Scratch output.\n' };
      delete files['work/.gitignore'];
      if (state === 'altered') {
        files['work/.gitignore'] = 'altered work ignore\n';
        files['runs/.gitignore'] = 'altered runs ignore\n';
      }
      const dir = await project(null, files);
      const args = command === 'diff' ? ['diff', await project()] : [command];
      const expected = json(clean, args);
      const before = await snapshot(dir);
      assert.deepEqual(json(dir, args), expected);
      assert.deepEqual(await snapshot(dir), before);
    });
  }

  test('account.md §commands folders: a folder under design or models is not itself a foreign-file change', async () => {
    // door.md §read-checks to §change: "not Forma's" excludes folders. The unknown regular
    // children are changes, while the enclosing folders themselves are not.
    const { dir } = await fixture({ edit: (files) => {
      files['design/unknown/note.txt'] = 'Unknown design file.\n';
      files['models/unknown/note.txt'] = 'Unknown model file.\n';
    } });
    const items = missing(dir);
    for (const root of ['design', 'models']) {
      assert.ok(names(items).includes(`change:${root}/unknown/note.txt`));
      assert.ok(!names(items).includes(`change:${root}/unknown`));
    }
  });

  for (const scope of ['absent', 'p/claims/absent', 'p/widgets/state', 'p/journeys/reach-state--absent']) {
    test(`account.md §commands refusal: account rejects unknown scope ${scope}`, async () => {
      // account.md §commands: no design folder or generated journey has this name.
      const { dir } = await fixture();
      await refusal(dir, ['account', scope]);
    });
  }

  for (const [label, args] of [
    ['unknown command', ['no-such-command']],
    ['unknown option', ['account', '--no-such-option']],
    ['duplicate option', ['account', '--json']],
  ]) test(`account.md §commands and project.md §commands refusal: ${label}`, async () => {
    // project.md §commands; account.md §commands.
    const { dir } = await fixture();
    await refusal(dir, args);
  });

  test('account.md §commands and project.md §commands refusal: a project option naming no folder writes nothing', async () => {
    // project.md §commands fixes refusal status, one JSON object and no writes.
    const dir = await project();
    const missingDir = `${dir}/not-created`;
    const before = await snapshot(dir);
    const result = forma(missingDir, ['missing', '--json']);
    assert.equal(result.status, 1);
    assert.ok(result.json && typeof result.json === 'object' && !Array.isArray(result.json), `expected JSON refusal: ${result.stdout}\n${result.stderr}`);
    assert.notEqual(JSON.stringify(result.json), '{}', 'the refusal must print why');
    assert.deepEqual(await snapshot(dir), before);
  });

  test('account.md §commands intake: whitespace-only required words leave intake missing and the record unchanged', async () => {
    // decisions.md §kinds, §forma-decide refuses required words
    // containing only whitespace; account.md §items keeps intake owed.
    const { dir } = await fixture({ intake: false });
    const before = await snapshot(dir, { skip: ['work', 'runs'] });
    const result = forma(dir, ['decide', 'intake', '--situation', 'design new', '--answers', '100', '--runs', '100',
      '--tlc-seconds', '30', '--tlc-megabytes', '256', '--alloy-seconds', '30', '--alloy-megabytes', '256',
      '--lifecycle-seconds', '30', '--cadence', 'question', '--inbox-cap', '100', '--words', ' \t\n ',
      '--by', 'Ada', '--provider', 'fixture', '--model', 'developer', '--session', 'human-review', '--json']);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.ok(Array.isArray(result.json?.refused) && result.json.refused.length > 0, `expected refusal reasons: ${result.stdout}\n${result.stderr}`);
    assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
    assert.ok(names(missing(dir)).includes('intake'));
  });

  for (const kind of ['decline', 'accept']) test(`account.md §commands ${kind}: whitespace-only required words leave the claim and record unchanged`, async () => {
    // decisions.md §kinds, §forma-decide fixes refusal;
    // account.md §standing, §items leaves standing and confirmation owed.
    const { dir } = await fixture({ noLifecycle: true, confirmClaim: false });
    const shown = json(dir, ['show', kind, CLAIM]);
    const before = await snapshot(dir, { skip: ['work', 'runs'] });
    const result = forma(dir, ['decide', kind, CLAIM, '--shown', shown.token,
      ...(kind === 'accept' ? ['--choice', 'accept'] : []), '--words', ' \t\n ',
      '--by', 'Ada', '--provider', 'fixture', '--model', 'developer', '--session', 'human-review', '--json']);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.ok(Array.isArray(result.json?.refused) && result.json.refused.length > 0, `expected refusal reasons: ${result.stdout}\n${result.stderr}`);
    assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
    assert.ok(names(missing(dir)).includes(`confirm:${CLAIM}`));
    assert.equal(claim(account(dir)).standing, 'not established');
  });

  test('account.md §commands refused Restate: tracked files stay unchanged while the answer count and local reasons appear', async () => {
    // design.md §restate-applied to §restate-checks: a malformed page the answer holds refuses the whole
    // answer; forms.md §page-rules permits no empty Entity field. Existing failures elsewhere alone
    // do not refuse an answer under design.md §restate-applied.
    // door.md §forma-answer, §scratch fixes counting and
    // stored reasons; account.md §commands exposes them locally.
    const f = await fixture();
    const target = `change:${CP}`;
    await writeFiles(f.dir, { [CP]: `${f.files[CP]}\nUnaccepted modification.\n` });
    const answer = await project(null, {
      [CP]: replaceField(f.files[CP], 'Sentence', 'Completion persists after the finishing action.'),
      [LP]: replaceField(f.files[LP], 'Entity', ''),
    });
    const before = await snapshot(f.dir, { skip: ['work', 'runs'] });
    const spent = json(f.dir, ['missing']).here.answers.spent;
    const result = forma(f.dir, ['answer', target, answer, '--provider', 'fixture', '--model', 'writer', '--session', 'refused-restatement', '--json']);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.equal(result.json?.accepted, false);
    assert.ok(result.json.reasons.length > 0);
    assert.equal(result.json.answers.spent, spent + 1);
    assert.deepEqual(await snapshot(f.dir, { skip: ['work', 'runs'] }), before);
    const local = json(f.dir, ['missing']);
    assert.equal(local.here.answers.spent, spent + 1);
    const refused = item(local.items, target).refused;
    for (const reason of result.json.reasons) {
      // account.md §commands does not fix refusal nesting; the actual reason text is fixed.
      const encoded = JSON.stringify(reason.says).slice(1, -1);
      assert.ok(JSON.stringify(refused).includes(encoded));
      assert.ok(JSON.stringify(account(f.dir)).includes(encoded));
    }
    const stored = JSON.parse(await read(f.dir, `work/refused/${sha256(target).slice(0, 12)}.json`));
    assert.deepEqual(stored, { item: target, refusals: [result.json.reasons] });
  });

  for (const held of [false, true]) test(`account.md §commands Restate: an existing unresolved reference ${held ? 'in a held page refuses the answer' : 'in another part does not refuse the answer'}`, async () => {
    // design.md §restate-applied distinguishes failures in held pages from existing ones
    // elsewhere; design.md §at-read and account.md §items leave the latter to restate:q.
    const other = 'design/parts/q/claims/other/README.md';
    const f = await fixture({ noLifecycle: true, edit: (files) => {
      addSpan(files);
      files[other] = replaceField(replaceField(files[CP].replace('# Completion sticks', '# Receipt preservation'), 'Parts', 'q'), 'Rests on', 'absent');
    } });
    const target = `change:${CP}`;
    await writeFiles(f.dir, { [CP]: `${f.files[CP]}\nUnaccepted modification.\n` });
    const replacement = replaceField(f.files[CP], 'Sentence', 'Completion persists after finishing.');
    const answer = await project(null, { [CP]: replacement, ...(held ? { [other]: f.files[other] } : {}) });
    const before = await snapshot(f.dir, { skip: ['work', 'runs'] });
    const result = forma(f.dir, ['answer', target, answer, '--provider', 'fixture', '--model', 'writer', '--session', 'isolated-restatement', '--json']);
    assert.equal(result.status, held ? 1 : 0, result.stdout + result.stderr);
    assert.equal(result.json?.accepted, !held, result.stdout + result.stderr);
    if (held) {
      assert.deepEqual(await snapshot(f.dir, { skip: ['work', 'runs'] }), before);
      assert.ok(result.json.reasons.some((reason) => reason.file === other));
      assert.ok(names(missing(f.dir)).includes(target));
    } else {
      assert.equal(await read(f.dir, CP), replacement);
      assert.ok(!names(missing(f.dir)).includes(target));
    }
    assert.equal(item(missing(f.dir), 'restate:q').why, 'unresolved');
  });

  test('account.md §commands Restate: removing a premise creates a new unresolved reference in another part and refuses the answer', async () => {
    // design.md §restate-applied refuses a newly caused resolution failure outside the
    // answer; forms.md §page-rules, design.md §restate-holds allow a cross-part reference and this removal form.
    // account.md §items and door.md §forma-answer keep the original change item after refusal.
    const other = 'design/parts/q/claims/other/README.md';
    const f = await fixture({ noLifecycle: true, premise: true, edit: (files) => {
      addSpan(files);
      files[other] = replaceField(replaceField(files[CP].replace('# Completion sticks', '# Receipt preservation'), 'Parts', 'q'), 'Rests on', 'p/trust');
    } });
    const target = `change:${CP}`;
    await writeFiles(f.dir, { [CP]: `${f.files[CP]}\nUnaccepted modification.\n` });
    const answer = await project(null, { [CP]: replaceField(f.files[CP], 'Rests on', 'none'), 'removed.md': 'design/parts/p/premises/trust\n' });
    const before = await snapshot(f.dir, { skip: ['work', 'runs'] });
    const result = forma(f.dir, ['answer', target, answer, '--provider', 'fixture', '--model', 'writer', '--session', 'new-reference-failure', '--json']);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.equal(result.json?.accepted, false, result.stdout + result.stderr);
    assert.ok(result.json.reasons.some((reason) => reason.file === other));
    assert.deepEqual(await snapshot(f.dir, { skip: ['work', 'runs'] }), before);
    assert.ok(names(missing(f.dir)).includes(target));
  });
});

describe('account.md §what-it-is — read-time trust checks', () => {
  test('account.md §what-it-is sessions: an accepted page written by a decision-making session counts for nothing', async () => {
    // account.md §what-it-is; door.md §sessions, §read-checks; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await fixture({ writer: { provider: 'fixture', model: 'developer', session: 'human-review' } });
    const entries = missing(dir);
    assert.ok(names(entries).includes(`change:${CP}`));
    assert.ok(!account(dir).parts.flatMap((p) => [...p.open, ...p.accepted, ...p.established]).some((e) => e.ref === CLAIM));
  });

  test('account.md §what-it-is freeze: a rewritten accepted encoding frozen by an open surprise is discounted', async () => {
    // account.md §what-it-is; models.md §freeze; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await fixture();
    await addSurprise(f);
    f.files[`${SLOT}/encoding.md`] = f.files[`${SLOT}/encoding.md`].replace('| state | done | finish | idle |', '| state | idle | finish | idle |');
    seal(f.files, f.pins);
    await writeFiles(f.dir, f.files);
    assert.ok(names(missing(f.dir)).includes(`change:${SLOT}/encoding.md`));
  });
});

async function makeUnanswered(dir, seconds = 30) {
  // evidence.md §limits, §keys, §measures: a recorded timeout is from a run by itself;
  // unanswered evidence has no matches and no concurrency measure.
  const path = `models/${QUESTION}/base.json`;
  const value = JSON.parse(await read(dir, path));
  value.limits = { seconds };
  value.found = { outcome: 'unanswered', reason: 'time limit' };
  delete value.matches;
  value.flags = [];
  await writeFiles(dir, { [path]: evidenceFile(value) });
}
async function ruling(f, s, { target = 'premise:p/premises/trust', targetPin = f.pins['p/premises/trust'], verdict = 'real finding', index = 30 } = {}) {
  const entries = s.value.basis.entries.map((e) => [s.name, e.entry, e.pin]);
  const extra = `\n## Surprises\n\n${table(['Surprise', 'Question', 'Basis', 'Parts', 'Expected', 'Found'], [[s.name, s.question, s.digest, 'p', s.value.expected.outcome, s.value.found.outcome]])}\n${table(['Surprise', 'Entry', 'Pin'], entries)}`;
  // decisions.md §decision-file; door.md §clock:
  // a newly recorded ruling is later than the run it rules.
  const tracked = Object.values(f.files).flatMap((text) => [...text.matchAll(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g)].map((m) => Date.parse(m[0])));
  const at = new Date(Math.max(Date.now(), ...tracked) + 1).toISOString();
  const rule = decision(f.files, { kind: 'rule', on: s.name, rows: [['Verdict', verdict], ['Level', 'specification'], ['Target', target], ['Target pin', targetPin ?? '-'], ['Basis', '-']], words: 'Revise the assumption exposed by this result.', index, at, folder: 'design/parts/p/claims/sticks/decisions', extra, shown: `rule ${s.name}\nSurprise ${s.name}\n  Question: ${s.question}\n  Expected: ${s.value.expected.outcome}\n  Found: ${s.value.found.outcome}\nTarget\n  ${target}` });
  await writeFiles(f.dir, f.files);
  return rule;
}

describe('account.md §items — remaining evidence and decision item cases', () => {
  test('account.md §items unanswered: current evidence at current limits offers allow before model', async () => {
    // account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await examined();
    await makeUnanswered(dir);
    const entry = item(missing(dir), `unanswered:${QUESTION}/base`);
    assertItem(entry, { on: `${QUESTION}/base`, supply: [developer('allow', 'carry or allow'), agent('model')] });
    assert.ok(!names(missing(dir)).includes(`run:${QUESTION}/base`));
  });

  test('account.md §items run larger-limits: unanswered evidence at smaller limits is owed a run', async () => {
    // account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await examined();
    await makeUnanswered(dir, 1);
    assert.equal(item(missing(dir), `run:${QUESTION}/base`).why, 'larger-limits');
  });

  test('account.md §items run lost-surprise: an answered mismatch without a surprise or ruling must run again', async () => {
    // account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const { dir } = await examined();
    const path = `models/${QUESTION}/fault-reset.json`;
    const value = JSON.parse(await read(dir, path));
    value.found = { outcome: 'no violation' };
    value.matches = false;
    await writeFiles(dir, { [path]: evidenceFile(value) });
    assert.equal(item(missing(dir), `run:${QUESTION}/fault-reset`).why, 'lost-surprise');
  });

  test('account.md §items carry revoked: a real finding revokes the old carry and owes a lapsed carry', async () => {
    // account.md §items; decisions.md §in-force; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await fixture({ premise: true, carryPremise: true });
    const s = await addSurprise(f);
    const rule = await ruling(f, s);
    assert.equal(item(missing(f.dir), 'carry:p/premises/trust').why, 'lapsed');
    const carry = account(f.dir, 'p/premises/trust').thing.decisions.find((d) => d.decision === f.decisions.premise.name);
    assert.equal(carry.state, 'revoked');
    assert.equal(carry.revokedBy, rule.name);
  });

  test('account.md §items pick revoked: revocation reopens the pick while keeping its journeys in force', async () => {
    // account.md §items; decisions.md §in-force; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await fixture({ edit: addChoice });
    const picked = await pickChoice(f);
    const s = await addSurprise(f);
    await ruling(f, s, { target: 'choice:p/route', targetPin: choicePin(f.files) });
    assert.equal(item(missing(f.dir), 'pick:p/choices/route').why, 'revoked');
    const result = account(f.dir, 'p/journeys/route-a');
    assert.ok(result.thing.decisions.some((d) => d.decision === picked.name && d.state === 'in force'));
    failure(account(f.dir), 'carried');
  });

  test('account.md §items repair model: a ruling targeting a model owes the model-qualified repair name', async () => {
    // account.md §items; decisions.md §rulings; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await fixture();
    const s = await addSurprise(f);
    const rule = await ruling(f, s, { target: MODEL, targetPin: '-' });
    const entry = item(missing(f.dir), `repair:${rule.name}/${MODEL}`);
    assert.deepEqual(entry.supply, [agent('repair')]);
  });

  test('account.md §items reduction: a TLC surprise with its reductions absent owes the next reduction and holds the ruling', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await native('tlc', { editNative: (files) => { files['models/core/parts/p/claims/sticks/encoding.tla'] = 'Invariant == state = 0\n'; } });
    json(f.dir, ['run']);
    const files = await snapshot(f.dir, { skip: ['work', 'runs'] });
    const path = Object.keys(files).find((p) => /core\/parts\/p\/claims\/sticks\/base\..*\.surprise-[a-f0-9]+\.json$/.test(p));
    assert.ok(path);
    const s = JSON.parse(files[path]);
    for (const file of Object.keys(files)) if (file.startsWith(path.slice(0, -5)) && file.includes('.reduction-')) delete files[file];
    const dir = await project(null, files);
    const reduction = `run:${s.name}/reduction`;
    assert.deepEqual(item(missing(dir), reduction).supply, [{ by: 'run' }]);
    const wait = itemNames(item(missing(dir), `rule:${s.name}`).waits);
    assert.ok(wait.includes(`explain:${s.name}`));
    assert.ok(wait.indexOf(`explain:${s.name}`) < wait.indexOf(reduction));
  });

  test('account.md §items weaker: an accepted native explanation’s unrun weaker form owes its exact run name', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // account.md §items; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await native('tlc', { editNative: (files) => { files['models/core/parts/p/claims/sticks/encoding.tla'] = 'Invariant == state = 0\n'; } });
    json(f.dir, ['run']);
    const files = await snapshot(f.dir, { skip: ['work', 'runs'] });
    const path = Object.keys(files).find((p) => /core\/parts\/p\/claims\/sticks\/base\..*\.surprise-[a-f0-9]+\.json$/.test(p));
    assert.ok(path);
    const s = JSON.parse(files[path]), stem = path.slice(0, -5);
    const explanation = fields([['Question', s.question], ['Basis', sha256(jsonText(s.basis)).slice(0, 12)], ['Verdict', 'property wrong'], ['Level', 'specification'], ['Weaker', 'loose']]) + '\n## Trace\n\nThe ticket completed.\n\n## Failure shape\n\nCompletion was incorrectly forbidden.\n\n## Mechanism\n\nThe encoding forbids Finish from changing state.\n';
    const added = { [`${stem}.explained.md`]: explanation, [`${stem}.weaker-loose.tla`]: 'Invariant == state # 2\n' };
    const folder = path.slice(0, path.lastIndexOf('/'));
    const explainer = { provider: 'fixture', model: 'reviewer', session: 'explanation' };
    const lines = files[`${folder}/receipt`].trimEnd().split('\n').map(JSON.parse);
    for (const [file, content] of Object.entries(added)) lines.push({ file: file.slice(folder.length + 1), sha256: sha256(content), at: '2020-01-01T00:00:25.000Z', session: explainer, authors: [explainer] });
    Object.assign(files, added);
    files[`${folder}/receipt`] = lines.sort((a, b) => a.file < b.file ? -1 : 1).map((line) => JSON.stringify(line) + '\n').join('');
    const dir = await project(null, files);
    const name = `run:${s.name}/weaker-loose`;
    assert.deepEqual(item(missing(dir), name).supply, [{ by: 'run' }]);
    assert.ok(!names(missing(dir)).includes(`explain:${s.name}`));
  });
});

async function additionalJourney(f, { key, negative = false, start = false }) {
  const count = negative ? 2 : 1;
  const journey = `p/journeys/${key}`;
  const polarity = negative ? 'must not' : 'should happen';
  const end = negative ? '-' : 'The ticket is done.';
  const refused = negative ? '2' : '-';
  const pageText = page(key, [['Polarity', polarity], ['Expected end', end], ['Refused step', refused], ['Origin', 'added'], ['Cites', CITE]])
    + (start ? `\n${table(['Lifecycle', 'Entity', 'Phase'], [['state', 't', 'done']])}` : '')
    + `\n${table(['Step', 'Actor', 'Action', 'Arguments', 'Entity', 'Case'], Array.from({ length: count }, (_, i) => [i + 1, 'Ticket worker', 'finish', '-', '-', '-']))}`;
  const passage = sha256(f.files['design/brief/ticket.md'].trim().split(/\n\s*\n/).map((s) => s.replace(/\s+/g, ' ')).join('\n\n'));
  // design.md §pins: a start names its lifecycle's entity.
  const pin = sha256([`Polarity: ${polarity}`, `Expected end: ${end}`, `Refused step: ${refused}`, `Cites: ${passage}`, ...(start ? ['Start: Ticket | t | done'] : []), ...Array.from({ length: count }, (_, i) => `Step ${i + 1}: Ticket worker | Complete the ticket. | - | - | -`)].join('\n'));
  const folder = `design/parts/p/journeys/${key}`;
  f.files[`${folder}/README.md`] = pageText;
  const scheduleFolder = `models/core/parts/p/journeys/${key}`;
  const schedule = table(['Entity', 'Value'], start ? [['t', 'CHOOSE e \\in Tickets: TRUE']] : [])
    + (start ? `\n${table(['Start'], [['state = 1']])}` : '')
    + `\n${table(['Step', 'Bindings'], Array.from({ length: count }, (_, i) => [i + 1, 'none']))}`
    // engines.md §slot-forms: only the positive journey checks its expected done end.
    + (negative ? '' : '\n' + table(['Field', 'Value'], [['Meaning', end]]) + '\n```tla\nEnd == state = 1\n```\n');
  f.files[`${scheduleFolder}/schedule.md`] = schedule;
  f.files[`${folder}/receipt`] = JSON.stringify({ file: 'README.md', sha256: sha256(pageText), at: WHEN, session: WRITER, authors: [WRITER] }) + '\n';
  f.files[`${scheduleFolder}/receipt`] = JSON.stringify({ file: 'schedule.md', sha256: sha256(schedule), at: WHEN, session: WRITER, authors: [WRITER], pins: [{ entry: 'p/actions/finish', pin: nativePins(f).action }, { entry: journey, pin }] }) + '\n';
  decision(f.files, { kind: 'confirm', on: journey, pin, folder: `${folder}/decisions`, index: 15, shown: `confirm ${journey}\nActions:\n  p/finish | Complete the ticket. | none | none\njourneys ${key}\n${pageText.split('\n').filter((s) => s.startsWith('|') && !s.includes('---')).map((s) => `  ${s}`).join('\n')}\nCites ${CITE}:\n${f.files['design/brief/ticket.md'].trimEnd().split('\n').map((s) => `  ${s}`).join('\n')}` });
  await writeFiles(f.dir, f.files);
  return journey;
}

describe('account.md §journey-rules — native journey question variants', () => {
  test('account.md §journey-rules journeys: a negative journey needs both its prefix path and refusal, and an enabled refusal fails', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // account.md §journey-rules; evidence.md §question-names; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await native();
    const journey = await additionalJourney(f, { key: 'no-second-finish', negative: true });
    const items = names(missing(f.dir));
    for (const stem of ['path-to-1', 'refusal-at-2']) assert.ok(items.some((name) => name.startsWith(`run:core/parts/p/journeys/no-second-finish/${stem}.`)));
    json(f.dir, ['run']);
    const model = account(f.dir).models.find((m) => m.model === 'core');
    assert.equal(model.conforms, false);
    assert.ok(model.fails.some((f) => f.rule === 'journeys' && JSON.stringify(f.on).includes(journey) && JSON.stringify(f.found).includes('enabled')));
  });

  test('account.md §journey-rules journeys: a journey with a start needs current reached start evidence as well as its path', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // account.md §journey-rules; evidence.md §question-names; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await native();
    await additionalJourney(f, { key: 'already-done', start: true });
    assert.ok(names(missing(f.dir)).some((name) => name.startsWith('run:core/parts/p/journeys/already-done/start.')));
    json(f.dir, ['run']);
    const files = await snapshot(f.dir, { skip: ['work', 'runs'] });
    const start = Object.keys(files).find((p) => /^models\/core\/parts\/p\/journeys\/already-done\/start\..*\.json$/.test(p));
    assert.ok(start);
    delete files[start];
    const without = await project(null, files);
    assert.ok(account(without).models.find((m) => m.model === 'core').fails.some((f) => f.rule === 'journeys' && itemNames(f.items).includes(`run:${start.slice('models/'.length, -5)}`)));
  });
});

describe('account.md §basis-line — liveness qualifications', () => {
  test('account.md §basis-line liveness: fairness and CHOOSE trades are shown, while a state constraint is not a liveness bound', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // account.md §standing, §basis-line requires an established
    // liveness claim's fairness and trades; engines.md §bounds
    // includes choose trades and excludes the constraint from its bounds.
    const f = await native('tlc', { premise: true, carryPremise: true, edit: (files) => {
      files[CP] = replaceField(files[CP], 'Kind', 'liveness');
      files[CP] = replaceField(files[CP], 'Sentence', 'Every ticket eventually remains complete.');
      files[PP] = replaceField(files[PP], 'Class', 'fairness');
      files[`${SLOT}/encoding.md`] = fields([['Cannot express', 'Forbidden phase forms cannot express liveness.']]);
    }, editNative: (files) => {
      files['models/core/parts/p/claims/sticks/encoding.tla'] = 'Property == <>[](state = 1)\nFairness == WF_vars(Finish)\n';
      files['models/core/parts/p/claims/sticks/fault-reset.md'] = files['models/core/parts/p/claims/sticks/fault-reset.md'].replace("Fault == state' = 2", "Fault == state' \\in {1, 2}");
      files['models/core/Ticket.tla'] = files['models/core/Ticket.tla'].replace('====', 'PickTicket == CHOOSE e \\in Tickets: TRUE\n====');
      files['models/core/model.md'] = files['models/core/model.md'].replace('| constant Tickets | {ticket} | One ticket. |', '| constant Tickets | {ticket} | One ticket. |\n| choose PickTicket | - | Only the selected ticket is considered. |\n| constraint | state < 2 | Excludes the reset state. |');
    } });
    json(f.dir, ['run']);
    const local = modelClaim(account(f.dir), 'core');
    assert.equal(local.standing, 'established');
    assert.ok(local.basis.bounds.some((b) => b.bound === 'choose PickTicket' && b.meaning === 'Only the selected ticket is considered.'));
    assert.ok(!local.basis.bounds.some((b) => b.bound === 'constraint'));
    assert.ok(JSON.stringify(local.basis.fairness).includes('WF_vars'));
  });
});

describe('account.md §diff — rewritten and removed records', () => {
  test('account.md §diff same outcome: a property rewritten and rerun still appears as a changed current slot', async () => {
    // account.md §diff: rewritten slot bytes go stale
    // even if a rerun preserves the outcome and account.md §standing establishes the claim.
    const f = await examined();
    const before = await cloneWithout(f.dir, []);
    const files = await snapshot(f.dir, { skip: ['work', 'runs'] });
    files[`${SLOT}/encoding.md`] = files[`${SLOT}/encoding.md`].replace('| state | done | finish | idle |', '|  state  | done | finish | idle |');
    seal(files, f.pins);
    const now = await project(null, files);
    json(now, ['run']);
    const d = json(now, ['diff', before]);
    assert.ok(d.stale.some((group) => group.change?.kind === 'file' && group.change.ref === `${SLOT}/encoding.md` && group.lines.length > 0));
    assert.deepEqual(d.changedOutcome, []);
    assert.equal(claim(account(now)).standing, 'established');
  });

  test('account.md §diff absent evidence: losing a current base evidence file stales its claim and opens its run', async () => {
    // account.md §diff; account.md §standing, §items.
    const { dir } = await examined();
    const now = await cloneWithout(dir, [`models/${QUESTION}/base.json`]);
    const d = json(now, ['diff', dir]);
    assert.ok(diffLines(d.stale).length > 0);
    assert.ok(diffLines(d.opened).some((line) => line.ref === `run:${QUESTION}/base`));
  });

  test('account.md §diff default history: when a decision is re-added the most recent adding commit is used', async () => {
    // account.md §diff: the most recent adding commit wins.
    const f = await fixture({ noLifecycle: true });
    const latest = f.decisions.claim;
    const removed = { ...f.files };
    delete removed[latest.path];
    const dir = await project();
    const commits = await gitHistory(dir, [f.files, removed, f.files, { ...f.files, 'later.txt': 'Later unrelated file.\n' }]);
    assert.deepEqual(json(dir, ['diff']).from, { commit: commits[2] });
  });
});

describe('account.md §journey-rules — remaining lifecycle exploration flags', () => {
  test('account.md §journey-rules explored open-pair: an unpicked posed cell cannot be cleared by a caught fault and reached witness', async () => {
    // account.md §journey-rules; account.md §standing; account.md §items; evidence.md §flags; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await fixture({ edit: (files) => {
      const alternative = (negative) => fields([['Polarity', negative ? 'must not' : 'should happen'], ['Expected end', negative ? '-' : 'The ticket stays done.'], ['Refused step', negative ? '2' : '-']])
        + '\n' + table(['Step', 'Actor', 'Action', 'Arguments', 'Entity', 'Case'], [[1, 'Ticket worker', 'finish', '-', '-', '-'], [2, 'Ticket worker', 'finish', '-', '-', '-']])
        + '\n' + table(['Lifecycle', 'Phase', 'Action', 'Outcome'], [['state', 'done', 'finish', negative ? 'None.' : 'done']]);
      files['design/parts/p/choices/route/README.md'] = page('Completion route', [['Question', 'Which completion path should be used?'], ['Recommendation', 'a: Keep completion idempotent.'], ['Cites', CITE]]) + `\n## a\n\n${alternative(false)}\n## b\n\n${alternative(true)}`;
      files[LP] = files[LP].replace('| done | done |', '| done | choice:route |');
      files[`${SLOT}/encoding.md`] = files[`${SLOT}/encoding.md`].replace('| state | done | finish | idle |', '| state | idle | finish | idle |');
      files[`${SLOT}/fault-reset.md`] = files[`${SLOT}/fault-reset.md`].replace('| state | done | finish | idle |', '| state | idle | finish | idle |');
    } });
    json(f.dir, ['run']);
    const m = account(f.dir).models.find((m) => m.model === MODEL);
    assert.ok(m.fails.some((f) => f.rule === 'explored' && JSON.stringify(f.found).includes('open-pair')));
    assert.equal(claim(account(f.dir)).standing, 'not established');
    assert.equal(JSON.parse(await read(f.dir, `models/${QUESTION}/base.json`)).found.outcome, 'no violation');
    assert.equal(JSON.parse(await read(f.dir, `models/${QUESTION}/fault-reset.json`)).matches, true);
    assert.equal(JSON.parse(await read(f.dir, `models/${QUESTION}/witness-done.json`)).matches, true);
    // account.md §items: a posed cell's flag is owed by pick, never flagged Restate.
    assert.equal(item(missing(f.dir), 'pick:p/choices/route').why, 'unpicked');
    assert.ok(!names(missing(f.dir)).includes('restate:p'));
  });

  test('account.md §journey-rules explored unreachable-phase: individually valid lifecycles may leave a phase unreachable in their combined model', async () => {
    // account.md §journey-rules; account.md §standing; account.md §items; evidence.md §flags; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await fixture({ edit: (files) => {
      files['design/parts/p/actions.md'] += `| tick | worker | Observe the ticket. | none | none | stated | ${CITE} |\n`;
      files['design/parts/p/boundary.md'] += `| gate | Gate | entity | machine | - | - | worker | worker | stated | ${CITE} |\n`;
      files[LP] = files[LP].replace('| Phase | finish |', '| Phase | finish | tick |').replace('| --- | --- |\n| idle', '| --- | --- | --- |\n| idle').replace('| idle | done |', '| idle | done | idle |').replace('| done | done |', '| done | done | done |');
      files['design/parts/p/lifecycles/gate/README.md'] = page('Gate state', [['Entity', 'gate'], ['Initial', 'closed'], ['Ends', 'closed'], ['Unaffected', 'none'], ['Origin', 'stated'], ['Cites', CITE]]) + '\n' + table(['Phase', 'finish', 'tick'], [['closed', 'None.', 'closed']]);
      files[JP] = replaceField(files[JP].replace('| 1 | Ticket worker | finish |', '| 1 | Ticket worker | tick |'), 'Expected end', 'The ticket remains idle.');
      files[`${SLOT}/witness-done.md`] = fields([['Meaning', 'An idle ticket can be observed.']]) + '\n' + table(['Lifecycle', 'From', 'Action', 'To'], [['state', 'idle', 'tick', 'idle']]);
      files[`${SLOT}/fault-reset.md`] += '| gate | closed | finish | closed |\n';
    } });
    const passage = sha256(f.files['design/brief/ticket.md'].trim().split(/\n\s*\n/).map((s) => s.replace(/\s+/g, ' ')).join('\n\n'));
    // design.md §pins: Gate's fields and cells, with boundary/action references.
    const pin = sha256(`Entity: Gate (entity, machine, -, -)\nInitial: closed\nEnds: closed\nUnaffected: \nCites: ${passage}\nCell: closed | Complete the ticket. | None.\nCell: closed | Observe the ticket. | closed`);
    const rows = f.files[`${SLOT}/receipt`].trimEnd().split('\n').map(JSON.parse);
    for (const row of rows) {
      row.pins.push({ entry: 'p/lifecycles/gate', pin });
      row.pins.sort((a, b) => a.entry < b.entry ? -1 : 1);
    }
    f.files[`${SLOT}/receipt`] = rows.map((r) => JSON.stringify(r) + '\n').join('');
    // A confirmation whose showing holds no structured picture is a valid record.
    decision(f.files, { kind: 'confirm', on: 'p/lifecycles/gate', pin, folder: 'design/parts/p/lifecycles/gate/decisions', index: 10, shown: `confirm p/lifecycles/gate\nActions:\n  p/finish | Complete the ticket. | none | none\n  p/tick | Observe the ticket. | none | none\nlifecycles Gate state\n  Entity: Gate (entity, machine, -, -)\n  Initial: closed\n  Ends: closed\n  Unaffected: none\n  Origin: stated\n  Cites: ${CITE}\n  Phase | finish | tick\n  closed | None. | closed\nCites ${CITE}:\n${f.files['design/brief/ticket.md'].trimEnd().split('\n').map((s) => `  ${s}`).join('\n')}` });
    await writeFiles(f.dir, f.files);
    json(f.dir, ['run']);
    const m = account(f.dir).models.find((m) => m.model === MODEL);
    assert.ok(m.fails.some((f) => f.rule === 'explored' && JSON.stringify(f.found).includes('unreachable-phase')));
    assert.equal(claim(account(f.dir)).standing, 'not established');
  });
});

describe('account.md §standing — model-wide surprises', () => {
  test('account.md §standing no open surprise: a journey’s historical surprise blocks an otherwise examined claim on the same model', async () => {
    // account.md §standing; evidence.md §surprise-file; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await examined();
    await addSurprise(f, { question: `${MODEL}/parts/p/journeys/complete/lifecycle-path`, kind: 'lifecycle-path', expected: { outcome: 'admitted' }, found: { outcome: 'refused', step: 1 } });
    failure(account(f.dir), 'no open surprise');
    assert.equal(claim(account(f.dir)).standing, 'not established');
    assert.equal(JSON.parse(await read(f.dir, `models/${QUESTION}/base.json`)).found.outcome, 'no violation');
  });
});

describe('account.md §items — multiple freezes', () => {
  test('account.md §items slot freeze: each independent waiting decision must be ruled', async () => {
    // account.md §items; models.md §freeze: every open surprise freezes all slots of its claim; each ruling is owed.
    const f = await fixture();
    const a = await addSurprise(f);
    const b = await addSurprise(f, { question: `${QUESTION}/base`, kind: 'base', expected: { outcome: 'no violation' }, found: { outcome: 'violation', property: 'forbidden form' } });
    const receipt = f.files[`${SLOT}/receipt`].trimEnd().split('\n').map(JSON.parse);
    receipt.find((row) => row.file === 'witness-done.md').pins.find((pin) => pin.entry === CLAIM).pin = sha256('older claim');
    await writeFiles(f.dir, { [`${SLOT}/receipt`]: receipt.map((row) => JSON.stringify(row) + '\n').join('') });
    const waits = itemNames(item(missing(f.dir), `slot:${QUESTION}/witness-done`).waits);
    assert.ok(waits.includes(`rule:${a.name}`));
    assert.ok(waits.includes(`rule:${b.name}`));
  });

  test('account.md §items repair freeze: a model repair waits for a different open surprise on that model', async () => {
    // account.md §items; models.md §freeze; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await fixture();
    const a = await addSurprise(f);
    const rule = await ruling(f, a, { target: MODEL, targetPin: '-' });
    const b = await addSurprise(f, { question: `${QUESTION}/base`, kind: 'base', expected: { outcome: 'no violation' }, found: { outcome: 'violation', property: 'forbidden form' } });
    assert.ok(itemNames(item(missing(f.dir), `repair:${rule.name}/${MODEL}`).waits).includes(`rule:${b.name}`));
  });

  test('account.md §items model freeze: a model owed new action rows waits for its existing surprise’s ruling', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // account.md §items; models.md §freeze; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await native('tlc', { editNative: (files) => { files['models/core/parts/p/claims/sticks/encoding.tla'] = 'Invariant == state = 0\n'; } });
    json(f.dir, ['run']);
    const files = await snapshot(f.dir, { skip: ['work', 'runs'] });
    const surprisePath = Object.keys(files).find((p) => /core\/parts\/p\/claims\/sticks\/base\..*\.surprise-[a-f0-9]+\.json$/.test(p));
    assert.ok(surprisePath);
    const surprise = JSON.parse(files[surprisePath]);
    files['design/parts/p/actions.md'] += `| reset | worker | Reset the ticket. | none | none | stated | ${CITE} |\n`;
    files[LP] = files[LP].replace('| Phase | finish |', '| Phase | finish | reset |').replace('| --- | --- |\n| idle', '| --- | --- | --- |\n| idle').replace('| idle | done |', '| idle | done | None. |').replace('| done | done |', '| done | done | None. |');
    seal(files, f.pins);
    const dir = await project(null, files);
    assert.ok(itemNames(item(missing(dir), 'model:core').waits).includes(`rule:${surprise.name}`));
  });
});

describe('account.md §basis-line — all contributing faults', () => {
  test('account.md §basis-line faults: every current caught fault is named in the established basis', async () => {
    // account.md §basis-line includes each caught current fault by mechanism;
    // presentation.md §reading gives its question/mechanism fields without fixing their order.
    const { dir } = await examined({ edit: (files) => { files[`${SLOT}/fault-other.md`] = files[`${SLOT}/fault-reset.md`].replace('Completion preserves the done phase.', 'A second safeguard preserves completion.'); } });
    const faults = modelClaim(account(dir)).basis.faults;
    assert.deepEqual(faults.map((f) => f.question).sort(), [`${QUESTION}/fault-other`, `${QUESTION}/fault-reset`]);
    assert.ok(faults.some((f) => f.mechanism === 'A second safeguard preserves completion.'));
  });

  test('account.md §basis-line faults: a stale extra fault is excluded while a current caught one still controls the claim', async () => {
    // account.md §standing requires at least one current caught fault;
    // account.md §basis-line excludes stale faults; evidence.md §currency makes this
    // altered runtime version stale without changing the other fault's currency.
    const { dir } = await examined({ edit: (files) => { files[`${SLOT}/fault-other.md`] = files[`${SLOT}/fault-reset.md`].replace('Completion preserves the done phase.', 'A second safeguard preserves completion.'); } });
    const path = `models/${QUESTION}/fault-other.json`;
    const value = JSON.parse(await read(dir, path));
    value.basis.runtime.version = 'v0.0.0';
    await writeFiles(dir, { [path]: evidenceFile(value) });
    const local = modelClaim(account(dir));
    assert.equal(local.standing, 'established');
    assert.deepEqual(local.basis.faults.map((f) => f.question), [`${QUESTION}/fault-reset`]);
  });

  test('account.md §basis-line faults: a ruled uncaught extra fault is excluded from a basis supported by a caught fault', async () => {
    // account.md §standing requires one caught fault and no open surprise;
    // account.md §basis-line includes caught faults only. evidence.md §surprise-file
    // records a mismatching answered fault; evidence.md §at-ruling closes it by ruling.
    const f = await examined({ edit: (files) => { files[`${SLOT}/fault-other.md`] = files[`${SLOT}/fault-reset.md`].replace('| state | done | finish | idle |', '| state | done | finish | done |'); } });
    f.files = await snapshot(f.dir, { skip: ['work', 'runs'] });
    const path = Object.keys(f.files).find((p) => p.startsWith(`models/${QUESTION}/fault-other.surprise-`) && p.endsWith('.json'));
    assert.ok(path);
    const value = JSON.parse(f.files[path]);
    await ruling(f, { name: value.name, question: value.question, digest: sha256(jsonText(value.basis)), value }, { target: 'brief', targetPin: '-', index: 40 });
    const local = modelClaim(account(f.dir));
    assert.equal(local.standing, 'established');
    assert.deepEqual(local.basis.faults.map((f) => f.question), [`${QUESTION}/fault-reset`]);
  });
});

describe('account.md §standing — matching corroboration bounds', () => {
  test('account.md §standing same bounds: fault evidence at another bounds digest cannot replace a missing fault at current bounds', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // account.md §standing; evidence.md §flags; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await native();
    json(f.dir, ['run']);
    const files = await snapshot(f.dir, { skip: ['work', 'runs'] });
    const path = Object.keys(files).find((p) => /^models\/core\/parts\/p\/claims\/sticks\/fault-reset\.[a-f0-9]+\.json$/.test(p));
    assert.ok(path);
    const value = JSON.parse(files[path]);
    delete files[path];
    // evidence.md §bounds: sorted normalized bounds, each ending in a line feed.
    const digest = sha256('constant Tickets = {other}\n').slice(0, 12);
    value.name = `core/parts/p/claims/sticks/fault-reset.${digest}`;
    value.bounds = { 'constant Tickets': '{other}' };
    files[`models/${value.name}.json`] = evidenceFile(value);
    const dir = await project(null, files);
    assert.ok(modelClaim(account(dir), 'core').fails.some((f) => f.condition === 'controlled'));
  });

  test('account.md §standing Alloy flags: a caught fault and reached witness clear both tiny-scope and tiny-trace', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // account.md §standing; evidence.md §flags; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await native('alloy', { omit: [LP], edit: (files) => { files['design/parts/p/README.md'] = files['design/parts/p/README.md'].replace('3. [Ticket state](lifecycles/state/)\n', ''); }, editNative: (files) => {
      files['models/core/model.md'] = files['models/core/model.md'].replace('| scope | 2 | Two atoms per unconstrained signature. |', '| scope | 1 | One item. |').replace('| steps | 3 | Three transition states. |', '| steps | 1 | One state. |').replace('| p/state | e: Ticket | e.phase |\n', '');
      files['models/core/Ticket.als'] = 'module Ticket\nsig Item {}\none sig Mark { bad: set Item }\npred Finish { no Mark.bad }\nfact Behavior { Finish }\n';
      files['models/core/parts/p/claims/sticks/encoding.als'] = 'assert Claim { no Mark.bad }\n';
      files['models/core/parts/p/journeys/complete/schedule.md'] = files['models/core/parts/p/journeys/complete/schedule.md'].replace('pred End { Ticket.phase = done }', 'pred End { no Mark.bad }');
      files['models/core/parts/p/claims/sticks/witness-done.md'] = fields([['Meaning', 'An item exists.']]) + '\n```alloy\npred Target { some Item }\n```\n';
      files['models/core/parts/p/claims/sticks/fault-reset.md'] = fields([['Action', 'p/finish'], ['Mechanism', 'The mark excludes bad items.']]) + '\n```alloy\npred Fault { some Mark.bad }\n```\n';
    } });
    json(f.dir, ['run']);
    const local = modelClaim(account(f.dir), 'core');
    assert.equal(local.standing, 'established');
    const base = local.basis.evidence.find((e) => e.question.includes('/base.'));
    const text = JSON.stringify(base);
    for (const flag of ['tiny-scope', 'tiny-trace']) assert.ok(text.includes(flag));
    assert.ok(text.includes('clearedBy'));
    assert.ok(text.includes('fault-reset.'));
    assert.ok(text.includes('witness-done.'));
  });
});

describe('account.md §journey-rules — examined spans', () => {
  test('account.md §journey-rules span: one reached cross-part journey examines a span on a model covering both parts', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // account.md §journey-rules; account.md §items; forms.md §surface; account.md §box; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await native('tlc', { confirmParts: false, edit: (files) => {
      addSpan(files);
      files['design/parts/q/boundary.md'] = files['design/parts/q/boundary.md'].replace('## Surface', `## Boundary\n\n${table(['Row', 'Names', 'Kind', 'Side', 'Seam', 'Isolation', 'Reads', 'Writes', 'Origin', 'Cites'], [['worker', 'Receipt worker', 'service', 'machine', '-', '-', '-', '-', 'stated', CITE]])}\n## Surface`);
      files['design/parts/q/actions.md'] = '# Receipt actions\n\n' + table(['Action', 'Actor', 'Sentence', 'Cases', 'Guard', 'Origin', 'Cites'], [['store', 'worker', 'Store the receipt.', 'none', 'none', 'stated', CITE]]);
    }, editNative: (files) => {
      files['models/core/model.md'] = replaceField(files['models/core/model.md'], 'Parts', 'p, q').replace('| p/finish | Finish | none |', '| p/finish | Finish | none |\n| q/store | Store | none |');
      files['models/core/Ticket.tla'] = files['models/core/Ticket.tla'].replace('VARIABLE state', 'VARIABLE state, stored').replace('vars == <<state>>', 'vars == <<state, stored>>').replace('Init == state = 0', 'Init == /\\ state = 0 /\\ stored = FALSE').replace('TypeOK == state \\in 0..2', 'TypeOK == /\\ state \\in 0..2 /\\ stored \\in BOOLEAN').replace("Finish == state' = 1", "Finish == /\\ state' = 1 /\\ UNCHANGED stored").replace('====', "Store == /\\ stored' = TRUE /\\ UNCHANGED state\n====");
      files['models/core/parts/p/claims/sticks/fault-reset.md'] = files['models/core/parts/p/claims/sticks/fault-reset.md'].replace("Fault == state' = 2", "Fault == /\\ state' = 2 /\\ UNCHANGED stored");
    } });
    const folder = 'design/spans/completion/journeys/store';
    const pageText = page('Complete and store', [['Polarity', 'should happen'], ['Expected end', 'The completion has a receipt.'], ['Refused step', '-'], ['Origin', 'added'], ['Cites', CITE]]) + '\n' + table(['Step', 'Actor', 'Action', 'Arguments', 'Entity', 'Case'], [[1, 'Ticket worker', 'p/finish', '-', '-', '-'], [2, 'Receipt worker', 'q/store', '-', '-', '-']]);
    f.files['design/spans/completion/README.md'] = '# Completion and receipt\n\nA ticket completion is stored as a receipt.\n\n1. [Complete and store](journeys/store/)\n';
    f.files[`${folder}/README.md`] = pageText;
    const passage = sha256(f.files['design/brief/ticket.md'].trim().split(/\n\s*\n/).map((s) => s.replace(/\s+/g, ' ')).join('\n\n'));
    const pin = sha256(`Polarity: should happen\nExpected end: The completion has a receipt.\nRefused step: -\nCites: ${passage}\nStep 1: Ticket worker | Complete the ticket. | - | - | -\nStep 2: Receipt worker | Store the receipt. | - | - | -`);
    const qAction = sha256(`Actor: Receipt worker (service, machine, -, -)\nSentence: Store the receipt.\nCases: \nGuard: none\nCites: ${passage}`);
    const sf = 'models/core/spans/completion/journeys/store';
    // engines.md §slot-forms: both completion and storage hold after the span's last step.
    f.files[`${sf}/schedule.md`] = table(['Entity', 'Value'], []) + '\n' + table(['Step', 'Bindings'], [[1, 'none'], [2, 'none']])
      + '\n' + table(['Field', 'Value'], [['Meaning', 'The completed ticket has its receipt stored.']])
      + '\n```tla\nEnd == /\\ state = 1 /\\ stored\n```\n';
    // Seal only new front/journey/schedule files; preserve native slot pin lines.
    for (const path of ['design/spans/completion/README.md', `${folder}/README.md`, `${sf}/schedule.md`]) {
      const split = path.lastIndexOf('/');
      const line = { file: path.slice(split + 1), sha256: sha256(f.files[path]), at: WHEN, session: WRITER, authors: [WRITER] };
      if (path.endsWith('/schedule.md')) line.pins = [{ entry: 'completion/journeys/store', pin }, { entry: 'p/actions/finish', pin: nativePins(f).action }, { entry: 'q/actions/store', pin: qAction }];
      f.files[`${path.slice(0, split)}/receipt`] = JSON.stringify(line) + '\n';
    }
    decision(f.files, { kind: 'confirm', on: 'completion/journeys/store', pin, index: 15, folder: `${folder}/decisions`, shown: `confirm completion/journeys/store\nActions:\n  p/finish | Complete the ticket. | none | none\n  q/store | Store the receipt. | none | none\njourneys Complete and store\n  Polarity: should happen\n  Expected end: The completion has a receipt.\n  Refused step: -\n  1 | Ticket worker | p/finish | - | - | -\n  2 | Receipt worker | q/store | - | - | -\nCites ${CITE}:\n${f.files['design/brief/ticket.md'].trimEnd().split('\n').map((s) => `  ${s}`).join('\n')}` });
    await writeFiles(f.dir, f.files);
    assert.equal(item(missing(f.dir), 'span:p+q').why, 'unexamined');
    json(f.dir, ['run']);
    assert.ok(!names(missing(f.dir)).includes('span:p+q'));
  });
});

async function twoPartModel({ spanningClaim = false } = {}) {
  const f = await native('tlc', { confirmParts: false, edit: (files) => {
    addSpan(files, spanningClaim);
    files['design/parts/q/boundary.md'] = files['design/parts/q/boundary.md'].replace('## Surface', `## Boundary\n\n${table(['Row', 'Names', 'Kind', 'Side', 'Seam', 'Isolation', 'Reads', 'Writes', 'Origin', 'Cites'], [['worker', 'Receipt worker', 'service', 'machine', '-', '-', '-', '-', 'stated', CITE]])}\n## Surface`);
    files['design/parts/q/actions.md'] = '# Receipt actions\n\n' + table(['Action', 'Actor', 'Sentence', 'Cases', 'Guard', 'Origin', 'Cites'], [['store', 'worker', 'Store the receipt.', 'none', 'none', 'stated', CITE]]);
  }, editNative: (files) => {
    files['models/core/model.md'] = replaceField(files['models/core/model.md'], 'Parts', 'p, q').replace('| p/finish | Finish | none |', '| p/finish | Finish | none |\n| q/store | Store | none |');
    files['models/core/Ticket.tla'] = files['models/core/Ticket.tla'].replace('VARIABLE state', 'VARIABLE state, stored').replace('vars == <<state>>', 'vars == <<state, stored>>').replace('Init == state = 0', 'Init == /\\ state = 0 /\\ stored = FALSE').replace('TypeOK == state \\in 0..2', 'TypeOK == /\\ state \\in 0..2 /\\ stored \\in BOOLEAN').replace("Finish == state' = 1", "Finish == /\\ state' = 1 /\\ UNCHANGED stored").replace('====', "Store == /\\ stored' = TRUE /\\ UNCHANGED state\n====");
    files['models/core/parts/p/claims/sticks/fault-reset.md'] = files['models/core/parts/p/claims/sticks/fault-reset.md'].replace("Fault == state' = 2", "Fault == /\\ state' = 2 /\\ UNCHANGED stored");
    if (spanningClaim) files['models/core/parts/p/claims/sticks/encoding.tla'] = 'Invariant == state = 0\n';
  } });
  f.passage = sha256(f.files['design/brief/ticket.md'].trim().split(/\n\s*\n/).map((s) => s.replace(/\s+/g, ' ')).join('\n\n'));
  f.qAction = sha256(`Actor: Receipt worker (service, machine, -, -)\nSentence: Store the receipt.\nCases: \nGuard: none\nCites: ${f.passage}`);
  const folder = 'design/parts/q/journeys/store', modelFolder = 'models/core/parts/q/journeys/store';
  const text = page('Store a receipt', [['Polarity', 'should happen'], ['Expected end', 'The receipt is stored.'], ['Refused step', '-'], ['Origin', 'added'], ['Cites', CITE]]) + '\n' + table(['Step', 'Actor', 'Action', 'Arguments', 'Entity', 'Case'], [[1, 'Receipt worker', 'store', '-', '-', '-']]);
  const pin = sha256(`Polarity: should happen\nExpected end: The receipt is stored.\nRefused step: -\nCites: ${f.passage}\nStep 1: Receipt worker | Store the receipt. | - | - | -`);
  // engines.md §slot-forms: this journey promises storage, independently of completion.
  const schedule = table(['Entity', 'Value'], []) + '\n' + table(['Step', 'Bindings'], [[1, 'none']])
    + '\n' + table(['Field', 'Value'], [['Meaning', 'The receipt is stored.']]) + '\n```tla\nEnd == stored\n```\n';
  f.files[`${folder}/README.md`] = text;
  f.files[`${modelFolder}/schedule.md`] = schedule;
  f.files[`${folder}/receipt`] = JSON.stringify({ file: 'README.md', sha256: sha256(text), at: WHEN, session: WRITER, authors: [WRITER] }) + '\n';
  f.files[`${modelFolder}/receipt`] = JSON.stringify({ file: 'schedule.md', sha256: sha256(schedule), at: WHEN, session: WRITER, authors: [WRITER], pins: [{ entry: 'q/actions/store', pin: f.qAction }, { entry: 'q/journeys/store', pin }] }) + '\n';
  decision(f.files, { kind: 'confirm', on: 'q/journeys/store', pin, index: 15, folder: `${folder}/decisions`, shown: `confirm q/journeys/store\nActions:\n  q/store | Store the receipt. | none | none\njourneys Store a receipt\n  Polarity: should happen\n  Expected end: The receipt is stored.\n  Refused step: -\n  1 | Receipt worker | store | - | - | -\nCites ${CITE}:\n${f.files['design/brief/ticket.md'].trimEnd().split('\n').map((s) => `  ${s}`).join('\n')}` });
  await writeFiles(f.dir, f.files);
  return f;
}

describe('account.md §journey-rules — span examination is not establishment', () => {
  test('account.md §journey-rules span claim: a current answered violation examines both parts without establishing the claim', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // account.md §journey-rules; account.md §items; forms.md §surface; account.md §box; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await twoPartModel({ spanningClaim: true });
    assert.equal(item(missing(f.dir), 'span:p+q').why, 'unexamined');
    json(f.dir, ['run']);
    assert.ok(!names(missing(f.dir)).includes('span:p+q'));
    assert.equal(claim(account(f.dir)).standing, 'not established');
    const files = await snapshot(f.dir, { skip: ['work', 'runs'] });
    const base = Object.keys(files).find((p) => /^models\/core\/parts\/p\/claims\/sticks\/base\.[a-f0-9]+\.json$/.test(p));
    assert.equal(JSON.parse(files[base]).found.outcome, 'violation');
  });

  test('account.md §journey-rules span negative journey: both current path and refusal evidence are needed for examination', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // account.md §journey-rules; account.md §items; forms.md §surface; account.md §box; presentation.md §reading fixes reading fields, account.md §commands fixes item fields.
    const f = await twoPartModel();
    const folder = 'design/spans/completion/journeys/no-store', sf = 'models/core/spans/completion/journeys/no-store';
    const text = page('Do not store after completion', [['Polarity', 'must not'], ['Expected end', '-'], ['Refused step', '2'], ['Origin', 'added'], ['Cites', CITE]]) + '\n' + table(['Step', 'Actor', 'Action', 'Arguments', 'Entity', 'Case'], [[1, 'Ticket worker', 'p/finish', '-', '-', '-'], [2, 'Receipt worker', 'q/store', '-', '-', '-']]);
    const pin = sha256(`Polarity: must not\nExpected end: -\nRefused step: 2\nCites: ${f.passage}\nStep 1: Ticket worker | Complete the ticket. | - | - | -\nStep 2: Receipt worker | Store the receipt. | - | - | -`);
    const schedule = table(['Entity', 'Value'], []) + '\n' + table(['Step', 'Bindings'], [[1, 'none'], [2, 'none']]);
    f.files['design/spans/completion/README.md'] = '# Completion and receipt\n\nCompletion interacts with receipt storage.\n';
    f.files[`${folder}/README.md`] = text;
    f.files[`${sf}/schedule.md`] = schedule;
    for (const path of ['design/spans/completion/README.md', `${folder}/README.md`, `${sf}/schedule.md`]) {
      const split = path.lastIndexOf('/');
      const line = { file: path.slice(split + 1), sha256: sha256(f.files[path]), at: WHEN, session: WRITER, authors: [WRITER] };
      if (path.endsWith('schedule.md')) line.pins = [{ entry: 'completion/journeys/no-store', pin }, { entry: 'p/actions/finish', pin: nativePins(f).action }, { entry: 'q/actions/store', pin: f.qAction }];
      f.files[`${path.slice(0, split)}/receipt`] = JSON.stringify(line) + '\n';
    }
    decision(f.files, { kind: 'confirm', on: 'completion/journeys/no-store', pin, index: 16, folder: `${folder}/decisions`, shown: `confirm completion/journeys/no-store\nActions:\n  p/finish | Complete the ticket. | none | none\n  q/store | Store the receipt. | none | none\njourneys Do not store after completion\n  Polarity: must not\n  Expected end: -\n  Refused step: 2\n  1 | Ticket worker | p/finish | - | - | -\n  2 | Receipt worker | q/store | - | - | -\nCites ${CITE}:\n${f.files['design/brief/ticket.md'].trimEnd().split('\n').map((s) => `  ${s}`).join('\n')}` });
    await writeFiles(f.dir, f.files);
    json(f.dir, ['run']);
    assert.ok(!names(missing(f.dir)).includes('span:p+q'));
    const files = await snapshot(f.dir, { skip: ['work', 'runs'] });
    const refused = Object.keys(files).find((p) => /^models\/core\/spans\/completion\/journeys\/no-store\/refusal-at-2\.[a-f0-9]+\.json$/.test(p));
    assert.ok(refused);
    delete files[refused];
    const dir = await project(null, files);
    assert.equal(item(missing(dir), 'span:p+q').why, 'unexamined');
  });
});

describe('account.md §box — all carried premises', () => {
  test('account.md §box store premise: its derived statement and falsifier accompany the accepted claim', async () => {
    // account.md §box admits this accepted claim only
    // after its store premise is carried; presentation.md §reading lists its class
    // and claims; forms.md §store-premises fixes the derived premise words.
    const f = await fixture({ noLifecycle: true, accept: true, edit: (files) => {
      files['design/parts/p/boundary.md'] = '# Receipt boundary\n\n## Boundary\n\n' + table(['Row', 'Names', 'Kind', 'Side', 'Seam', 'Isolation', 'Reads', 'Writes', 'Origin', 'Cites'], [['records', 'Receipt store', 'store', 'world', '-', 'read committed', 'none', 'none', 'added', CITE]]);
      files[CP] = replaceField(files[CP], 'Rests on', 'store:records');
    } });
    assert.deepEqual(json(f.dir, ['box']).claims, []);
    const statement = 'Receipt store permits exactly read skew, lost update, write skew, phantom and prevents the rest.';
    const falsifier = 'an observed prevented anomaly';
    // forms.md §store-premises and decisions.md §carry
    // fixes the store premise and canonical pin (no final line feed).
    const pin = sha256(`Statement: ${statement}\nFalsifier: ${falsifier}\nProvider: the store's documented and measured isolation`);
    const carry = decision(f.files, { kind: 'carry', on: 'store:p/records', pin, rows: [['Choice', 'carry'], ['Basis', '-']], words: falsifier, index: 10, folder: 'design/parts/p/decisions', shown: `carry store:p/records\nstore Receipt store\n  Statement: ${statement}\n  Falsifier: ${falsifier}\n  Provider: the store's documented and measured isolation\nboundary Receipt store\n  Kind: store\n  Side: world\n  Isolation: read committed` });
    await writeFiles(f.dir, f.files);
    const box = json(f.dir, ['box']);
    assert.equal(box.claims[0].standing, 'accepted');
    // forms.md §premise-says additionally requires generated classes/providers in the
    // reading and box. account.md §box does not fix their JSON field locations.
    assert.equal(box.premises.length, 1);
    const stored = box.premises[0];
    for (const [key, value] of Object.entries({ premise: 'store:p/records', statement, falsifier, decision: carry.name, by: 'Ada', at: carry.at })) assert.equal(stored[key], value);
    for (const command of ['account', 'box']) {
      const text = success(f.dir, [command]).stdout;
      for (const words of [statement, falsifier, 'store phenomena', "the store's documented and measured isolation"]) assert.ok(text.includes(words));
    }
    const assumed = account(f.dir).parts[0].assumed.find((p) => p.premise === 'store:p/records');
    assert.equal(assumed.class, 'store phenomena');
    // presentation.md §reading fixes the dependent claims, not their nested reference form.
    assert.ok(JSON.stringify(assumed.claims).includes(CLAIM));
  });

  test('account.md §box carried premises: a carried premise is included even when no claim rests on it', async () => {
    // account.md §box includes every carried premise independently
    // of qualifying claims; this fixture has neither evidence nor an acceptance.
    const { dir } = await fixture({ noLifecycle: true, premise: true, carryPremise: true, edit: (files) => { files[CP] = replaceField(files[CP], 'Rests on', 'none'); } });
    const box = json(dir, ['box']);
    assert.deepEqual(box.claims, []);
    assert.deepEqual(box.premises.map((p) => p.premise), ['p/premises/trust']);
  });
});

describe('presentation.md §reading to account.md §box — generated premise meanings', () => {
  for (const carriedBound of [false, true]) test(`presentation.md §reading generated bound: ${carriedBound ? 'carried' : 'uncarried'} phase bounds have their fixed class, statement, falsifier and provider`, async () => {
    // forms.md §premise-says fixes all four words; account.md §basis-line to §box shows them beside
    // Assumed, with names beside claims; the box admits it only once carried.
    const { dir, decisions } = await fixture({ carryBound: carriedBound });
    const name = `bound:${MODEL}/p/sticks`;
    const statement = `Beyond phase level on ${MODEL}: A done ticket never becomes idle.`;
    const falsifier = carriedBound ? decisions.bound.words : '-';
    const premise = account(dir).parts[0].assumed.find((entry) => entry.premise === name);
    assert.equal(premise.class, 'bound');
    assert.equal(premise.statement, statement);
    assert.equal(premise.falsifier, falsifier);
    assert.ok(success(dir, ['account']).stdout.includes("the developer's carry"));
    const boxed = json(dir, ['box']).premises.find((entry) => entry.premise === name);
    if (carriedBound) {
      assert.equal(boxed.statement, statement);
      assert.equal(boxed.falsifier, falsifier);
      const text = success(dir, ['box']).stdout;
      for (const words of ['bound', statement, falsifier, "the developer's carry"]) assert.ok(text.includes(words));
    } else assert.equal(boxed, undefined);
  });

  test('presentation.md §reading generated choice: its statement changes from not yet picked to the selected end and enters the box', async () => {
    // forms.md §premise-says fixes both statements, class, falsifier and provider;
    // account.md §standing, presentation.md §reading to account.md §box makes the pick carry it and includes it in the box.
    const f = await fixture({ edit: addChoice });
    const name = 'choice:p/route';
    const find = () => account(f.dir).parts[0].assumed.find((entry) => entry.premise === name);
    assert.equal(find().statement, 'Which completion path should be used? Not yet picked.');
    assert.equal(find().class, 'choice');
    assert.equal(find().falsifier, 'a pick of the other alternative');
    assert.ok(success(f.dir, ['account']).stdout.includes("the developer's pick"));
    assert.ok(!json(f.dir, ['box']).premises.some((entry) => entry.premise === name));
    await pickChoice(f);
    const statement = 'Which completion path should be used? Picked a. The ticket is done.';
    assert.equal(find().statement, statement);
    assert.equal(json(f.dir, ['box']).premises.find((entry) => entry.premise === name).statement, statement);
    for (const command of ['account', 'box']) {
      const text = success(f.dir, [command]).stdout;
      for (const words of [statement, 'choice', 'a pick of the other alternative', "the developer's pick"]) assert.ok(text.includes(words));
    }
  });

  test('presentation.md §reading generated strike: the carried world exclusion states its menu item and declared falsifier', async () => {
    // forms.md §premise-says; decisions.md §carry; presentation.md §reading to account.md §box. A strike is a world
    // premise whose falsifier is the developer's words, independently of claims.
    const { dir } = await fixture({ edit: (files) => {
      files['design/parts/p/boundary.md'] += `| delivery | Delivery service | service | world | request-response | - | - | - | added | ${CITE} |\n`;
    } });
    const name = 'strike:p/delivery/drop';
    const shown = json(dir, ['show', 'carry', name]);
    const falsifier = 'A delivery request disappears without a response.';
    json(dir, ['decide', 'carry', name, '--shown', shown.token, '--choice', 'carry', '--basis', '-', '--words', falsifier,
      '--by', 'Ada', '--provider', 'fixture', '--model', 'developer', '--session', 'human-review']);
    const premise = account(dir).parts[0].assumed.find((entry) => entry.premise === name);
    assert.equal(premise.class, 'world');
    assert.equal(premise.statement, 'Delivery service never does drop.');
    assert.equal(premise.falsifier, falsifier);
    assert.equal(json(dir, ['box']).premises.find((entry) => entry.premise === name).falsifier, falsifier);
    for (const command of ['account', 'box']) {
      const text = success(dir, [command]).stdout;
      for (const words of ['world', premise.statement, falsifier, "the developer's strike"]) assert.ok(text.includes(words));
    }
  });

  test('presentation.md §reading generated span: its purposes and shared surfaces accompany the carried premise', async () => {
    // forms.md §surface, §premise-says and decisions.md §carry fix the span, purpose order,
    // surface content, falsifier and provider; account.md §box admits its carry.
    const { dir } = await fixture({ noLifecycle: true, edit: (files) => addSpan(files) });
    const name = 'span:p+q';
    const shown = json(dir, ['show', 'carry', name]);
    const falsifier = 'A completed ticket has no corresponding receipt.';
    json(dir, ['decide', 'carry', name, '--shown', shown.token, '--choice', 'carry', '--basis', '-', '--words', falsifier,
      '--by', 'Ada', '--provider', 'fixture', '--model', 'developer', '--session', 'human-review']);
    const premise = walkObjects(account(dir)).find((entry) => entry.premise === name && Object.hasOwn(entry, 'class'));
    assert.ok(premise);
    assert.equal(premise.class, 'span');
    assert.ok(premise.statement.startsWith('Completes tickets. and Stores receipts. hold together over what they share: '));
    assert.ok(premise.statement.includes('emits completed'));
    assert.ok(premise.statement.includes('consumes p/completed'));
    assert.equal(premise.falsifier, falsifier);
    const boxed = json(dir, ['box']).premises.find((entry) => entry.premise === name);
    assert.equal(boxed.statement, premise.statement);
    assert.equal(boxed.falsifier, falsifier);
    for (const command of ['account', 'box']) {
      const text = success(dir, [command]).stdout;
      for (const words of ['span', premise.statement, falsifier, "the developer's carry"]) assert.ok(text.includes(words));
    }
  });
});

describe('presentation.md §reading — lapse and entry order', () => {
  test('presentation.md §reading lapsed decision: the reading preserves its name, state and the passage change', async () => {
    // presentation.md §reading shows lapsed state and the change which
    // opened the item; presentation.md §showings keeps the decision name and
    // lost/gained passage lines; decisions.md §in-force defines this citation-pin lapse.
    const f = await fixture();
    await writeFiles(f.dir, { 'design/brief/ticket.md': f.files['design/brief/ticket.md'].replace('never returns', 'sometimes returns') });
    const d = account(f.dir, CLAIM).thing.decisions.find((d) => d.decision === f.decisions.claim.name);
    assert.equal(d.state, 'lapsed');
    const text = success(f.dir, ['account', 'p']).stdout;
    assert.ok(text.includes(f.decisions.claim.name));
    assert.ok(text.includes('never returns'));
    assert.ok(text.includes('sometimes returns'));
  });

  test('presentation.md §reading entry order: a part’s front-page order is kept within the Open heading', async () => {
    // presentation.md §reading preserves front-page order within Open;
    // forms.md §reading-order reads the destinations in their listed order.
    const { dir } = await fixture({ edit: (files) => {
      files['design/parts/p/claims/other/README.md'] = replaceField(files[CP].replace('# Completion sticks', '# Receipt preservation'), 'Sentence', 'A receipt is never lost.');
      files['design/parts/p/README.md'] = '# Tickets\n\n1. [Receipt preservation](claims/other/)\n2. [Completion sticks](claims/sticks/)\n';
    } });
    assert.deepEqual(account(dir).parts[0].open.filter((e) => e.ref?.startsWith('p/claims/')).map((e) => e.ref), ['p/claims/other', CLAIM]);
  });
});

// forms.md §lifecycles to §journeys, lifecycle-tool.md §stepping: simple creation lifecycle fixtures. Tests
// leave these pages unconfirmed unless they obtain a confirmation through the
// public command, so fixturePicture need not invent entered-by picture syntax.
function enteredLifecycle(files) {
  files['design/parts/p/actions.md'] += `| create | worker | Create the ticket. | none | none | stated | ${CITE} |\n`;
  files[LP] = replaceField(files[LP], 'Initial', 'idle, entered by create')
    .replace('| Phase | finish |', '| Phase | create | finish |')
    .replace('| --- | --- |\n| idle', '| --- | --- | --- |\n| idle')
    .replace('| idle | done |', '| idle | None. | done |')
    .replace('| done | done |', '| done | None. | done |');
}
function posedCompletion(files, phase = 'idle') {
  const alternative = (negative) => fields([['Polarity', negative ? 'must not' : 'should happen'], ['Expected end', negative ? '-' : 'The ticket is done.'], ['Refused step', negative ? '1' : '-']])
    + '\n' + table(['Step', 'Actor', 'Action', 'Arguments', 'Entity', 'Case'], [[1, 'Ticket worker', 'finish', '-', '-', '-']])
    + '\n' + table(['Lifecycle', 'Phase', 'Action', 'Outcome'], [['state', phase, 'finish', negative ? 'None.' : 'done']]);
  files['design/parts/p/choices/route/README.md'] = page('Completion route', [['Question', 'Which completion path should be used?'], ['Recommendation', 'a: Complete directly.'], ['Cites', CITE]]) + `\n## a\n\n${alternative(false)}\n## b\n\n${alternative(true)}`;
  files[LP] = files[LP].replace(`| ${phase} | done |`, `| ${phase} | choice:route |`);
}

// decisions.md §forma-show to §forma-decide: use an actual showing token and read the decision it
// records. Expected domain facts never come from these command outputs.
function recordDecision(dir, kind, on, options = []) {
  const shown = json(dir, ['show', kind, on]);
  return json(dir, ['decide', kind, on, '--shown', shown.token, ...options,
    '--by', 'Ada', '--provider', 'fixture', '--model', 'developer', '--session', 'human-review']);
}

describe('account.md §what-it-is, §journey-rules to §items — revised lifecycle facts', () => {
  for (const gap of ['empty', 'posed']) for (const gate of ['a-gate', 'z-gate']) {
    test(`account.md §items lifecycle refusal: a refusing ${gate} takes precedence over ${gap === 'empty' ? 'an empty' : 'a posed'} cell`, async () => {
      // lifecycle-tool.md §stepping: any refusal wins before empty/posed cells are considered;
      // lifecycle-tool.md §findings and account.md §items expose step-refused, without journey unchecked.
      const f = await fixture({ confirmLifecycle: false, confirmJourney: false, edit: (files) => {
        if (gap === 'posed') posedCompletion(files);
        else files[LP] = files[LP].replace('| idle | done |', '| idle |  |');
        files['design/parts/p/boundary.md'] += `| gate | Gate | entity | machine | - | - | worker | worker | stated | ${CITE} |\n`;
        files[`design/parts/p/lifecycles/${gate}/README.md`] = page('Gate', [['Entity', 'gate'], ['Initial', 'closed'], ['Ends', 'closed'], ['Unaffected', 'none'], ['Origin', 'stated'], ['Cites', CITE]])
          + '\n' + table(['Phase', 'finish'], [['closed', 'None.']]);
      } });
      const findings = JSON.stringify(item(missing(f.dir), 'findings:p').found);
      assert.match(findings, /step-refused/);
      assert.match(findings, /complete/);
      assert.doesNotMatch(findings, /unchecked/);
      assert.ok(itemNames(item(missing(f.dir), `confirm:${JOURNEY}`).waits).includes('findings:p'));
    });
  }

  for (const presentAtStart of [false, true]) {
    test(`account.md §items entered by: a non-entry action ${presentAtStart ? 'uses an entity supplied by the start' : 'refuses an entity absent from the start'}`, async () => {
      // lifecycle-tool.md §stepping: an entered-by entity is absent until entered, unless the
      // journey's start table supplies it; lifecycle-tool.md §findings reports an unexpected refusal.
      const f = await fixture({ confirmLifecycle: false, confirmJourney: false, edit: (files) => {
        enteredLifecycle(files);
        if (presentAtStart) files[JP] = files[JP].replace('| Step |', `${table(['Lifecycle', 'Entity', 'Phase'], [['state', 'ticket-one', 'idle']])}\n| Step |`);
      } });
      const findings = JSON.stringify(missing(f.dir).filter((entry) => entry.item === 'findings:p').map((entry) => entry.found));
      if (presentAtStart) assert.doesNotMatch(findings, /step-refused|unchecked/);
      else {
        assert.match(findings, /step-refused/);
        assert.match(findings, /complete/);
        assert.ok(itemNames(item(missing(f.dir), `confirm:${JOURNEY}`).waits).includes('findings:p'));
      }
    });
  }

  test('account.md §items shortest journey: an entered-by lifecycle is entered before its first transition', async () => {
    // lifecycle-tool.md §shortest, design.md §code-journeys: shortest journeys start absent and must take create
    // before finish; account.md §items owes confirmation of the offered journey.
    const f = await fixture({ confirmLifecycle: false, confirmJourney: false, omit: [JP], edit: enteredLifecycle });
    recordDecision(f.dir, 'confirm', LIFE);
    const offered = 'p/journeys/reach-state--done';
    assert.ok(names(missing(f.dir)).includes(`confirm:${offered}`));
    const shown = json(f.dir, ['show', 'confirm', offered]);
    assert.ok(shown.shown.includes('Create the ticket.'));
    assert.ok(shown.shown.includes('Complete the ticket.'));
    // The showing's entry block precedes its passages (presentation.md §showings).
    assert.ok(shown.shown.indexOf('Create the ticket.') < shown.shown.indexOf('Complete the ticket.'));
  });

  for (const path of [LP, JP]) {
    test(`account.md §items citation-only lifecycle failure: ${path === LP ? 'a lifecycle' : 'a journey'} owes passage without unchecked`, async () => {
      // lifecycle-tool.md §findings, design.md §at-read and account.md §items: an unresolved citation is a
      // passage obligation, not a reason the lifecycle tool cannot step a page.
      const bad = 'design/brief/ticket.md#missing';
      const f = await fixture({ confirmLifecycle: false, confirmJourney: false, edit: (files) => { files[path] = replaceField(files[path], 'Cites', bad); } });
      const entries = missing(f.dir);
      assert.equal(item(entries, `passage:${bad}`).why, 'unresolved');
      assert.ok(!names(entries).includes('restate:p'));
      assert.doesNotMatch(JSON.stringify(entries.filter((entry) => entry.item === 'findings:p').map((entry) => entry.found)), /unchecked/);
      assert.doesNotMatch(JSON.stringify(account(f.dir).parts[0].lifecycles.map((entry) => entry.facts)), /unchecked/);
    });
  }

  test('account.md §items lifecycle exploration limit: every lifecycle reports unchecked after 250000 combinations', async () => {
    // lifecycle-tool.md §shortest bounds the read-time search at 250,000 combinations per
    // part; lifecycle-tool.md §findings and account.md §items expose unchecked as confirmation findings.
    // Nineteen bits form a binary counter: increment i requires lower bits
    // one and clears them. The highest bit first becomes one after 2**18
    // steps, so finding all phase targets cannot finish before the limit.
    const lifecycles = Array.from({ length: 19 }, (_, i) => `bit-${String(i).padStart(2, '0')}`);
    const actions = lifecycles.map((key) => `increment-${key}`);
    const f = await fixture({ noLifecycle: true, omit: [CP], edit: (files) => {
      files['design/parts/p/README.md'] = '# Tickets\n';
      files['design/parts/p/boundary.md'] = '# Bits\n\n## Boundary\n\n' + table(['Row', 'Names', 'Kind', 'Side', 'Seam', 'Isolation', 'Reads', 'Writes', 'Origin', 'Cites'], [
        ['worker', 'Ticket worker', 'service', 'machine', '-', '-', '-', '-', 'stated', CITE],
        ...lifecycles.map((key) => [key, key, 'entity', 'machine', '-', '-', 'worker', 'worker', 'stated', CITE]),
      ]);
      files['design/parts/p/actions.md'] = '# Actions\n\n' + table(['Action', 'Actor', 'Sentence', 'Cases', 'Guard', 'Origin', 'Cites'], actions.map((action) => [action, 'worker', `Set ${action}.`, 'none', 'none', 'stated', CITE]));
      for (const [index, key] of lifecycles.entries()) files[`design/parts/p/lifecycles/${key}/README.md`] = page(key, [['Entity', key], ['Initial', 'zero'], ['Ends', index === lifecycles.length - 1 ? 'one' : 'none'], ['Unaffected', actions.slice(0, index).join(', ') || 'none'], ['Origin', 'stated'], ['Cites', CITE]])
        + '\n' + table(['Phase', ...actions.slice(index)], [
          ['zero', ...actions.slice(index).map((_, offset) => offset === 0 ? 'one' : 'None.')],
          ['one', ...actions.slice(index).map((_, offset) => offset === 0 ? 'None.' : 'zero')],
        ]);
    } });
    const reading = account(f.dir);
    const entries = missing(f.dir);
    assert.ok(names(entries).includes('findings:p'));
    for (const key of lifecycles) {
      const facts = JSON.stringify(reading.parts[0].lifecycles.find((entry) => entry.ref === `p/lifecycles/${key}`).facts);
      assert.match(facts, /unchecked/);
      // The limit's explanation has no prescribed JSON shape or wording.
      assert.ok(itemNames(item(entries, `confirm:p/lifecycles/${key}`).waits).includes('findings:p'));
    }
  });

  test('account.md §journey-rules posed journey: an unchecked path keeps old evidence without owing a lifecycle run', async () => {
    // evidence.md §lifecycle-journeys: an empty or unpicked posed cell ends tool stepping and
    // suppresses the lifecycle question; evidence.md §currency keeps its old evidence, not current.
    // account.md §items owes pick and no flagged Restate for the posed cell itself.
    const f = await examined();
    const path = `models/${MODEL}/parts/p/journeys/complete/lifecycle-path.json`;
    const old = await read(f.dir, path);
    const previousCurrency = account(f.dir, JOURNEY).thing.evidence.find((entry) => entry.question === `${MODEL}/parts/p/journeys/complete/lifecycle-path`).current;
    f.files = await snapshot(f.dir, { skip: ['work', 'runs'] });
    posedCompletion(f.files);
    seal(f.files, fixturePins(f.files));
    await writeFiles(f.dir, f.files);
    // A posed cell alone does not block lifecycle confirmation (design lifecycle-tool.md §findings).
    // The existing journey's unchanged pin keeps its prior confirmation.
    recordDecision(f.dir, 'confirm', LIFE);
    const entries = missing(f.dir);
    assert.ok(names(entries).includes('pick:p/choices/route'));
    assert.ok(!names(entries).includes(`run:${MODEL}/parts/p/journeys/complete/lifecycle-path`));
    assert.equal(await read(f.dir, path), old);
    const evidence = account(f.dir, JOURNEY).thing.evidence.find((entry) => entry.question === `${MODEL}/parts/p/journeys/complete/lifecycle-path`);
    assert.ok(evidence);
    assert.notDeepEqual(evidence.current, previousCurrency);
  });
});

describe('account.md §what-it-is, §items — recorded freezes and Explain packets', () => {
  test('account.md §what-it-is freeze record: a generated surprise holds every claim slot and the confirmed lifecycle in byte order', async () => {
    // evidence.md §measures, §surprise-file; models.md §freeze: held follows basis, independently
    // of what the question read, and contains each frozen file's exact bytes.
    const f = await examined({ edit: (files) => {
      files[`${SLOT}/encoding.md`] = files[`${SLOT}/encoding.md`].replace('| state | done | finish | idle |', '| state | idle | finish | done |');
      files[`${SLOT}/witness-other.md`] = files[`${SLOT}/witness-done.md`].replace('An idle ticket can complete.', 'Another completion witness.');
    } });
    const files = await snapshot(f.dir);
    const path = Object.keys(files).find((path) => path.startsWith(`models/${QUESTION}/base.surprise-`) && path.endsWith('.json'));
    assert.ok(path, 'the violated base question opens a surprise');
    const surprise = JSON.parse(files[path]);
    const expected = [LP, `${SLOT}/encoding.md`, `${SLOT}/fault-reset.md`, `${SLOT}/witness-done.md`, `${SLOT}/witness-other.md`].sort().map((path) => ({ path, sha256: sha256(f.files[path]) }));
    assert.deepEqual(surprise.held, expected);
    const order = Object.keys(surprise);
    assert.equal(order.indexOf('held'), order.indexOf('basis') + 1);
    assert.ok(!Object.hasOwn(surprise, 'previous'));
    keys(surprise.measures, ['duration', 'combinations']);
    // account.md §items: the same persisted surprise remains owed after scratch loss.
    const clean = await cloneWithout(f.dir, []);
    assert.ok(names(missing(clean)).includes(`explain:${surprise.name}`));
    assert.ok(names(missing(clean)).includes(`rule:${surprise.name}`));
  });

  test('account.md §what-it-is freeze record: a changed held slot not read by the question counts for nothing until restored', async () => {
    // models.md §freeze; door.md §read-checks to §change; account.md §what-it-is, §items: held, not basis,
    // determines the frozen bytes, and direct restoration clears the change.
    const f = await fixture();
    await addSurprise(f, { question: `${QUESTION}/base`, kind: 'base', expected: { outcome: 'no violation' }, found: { outcome: 'violation', property: 'forbidden form' } });
    const path = `${SLOT}/fault-reset.md`, original = f.files[path];
    f.files[path] = replaceField(original, 'Mechanism', 'An altered planted defect.');
    seal(f.files, f.pins);
    await writeFiles(f.dir, f.files);
    assert.ok(names(missing(f.dir)).includes(`change:${path}`));
    f.files[path] = original;
    seal(f.files, f.pins);
    await writeFiles(f.dir, f.files);
    assert.ok(!names(missing(f.dir)).includes(`change:${path}`));
  });

  test('account.md §what-it-is freeze record: a missing held file is a change and an answer restoring its bytes is refused', async () => {
    // models.md §freeze treats a gone held file as changed, and refuses an answer
    // holding it whatever its bytes. account.md §items and door.md §forma-answer, §change expose
    // the change and preserve all tracked bytes on that refusal.
    const f = await fixture();
    await addSurprise(f);
    const dir = await cloneWithout(f.dir, [LP]);
    assert.ok(names(missing(dir)).includes(`change:${LP}`));
    const answer = await project(null, { [LP]: f.files[LP] });
    const before = await snapshot(dir, { skip: ['work', 'runs'] });
    const result = forma(dir, ['answer', `change:${LP}`, answer, '--provider', 'fixture', '--model', 'writer', '--session', 'restore-held', '--json']);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.json?.accepted, false, result.stderr);
    assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
  });

  test('account.md §items freeze scope: a journey surprise permits another claim witness on the model', async () => {
    // models.md §freeze freezes claim slots only when the surprise is on that
    // claim; models.md §owed and door.md §forma-answer allow a further witness at any time.
    const f = await fixture();
    const s = await addSurprise(f, { question: `${MODEL}/parts/p/journeys/complete/lifecycle-path`, kind: 'lifecycle-path', expected: { outcome: 'admitted' }, found: { outcome: 'refused', step: 1 } });
    const path = `${SLOT}/witness-other.md`;
    const text = f.files[`${SLOT}/witness-done.md`].replace('An idle ticket can complete.', 'Another completion witness.');
    const answer = await project(null, { [path]: text });
    assert.equal(json(f.dir, ['answer', `slot:${QUESTION}/witness`, answer, '--provider', 'fixture', '--model', 'writer', '--session', 'journey-new-witness']).accepted, true);
    assert.equal(await read(f.dir, path), text);
    assert.ok(names(missing(f.dir)).includes(`rule:${s.name}`));
    assert.ok(!names(missing(f.dir)).includes(`change:${path}`));
  });

  test('account.md §what-it-is freeze record: a new native engine file is discounted while its model surprise is open', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    // models.md §freeze and door.md §read-checks to §change: a new engine file is frozen out,
    // regardless of a matching receipt. account.md §what-it-is, §items expose it as change.
    const f = await native('tlc', { editNative: (files) => { files['models/core/parts/p/claims/sticks/encoding.tla'] = 'Invariant == state = 0\n'; } });
    json(f.dir, ['run']);
    const files = await snapshot(f.dir, { skip: ['work', 'runs'] });
    const surprisePath = Object.keys(files).find((path) => /core\/parts\/p\/claims\/sticks\/base\..*\.surprise-[a-f0-9]+\.json$/.test(path));
    assert.ok(surprisePath);
    const s = JSON.parse(files[surprisePath]);
    const path = 'models/core/Extra.tla';
    files[path] = '---- MODULE Extra ----\nValue == TRUE\n====\n';
    const lines = files['models/core/receipt'].trimEnd().split('\n').map(JSON.parse);
    lines.push({ file: 'Extra.tla', sha256: sha256(files[path]), at: WHEN, session: WRITER, authors: [WRITER] });
    files['models/core/receipt'] = lines.sort((a, b) => a.file < b.file ? -1 : 1).map((line) => JSON.stringify(line) + '\n').join('');
    const dir = await project(null, files);
    assert.ok(names(missing(dir)).includes(`change:${path}`));
    assert.ok(names(missing(dir)).includes(`rule:${s.name}`));
  });

  test('account.md §items explain sent back: a guarded transition carries its reason into the Explain packet', async () => {
    // evidence.md §sent-back: a lifecycle base trace taking a guarded move goes back first;
    // account.md §commands fixes found. door.md §forma-give to §gives copies that item and includes
    // evidence.md, models.md and decisions.md alongside account.md/door.md.
    const f = await examined({ edit: (files) => {
      files['design/parts/p/actions.md'] = files['design/parts/p/actions.md'].replace('| none | none |', '| none | The ticket is eligible. |');
      files[`${SLOT}/encoding.md`] = files[`${SLOT}/encoding.md`].replace('| state | done | finish | idle |', '| state | idle | finish | done |');
    } });
    const files = await snapshot(f.dir);
    const path = Object.keys(files).find((path) => path.startsWith(`models/${QUESTION}/base.surprise-`) && path.endsWith('.json'));
    assert.ok(path);
    const s = JSON.parse(files[path]);
    const entry = item(missing(f.dir), `explain:${s.name}`);
    assert.ok(entry.found);
    // The reason's wording and nested representation are unspecified.
    assert.ok(!['""', 'null', '[]', '{}'].includes(JSON.stringify(entry.found)));
    const packet = await project();
    const given = json(f.dir, ['give', `explain:${s.name}`, packet]);
    assert.equal(given.item, `explain:${s.name}`);
    const metadata = JSON.parse(await read(packet, 'item.json'));
    assert.deepEqual(metadata.item.found, entry.found);
    for (const name of ['account.md', 'door.md', 'evidence.md', 'models.md', 'decisions.md']) assert.ok(await read(packet, `forma/${name}`));
  });

  for (const kind of ['witness', 'fault']) test(`account.md §items give extra ${kind}: a filled claim still supplies the synthetic slot packet`, async () => {
    // door.md §forma-give exempts the synthetic witness/fault items from missing-only
    // give; models.md §owed and account.md §items allow them at any time.
    const f = await fixture();
    const name = `slot:${QUESTION}/${kind}`;
    assert.ok(!names(missing(f.dir)).includes(name));
    const packet = await project();
    const result = json(f.dir, ['give', name, packet]);
    assert.equal(result.item, name);
    assert.equal(result.folder, packet);
    assert.equal(await read(packet, CP), f.files[CP]);
    assert.equal(await read(packet, `${SLOT}/encoding.md`), f.files[`${SLOT}/encoding.md`]);
  });

  test('account.md §what-it-is receipts: a JSON-equivalent non-stringify escape discounts the receipt line', async () => {
    // door.md §receipts requires exactly JSON.stringify's text, not merely compact
    // valid JSON; door.md §read-checks to §change and account.md §what-it-is discount its unreceipted page.
    const f = await fixture();
    const path = 'design/parts/p/claims/sticks/receipt';
    await writeFiles(f.dir, { [path]: f.files[path].replace('README.md', 'README\\u002emd') });
    const entries = names(missing(f.dir));
    assert.ok(entries.includes(`change:${path}`));
    assert.ok(entries.includes(`change:${CP}`));
    assert.ok(!account(f.dir).parts.flatMap((part) => [...part.open, ...part.accepted, ...part.established]).some((entry) => entry.ref === CLAIM));
  });

  test('account.md §what-it-is receipts: an accepted extra witness writes literal Unicode in stringify form', async () => {
    // door.md §forma-answer, §receipts write receipts exactly as JSON.stringify, including
    // literal Unicode and slash characters inside declared session strings.
    const f = await fixture();
    const path = `${SLOT}/witness-other.md`;
    const answer = await project(null, { [path]: f.files[`${SLOT}/witness-done.md`] });
    assert.equal(json(f.dir, ['answer', `slot:${QUESTION}/witness`, answer, '--provider', 'fixturé/provider', '--model', 'writer', '--session', 'unicode']).accepted, true);
    const receipt = await read(f.dir, `${SLOT}/receipt`);
    assert.ok(receipt.endsWith('\n'));
    for (const line of receipt.slice(0, -1).split('\n')) assert.equal(line, JSON.stringify(JSON.parse(line)));
    const row = receipt.trimEnd().split('\n').map(JSON.parse).find((line) => line.file === 'witness-other.md');
    assert.equal(row.session.provider, 'fixturé/provider');
    assert.ok(!names(missing(f.dir)).includes(`change:${path}`));
  });
});

describe('account.md §items — revised repairs and kept journeys', () => {
  test('account.md §items offered decline: repairing its lifecycle closes the repair even when the offered steps stay the same', async () => {
    // decisions.md §confirm, §expects; design.md §code-journeys; account.md §items: an offered decline
    // sends repair to its lifecycle's part and is met when that lifecycle's pin
    // changes, even when the shortest journey still has the same finish step.
    const f = await fixture({ omit: [JP] });
    const offered = 'p/journeys/reach-state--done';
    recordDecision(f.dir, 'decline', offered, ['--words', 'Refuse completion when it is already done.']);
    const recorded = await snapshot(f.dir, { skip: ['work', 'runs'] });
    const declinePath = Object.keys(recorded).find((path) => path.includes('/decisions/') && field(recorded[path], 'Kind') === 'decline' && field(recorded[path], 'On') === offered);
    assert.ok(declinePath);
    const declineName = declinePath.split('/').at(-1).slice(0, -3);
    const repair = `repair:${declineName}`;
    assert.deepEqual(item(missing(f.dir), repair).supply, [agent('repair')]);
    const answer = await project(null, {
      [LP]: f.files[LP].replace('| done | done |', '| done | None. |'),
      'repair.md': fields([['Mechanism', 'Completion is refused once the ticket is done.']]),
    });
    const accepted = json(f.dir, ['answer', repair, answer, '--provider', 'fixture', '--model', 'writer', '--session', 'offered-decline-repair']);
    assert.equal(accepted.accepted, true);
    assert.ok(!names(missing(f.dir)).includes(repair));
    assert.equal(item(missing(f.dir), `confirm:${LIFE}`).why, 'lapsed');
    assert.equal(await read(f.dir, declinePath), recorded[declinePath]);
  });

  for (const target of ['claim page', 'encoding']) {
    test(`account.md §items property wrong: one repair item accepts a changed ${target}`, async () => {
      // decisions.md §rulings, §expects; door.md §gives, §repair-answer; models.md §model-repair: property wrong may
      // revise the claim page or refill its encoding without changing model files.
      const f = await fixture();
      const s = await addSurprise(f, { question: `${QUESTION}/base`, kind: 'base', expected: { outcome: 'no violation' }, found: { outcome: 'violation', property: 'forbidden form' } });
      const rule = await ruling(f, s, { verdict: 'property wrong', target: '-', targetPin: '-' });
      // door.md §gives permits both answer kinds for the same property-wrong item;
      // find that item without choosing whether its name has a model suffix.
      const repair = names(missing(f.dir)).find((name) => name === `repair:${rule.name}` || name.startsWith(`repair:${rule.name}/`));
      assert.ok(repair);
      assert.deepEqual(item(missing(f.dir), repair).supply, [agent('repair')]);
      const path = target === 'claim page' ? CP : `${SLOT}/encoding.md`;
      const changed = target === 'claim page'
        ? replaceField(f.files[CP], 'Sentence', 'A done ticket remains done unless deliberately reset.')
        : f.files[path].replace('| state | done | finish | idle |', '| state | idle | finish | idle |');
      const answer = await project(null, { [path]: changed, 'repair.md': fields([['Mechanism', 'Revise the property to match deliberate completion.']]) });
      const accepted = json(f.dir, ['answer', repair, answer, '--provider', 'fixture', '--model', 'writer', '--session', `property-repair-${target.replaceAll(' ', '-')}`]);
      assert.equal(accepted.accepted, true);
      assert.equal(await read(f.dir, LP), f.files[LP]);
      assert.equal(await read(f.dir, path), changed);
      assert.ok(!names(missing(f.dir)).includes(repair));
      if (target === 'claim page') assert.equal(item(missing(f.dir), `confirm:${CLAIM}`).why, 'lapsed');
      else {
        assert.equal(await read(f.dir, CP), f.files[CP]);
        assert.ok(!names(missing(f.dir)).includes(`confirm:${CLAIM}`));
      }
      // decisions.md §expects and door.md §receipts: the changed file's receipt records the
      // ruling that the answer met; no layout of the answers entries is assumed.
      const receipt = await read(f.dir, `${path.slice(0, path.lastIndexOf('/'))}/receipt`);
      assert.ok(receipt.split('\n').filter(Boolean).map(JSON.parse).some((line) => line.file === path.split('/').at(-1) && JSON.stringify(line.answers ?? []).includes(rule.name)));
    });
  }

  test('account.md §items property wrong: changing a lifecycle with the refilled encoding refuses the repair', async () => {
    // models.md §model-repair: a property-wrong model repair changes the ruled encoding and
    // none of the model's own files; door.md §forma-answer to §repair-answer preserves the tracked record.
    const f = await fixture();
    const s = await addSurprise(f, { question: `${QUESTION}/base`, kind: 'base', expected: { outcome: 'no violation' }, found: { outcome: 'violation', property: 'forbidden form' } });
    const rule = await ruling(f, s, { verdict: 'property wrong', target: '-', targetPin: '-' });
    const repair = names(missing(f.dir)).find((name) => name === `repair:${rule.name}` || name.startsWith(`repair:${rule.name}/`));
    assert.ok(repair);
    item(missing(f.dir), repair);
    const answer = await project(null, {
      [`${SLOT}/encoding.md`]: f.files[`${SLOT}/encoding.md`].replace('| state | done | finish | idle |', '| state | idle | finish | idle |'),
      [LP]: f.files[LP].replace('| done | done |', '| done | None. |'),
      'repair.md': fields([['Mechanism', 'Change both completion and its property.']]),
    });
    const before = await snapshot(f.dir, { skip: ['work', 'runs'] });
    const result = forma(f.dir, ['answer', repair, answer, '--provider', 'fixture', '--model', 'writer', '--session', 'property-with-model-change', '--json']);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.equal(result.json.accepted, false);
    assert.ok(result.json.reasons.some((reason) => reason.check === 'models.md §model-repair'));
    assert.deepEqual(await snapshot(f.dir, { skip: ['work', 'runs'] }), before);
    assert.ok(names(missing(f.dir)).includes(repair));
  });

  test('account.md §items model repair: changing only a file the ruled question did not read refuses the repair', async () => {
    // models.md §model-repair now requires a changed file in a ruled surprise's basis;
    // decisions.md §expects and door.md §repair-answer leave an ineffective repair owed.
    const f = await fixture();
    const s = await addSurprise(f, { question: `${MODEL}/parts/p/journeys/complete/lifecycle-path`, kind: 'lifecycle-path', expected: { outcome: 'admitted' }, found: { outcome: 'refused', step: 1 } });
    const rule = await ruling(f, s, { target: MODEL, targetPin: '-' });
    const repair = `repair:${rule.name}/${MODEL}`;
    item(missing(f.dir), repair);
    const witness = `${SLOT}/witness-done.md`;
    // A journey question's basis reads its journey and lifecycles, not this claim witness.
    const answer = await project(null, {
      [witness]: replaceField(f.files[witness], 'Meaning', 'Completion remains observable.'),
      'repair.md': fields([['Mechanism', 'Describe the witness more clearly.']]),
    });
    const before = await snapshot(f.dir, { skip: ['work', 'runs'] });
    const result = forma(f.dir, ['answer', repair, answer, '--provider', 'fixture', '--model', 'writer', '--session', 'unread-file-repair', '--json']);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.equal(result.json.accepted, false);
    assert.ok(result.json.reasons.some((reason) => reason.check === 'models.md §model-repair'));
    assert.deepEqual(await snapshot(f.dir, { skip: ['work', 'runs'] }), before);
    assert.ok(names(missing(f.dir)).includes(repair));
  });

  test('account.md §items kept lifecycle trace: model wrong keeps a lifecycle base violation as a confirmed must-not journey', async () => {
    // decisions.md §rulings to §kept-journeys: lifecycle base violations can be kept; the ruling
    // confirms the generated must-not journey. account.md §journey-rules to §items asks its path.
    const f = await examined({ edit: (files) => {
      files[`${SLOT}/encoding.md`] = files[`${SLOT}/encoding.md`].replace('| state | done | finish | idle |', '| state | idle | finish | done |');
    } });
    const files = await snapshot(f.dir, { skip: ['work', 'runs'] });
    const surprisePath = Object.keys(files).find((path) => path.startsWith(`models/${QUESTION}/base.surprise-`) && path.endsWith('.json'));
    assert.ok(surprisePath);
    const s = JSON.parse(files[surprisePath]);
    const digest = sha256(jsonText(s.basis));
    const kept = `p/journeys/kept-${digest.slice(0, 12)}`;
    const explanation = fields([['Question', s.question], ['Basis', digest.slice(0, 12)], ['Verdict', 'model wrong'], ['Level', 'specification'], ['Weaker', 'none']])
      + '\n## Trace\n\nThe idle ticket completed.\n\n## Failure shape\n\nCompletion occurred where it was forbidden.\n\n## Mechanism\n\nThe lifecycle admits finish from idle to done.\n';
    const answer = await project(null, { 'explain.md': explanation });
    assert.equal(json(f.dir, ['answer', `explain:${s.name}`, answer, '--provider', 'fixture', '--model', 'reviewer', '--session', 'lifecycle-trace-explainer']).accepted, true);
    recordDecision(f.dir, 'rule', s.name, ['--verdict', 'model wrong', '--level', 'specification', '--words', 'Prevent completion through this transition.', '--basis', '-']);
    assert.ok(!names(missing(f.dir)).includes(`confirm:${kept}`));
    assert.equal(account(f.dir, kept).scope, kept);
    assert.ok(names(missing(f.dir)).includes(`run:${MODEL}/parts/p/journeys/${kept.split('/').at(-1)}/lifecycle-path-to-0`));
    const after = await snapshot(f.dir, { skip: ['work', 'runs'] });
    const rulePath = Object.keys(after).find((path) => path.includes('/decisions/') && field(after[path], 'Kind') === 'rule' && field(after[path], 'On') === s.name);
    assert.ok(rulePath);
    const keptSection = after[rulePath].split('\n## Kept\n')[1];
    assert.ok(keptSection.includes(`| Journey | ${kept} |`));
    assert.ok(keptSection.includes('| Polarity | must not |'));
    assert.ok(keptSection.includes('| Refused step | 1 |'));
    assert.ok(keptSection.includes('| Expected end | - |'));
    assert.ok(keptSection.includes('| 1 | Ticket worker | finish | - | - | - |'));
    assert.equal(await read(f.dir, `design/parts/p/journeys/${kept.split('/').at(-1)}/README.md`), null);
  });
});

describe('account.md §journey-rules to §items — ruling scope and native alternatives', () => {
  test('account.md §journey-rules kept journey scope: overriding one surprise removes only its journey from the older grouped ruling', async () => {
    // decisions.md §kept-journeys, §in-force: a kept journey follows its ruling per surprise,
    // even when that ruling remains in force for another surprise it grouped.
    // These historical decisions hand-write their specified tables and pins.
    const f = await fixture();
    const first = await addSurprise(f, { question: `${QUESTION}/base`, kind: 'base', expected: { outcome: 'no violation' }, found: { outcome: 'violation', property: 'forbidden form' } });
    const otherBasis = { ...first.value.basis, runtime: { name: 'node', version: 'v0.0.1' } };
    const otherDigest = sha256(jsonText(otherBasis));
    const second = { name: `${QUESTION}/base.surprise-${otherDigest.slice(0, 12)}`, question: first.question, digest: otherDigest, value: { ...first.value, basis: otherBasis } };
    const surprises = [first, second].sort((a, b) => a.name < b.name ? -1 : 1);
    const journeyText = replaceField(replaceField(replaceField(replaceField(f.files[JP], 'Polarity', 'must not'), 'Expected end', '-'), 'Refused step', '1'), 'Origin', 'added');
    const keptPin = fixturePins({ ...f.files, [JP]: journeyText })[JOURNEY];
    const kept = (s) => `p/journeys/kept-${s.digest.slice(0, 12)}`;
    const surpriseTables = (list) => '\n## Surprises\n\n'
      + table(['Surprise', 'Question', 'Basis', 'Parts', 'Expected', 'Found'], list.map((s) => [s.name, s.question, s.digest, 'p', 'no violation', 'violation'])) + '\n'
      + table(['Surprise', 'Entry', 'Pin'], list.flatMap((s) => s.value.basis.entries.map((entry) => [s.name, entry.entry, entry.pin])));
    const keptSection = '\n## Kept\n\n' + surprises.map((s) => `### ${s.name}\n\n${fields([['Journey', kept(s)], ['Pin', keptPin]])}\n${journeyText.slice(journeyText.indexOf('| Field |'))}`).join('\n');
    const grouped = decision(f.files, { kind: 'rule', on: surprises.map((s) => s.name).join(', '), rows: [['Verdict', 'model wrong'], ['Level', 'specification'], ['Target', '-'], ['Target pin', '-'], ['Basis', '-']], words: 'Block each completion trace.', index: 30, extra: surpriseTables(surprises), shown: 'rule the two historical completion traces', afterShown: keptSection });
    await writeFiles(f.dir, f.files);
    const refs = (reading) => reading.parts.flatMap((part) => [...part.open, ...part.established]).map((entry) => entry.ref);
    const before = refs(account(f.dir));
    assert.ok(before.includes(kept(first)));
    assert.ok(before.includes(kept(second)));
    decision(f.files, { kind: 'rule', on: first.name, rows: [['Verdict', 'property wrong'], ['Level', 'specification'], ['Target', '-'], ['Target pin', '-'], ['Basis', '-']], words: 'Revise only the first trace property.', index: 31, extra: surpriseTables([first]), shown: 'rule the first historical completion trace again' });
    await writeFiles(f.dir, f.files);
    const after = refs(account(f.dir));
    assert.ok(!after.includes(kept(first)));
    assert.ok(after.includes(kept(second)));
    assert.ok(names(missing(f.dir)).includes(`repair:${grouped.name}/${MODEL}`));
    assert.ok(!names(missing(f.dir)).includes(`confirm:${kept(second)}`));
  });

  for (const shared of [false, true]) {
    test(`account.md §journey-rules enabled alternatives: an unpicked action ${shared ? 'still owes enabled when another journey takes it' : 'owes no enabled question when only that alternative takes it'}`, { skip: !hasToolchain && 'toolchain absent' }, async () => {
      // account.md §journey-rules and evidence.md §questions: only actions exclusive to an unpicked
      // alternative are exempt; another written journey restores the question.
      const f = await native('tlc', { edit: (files) => {
        files['design/parts/p/actions.md'] += `| reset | worker | Reset the ticket. | none | none | stated | ${CITE} |\n`;
        files[LP] = replaceField(files[LP], 'Unaffected', 'reset');
        const alternative = (action, count) => fields([['Polarity', 'should happen'], ['Expected end', 'The ticket completes.'], ['Refused step', '-']]) + '\n'
          + table(['Step', 'Actor', 'Action', 'Arguments', 'Entity', 'Case'], Array.from({ length: count }, (_, i) => [i + 1, 'Ticket worker', action, '-', '-', '-']));
        files['design/parts/p/choices/route/README.md'] = page('Completion route', [['Question', 'Which completion path should be used?'], ['Recommendation', 'a: Complete directly.'], ['Cites', CITE]]) + `\n## a\n\n${alternative('finish', 2)}\n## b\n\n${alternative('reset', 3)}`;
        if (shared) files['design/parts/p/journeys/reset/README.md'] = files[JP].replaceAll('finish', 'reset');
      }, editNative: (files) => {
        files['models/core/model.md'] = files['models/core/model.md'].replace('| p/finish | Finish | none |', '| p/finish | Finish | none |\n| p/reset | Reset | none |');
        files['models/core/Ticket.tla'] = files['models/core/Ticket.tla'].replace('====', 'Reset == FALSE\n====');
      } });
      recordDecision(f.dir, 'pick', 'p/choices/route', ['--choice', 'a']);
      const runs = names(missing(f.dir)).filter((name) => name.startsWith('run:core/actions/p/reset.'));
      if (shared) assert.equal(runs.length, 1);
      else assert.equal(runs.length, 0);
      const enabled = account(f.dir).models.find((model) => model.model === 'core').fails.filter((entry) => entry.rule === 'enabled' && JSON.stringify(entry.on).includes('reset'));
      assert.equal(enabled.length, shared ? 1 : 0);
    });
  }
});

describe('account.md §items — another-engine splits', () => {
  for (const engine of ['alloy', 'tlc']) {
    test(`account.md §items cannot express split: a smaller ${engine === 'alloy' ? 'different-engine model is accepted' : 'same-engine model is refused'} without unanswered evidence`, { skip: !hasToolchain && 'toolchain absent' }, async () => {
      // models.md §one-model-first to §owed and account.md §items: cannot-express on every covering
      // model permits a smaller model on another engine; the same-engine split
      // still needs current unanswered evidence, which this fixture never has.
      const reason = fields([['Cannot express', 'This encoding cannot represent the required data relation.']]);
      const f = await native('tlc', { edit: (files) => {
        addSpan(files);
        files[`${SLOT}/encoding.md`] = reason;
      }, editNative: (files) => {
        files['models/core/model.md'] = replaceField(files['models/core/model.md'], 'Parts', 'p, q');
        delete files['models/core/parts/p/claims/sticks/encoding.tla'];
        files['models/core/parts/p/claims/sticks/encoding.md'] = reason;
      } });
      const target = `express:${CLAIM}`;
      assertItem(item(missing(f.dir), target), { on: CLAIM, supply: [agent('model'), developer('accept', 'carry or allow')] });
      const source = await snapshot(await project(`account/${engine}`));
      const answerFiles = {};
      for (const [path, bytes] of Object.entries(source)) if (/^models\/core\/[^/]+$/.test(path)) answerFiles[path.replace('models/core/', 'models/smaller/')] = bytes;
      const answer = await project(null, answerFiles);
      const before = await snapshot(f.dir, { skip: ['work', 'runs'] });
      const result = forma(f.dir, ['answer', target, answer, '--provider', 'fixture', '--model', 'writer', '--session', `split-${engine}`, '--json']);
      if (engine === 'alloy') {
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.equal(result.json.accepted, true);
        assert.ok(account(f.dir).models.some((model) => model.model === 'smaller' && model.engine === 'alloy'));
        assert.ok(names(missing(f.dir)).includes('slot:smaller/parts/p/claims/sticks/encoding'));
        assert.ok(!names(missing(f.dir)).includes(target));
      } else {
        assert.equal(result.status, 1, result.stdout + result.stderr);
        assert.equal(result.json.accepted, false);
        assert.deepEqual(await snapshot(f.dir, { skip: ['work', 'runs'] }), before);
        assert.ok(names(missing(f.dir)).includes(target));
      }
    });
  }
});

// Suggested additions for tests/account.test.mjs. These use that file's helpers.
// Every native execution is guarded by the harness's hasToolchain flag.

// evidence.md §basis, §surprise-file, §explain; door.md §receipts: obtain a real surprise through the
// harness, then hand-author only the explanation and optional weaker form.
// The command output supplies the identity being answered, never an expected
// outcome. Expected property names and weaker eligibility come from evidence.md §outcomes/door.md §scratch.
async function nativeExplanationRecord({ typeFailure = false, withWeaker = true } = {}) {
  const f = await native('tlc', { omit: typeFailure ? [LP] : [], editNative: (files) => {
    if (typeFailure) {
      // No lifecycle means no Phases row/question can pre-empt the base run.
      // The confirmed one-step journey reaches state 1 within TypeOK; the base
      // explores a second step to state 2 and finds TypeOK before Invariant.
      files['models/core/parts/p/claims/sticks/encoding.tla'] = 'Invariant == TRUE\n';
      files['models/core/model.md'] = files['models/core/model.md'].replace('| p/state | e \\in Tickets | Phase(e) |\n', '');
      files['models/core/Ticket.tla'] = files['models/core/Ticket.tla']
        .replace('TypeOK == state \\in 0..2', 'TypeOK == state \\in 0..1')
        .replace("Finish == state' = 1", "Finish == state' = IF state = 0 THEN 1 ELSE 2");
    }
    else files['models/core/parts/p/claims/sticks/encoding.tla'] = 'Invariant == state = 0\n';
  } });
  json(f.dir, ['run']);
  const files = await snapshot(f.dir, { skip: ['work', 'runs'] });
  const path = Object.keys(files).find((path) => /core\/parts\/p\/claims\/sticks\/base\..*\.surprise-[a-f0-9]+\.json$/.test(path));
  assert.ok(path, 'the selected base failure opens a surprise');
  const surprise = JSON.parse(files[path]);
  assert.equal(surprise.found.property, typeFailure ? 'TypeOK' : 'Invariant');
  const stem = path.slice(0, -5), folder = path.slice(0, path.lastIndexOf('/'));
  const explanation = fields([
    ['Question', surprise.question], ['Basis', sha256(jsonText(surprise.basis)).slice(0, 12)],
    ['Verdict', typeFailure ? 'model wrong' : 'property wrong'], ['Level', 'specification'], ['Weaker', withWeaker ? 'loose' : 'none'],
  ]) + '\n## Trace\n\nThe ticket completed.\n\n## Failure shape\n\nCompletion is ruled out by the written property.\n\n## Mechanism\n\nThe model or encoding excludes the completed state.\n';
  const additions = { [`${stem}.explained.md`]: explanation };
  if (withWeaker) additions[`${stem}.weaker-loose.tla`] = 'Invariant == state # 2\n';
  const writer = { provider: 'fixture', model: 'reviewer', session: 'native-explanation' };
  const receipt = files[`${folder}/receipt`].trimEnd().split('\n').map(JSON.parse);
  for (const [file, bytes] of Object.entries(additions)) receipt.push({ file: file.slice(folder.length + 1), sha256: sha256(bytes), at: WHEN, session: writer, authors: [writer] });
  Object.assign(files, additions);
  files[`${folder}/receipt`] = receipt.sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0).map((row) => JSON.stringify(row) + '\n').join('');
  return { dir: await project(null, files), surprise, stem };
}

describe('account.md §what-it-is, §items — native explanation checks and bound whitespace', () => {
  for (const typeFailure of [false, true]) for (const withWeaker of [false, true]) {
    test(`account.md §items weaker eligibility: ${typeFailure ? 'a type-invariant failure' : 'an encoding-property failure'} ${withWeaker ? 'with' : 'without'} a weaker form`, { skip: !hasToolchain && 'toolchain absent' }, async () => {
      // evidence.md §weaker, §explain check 3: exactly encoding-property base failures
      // require weaker forms; door.md §change repeats this check at read.
      const { dir, surprise, stem } = await nativeExplanationRecord({ typeFailure, withWeaker });
      const accepted = typeFailure !== withWeaker;
      const entries = names(missing(dir));
      assert.equal(entries.includes(`change:${stem}.explained.md`), !accepted);
      assert.equal(entries.includes(`explain:${surprise.name}`), !accepted);
      if (accepted && withWeaker) assert.ok(entries.includes(`run:${surprise.name}/weaker-loose`));
      if (accepted && !withWeaker) assert.ok(!entries.some((name) => name.startsWith(`run:${surprise.name}/weaker-`)));
    });
  }

  test('account.md §what-it-is weaker parser: an imported explanation is not discounted merely because this machine lacks its native toolchain', { skip: !hasToolchain && 'toolchain absent for historical-run setup' }, async () => {
    // door.md §change item 3 defers only the parser check when its toolchain is
    // missing. Harness forma's environment override selects an empty toolchain
    // after setup, so the read is performed with no pinned native binaries.
    const { dir, surprise, stem } = await nativeExplanationRecord();
    const emptyToolchain = await project();
    const result = forma(dir, ['missing', '--json'], { env: { FORMA_TOOLCHAIN: emptyToolchain } });
    // project.md §commands and account.md §commands: this successful read is JSON.
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.ok(result.json && Array.isArray(result.json.items));
    const entries = names(result.json.items);
    assert.ok(!entries.includes(`change:${stem}.explained.md`));
    assert.ok(!entries.includes(`change:${stem}.weaker-loose.tla`));
    assert.ok(!entries.includes(`explain:${surprise.name}`));
  });

  for (const [label, value, canonical] of [
    ['NEL outside a string collapses', '{\u0085ticket\u0085}', '{ticket}'],
    ['BOM within a quoted value is retained', '{"ti\ufeffcket"}', '{"ti\ufeffcket"}'],
  ]) {
    test(`account.md §items native bounds: ${label} in the question name`, { skip: !hasToolchain && 'toolchain absent' }, async () => {
      // evidence.md §bounds uses design.md §passages White_Space outside quoted strings,
      // retains string contents, and hashes each normalized line plus its LF.
      // account.md §items gives that exact question in the missing run item.
      const f = await native('tlc', { editNative: (files) => {
        files['models/core/model.md'] = files['models/core/model.md'].replace('| constant Tickets | {ticket} |', `| constant Tickets | ${value} |`);
      } });
      const digest = sha256(`constant Tickets = ${canonical}\n`).slice(0, 12);
      // Enabled questions are asked before conformance gates claim questions.
      assert.equal(item(missing(f.dir), `run:core/actions/p/finish.${digest}`).why, 'none');
    });
  }
});


describe('account.md §basis-line — unreported measures', () => {
  test('account.md §basis-line measures: an unreported lifecycle measure remains null in the basis', async () => {
    // evidence.md §measures fixes null when a measure was not reported; account.md
    // account.md §basis-line to presentation.md §reading carries each contributing evidence file's measures into the basis.
    const { dir } = await examined();
    const path = `models/${QUESTION}/base.json`;
    const evidence = JSON.parse(await read(dir, path));
    evidence.measures.combinations = null;
    await writeFiles(dir, { [path]: evidenceFile(evidence) });
    const entry = modelClaim(account(dir)).basis.evidence.find((entry) => entry.question === `${QUESTION}/base`);
    keys(entry.measures, ['duration', 'combinations']);
    assert.equal(entry.measures.combinations, null);
  });
});

describe('account.md §journey-rules — lifecycle entry questions', () => {
  test('account.md §journey-rules repeated entry: lifecycle evidence refuses entering an entity the journey already holds', async () => {
    // evidence.md §lifecycle-journeys, engines.md §lifecycle-engine: the lifecycle data form refuses a second entry,
    // unlike the tool's stepping rule in lifecycle-tool.md §stepping. A confirmation already
    // in the record keeps its pin under decisions.md §in-force, even though the tool
    // would refuse a new confirmation of this journey (lifecycle-tool.md §findings).
    const f = await fixture({ confirmLifecycle: false, confirmJourney: false, edit: (files) => {
      enteredLifecycle(files);
      files[JP] = files[JP].replace('| 1 | Ticket worker | finish |', '| 1 | Ticket worker | create |') + '| 2 | Ticket worker | create | - | - | - |\n';
    } });
    decision(f.files, { kind: 'confirm', on: JOURNEY, pin: f.pins[JOURNEY], index: 4,
      shown: showing(f.files, 'confirm', JOURNEY, []) });
    await writeFiles(f.dir, f.files);
    recordDecision(f.dir, 'confirm', LIFE);
    const question = `${MODEL}/parts/p/journeys/complete/lifecycle-path`;
    assert.ok(names(missing(f.dir)).includes(`run:${question}`));
    json(f.dir, ['run']);
    // evidence.md §outcomes, §keys fixes the lifecycle refusal outcome and its step.
    const evidence = JSON.parse(await read(f.dir, `models/${question}.json`));
    assert.equal(evidence.found.outcome, 'refused');
    assert.equal(evidence.found.step, 2);
    assert.equal(evidence.matches, false);
  });
});

describe('account.md §what-it-is, §items — clarified page checks', () => {
  test('account.md §items reserved action key: phase owes restatement rather than a file change', async () => {
    // forms.md §page-rules reserves phase; design.md §at-read classifies all key rules as check 2,
    // so account.md §items owes restate: with unresolved, not change: on the page.
    const { dir } = await fixture({ edit: (files) => {
      files['design/parts/p/actions.md'] += `| phase | worker | Observe the phase. | none | none | stated | ${CITE} |\n`;
      files[LP] = replaceField(files[LP], 'Unaffected', 'phase');
    } });
    const entries = missing(dir);
    assert.equal(item(entries, 'restate:p').why, 'unresolved');
    assert.ok(!names(entries).includes('change:design/parts/p/actions.md'));
  });

  test('account.md §items repeated action column: duplicate lifecycle keys owe restatement rather than a file change', async () => {
    // forms.md §page-rules, design.md §at-read explicitly put repeated action columns under check 2;
    // account.md §items exposes the unresolved Restate item while reading the page.
    const { dir } = await fixture({ edit: (files) => {
      files[LP] = files[LP].replace('| Phase | finish |', '| Phase | finish | finish |')
        .replace('| --- | --- |\n| idle', '| --- | --- | --- |\n| idle')
        .replace('\n| idle | done |', '\n| idle | done | done |')
        .replace('\n| done | done |', '\n| done | done | done |');
    } });
    const entries = missing(dir);
    assert.equal(item(entries, 'restate:p').why, 'unresolved');
    assert.ok(!names(entries).includes(`change:${LP}`));
  });

  test('account.md §what-it-is journey form: a should-happen journey with a refused-step number counts for nothing', async () => {
    // forms.md §journeys, design.md §at-read: a should-happen Refused step must be '-'; a form
    // failure discounts the page and is change: under door.md §change/account door.md §door.
    const { dir } = await fixture({ edit: (files) => { files[JP] = replaceField(files[JP], 'Refused step', '1'); } });
    assert.ok(names(missing(dir)).includes(`change:${JP}`));
  });

  test('account.md §what-it-is choice form: identical alternatives count for nothing', async () => {
    // forms.md §choices, design.md §at-read make differing alternatives an own-form check;
    // door.md §change and account.md §what-it-is expose a change even with a valid receipt.
    const path = 'design/parts/p/choices/route/README.md';
    const { dir } = await fixture({ edit: (files) => {
      addChoice(files);
      const first = files[path].split('\n## a\n\n')[1].split('\n## b\n\n')[0];
      files[path] = files[path].split('\n## b\n\n')[0] + '\n## b\n\n' + first;
    } });
    assert.ok(names(missing(dir)).includes(`change:${path}`));
  });
});

// account.md §basis-line to presentation.md §reading: premise details live once under Assumed; a claim's model
// entries refer to names with carried flags, while a one-claim reading supplies
// its own complete premise entries because it has no Assumed section.
describe('account.md §basis-line to presentation.md §reading premise and phase presentation', () => {
  test('presentation.md §reading: two claims name a shared premise whose details appear once', async () => {
    const { dir } = await fixture({ premise: true, carryPremise: false, edit: files => {
      files['design/parts/p/claims/other/README.md'] = files[CP].replace('# Completion sticks', '# Another claim')
        .replace('A done ticket never becomes idle.', 'Completed tickets are retained.');
    } });
    const reading = account(dir);
    for (const ref of [CLAIM, 'p/claims/other']) {
      const model = claim(reading, ref).models.find(row => row.model === MODEL);
      const named = model.premises.find(row => row.premise === 'p/premises/trust');
      assert.deepEqual(named, { premise: 'p/premises/trust', carried: false });
    }
    const statement = 'The worker reports completion faithfully.';
    const falsifier = 'A completion report disagrees with the ticket.';
    const text = success(dir, ['account', 'p']).stdout;
    assert.equal(text.split(statement).length - 1, 1);
    assert.equal(text.split(falsifier).length - 1, 1);
    assert.ok(text.indexOf(statement) > text.indexOf('### Assumed'));
    const own = account(dir, CLAIM).thing.premises.find(row => row.premise === 'p/premises/trust');
    assert.equal(own.statement, statement);
    assert.equal(own.class, 'world');
    assert.equal(own.falsifier, falsifier);
  });

  test('presentation.md §reading: initial is distinct from an uncovered noninitial phase', async () => {
    const { dir } = await fixture({ confirmJourney: false });
    const life = account(dir).parts[0].lifecycles.find(row => row.ref === LIFE);
    assert.equal(life.phases.find(row => row.phase === 'idle').class, 'initial');
    assert.equal(life.phases.find(row => row.phase === 'done').class, 'open');
  });

  test('account.md §commands: confirm parts is read before every confirmation waiting for it', async () => {
    const { dir } = await fixture({ confirmParts: false, confirmLifecycle: false, confirmJourney: false, confirmClaim: false });
    const items = missing(dir), all = names(items);
    const at = all.indexOf('confirm:parts');
    assert.ok(at >= 0);
    const dependents = items.filter(row => row.item.startsWith('confirm:') && row.item !== 'confirm:parts');
    assert.ok(dependents.length > 1);
    const text = success(dir, ['missing']).stdout;
    for (const dependent of dependents) {
      assert.ok(itemNames(dependent.waits).includes('confirm:parts'));
      assert.ok(at < all.indexOf(dependent.item));
      assert.ok(text.indexOf('confirm:parts') < text.indexOf(dependent.item));
    }
  });

  test('account.md §basis-line: a ruled base failure names its ruling when no run can supply examined', async () => {
    const f = await fixture({ edit: files => {
      files[`${SLOT}/encoding.md`] = table(['Lifecycle', 'Phase'], [['state', 'idle']]);
    } });
    const ran = json(f.dir, ['run']);
    const name = ran.opened.find(name => name.startsWith(`${QUESTION}/base.surprise-`));
    assert.ok(name);
    const value = JSON.parse(await read(f.dir, `models/${name}.json`));
    f.files = await snapshot(f.dir);
    const surprise = { name, question: value.question, digest: sha256(jsonText(value.basis)), value };
    const decision = await ruling(f, surprise, { verdict: 'real finding', target: 'brief', targetPin: '-' });
    const fail = failure(account(f.dir), 'examined');
    assert.equal(fail.reason, `its base surprise is ruled: ${decision.name}`);
  });
});
