import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  project, answerFolder, tempFolder, writeFiles, read, tree, snapshot, forma, sha256, hasToolchain, repo, app,
} from './helpers/forma.mjs';

// All input pages and native models are hand-written fixtures. These helpers
// implement only the contracts' record rules; nothing imports src/ or an engine.
const P = 'design/parts/gate';
const L = 'lifecycles-gate';
const C = `${L}/parts/gate/claims/safe`;
const J = `${L}/parts/gate/journeys`;
const lifePage = `${P}/lifecycles/door/README.md`;
const claimPage = `${P}/claims/safe/README.md`;
const positivePage = `${P}/journeys/open-once/README.md`;
const negativePage = `${P}/journeys/open-twice/README.md`;
const encoding = `models/${C}/encoding.md`;
const author = { provider: 'fixture', model: 'writer', session: 'model-author' };
const explainer = ['--provider', 'fixture', '--model', 'reader', '--session', 'independent'];
const epoch = '2020-01-01T00:00:00.000Z';
const iso = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const hash = /^[0-9a-f]{64}$/;
const external = { skip: !hasToolchain && 'toolchain absent' };
const sorted = values => [...values].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
const jsonText = value => `${JSON.stringify(value, null, 2)}\n`;
const keys = (value, expected) => {
  assert.ok(value && typeof value === 'object', 'Forma must return the specified JSON object');
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
};
const orderedKeys = (value, expected) => {
  assert.ok(value && typeof value === 'object', 'Forma must write the specified JSON object');
  assert.deepEqual(Object.keys(value), expected);
};
// lifecycle-tool.md §as-read: a showing retains exact diagram JSON, including
// its source and basis, inside the surrounding decision's text fence.
function retainedPictures(text) {
  return [...text.matchAll(/^([ \t]*)```json forma-diagram\n([\s\S]*?)^\1```[ \t]*$/gm)].map(match => {
    const picture = JSON.parse(match[2]);
    const expected = JSON.stringify(picture, null, 2).split('\n').map(line => match[1] + line).join('\n') + '\n';
    assert.equal(match[2], expected);
    return picture;
  });
}

function table(text, first) {
  const lines = text.split('\n');
  const start = lines.findIndex(line => line.startsWith(`| ${first} |`));
  if (start < 0) return [];
  const names = lines[start].split('|').slice(1, -1).map(v => v.trim());
  const out = [];
  for (let n = start + 2; n < lines.length && lines[n].startsWith('|'); n++) {
    const cells = lines[n].split('|').slice(1, -1).map(v => v.trim().replace(/^`([^`]*)`$/, '$1'));
    out.push(Object.fromEntries(names.map((name, i) => [name, cells[i]])));
  }
  return out;
}
const fields = text => Object.fromEntries(table(text, 'Field').map(r => [r.Field, r.Value]));

// design.md §passages, §pins: canonical texts for this deliberately small fixture's
// plain paragraphs/tables. This is not a Markdown parser or a production oracle.
function meanings(files) {
  const passage = sha256(files['design/brief/gate.md'].trim().split(/\n\s*\n/)
    .map(block => block.replace(/\p{White_Space}+/gu, ' ').replace(/^ +| +$/g, '')).join('\n\n'));
  const out = {};
  const boundary = Object.fromEntries(table(files[`${P}/boundary.md`], 'Row').map(r => [r.Row, r]));
  const reference = key => {
    const r = boundary[key];
    return `${r.Names} (${r.Kind}, ${r.Side}, ${r.Seam}, ${r.Isolation})`;
  };
  const list = (value, resolve = v => v) => value === 'none' ? '' : value.split(', ').map(resolve).sort().join(', ');
  const content = pairs => pairs.map(([k, v]) => `${k}: ${v}`).join('\n');
  for (const [key, row] of Object.entries(boundary)) {
    out[`gate/boundary/${key}`] = content(['Names', 'Kind', 'Side', 'Seam', 'Isolation', 'Reads', 'Writes', 'Cites'].map(k =>
      [k, k === 'Cites' ? passage : ['Reads', 'Writes'].includes(k) && row[k] !== '-' ? list(row[k], reference) : row[k]]));
  }
  const actions = Object.fromEntries(table(files[`${P}/actions.md`], 'Action').map(r => [r.Action, r]));
  const action = key => {
    const r = actions[key];
    return r.Sentence + (r.Cases === 'none' ? '' : ` (cases ${r.Cases})`) + (r.Guard === 'none' ? '' : ` (guard ${r.Guard})`);
  };
  for (const [key, r] of Object.entries(actions)) {
    out[`gate/actions/${key}`] = content([
      ['Actor', reference(r.Actor)], ['Sentence', r.Sentence], ['Cases', list(r.Cases)],
      ['Guard', r.Guard], ['Cites', passage],
    ]);
  }
  const lifecycles = Object.entries(files).filter(([path]) => path.startsWith(`${P}/lifecycles/`) && path.endsWith('/README.md'));
  for (const [path, text] of lifecycles) {
    const f = fields(text);
    const initial = f.Initial.replace(/, entered by (.+)$/, (_, a) => `, entered by ${action(a)}`);
    const outcome = value => value.startsWith('choice:') ?
      `choice ${fields(files[`${P}/choices/${value.slice(7)}/README.md`]).Question}` : value || '(empty)';
    const cell = value => value.includes('<br>') ? value.split('<br>').map(s => {
      const [name, ...rest] = s.trim().split(': ');
      return `${name}: ${outcome(rest.join(': '))}`;
    }).sort().join('; ') : outcome(value);
    const lines = table(text, 'Phase').flatMap(r => Object.keys(r).filter(k => k !== 'Phase').map(a =>
      `Cell: ${r.Phase} | ${action(a)} | ${cell(r[a])}`)).sort();
    out[`gate/lifecycles/${path.split('/').at(-2)}`] = content([
      ['Entity', reference(f.Entity)], ['Initial', initial], ['Ends', list(f.Ends)],
      ['Unaffected', list(f.Unaffected, action)], ['Cites', passage],
    ]) + (lines.length ? `\n${lines.join('\n')}` : '');
  }
  for (const [path, text] of Object.entries(files)) {
    if (!path.startsWith(`${P}/journeys/`) || !path.endsWith('/README.md')) continue;
    const f = fields(text);
    const starts = table(text, 'Lifecycle').map(r => {
      const life = fields(files[`${P}/lifecycles/${r.Lifecycle}/README.md`]);
      return `Start: ${boundary[life.Entity].Names} | ${r.Entity} | ${r.Phase}`;
    }).sort();
    const steps = table(text, 'Step').map(r => `Step ${r.Step}: ${r.Actor} | ${action(r.Action)} | ${r.Arguments} | ${r.Entity} | ${r.Case}`);
    out[`gate/journeys/${path.split('/').at(-2)}`] = [content([
      ['Polarity', f.Polarity], ['Expected end', f['Expected end']], ['Refused step', f['Refused step']], ['Cites', passage],
    ]), ...starts, ...steps].join('\n');
  }
  if (files[claimPage]) {
    const f = fields(files[claimPage]);
    const purpose = table(files['design/README.md'], 'Part').find(r => r.Part === 'gate').Purpose;
    out['gate/claims/safe'] = content([
      ['Sentence', f.Sentence], ['Kind', f.Kind], ['Stake', f.Stake],
      ['Rests on', list(f['Rests on'], key => {
        const premise = files[`${P}/premises/${key}/README.md`];
        return premise ? fields(premise).Statement : key;
      })], ['Parts', purpose], ['Cites', passage],
    ]);
  }
  return out;
}
const entryPins = files => Object.fromEntries(Object.entries(meanings(files)).map(([name, value]) => [name, sha256(value)]));

// decisions.md §decision-file to §kinds, §intake: fixture decisions' filename hashes are computed from
// their hand-written contents. Showing text is not copied from Forma.
function decision(kind, on, pin, extras = [], at = epoch, words) {
  const showing = 'Hand-written contract fixture.\n';
  const rows = [['Kind', kind], ['On', on], ['Pin', pin ?? sha256(showing)], ...extras,
    ['Provider', '-'], ['Model', '-'], ['Session', '-'], ['By', 'Fixture developer'], ['At', at]];
  const text = `# ${kind} ${on}\n\n| Field | Value |\n| --- | --- |\n${rows.map(([k, v]) => `| ${k} | ${v} |\n`).join('')}` +
    (words === undefined ? '' : `\n## Words\n\n\`\`\`text\n${words}\n\`\`\`\n`) +
    `\n## Shown\n\n\`\`\`text\n${showing}\`\`\`\n`;
  return { name: `${at.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}-${kind}-${sha256(text).slice(0, 12)}`, text };
}
function intake({ runs = 100, seconds = 10, tlcSeconds = 20, alloySeconds = 20, megabytes = 512 } = {}) {
  return decision('intake', 'intake', null, [
    ['Situation', 'design new'], ['Answers', 100], ['Runs', runs],
    ['TLC seconds', tlcSeconds], ['TLC megabytes', megabytes], ['Alloy seconds', alloySeconds],
    ['Alloy megabytes', megabytes], ['Lifecycle seconds', seconds], ['Cadence', 'span'], ['Inbox cap', 7],
  ], epoch, 'Networking is outside this ticket example.');
}

// door.md §receipts and models.md §slot-currency: receipts hash the exact fixture bytes, and
// slot lines pin the entries their kind reads. No evidence is receipted.
function receipts(files) {
  const pins = entryPins(files);
  const groups = {};
  for (const [path, text] of Object.entries(files)) {
    if (!(path.startsWith('design/') || path.startsWith('models/')) ||
        path.startsWith('design/brief/') || path.includes('/decisions/') ||
        path.endsWith('/receipt') || path.endsWith('.json') || path.endsWith('.gitattributes')) continue;
    const folder = path.slice(0, path.lastIndexOf('/'));
    const file = path.slice(path.lastIndexOf('/') + 1);
    const line = { file, sha256: sha256(text), at: epoch, session: author, authors: [author] };
    if (/\/(encoding\.(md|tla|als)|witness-[^/]+\.md|fault-[^/]+\.md)$/.test(path)) {
      let names = ['gate/claims/safe'];
      if (path.startsWith(`models/${L}/`)) names.push(...Object.keys(pins).filter(k => k.startsWith('gate/lifecycles/')));
      else if (file.startsWith('fault-')) names.push('gate/actions/open');
      line.pins = sorted(names).map(entry => ({ entry, pin: pins[entry] }));
    }
    if (file === 'schedule.md') {
      const journey = path.split('/').at(-2);
      const steps = table(files[`${P}/journeys/${journey}/README.md`], 'Step');
      const names = new Set([`gate/journeys/${journey}`, ...steps.map(r => `gate/actions/${r.Action}`)]);
      for (const step of steps.filter(r => r.Case !== '-')) {
        for (const life of Object.keys(pins).filter(k => k.startsWith('gate/lifecycles/'))) {
          if (table(files[`design/parts/${life}/README.md`], 'Phase').some(r => Object.hasOwn(r, step.Action))) names.add(life);
        }
      }
      line.pins = sorted(names).map(entry => ({ entry, pin: pins[entry] }));
    }
    if (/\/world\/gate\/robot\/[^/]+\.(tla|als)$/.test(path)) {
      line.pins = [{ entry: 'gate/boundary/robot', pin: pins['gate/boundary/robot'] }];
    }
    if (file === 'model.md') line.strikes = [];
    (groups[folder] ??= []).push(line);
  }
  return Object.fromEntries(Object.entries(groups).map(([folder, lines]) =>
    [`${folder}/receipt`, lines.sort((a, b) => a.file < b.file ? -1 : 1).map(l => JSON.stringify(l) + '\n').join('')]));
}
async function fixture(options = {}) {
  const source = await project('evidence/lifecycle');
  let files = await snapshot(source);
  if (options.engine) {
    const native = await project(`evidence/${options.engine}`);
    files = { ...files, ...await snapshot(native) };
  }
  for (const [path, value] of Object.entries(options.files ?? {})) {
    if (value === null) delete files[path];
    else files[path] = typeof value === 'function' ? value(files[path]) : value;
  }
  if (options.edit) options.edit(files);
  files = { ...files, ...receipts(files) };
  const pins = entryPins(files);
  if (options.intake !== false) {
    const d = intake(options);
    files[`design/decisions/${d.name}.md`] = d.text;
  }
  let index = 1;
  for (const [entry, pin] of Object.entries(pins)) {
    if (!/gate\/(lifecycles|journeys)\//.test(entry) || options.unconfirmed?.includes(entry)) continue;
    const d = decision('confirm', entry, pin, [], `2020-01-01T00:00:${String(index++).padStart(2, '0')}.000Z`);
    files[`design/parts/${entry}/decisions/${d.name}.md`] = d.text;
  }
  return project(null, files);
}
async function fileJSON(dir, path) {
  const raw = await read(dir, path);
  assert.notEqual(raw, null, `Forma must write ${path}`);
  return JSON.parse(raw);
}
function run(dir, args = []) {
  const result = forma(dir, ['run', ...args, '--json']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.ok(result.json && typeof result.json === 'object', 'forma run must return its JSON object');
  keys(result.json, ['ran', 'opened', 'removed', 'skipped', 'runs']);
  for (const row of result.json.ran) keys(row, ['name', 'found', 'matches', 'duration', 'wrote', 'spent']);
  for (const row of result.json.skipped) keys(row, ['name', 'reason']);
  keys(result.json.runs, ['spent', 'left']);
  // evidence.md §forma-run does not define the value types of ran.found/matches/wrote/spent.
  // Test their observable effects and evidence fields, without inventing types.
  return result.json;
}
function command(dir, args) {
  const r = forma(dir, [...args, '--json']);
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.ok(r.json);
  return r.json;
}
async function tracked(dir) { return snapshot(dir, { skip: ['work', 'runs'] }); }
async function copyWithout(dir, prefixes) {
  return project(null, Object.fromEntries(Object.entries(await snapshot(dir)).filter(([p]) =>
    !prefixes.some(prefix => p === prefix || p.startsWith(`${prefix}/`)))));
}
// evidence.md §basis, §own-check: canonical JSON and digests, independent of Forma.
const basisDigest = basis => sha256(jsonText(basis));
function sealed(value) {
  const result = { ...value, digest: '' };
  result.digest = sha256(jsonText(result));
  return jsonText(result);
}
async function changeEvidence(dir, name, change) {
  const value = await fileJSON(dir, `models/${name}.json`);
  change(value);
  await writeFiles(dir, { [`models/${name}.json`]: sealed(value) });
}
async function evidence(dir, name) { return fileJSON(dir, `models/${name}.json`); }
async function allEvidence(dir, model = L) {
  const paths = (await tree(dir)).filter(p => p.startsWith(`models/${model}/`) && p.endsWith('.json'));
  return Promise.all(paths.map(p => fileJSON(dir, p)));
}
function checkEvidenceBytes(raw) {
  const e = JSON.parse(raw);
  assert.equal(raw, jsonText(e));
  assert.match(e.digest, hash);
  assert.equal(e.digest, sha256(jsonText({ ...e, digest: '' })));
  assert.match(e.established, iso);
  return e;
}
async function passing(options) {
  const dir = await fixture(options);
  run(dir);
  return dir;
}
async function surpriseProject(options = {}) {
  const dir = await fixture({ ...options, files: { ...options.files,
    [encoding]: '| Lifecycle | Phase |\n| --- | --- |\n| door | opened |\n' } });
  const result = run(dir);
  const name = result.opened.find(n => n.startsWith(`${C}/base.surprise-`));
  assert.ok(name, 'the forbidden reachable combination must open a base surprise');
  return { dir, name, surprise: await evidence(dir, name) };
}
function explanation(s, overrides = {}) {
  const values = { Question: s.question, Basis: basisDigest(s.basis).slice(0, 12),
    Verdict: 'model wrong', Level: 'specification', Weaker: 'none', ...overrides };
  return '| Field | Value |\n| --- | --- |\n' + Object.entries(values).map(([k, v]) => `| ${k} | ${v} |\n`).join('') +
    '\n## Trace\n\nThe robot opens the ticket.\n\n## Failure shape\n\nAn opened ticket is forbidden.\n\n## Mechanism\n\nThe forbidden combination includes the opened phase.\n';
}
async function submitExplanation(dir, name, files, session = explainer) {
  const folder = await answerFolder(files);
  return forma(dir, ['answer', `explain:${name}`, folder, ...session, '--json']);
}
function assertRefused(result, section = 'evidence.md §explain') {
  assert.equal(result.status, 1, result.stdout);
  assert.ok(result.json, 'refusal must be JSON, not a CLI startup error');
  assert.equal(result.json.accepted, false);
  assert.ok(result.json.reasons.length);
  assert.ok(result.json.reasons.some(r => r.check.startsWith(section)), JSON.stringify(result.json.reasons));
  for (const reason of result.json.reasons) keys(reason, ['check', 'file', 'entry', 'field', 'says']);
}

// evidence.md §bounds and design.md §passages: Unicode White_Space outside quoted
// strings, byte-sort, LF each line. JS \s includes FEFF and omits U+0085.
function normalizeBound(value) {
  const strings = [];
  const protectedText = value.replace(/"(?:\\.|[^"\\])*"/g, s => `\u0000${strings.push(s) - 1}\u0000`);
  const normalized = protectedText.replace(/\p{White_Space}+/gu, ' ').replace(/^ +| +$/g, '')
    .replace(/\{ +/g, '{').replace(/ +}/g, '}')
    .replace(/ *, */g, ', ').replace(/ *\.\. */g, '..');
  return normalized.replace(/\u0000(\d+)\u0000/g, (_, i) => strings[Number(i)]);
}
function modelBounds(text) {
  return Object.fromEntries(table(text, 'Bound').map(r => [normalizeBound(r.Bound), normalizeBound(r.Value)])
    .sort(([a], [b]) => Buffer.compare(Buffer.from(a), Buffer.from(b))));
}
const boundsDigest = bounds => sha256(sorted(Object.keys(bounds)).map(k => `${k} = ${bounds[k]}\n`).join('')).slice(0, 12);
async function nativeFixture(engine, options = {}) { return fixture({ ...options, engine }); }
const modelFor = engine => engine === 'tlc' ? 'core' : 'relational';

async function reviseFixture(dir, changes, confirm = true) {
  const files = await snapshot(dir);
  for (const [path, value] of Object.entries(changes)) files[path] = typeof value === 'function' ? value(files[path]) : value;
  const writes = { ...Object.fromEntries(Object.keys(changes).map(p => [p, files[p]])), ...receipts(files) };
  if (confirm) {
    for (const [entry, pin] of Object.entries(entryPins(files))) {
      if (!/gate\/(lifecycles|journeys)\//.test(entry)) continue;
      const d = decision('confirm', entry, pin, [], '2020-01-02T00:00:00.000Z');
      writes[`design/parts/${entry}/decisions/${d.name}.md`] = d.text;
    }
  }
  await writeFiles(dir, writes);
}

describe('evidence.md §questions Questions', () => {
  test('evidence.md §questions: current lifecycle slots ask base, witness and fault with their fixed expectations', async () => {
    const dir = await passing();
    for (const [kind, suffix, expected, found] of [
      ['base', 'base', 'no violation', { outcome: 'no violation' }],
      ['witness', 'witness-open', 'reached', { outcome: 'reached' }],
      ['fault', 'fault-reopen', 'caught', { outcome: 'violation', property: 'forbidden form' }],
    ]) {
      const e = await evidence(dir, `${C}/${suffix}`);
      assert.equal(e.kind, kind);
      assert.deepEqual(e.expected, { outcome: expected });
      assert.deepEqual(e.found, found);
      assert.equal(e.matches, true);
    }
  });
  test('evidence.md §questions: an encoding giving a reason asks no base, witness or fault', async () => {
    const dir = await fixture({ files: { [encoding]: '| Field | Value |\n| --- | --- |\n| Cannot express | Requires data beyond phases. |\n' } });
    const r = run(dir);
    assert.ok(r.ran.length > 0);
    assert.ok(r.ran.every(row => !row.name.includes('/claims/')));
  });
  test('evidence.md §questions: an unconfirmed lifecycle has no lifecycle model or questions', async () => {
    const dir = await fixture({ unconfirmed: ['gate/lifecycles/door'] });
    assert.deepEqual(run(dir).ran, []);
  });
  test('evidence.md §questions: an unconfirmed journey is not asked', async () => {
    const dir = await fixture({ unconfirmed: ['gate/journeys/open-twice'] });
    const r = run(dir);
    assert.ok(r.ran.some(x => x.name.includes('open-once/')));
    assert.ok(r.ran.every(x => !x.name.includes('open-twice/')));
  });
  test('evidence.md §questions: claims wait for confirmed positive progress before spending property runs', async () => {
    const dir = await fixture({ unconfirmed: ['gate/journeys/open-once'] });
    const r = run(dir);
    assert.ok(r.ran.some(x => x.name.includes('open-twice/')));
    assert.ok(r.ran.every(x => !x.name.includes('/claims/')));
  });
  test('evidence.md §questions: a slot whose recorded pin is stale composes no question', async () => {
    const dir = await fixture();
    const path = `models/${C}/receipt`;
    const lines = (await read(dir, path)).trim().split('\n').map(JSON.parse);
    for (const line of lines) for (const pin of line.pins) pin.pin = '0'.repeat(64);
    await writeFiles(dir, { [path]: lines.map(l => `${JSON.stringify(l)}\n`).join('') });
    assert.ok(run(dir).ran.every(x => !x.name.includes('/claims/')));
  });
  test('evidence.md §questions: lifecycle question links include every lifecycle and action of its part', async () => {
    const dir = await passing();
    const e = await evidence(dir, `${C}/base`);
    const pins = entryPins(await snapshot(dir));
    for (const entry of ['gate/claims/safe', 'gate/lifecycles/door', 'gate/actions/open', 'gate/actions/reset']) {
      assert.ok(e.basis.entries.some(p => p.entry === entry && p.pin === pins[entry]), entry);
    }
  });
  for (const engine of ['tlc', 'alloy']) {
    for (const use of ['exclusive unpicked alternative', 'no pick', 'another journey', 'another alternative']) {
      test(`evidence.md §questions: ${engine} enabled questions account for an action used by ${use}`, external, async () => {
        // evidence.md §questions and account.md §journey-rules: only a picked choice's otherwise
        // unused alternative exempts an action; other journeys need not be confirmed.
        const alternative = (key, steps) => `## ${key}\n\n| Field | Value |\n| --- | --- |\n| Polarity | should happen |\n| Expected end | The ticket can be considered. |\n| Refused step | - |\n\n| Step | Actor | Action | Arguments | Entity | Case |\n| --- | --- | --- | --- | --- | --- |\n${steps.map((action, n) => `| ${n + 1} | The robot | ${action} | This ticket | - | - |\n`).join('')}\n`;
        const choice = (question, first) => `# Ticket handling\n\n| Field | Value |\n| --- | --- |\n| Question | ${question} |\n| Recommendation | a: act immediately. |\n| Cites | design/brief/gate.md#gate |\n\n` + alternative('a', [first]) + alternative('b', ['wait', 'reset']);
        const model = modelFor(engine);
        const dir = await nativeFixture(engine, { files: {
          [`${P}/actions.md`]: t => `${t}| wait | robot | Wait for the ticket. | none | none | stated | design/brief/gate.md#gate |\n`,
          [lifePage]: t => t.replace('| Unaffected | none |', '| Unaffected | wait |'),
          [`${P}/choices/handling/README.md`]: choice('Should the ticket be opened now?', 'open'),
          ...(use === 'another alternative' ? { [`${P}/choices/resetting/README.md`]: choice('Should the ticket be reset now?', 'reset') } : {}),
          ...(use === 'another journey' ? { [`${P}/journeys/wait/README.md`]: '# Wait\n\n| Field | Value |\n| --- | --- |\n| Polarity | should happen |\n| Expected end | The robot has waited. |\n| Refused step | - |\n| Origin | stated |\n| Cites | design/brief/gate.md#gate |\n\n| Step | Actor | Action | Arguments | Entity | Case |\n| --- | --- | --- | --- | --- | --- |\n| 1 | The robot | wait | This ticket | - | - |\n' } : {}),
          [`models/${model}/model.md`]: t => t.replace('| gate/reset | Reset | none |', '| gate/reset | Reset | none |\n| gate/wait | Wait | none |'),
          [`models/${model}/Gate.${engine === 'tlc' ? 'tla' : 'als'}`]: t => engine === 'tlc' ? t.replace('====', 'Wait == FALSE\n====') : `${t}\npred Wait { no Ticket }\n`,
        }, unconfirmed: ['gate/journeys/wait'] });
        if (use !== 'no pick') {
          const shown = command(dir, ['show', 'pick', 'gate/choices/handling']);
          command(dir, ['decide', 'pick', 'gate/choices/handling', '--shown', shown.token, '--choice', 'a', '--by', 'Developer',
            '--provider', 'fixture', '--model', 'developer', '--session', 'pick-handler']);
        }
        const r = run(dir);
        const d = boundsDigest(modelBounds(await read(dir, `models/${model}/model.md`)));
        const name = `${model}/actions/gate/wait.${d}`;
        assert.equal(r.ran.some(row => row.name === name), use !== 'exclusive unpicked alternative');
        const missing = command(dir, ['missing']);
        assert.equal(missing.items.some(i => i.item === `run:${name}`), false);
        if (use === 'exclusive unpicked alternative') assert.equal(await read(dir, `models/${name}.json`), null);
        else assert.deepEqual((await evidence(dir, name)).found, { outcome: 'not reached' });
      });
    }
  }
});

describe('evidence.md §lifecycle-journeys Lifecycle journeys', () => {
  test('evidence.md §lifecycle-journeys: should-happen is admitted and a must-not is refused at its numbered step', async () => {
    const dir = await passing();
    const yes = await evidence(dir, `${J}/open-once/lifecycle-path`);
    assert.deepEqual(yes.expected, { outcome: 'admitted' });
    assert.deepEqual(yes.found, { outcome: 'admitted' });
    const no = await evidence(dir, `${J}/open-twice/lifecycle-path-refused-at-2`);
    assert.equal(no.kind, 'lifecycle-path');
    assert.deepEqual(no.expected, { outcome: 'refused', step: 2 });
    assert.deepEqual(no.found, { outcome: 'refused', step: 2 });
    assert.equal(no.matches, true);
  });
  test('evidence.md §lifecycle-journeys: an admitted negative step asks only its prefix', async () => {
    const dir = await passing({ files: { [lifePage]: t => t.replace('| opened | None. | closed |', '| opened | opened | closed |') } });
    const e = await evidence(dir, `${J}/open-twice/lifecycle-path-to-1`);
    assert.deepEqual(e.expected, { outcome: 'admitted', step: 1 });
    assert.deepEqual(e.found, { outcome: 'admitted' });
    assert.equal(await read(dir, `models/${J}/open-twice/lifecycle-path-refused-at-2.json`), null);
  });
  test('evidence.md §lifecycle-journeys: once asked a refusal remains a refusal after an edit admits it', async () => {
    const dir = await passing();
    await reviseFixture(dir, { [lifePage]: t => t.replace('| opened | None. | closed |', '| opened | opened | closed |') });
    run(dir);
    const e = await evidence(dir, `${J}/open-twice/lifecycle-path-refused-at-2`);
    assert.deepEqual(e.expected, { outcome: 'refused', step: 2 });
    assert.deepEqual(e.found, { outcome: 'admitted' });
    assert.equal(e.matches, false);
    assert.equal(await read(dir, `models/${J}/open-twice/lifecycle-path-to-1.json`), null);
  });
  test('evidence.md §lifecycle-journeys: a prefix gives way to a newly refused question and retains its old evidence', async () => {
    const dir = await passing({ files: { [lifePage]: t => t.replace('| opened | None. | closed |', '| opened | opened | closed |') } });
    const path = `models/${J}/open-twice/lifecycle-path-to-1.json`;
    const before = await read(dir, path);
    await reviseFixture(dir, { [lifePage]: t => t.replace('| opened | opened | closed |', '| opened | None. | closed |') });
    run(dir);
    assert.equal(await read(dir, path), before);
    assert.deepEqual((await evidence(dir, `${J}/open-twice/lifecycle-path-refused-at-2`)).found, { outcome: 'refused', step: 2 });
  });
  test('evidence.md §lifecycle-journeys: an unreachable start is refused at step zero', async () => {
    const dir = await fixture({ files: {
      [lifePage]: t => t.replace('| closed | opened | closed |', '| closed | closed | closed |'),
      [positivePage]: t => t.replace('| Step | Actor', '| Lifecycle | Entity | Phase |\n| --- | --- | --- |\n| door | door | opened |\n\n| Step | Actor'),
    } });
    run(dir);
    assert.deepEqual((await evidence(dir, `${J}/open-once/lifecycle-path`)).found, { outcome: 'refused', step: 0 });
  });
  for (const cell of ['empty', 'posed']) {
    test(`evidence.md §lifecycle-journeys: a journey meeting a ${cell} cell has no question and retains noncurrent evidence`, async () => {
      const dir = await passing({ files: { [`models/${C}/fault-reopen.md`]: null } });
      const path = `models/${J}/open-once/lifecycle-path.json`;
      const stored = await read(dir, path);
      const changes = { [lifePage]: t => t.replace('| closed | opened | closed |', `| closed | ${cell === 'empty' ? '' : 'choice:opening'} | closed |`) };
      if (cell === 'posed') {
        const alternative = (key, end, outcome) => `## ${key}\n\n| Field | Value |\n| --- | --- |\n| Polarity | should happen |\n| Expected end | ${end} |\n| Refused step | - |\n\n| Step | Actor | Action | Arguments | Entity | Case |\n| --- | --- | --- | --- | --- | --- |\n| 1 | The robot | open | This ticket | - | - |\n\n| Lifecycle | Phase | Action | Outcome |\n| --- | --- | --- | --- |\n| door | closed | open | ${outcome} |\n\n`;
        changes[`${P}/choices/opening/README.md`] = '# Opening\n\n| Field | Value |\n| --- | --- |\n| Question | Does opening leave the ticket closed? |\n| Recommendation | a: open it. |\n| Cites | design/brief/gate.md#gate |\n\n' + alternative('a', 'The ticket opens.', 'opened') + alternative('b', 'The ticket stays closed.', 'closed');
      }
      await reviseFixture(dir, changes);
      const r = run(dir);
      assert.ok(r.ran.every(row => !row.name.startsWith(`${J}/open-once/`)));
      assert.equal(await read(dir, path), stored);
      // presentation.md §reading fixes the evidence's current field; facts' internal shape is open.
      const account = command(dir, ['account', 'gate/journeys/open-once']);
      assert.equal(account.thing.evidence.find(e => e.question === `${J}/open-once/lifecycle-path`).current, false);
      if (cell === 'posed') assert.ok(command(dir, ['missing']).items.some(i => i.item === 'pick:gate/choices/opening'));
    });
    test(`evidence.md §lifecycle-journeys and lifecycle-tool.md §stepping: refusal takes precedence over another lifecycle's ${cell} cell`, async () => {
      const dir = await fixture({ files: {
        [lifePage]: t => t.replace('| opened | None. | closed |', `| opened | ${cell === 'empty' ? '' : 'choice:reopening'} | closed |`),
        [`${P}/boundary.md`]: t => `${t}| latch | The latch | entity | machine | - | - | robot | robot | stated | design/brief/gate.md#gate |\n`,
        [`${P}/lifecycles/latch/README.md`]: '# Latch\n\n| Field | Value |\n| --- | --- |\n| Entity | latch |\n| Initial | closed |\n| Ends | none |\n| Unaffected | none |\n| Origin | stated |\n| Cites | design/brief/gate.md#gate |\n\n| Phase | open | reset |\n| --- | --- | --- |\n| closed | opened | closed |\n| opened | None. | closed |\n',
        ...(cell === 'posed' ? { [`${P}/choices/reopening/README.md`]: '# Reopening\n\n| Field | Value |\n| --- | --- |\n| Question | Does opening an open ticket close it? |\n| Recommendation | a: keep it open. |\n| Cites | design/brief/gate.md#gate |\n\n' + ['opened', 'closed'].map((outcome, i) => `## ${i ? 'b' : 'a'}\n\n| Field | Value |\n| --- | --- |\n| Polarity | should happen |\n| Expected end | The ticket is ${outcome}. |\n| Refused step | - |\n\n| Step | Actor | Action | Arguments | Entity | Case |\n| --- | --- | --- | --- | --- | --- |\n| 1 | The robot | reset | This ticket | - | - |\n\n| Lifecycle | Phase | Action | Outcome |\n| --- | --- | --- | --- |\n| door | opened | open | ${outcome} |\n\n`).join('') } : {}),
      } });
      run(dir);
      const e = await evidence(dir, `${J}/open-twice/lifecycle-path-refused-at-2`);
      assert.deepEqual(e.found, { outcome: 'refused', step: 2 });
      assert.equal(e.matches, true);
    });
  }
  test('evidence.md §lifecycle-journeys, engines.md §lifecycle-engine and lifecycle-tool.md §stepping: another action refuses an entity absent until its entering action', async () => {
    const dir = await fixture({ unconfirmed: ['gate/journeys/open-twice'], files: {
      [`${P}/actions.md`]: t => `${t}| create | robot | Create the ticket. | none | none | stated | design/brief/gate.md#gate |\n`,
      [lifePage]: t => t.replace('| Initial | closed |', '| Initial | closed, entered by create |')
        .replace('| Phase | open | reset |', '| Phase | open | reset | create |').replace('| --- | --- | --- |', '| --- | --- | --- | --- |')
        .replace('| closed | opened | closed |', '| closed | opened | closed | None. |').replace('| opened | None. | closed |', '| opened | None. | closed | None. |'),
    } });
    run(dir);
    assert.deepEqual((await evidence(dir, `${J}/open-once/lifecycle-path`)).found, { outcome: 'refused', step: 1 });
  });
  test('evidence.md §lifecycle-journeys, engines.md §lifecycle-engine: entering creates an absent entity and a second entry is refused', async () => {
    const dir = await fixture({ files: {
      [`${P}/actions.md`]: t => `${t}| create | robot | Create the ticket. | none | none | stated | design/brief/gate.md#gate |\n`,
      [lifePage]: t => t.replace('| Initial | closed |', '| Initial | closed, entered by create |')
        .replace('| Phase | open | reset |', '| Phase | open | reset | create |').replace('| --- | --- | --- |', '| --- | --- | --- | --- |')
        .replace('| closed | opened | closed |', '| closed | opened | closed | None. |').replace('| opened | None. | closed |', '| opened | None. | closed | None. |'),
      [positivePage]: t => t.replace('| 1 | The robot | open | This ticket | - | - |', '| 1 | The robot | create | This ticket | - | - |\n| 2 | The robot | open | This ticket | - | - |'),
      [negativePage]: t => t.replaceAll('| open |', '| create |'),
    } });
    run(dir);
    assert.deepEqual((await evidence(dir, `${J}/open-once/lifecycle-path`)).found, { outcome: 'admitted' });
    assert.deepEqual((await evidence(dir, `${J}/open-twice/lifecycle-path-refused-at-2`)).found, { outcome: 'refused', step: 2 });
  });
  test('evidence.md §lifecycle-journeys and lifecycle-tool.md §shortest, design.md §code-journeys: an offered shortest journey enters an initially absent entity first', async () => {
    const dir = await fixture({ files: {
      [positivePage]: null,
      [negativePage]: null,
      [`${P}/README.md`]: t => t.replace(/^.*\]\(journeys\/.*\n/gm, ''),
      [`${P}/actions.md`]: t => `${t}| create | robot | Create the ticket. | none | none | stated | design/brief/gate.md#gate |\n`,
      [lifePage]: t => t.replace('| Initial | closed |', '| Initial | closed, entered by create |')
        .replace('| Phase | open | reset |', '| Phase | open | reset | create |').replace('| --- | --- | --- |', '| --- | --- | --- | --- |')
        .replace('| closed | opened | closed |', '| closed | opened | closed | None. |').replace('| opened | None. | closed |', '| opened | None. | closed | None. |'),
    } });
    const session = ['--provider', 'fixture', '--model', 'developer', '--session', 'shortest-confirmation'];
    const parts = command(dir, ['show', 'confirm', 'parts']);
    command(dir, ['decide', 'confirm', 'parts', '--shown', parts.token, '--by', 'Developer', ...session]);
    const shown = command(dir, ['show', 'confirm', 'gate/journeys/reach-door--opened']);
    const recorded = command(dir, ['decide', 'confirm', 'gate/journeys/reach-door--opened', '--shown', shown.token, '--by', 'Developer', ...session]);
    // decisions.md §confirm fixes the offered journey's tables under ## Journey.
    const kept = (await read(dir, recorded.recorded[0])).split('## Journey\n')[1];
    assert.ok(kept);
    assert.deepEqual(table(kept, 'Step').map(row => row.Action), ['create', 'open']);
  });
  test('evidence.md §lifecycle-journeys and lifecycle-tool.md §findings: a citation-only failure does not report unchecked', async () => {
    const dir = await fixture({ files: {
      [lifePage]: t => t.replace('design/brief/gate.md#gate', 'design/brief/gate.md#missing'),
    } });
    const account = command(dir, ['account']);
    const life = account.parts.find(p => p.ref === 'gate').lifecycles.find(l => l.ref === 'gate/lifecycles/door');
    assert.doesNotMatch(JSON.stringify(life.facts), /unchecked/);
    assert.ok(command(dir, ['missing']).items.some(i => i.item === 'passage:design/brief/gate.md#missing'));
  });
});

describe('evidence.md §names Names and paths', () => {
  test('evidence.md §question-names: lifecycle evidence mirrors its things and has no bounds digest', async () => {
    const dir = await passing();
    const names = (await allEvidence(dir)).map(e => e.name);
    assert.deepEqual(sorted(names), sorted([
      `${C}/base`, `${C}/fault-reopen`, `${C}/witness-open`,
      `${J}/open-once/lifecycle-path`, `${J}/open-twice/lifecycle-path-refused-at-2`,
    ]));
    for (const name of names) assert.ok(await read(dir, `models/${name}.json`));
  });
  test('evidence.md §stems: a surprise name and file use the first twelve digits of its basis digest', async () => {
    const { dir, name, surprise: s } = await surpriseProject();
    assert.equal(name, `${s.question}.surprise-${basisDigest(s.basis).slice(0, 12)}`);
    assert.equal(s.name, name);
    assert.ok(await read(dir, `models/${name}.json`));
  });
  test('evidence.md §writers: code evidence has no receipt lines and creates its own folders', async () => {
    const dir = await fixture();
    assert.equal(await read(dir, `models/${J}/open-once/lifecycle-path.json`), null);
    run(dir);
    assert.ok(await read(dir, `models/${J}/open-once/lifecycle-path.json`));
    assert.equal(await read(dir, `models/${J}/open-once/receipt`), null);
    const receipt = await read(dir, `models/${C}/receipt`);
    assert.ok(receipt.trim().split('\n').every(line => !JSON.parse(line).file.endsWith('.json')));
  });
  for (const engine of ['tlc', 'alloy']) {
    test(`evidence.md §bounds to §question-names: ${engine} bounds determine all native question paths`, external, async () => {
      const dir = await nativeFixture(engine);
      run(dir);
      const model = modelFor(engine);
      const bounds = modelBounds(await read(dir, `models/${model}/model.md`));
      const d = boundsDigest(bounds);
      const expected = [
        `parts/gate/claims/safe/base.${d}`, `parts/gate/claims/safe/witness-open.${d}`, `parts/gate/claims/safe/fault-reopen.${d}`,
        `parts/gate/journeys/open-once/path.${d}`, `parts/gate/journeys/open-twice/path-to-1.${d}`,
        `parts/gate/journeys/open-twice/refusal-at-2.${d}`, `actions/gate/open.${d}`, `actions/gate/reset.${d}`, `phases.${d}`,
        ...(engine === 'alloy' ? [`facts.${d}`] : []),
      ];
      for (const suffix of expected) {
        const e = await evidence(dir, `${model}/${suffix}`);
        assert.deepEqual(e.bounds, bounds);
        assert.equal(e.name, `${model}/${suffix}`);
      }
    });
  }
  test('evidence.md §bounds: TLC bounds whitespace normalizes without altering quoted whitespace', external, async () => {
    const dir = await nativeFixture('tlc', { files: {
      // evidence.md §bounds refers to design.md §passages's Unicode White_Space,
      // including U+0085; quoted whitespace stays byte-for-byte unchanged.
      'models/core/model.md': t => t.replace('| constant Count | 2 |', '| constant Count |  2   |').replace('between resets |', 'between resets |\n| constant Labels | {\u0085\"two  spaces\"\u0085,\"comma,inside\" } | labels preserve quoted text |'),
      'models/core/Gate.tla': t => t.replace('CONSTANT Count', 'CONSTANT Count, Labels'),
    } });
    run(dir);
    const bounds = modelBounds(await read(dir, 'models/core/model.md'));
    const e = await evidence(dir, `core/parts/gate/claims/safe/base.${boundsDigest(bounds)}`);
    assert.deepEqual(e.bounds, bounds);
  });
});

describe('evidence.md §runs Runs scratch', () => {
  test('evidence.md §runs, §in-progress: completed runs store their basis and inputs and remove the running marker', async () => {
    const dir = await passing();
    const e = await evidence(dir, `${C}/witness-open`);
    const b = await fileJSON(dir, `runs/${e.name}/basis.json`);
    keys(b, ['name', 'basis', 'finished']);
    assert.equal(b.name, e.name);
    assert.deepEqual(b.basis, e.basis);
    // evidence.md §runs fixes UTC, but does not specify the scratch timestamp's JSON form.
    for (const input of e.basis.files) {
      const text = await read(dir, `runs/${e.name}/inputs/${input.path ?? input.generated}`);
      assert.notEqual(text, null);
      assert.equal(sha256(text), input.sha256);
    }
    assert.ok((await tree(dir)).some(p => p.startsWith(`runs/${e.name}/output/`)));
    assert.equal(await read(dir, `runs/${e.name}/running.json`), null);
  });
  test('evidence.md §runs: deleting all runs preserves the account of successful evidence', async () => {
    const dir = await passing();
    const before = command(dir, ['account']);
    const clone = await copyWithout(dir, ['runs']);
    assert.deepEqual(command(clone, ['account']), before);
    assert.deepEqual(run(clone).ran, []);
  });
});

describe('engines.md §composition Engines', () => {
  test('engines.md §composition, §lifecycle-engine: lifecycle composition writes just its named generated files deterministically', async () => {
    const dir = await passing();
    const first = await evidence(dir, `${C}/base`);
    const generated = first.basis.files.filter(f => f.generated);
    assert.deepEqual(generated.map(f => f.generated), ['lifecycles.json', 'question.json']);
    const clone = await copyWithout(dir, ['runs', 'work', `models/${C}/base.json`]);
    run(clone);
    const second = await evidence(clone, `${C}/base`);
    assert.deepEqual(second.basis, first.basis);
    for (const f of generated) {
      const a = await read(dir, `runs/${first.name}/inputs/${f.generated}`);
      const b = await read(clone, `runs/${first.name}/inputs/${f.generated}`);
      assert.equal(a, b);
      assert.doesNotThrow(() => JSON.parse(a));
    }
  });
  test('engines.md §lifecycle-engine: an overlay changes only its listed cells and leaves the base encoding untouched', async () => {
    const dir = await fixture();
    const before = await tracked(dir);
    run(dir);
    assert.deepEqual((await evidence(dir, `${C}/base`)).found, { outcome: 'no violation' });
    assert.deepEqual((await evidence(dir, `${C}/fault-reopen`)).found, { outcome: 'violation', property: 'forbidden form' });
    for (const [p, value] of Object.entries(before)) assert.equal(await read(dir, p), value);
  });
  test('engines.md §lifecycle-engine: a transition witness keeps a shortest breadth-first trace', async () => {
    const dir = await passing({ files: {
      [`models/${C}/witness-open.md`]: '| Field | Value |\n| --- | --- |\n| Meaning | The ticket is reset after opening. |\n\n| Lifecycle | From | Action | To |\n| --- | --- | --- | --- |\n| door | opened | reset | closed |\n',
    } });
    const e = await evidence(dir, `${C}/witness-open`);
    assert.equal(e.found.outcome, 'reached');
    assert.equal(e.trace.states.length, 3);
    assert.deepEqual(e.trace.states.slice(1).map(s => s.rows), [
      [{ action: 'gate/open', case: '-' }], [{ action: 'gate/reset', case: '-' }],
    ]);
  });
  test('engines.md §lifecycle-engine: guards remain unevaluated in the phase abstraction', async () => {
    const dir = await passing({ files: { [`${P}/actions.md`]: t => t.replace('| none | none | stated |', '| none | The ticket has permission. | stated |') } });
    assert.deepEqual((await evidence(dir, `${C}/witness-open`)).found, { outcome: 'reached' });
  });
  test('engines.md §lifecycle-engine: an empty fault cell admits every phase', async () => {
    const dir = await passing({ files: {
      [`models/${C}/fault-reopen.md`]: t => t.replace('| door | opened | open | closed |', '| door | opened | open |  |'),
    } });
    const e = await evidence(dir, `${C}/fault-reopen`);
    assert.deepEqual(e.found, { outcome: 'violation', property: 'forbidden form' });
    assert.equal(e.matches, true);
  });
  for (const engine of ['tlc', 'alloy']) {
    test(`engines.md §composition.${engine === 'tlc' ? '1' : '2'}: ${engine} composes the native slots unchanged and answers each question kind`, external, async () => {
      const dir = await nativeFixture(engine);
      run(dir);
      const model = modelFor(engine);
      const list = await allEvidence(dir, model);
      assert.ok(list.length >= 9);
      for (const e of list) {
        assert.equal(e.matches, true, e.name);
        const native = await read(dir, `runs/${e.name}/inputs/FormaExam.${engine === 'tlc' ? 'tla' : 'als'}`);
        assert.ok(native);
        if (e.kind === 'base') {
          const slot = await read(dir, `models/${model}/parts/gate/claims/safe/encoding.${engine === 'tlc' ? 'tla' : 'als'}`);
          assert.ok(native.includes(slot.trimEnd()));
        }
        if (engine === 'alloy') assert.ok(native.includes('FormaSteps'));
        if (e.kind === 'fault') assert.equal(e.found.property, engine === 'tlc' ? 'Invariant' : 'Claim');
      }
    });
  }
  test('engines.md §tlc: TLC ignores a model-defined Next in favor of action rows', external, async () => {
    const dir = await nativeFixture('tlc', { files: { 'models/core/Gate.tla': t => t.replace('====', 'Next == FALSE\n====') } });
    run(dir);
    const witness = (await allEvidence(dir, 'core')).find(e => e.kind === 'witness');
    assert.equal(witness.found.outcome, 'reached');
  });
  test('engines.md §tlc: a TLC type violation answers before a property violation and is not caught', external, async () => {
    const dir = await nativeFixture('tlc', { files: {
      'models/core/parts/gate/claims/safe/fault-reopen.md': t => t.replace("n' = n + 1", "n' = Count + 1"),
    } });
    run(dir);
    const e = (await allEvidence(dir, 'core')).find(e => e.kind === 'fault' && !e.question);
    assert.deepEqual(e.found, { outcome: 'violation', property: 'TypeOK' });
    assert.equal(e.matches, false);
  });
  test('engines.md §replay: a TLC witness replays phases within its run and keeps replay files only in scratch', external, async () => {
    const dir = await nativeFixture('tlc');
    run(dir);
    const e = (await allEvidence(dir, 'core')).find(e => e.kind === 'witness');
    assert.ok(e.trace.states.every(s => 'phases' in s));
    assert.ok((await tree(dir)).some(p => p.startsWith(`runs/${e.name}/replay/`)));
    assert.equal(e.basis.files.some(f => (f.generated ?? '').includes('replay')), false);
  });
});

describe('evidence.md §running Running', () => {
  test('evidence.md §toolchain: lifecycle bases name exact Node, XState and Forma versions', async () => {
    const dir = await passing();
    const b = (await evidence(dir, `${C}/base`)).basis;
    assert.equal(b.engine.name, 'lifecycle');
    assert.equal(b.engine.version, b.forma.version);
    assert.equal(b.runtime.name, 'node');
    // Node accepts a v prefix in its own reported version; the contract does not fix that prefix.
    assert.equal(b.runtime.version.replace(/^v/, ''), process.versions.node);
    const manifest = JSON.parse(await read(app, 'package.json'));
    assert.equal(b.library.name, 'xstate');
    assert.equal(typeof b.library.version, 'string');
    assert.ok(b.library.version.length);
    if (/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.dependencies.xstate)) {
      assert.equal(b.library.version, manifest.dependencies.xstate);
    }
    assert.equal(b.forma.version, manifest.version);
  });
  test('evidence.md §limits: zero lifecycle time skips without spending or evidence', async () => {
    const dir = await fixture({ seconds: 0 });
    const r = run(dir);
    assert.deepEqual(r.ran, []);
    assert.ok(r.skipped.length > 0);
    assert.ok(r.skipped.every(s => s.reason === 'no limit for lifecycle'));
    assert.equal(r.runs.spent, 0);
    assert.deepEqual(await allEvidence(dir), []);
  });
  for (const engine of ['tlc', 'alloy']) {
    for (const limit of ['seconds', 'megabytes']) {
      test(`evidence.md §limits: ${engine} with zero ${limit} starts no native runs`, external, async () => {
        const options = limit === 'megabytes' ? { megabytes: 0 } : { [`${engine}Seconds`]: 0 };
        const dir = await nativeFixture(engine, options);
        const r = run(dir);
        assert.ok(r.ran.every(row => !row.name.startsWith(`${modelFor(engine)}/`)));
        assert.ok(r.skipped.some(row => row.name.startsWith(`${modelFor(engine)}/`) && row.reason === `no limit for ${engine}`));
      });
    }
  }
  test('evidence.md §outcomes: a lifecycle witness with an unreachable target is answered not reached', async () => {
    const dir = await passing({ files: {
      [`models/${C}/witness-open.md`]: '| Field | Value |\n| --- | --- |\n| Meaning | Opening closes an already open ticket. |\n\n| Lifecycle | From | Action | To |\n| --- | --- | --- | --- |\n| door | opened | open | closed |\n',
    } });
    const e = await evidence(dir, `${C}/witness-open`);
    assert.deepEqual(e.found, { outcome: 'not reached' });
    assert.equal(e.matches, false);
  });
  test('evidence.md §result-says to §search: a shown lifecycle surprise says phase level and bounded exhaustive', async () => {
    const { dir, name, surprise } = await surpriseProject();
    const response = await submitExplanation(dir, name, { 'explain.md': explanation(surprise) });
    assert.equal(response.status, 0, response.stdout);
    const shown = command(dir, ['show', 'rule', name]);
    assert.match(shown.shown, /phase level/i);
    assert.match(shown.shown, /bounded exhaustive/i);
    assert.match(shown.shown, /violation/i);
  });
  test('evidence.md §search: kind of search is derived and never added to evidence keys', async () => {
    const dir = await passing();
    const e = await evidence(dir, `${C}/base`);
    assert.equal(Object.hasOwn(e, 'search'), false);
    assert.equal(Object.hasOwn(e, 'kindOfSearch'), false);
    assert.equal(Object.hasOwn(e.basis, 'search'), false);
  });

});

describe('evidence.md §evidence-file Evidence records', () => {
  test('evidence.md §keys: ordinary evidence has precisely the ordered keys, fixed values and timestamp form', async () => {
    const dir = await passing();
    const e = checkEvidenceBytes(await read(dir, `models/${C}/base.json`));
    orderedKeys(e, ['name', 'kind', 'expected', 'bounds', 'limits', 'basis', 'found', 'matches', 'measures', 'flags', 'established', 'previous', 'digest']);
    assert.equal(e.bounds, 'phase level');
    assert.deepEqual(e.limits, { seconds: 10 });
    assert.deepEqual(e.expected, { outcome: 'no violation' });
    assert.deepEqual(e.found, { outcome: 'no violation' });
    assert.equal(e.matches, true);
    assert.equal(e.previous, null);
    assert.deepEqual(e.flags, []);
  });
  test('evidence.md §basis: bases use ordered files and entries and hash the exact saved input bytes', async () => {
    const dir = await passing();
    const e = await evidence(dir, `${C}/witness-open`);
    // evidence.md §basis fixes these keys and list order, not nested object key order.
    keys(e.basis, ['files', 'entries', 'engine', 'runtime', 'library', 'forma']);
    const projectFiles = e.basis.files.filter(f => f.path);
    const generated = e.basis.files.filter(f => f.generated);
    assert.deepEqual(e.basis.files, [...projectFiles, ...generated]);
    assert.deepEqual(projectFiles.map(f => f.path), sorted(projectFiles.map(f => f.path)));
    assert.deepEqual(generated.map(f => f.generated), sorted(generated.map(f => f.generated)));
    for (const f of projectFiles) {
      keys(f, ['path', 'sha256']);
      assert.equal(f.sha256, sha256(await read(dir, f.path)));
    }
    for (const f of generated) {
      keys(f, ['generated', 'sha256']);
      assert.equal(f.sha256, sha256(await read(dir, `runs/${e.name}/inputs/${f.generated}`)));
    }
    const expectedPins = entryPins(await snapshot(dir));
    assert.deepEqual(e.basis.entries.map(p => p.entry), sorted(e.basis.entries.map(p => p.entry)));
    assert.equal(new Set(e.basis.entries.map(p => p.entry)).size, e.basis.entries.length);
    for (const p of e.basis.entries) {
      keys(p, ['entry', 'pin']);
      assert.equal(p.pin, expectedPins[p.entry]);
    }
    for (const k of ['engine', 'runtime', 'library']) keys(e.basis[k], ['name', 'version']);
    keys(e.basis.forma, ['version', 'source']);
    assert.match(e.basis.forma.source, /^[0-9a-f]{12}$/);
  });
  test('evidence.md §measures: lifecycle measures have only duration and combinations', async () => {
    const dir = await passing();
    const e = await evidence(dir, `${C}/base`);
    // evidence.md §measures fixes the exact set, once each, and leaves object key order open.
    for (const record of await allEvidence(dir)) {
      keys(record.measures, ['duration', 'combinations']);
      // evidence.md §own-check's canonical form also excludes duplicate measure members.
      checkEvidenceBytes(await read(dir, `models/${record.name}.json`));
    }
    assert.ok(typeof e.measures.duration === 'number' && e.measures.duration >= 0);
    assert.equal(e.measures.combinations, 2);
  });
  for (const engine of ['tlc', 'alloy']) {
    test(`evidence.md §measures: ${engine} measures use the engine-specific fields`, external, async () => {
      const dir = await nativeFixture(engine);
      run(dir);
      const records = await allEvidence(dir, modelFor(engine));
      const e = records.find(x => x.kind === 'base');
      for (const record of records) {
        keys(record.measures, engine === 'tlc' ? ['duration', 'states', 'depth'] : ['duration', 'scope', 'steps', 'bitwidth']);
        checkEvidenceBytes(await read(dir, `models/${record.name}.json`));
      }
      if (engine === 'alloy') {
        assert.equal(e.measures.scope, 3);
        assert.deepEqual(e.measures.steps, [1, 4]);
        assert.equal(e.measures.bitwidth, 3);
      }
    });
  }
  test('evidence.md §measures: Alloy defaults retain each unreported measure as null', external, async () => {
    const dir = await nativeFixture('alloy', { files: {
      'models/relational/model.md': t => t.replace('| scope | 3 |', '| scope | exactly 1 Ticket |')
        .replace(/^\| steps \|.*\n/m, '').replace(/^\| int \|.*\n/m, ''),
    } });
    run(dir);
    const facts = (await allEvidence(dir, 'relational')).find(e => e.kind === 'facts');
    keys(facts.measures, ['duration', 'scope', 'steps', 'bitwidth']);
    assert.equal(facts.measures.scope, null);
    assert.equal(facts.measures.steps, null);
    assert.equal(facts.measures.bitwidth, null);
  });
  test('evidence.md §flags: lifecycle base flags unreachable phases and never adds time or size flags', async () => {
    const dir = await passing({ files: { [lifePage]: t => `${t}| unused | None. | None. |\n` } });
    const e = await evidence(dir, `${C}/base`);
    assert.deepEqual(e.flags, ['unreachable-phase door/unused']);
    assert.equal(e.matches, true);
    assert.deepEqual((await evidence(dir, `${C}/witness-open`)).flags, []);
  });
  test('evidence.md §flags: an untaken action is reported by its key', async () => {
    const dir = await passing({ files: {
      [`${P}/actions.md`]: t => `${t}| wait | robot | Wait for the ticket. | none | none | stated | design/brief/gate.md#gate |\n`,
      [lifePage]: t => t.replace('| Phase | open | reset |', '| Phase | open | reset | wait |')
        .replace('| --- | --- | --- |', '| --- | --- | --- | --- |')
        .replace('| closed | opened | closed |', '| closed | opened | closed | None. |')
        .replace('| opened | None. | closed |', '| opened | None. | closed | None. |'),
    } });
    assert.ok((await evidence(dir, `${C}/base`)).flags.includes('untaken-action wait'));
  });
  test('evidence.md §flags: a reachable empty cell is an open-pair flag on a passing base', async () => {
    const dir = await passing({ unconfirmed: ['gate/journeys/open-twice'], files: {
      [lifePage]: t => t.replace('| closed | opened | closed |', '| closed | opened |  |'),
    } });
    assert.ok((await evidence(dir, `${C}/base`)).flags.includes('open-pair door/closed/reset'));
  });
  test('evidence.md §flags: TLC suspicion flags follow the measured thresholds', external, async () => {
    const dir = await nativeFixture('tlc');
    run(dir);
    const e = (await allEvidence(dir, 'core')).find(x => x.kind === 'base');
    assert.equal(e.flags.includes('instant-pass'), e.measures.duration < 1000);
    assert.equal(e.flags.includes('tiny-state-space'), e.measures.states < 100);
    for (const other of (await allEvidence(dir, 'core')).filter(x => x.kind !== 'base')) assert.deepEqual(other.flags, []);
  });
  test('engines.md §trace: only the successful witness keeps a trace in ordinary lifecycle evidence', async () => {
    const dir = await passing();
    for (const e of await allEvidence(dir)) {
      assert.equal(Object.hasOwn(e, 'trace'), e.kind === 'witness', e.name);
      assert.equal(Object.hasOwn(e, 'rendered'), e.kind === 'witness', e.name);
    }
    const e = await evidence(dir, `${C}/witness-open`);
    assert.equal(e.trace.states.length, 2);
    assert.equal(Object.hasOwn(e.trace.states[0], 'rows'), false);
    assert.ok(e.trace.states.every(s => Object.hasOwn(s, 'phases')));
    assert.deepEqual(e.trace.states[1].rows, [{ action: 'gate/open', case: '-' }]);
    assert.equal(Object.hasOwn(e.trace, 'replay'), false);
    const content = meanings(await snapshot(dir))['gate/actions/open'];
    assert.deepEqual(e.rendered, [{ entry: 'gate/actions/open', pin: sha256(content), content }]);
  });
  test('engines.md §trace: the surprise keeps a trace while the mismatching base evidence does not', async () => {
    const { dir, name, surprise } = await surpriseProject();
    const base = await evidence(dir, surprise.question);
    assert.equal(Object.hasOwn(base, 'trace'), false);
    assert.equal(Object.hasOwn(base, 'rendered'), false);
    assert.ok(surprise.trace.states.length >= 2);
    assert.ok(surprise.rendered.some(r => r.entry === 'gate/actions/open'));
    assert.equal(surprise.name, name);
  });
  test('evidence.md §own-check: canonical UTF-8 JSON, key order and the empty-digest hash hold for every written record', async () => {
    const { dir } = await surpriseProject();
    for (const path of (await tree(dir)).filter(p => p.startsWith('models/') && p.endsWith('.json'))) {
      checkEvidenceBytes(await read(dir, path));
    }
  });
  const damages = [
    ['unparseable JSON', () => '{'],
    ['wrong digest', raw => raw.replace(/"digest": "[0-9a-f]{64}"/, `"digest": "${'0'.repeat(64)}"`)],
    ['noncanonical whitespace', raw => JSON.stringify(JSON.parse(raw)) + '\n'],
    ['wrong name with a valid digest', raw => sealed({ ...JSON.parse(raw), name: `${C}/other` })],
    ['wrong kind with a valid digest', raw => sealed({ ...JSON.parse(raw), kind: 'fault' })],
    ['mixed found and digest from different runs', raw => jsonText({ ...JSON.parse(raw), found: { outcome: 'reached' } })],
  ];
  for (const [label, damage] of damages) {
    test(`evidence.md §own-check: ${label} counts for nothing and is replaced by a run`, async () => {
      const dir = await passing();
      const path = `models/${C}/base.json`;
      await writeFiles(dir, { [path]: damage(await read(dir, path)) });
      const missing = command(dir, ['missing']);
      assert.ok(missing.items.some(i => i.item === `change:${path}`));
      const r = run(dir);
      assert.ok(r.ran.some(row => row.name === `${C}/base`));
      assert.equal(checkEvidenceBytes(await read(dir, path)).found.outcome, 'no violation');
    });
  }
});

describe('evidence.md §written-moved Writing and rewriting', () => {
  test('evidence.md §written: unchanged reruns preserve every tracked byte and first measures', async () => {
    const dir = await passing();
    const before = await tracked(dir);
    const r = run(dir);
    assert.deepEqual(r.ran, []);
    assert.deepEqual(await tracked(dir), before);
  });
  test('evidence.md §written: a changed basis rewrites evidence even when found stays the same', async () => {
    const dir = await passing();
    const before = await evidence(dir, `${C}/base`);
    await reviseFixture(dir, { [encoding]: t => `${t}\n` });
    const r = run(dir);
    assert.ok(r.ran.some(row => row.name === `${C}/base`));
    const after = await evidence(dir, `${C}/base`);
    assert.notEqual(basisDigest(after.basis), basisDigest(before.basis));
    assert.deepEqual(after.found, before.found);
    assert.deepEqual(after.previous, before.previous);
  });
  test('evidence.md §written: an outcome change preserves the old found with until', async () => {
    const dir = await passing();
    const before = await evidence(dir, `${C}/base`);
    await reviseFixture(dir, { [encoding]: '| Lifecycle | Phase |\n| --- | --- |\n| door | opened |\n' });
    run(dir);
    const after = await evidence(dir, `${C}/base`);
    assert.deepEqual(after.found, { outcome: 'violation', property: 'forbidden form' });
    assert.deepEqual(after.previous, { ...before.found, until: after.established });
  });
  test('evidence.md §written: unanswered at smaller limits is rerun and records the previous outcome', async () => {
    const dir = await passing();
    await changeEvidence(dir, `${C}/base`, e => {
      e.found = { outcome: 'unanswered', reason: 'time limit' };
      delete e.matches;
      e.limits.seconds = 1;
    });
    const r = run(dir);
    assert.ok(r.ran.some(row => row.name === `${C}/base`));
    const after = await evidence(dir, `${C}/base`);
    assert.deepEqual(after.previous, { outcome: 'unanswered', reason: 'time limit', until: after.established });
    assert.deepEqual(after.limits, { seconds: 10 });
  });
  test('evidence.md §written: unanswered at the current limits opens no surprise and does not rerun', async () => {
    const dir = await passing();
    await changeEvidence(dir, `${C}/base`, e => { e.found = { outcome: 'unanswered', reason: 'engine stopped' }; delete e.matches; });
    const before = await read(dir, `models/${C}/base.json`);
    const r = run(dir);
    assert.deepEqual(r.ran, []);
    assert.deepEqual(r.opened, []);
    assert.equal(await read(dir, `models/${C}/base.json`), before);
  });
  for (const component of ['engine', 'runtime', 'library', 'forma', 'source']) {
    test(`evidence.md §versions: a ${component}-only change reruns for free with no allowance left`, async () => {
      const dir = await passing();
      await changeEvidence(dir, `${C}/base`, e => {
        if (component === 'source') e.basis.forma.source = e.basis.forma.source === '0'.repeat(12) ? '1'.repeat(12) : '0'.repeat(12);
        else if (component === 'forma' || component === 'engine') {
          // evidence.md §toolchain ties the lifecycle engine version to Forma's package version.
          e.basis.forma.version = '0.0.0-prerelease';
          e.basis.engine.version = '0.0.0-prerelease';
        } else e.basis[component].version = component === 'library' ? '5.0.0' : 'v24.0.0-old';
      });
      await writeFiles(dir, { 'work/spent.json': '{"answers":0,"runs":100}\n' });
      const r = run(dir);
      assert.ok(r.ran.some(row => row.name === `${C}/base`));
      assert.deepEqual(r.runs, { spent: 100, left: 0 });
      assert.equal((await evidence(dir, `${C}/base`)).matches, true);
    });
  }
  test('evidence.md §versions: a later semantic package version is skipped and never rewritten', async () => {
    const dir = await passing();
    await changeEvidence(dir, `${C}/base`, e => { e.basis.forma.version = '999.0.0'; e.basis.engine.version = '999.0.0'; });
    const before = await tracked(dir);
    const r = run(dir);
    assert.ok(r.skipped.some(s => s.name === `${C}/base` && s.reason === 'written by Forma 999.0.0'));
    assert.ok(r.ran.every(row => row.name !== `${C}/base`));
    assert.deepEqual(await tracked(dir), before);
  });
  test('evidence.md §removed: a no-longer-asked question retains all evidence', async () => {
    const dir = await passing();
    const before = await read(dir, `models/${C}/base.json`);
    await reviseFixture(dir, { [encoding]: '| Field | Value |\n| --- | --- |\n| Cannot express | Requires hidden data. |\n' });
    run(dir);
    assert.equal(await read(dir, `models/${C}/base.json`), before);
  });
});

describe('evidence.md §currency Currency', () => {
  test('evidence.md §currency: changing a linked action pin stales lifecycle evidence and reruns it', async () => {
    const dir = await passing();
    const before = await evidence(dir, `${C}/base`);
    await reviseFixture(dir, { [`${P}/actions.md`]: t => t.replace('Reset the ticket.', 'Return the ticket to its closed phase.') });
    run(dir);
    const after = await evidence(dir, `${C}/base`);
    assert.notEqual(after.basis.entries.find(p => p.entry === 'gate/actions/reset').pin,
      before.basis.entries.find(p => p.entry === 'gate/actions/reset').pin);
    assert.notEqual(basisDigest(after.basis), basisDigest(before.basis));
  });
  test('evidence.md §currency: dropping and restoring the same journey confirmation costs no run', async () => {
    const dir = await passing();
    const files = await snapshot(dir);
    const path = Object.keys(files).find(p => p.startsWith(`${P}/journeys/open-once/decisions/`));
    const clone = await copyWithout(dir, [path]);
    const stored = await read(clone, `models/${J}/open-once/lifecycle-path.json`);
    run(clone);
    assert.equal(await read(clone, `models/${J}/open-once/lifecycle-path.json`), stored);
    await writeFiles(clone, { [path]: files[path] });
    assert.deepEqual(run(clone).ran, []);
    assert.equal(await read(clone, `models/${J}/open-once/lifecycle-path.json`), stored);
  });
  test('evidence.md §currency: a mismatched generated hash is not current', async () => {
    const dir = await passing();
    await changeEvidence(dir, `${C}/base`, e => { e.basis.files.find(f => f.generated).sha256 = '0'.repeat(64); });
    assert.ok(run(dir).ran.some(row => row.name === `${C}/base`));
    assert.notEqual((await evidence(dir, `${C}/base`)).basis.files.find(f => f.generated).sha256, '0'.repeat(64));
  });
  for (const file of ['model.md', 'Gate.tla']) {
    test(`evidence.md §currency: every TLC question stales when ${file} bytes change`, external, async () => {
      const dir = await nativeFixture('tlc');
      run(dir);
      const names = (await allEvidence(dir, 'core')).map(e => e.name);
      await reviseFixture(dir, { [`models/core/${file}`]: t => `${t}\n` });
      const r = run(dir);
      for (const name of names) assert.ok(r.ran.some(row => row.name === name), name);
    });
  }
});

async function nativeSurprise(engine, options = {}) {
  const model = modelFor(engine);
  const ext = engine === 'tlc' ? 'tla' : 'als';
  const dir = await nativeFixture(engine, { ...options, files: {
    [`models/${model}/parts/gate/claims/safe/encoding.${ext}`]: engine === 'tlc' ? 'Invariant == n = 0\n' : 'assert Claim { always Ticket.count = 0 }\n',
    ...options.files,
  } });
  const r = run(dir);
  const name = r.opened.find(n => n.startsWith(`${model}/parts/gate/claims/safe/base.`));
  assert.ok(name, 'reachable bad state must open the native base surprise');
  return { dir, name, surprise: await evidence(dir, name) };
}

describe('evidence.md §surprise-file Surprises', () => {
  test('evidence.md §surprise-file: a surprise retains the run, inserts question and held, omits previous and is immutable', async () => {
    const { dir, name, surprise: s } = await surpriseProject();
    // evidence.md §keys, §surprise-file fix this order and the surprise-only additions.
    orderedKeys(s, ['name', 'question', 'kind', 'expected', 'bounds', 'limits', 'basis', 'held', 'found', 'matches', 'measures', 'flags', 'trace', 'rendered', 'established', 'digest']);
    // models.md §freeze: the freeze holds all of the claim's slots, including
    // witness and fault files that this base question did not read.
    const heldPaths = sorted([lifePage, encoding, `models/${C}/fault-reopen.md`, `models/${C}/witness-open.md`]);
    assert.deepEqual(s.held, await Promise.all(heldPaths.map(async path => ({ path, sha256: sha256(await read(dir, path)) }))));
    // engines.md §composition: a base composition reads its encoding, not another slot.
    assert.ok(s.basis.files.every(file => file.path !== `models/${C}/witness-open.md`));
    const e = await evidence(dir, s.question);
    for (const key of ['kind', 'expected', 'bounds', 'limits', 'basis', 'found', 'matches', 'measures', 'flags', 'established']) assert.deepEqual(s[key], e[key]);
    const before = await read(dir, `models/${name}.json`);
    const r = run(dir);
    assert.ok(r.ran.every(row => row.name !== s.question));
    assert.deepEqual(r.opened, []);
    assert.equal(await read(dir, `models/${name}.json`), before);
  });
  test('evidence.md §surprise-file: a lost surprise is recreated even when the evidence need not be rewritten', async () => {
    const original = await surpriseProject();
    const dir = await copyWithout(original.dir, [`models/${original.name}.json`]);
    const before = await read(dir, `models/${original.surprise.question}.json`);
    const r = run(dir);
    assert.ok(r.opened.includes(original.name));
    assert.equal(await read(dir, `models/${original.surprise.question}.json`), before);
    assert.equal((await evidence(dir, original.name)).question, original.surprise.question);
  });
  test('evidence.md §surprise-file: every unexplained open surprise owes an Explain answer', async () => {
    const { dir, name } = await surpriseProject();
    const missing = command(dir, ['missing']);
    assert.ok(missing.items.some(i => i.item === `explain:${name}` && i.supply.some(s => s.answer === 'explain')));
  });
  test('evidence.md §surprise-file: an open surprise suppresses its question even when versions are stale', async () => {
    const { dir, surprise: s } = await surpriseProject();
    await changeEvidence(dir, s.question, e => { e.basis.runtime.version = 'old-node'; });
    const r = run(dir);
    assert.ok(r.ran.every(row => row.name !== s.question));
  });
  for (const engine of ['tlc', 'alloy']) {
    test(`evidence.md §surprise-file / models.md §freeze: ${engine} held lists the model and every claim slot`, external, async () => {
      const { dir, surprise } = await nativeSurprise(engine);
      const model = modelFor(engine);
      const ext = engine === 'tlc' ? 'tla' : 'als';
      const paths = sorted([`models/${model}/model.md`, `models/${model}/Gate.${ext}`,
        `models/${model}/parts/gate/claims/safe/encoding.${ext}`,
        `models/${model}/parts/gate/claims/safe/fault-reopen.md`,
        `models/${model}/parts/gate/claims/safe/witness-open.md`]);
      assert.deepEqual(surprise.held, await Promise.all(paths.map(async path => ({ path, sha256: sha256(await read(dir, path)) }))));
    });
  }
});

// door.md §receipts, §copies: simulate a whole accepted file arriving from another copy.
// Preserve its slot pins and authors; hash the new bytes with the receipt form.
async function mergeReceiptedFile(dir, path, text, template = path) {
  const folder = path.slice(0, path.lastIndexOf('/'));
  const file = path.slice(path.lastIndexOf('/') + 1);
  const sourceFolder = template.slice(0, template.lastIndexOf('/'));
  const sourceName = template.slice(template.lastIndexOf('/') + 1);
  const source = (await read(dir, `${sourceFolder}/receipt`)).trim().split('\n').map(JSON.parse)
    .find(line => line.file === sourceName);
  assert.ok(source, 'the hand-written fixture supplies a matching receipt template');
  const lines = (await read(dir, `${folder}/receipt`)).trim().split('\n').map(JSON.parse)
    .filter(line => line.file !== file);
  lines.push({ ...source, file, sha256: sha256(text) });
  lines.sort((a, b) => Buffer.compare(Buffer.from(a.file), Buffer.from(b.file)));
  await writeFiles(dir, { [path]: text, [`${folder}/receipt`]: lines.map(line => JSON.stringify(line) + '\n').join('') });
}

describe('evidence.md §surprise-file / models.md §freeze Recorded freeze', () => {
  for (const alteration of ['changed', 'missing']) {
    test(`evidence.md §surprise-file / models.md §freeze: a ${alteration} held slot is discounted until restored`, async () => {
      const original = await surpriseProject();
      const path = `models/${C}/witness-open.md`;
      const bytes = await read(original.dir, path);
      const dir = alteration === 'missing' ? await copyWithout(original.dir, [path]) : original.dir;
      if (alteration === 'changed') await mergeReceiptedFile(dir, path, bytes.replace('opened', 'closed'));
      const before = await read(dir, `models/${original.name}.json`);
      const item = command(dir, ['missing']).items.find(item => item.item === `change:${path}`);
      assert.ok(item, 'held is authoritative even for a slot absent from the base basis');
      assert.ok(item.found != null);
      assert.ok(run(dir).ran.every(row => row.name !== `${C}/witness-open`));
      // Restoring the whole file and its matching receipt lifts this discount.
      await writeFiles(dir, { [path]: bytes, [`models/${C}/receipt`]: await read(original.dir, `models/${C}/receipt`) });
      if (alteration === 'changed') await mergeReceiptedFile(dir, path, bytes);
      assert.ok(command(dir, ['missing']).items.every(item => item.item !== `change:${path}`));
      assert.equal(await read(dir, `models/${original.name}.json`), before);
    });
  }
  test('evidence.md §surprise-file / models.md §freeze: a new receipted claim slot counts for nothing while the surprise is open', async () => {
    const { dir, name } = await surpriseProject();
    const source = `models/${C}/witness-open.md`;
    const path = `models/${C}/witness-extra.md`;
    await mergeReceiptedFile(dir, path, await read(dir, source), source);
    assert.ok(command(dir, ['missing']).items.some(item => item.item === `change:${path}`));
    assert.ok(run(dir).ran.every(row => row.name !== `${C}/witness-extra`));
    assert.ok((await evidence(dir, name)).held.every(file => file.path !== path));
  });
  for (const alteration of ['unchanged', 'changed']) {
    test(`evidence.md §surprise-file / account.md §items: an owed frozen slot waits for its rule and refuses ${alteration} bytes`, async () => {
      const { dir, name } = await surpriseProject();
      // models.md §freeze to §slot-currency: a changed claim pin owes the same slot again;
      // the claim page is not held. account.md §items makes it wait for the rule.
      await mergeReceiptedFile(dir, claimPage, (await read(dir, claimPage)).replace('Sentence |', 'Sentence | Revised:'));
      const path = `models/${C}/witness-open.md`;
      const itemName = `slot:${C}/witness-open`;
      const item = command(dir, ['missing']).items.find(item => item.item === itemName);
      assert.ok(item);
      assert.equal(item.why, 'owed-again');
      assert.ok(item.waits.includes(`rule:${name}`));
      const text = await read(dir, path);
      const folder = await answerFolder({ [path]: alteration === 'unchanged' ? text : text.replace('Meaning |', 'Meaning | Revised:') });
      const before = await tracked(dir);
      const r = forma(dir, ['answer', itemName, folder, ...explainer, '--json']);
      assertRefused(r, 'models.md §');
      assert.deepEqual(await tracked(dir), before);
    });
  }
  test('evidence.md §surprise-file / models.md §freeze: an optional new witness answer is refused while its claim is frozen', async () => {
    const { dir } = await surpriseProject();
    const path = `models/${C}/witness-extra.md`;
    const folder = await answerFolder({ [path]: await read(dir, `models/${C}/witness-open.md`) });
    const before = await tracked(dir);
    const r = forma(dir, ['answer', `slot:${C}/witness`, folder, ...explainer, '--json']);
    assertRefused(r, 'models.md §');
    assert.deepEqual(await tracked(dir), before);
  });
  for (const alteration of ['unchanged', 'changed', 'removed']) {
    test(`evidence.md §surprise-file / design.md §restate-checks: a Restate answer refuses a frozen lifecycle ${alteration}`, async () => {
      const { dir } = await surpriseProject();
      const front = await read(dir, `${P}/README.md`);
      await writeFiles(dir, { [`${P}/README.md`]: `${front}\nUnaccepted edit.\n` });
      const files = { [`${P}/README.md`]: front };
      if (alteration === 'removed') {
        files['removed.md'] = `${P}/lifecycles/door\n`;
        files[`${P}/README.md`] = front.split('\n').filter(line => !line.includes('(lifecycles/door/)')).join('\n');
      } else {
        const text = await read(dir, lifePage);
        files[lifePage] = alteration === 'unchanged' ? text : text.replace('# ', '# Revised ');
      }
      const before = await tracked(dir);
      const folder = await answerFolder(files);
      const r = forma(dir, ['answer', `change:${P}/README.md`, folder, ...explainer, '--json']);
      assertRefused(r, 'design.md §restate');
      assert.deepEqual(await tracked(dir), before);
    });
  }
  test('evidence.md §surprise-file / models.md §freeze: a new receipted engine file is discounted and a Model answer cannot adopt it', external, async () => {
    const { dir, name } = await nativeSurprise('tlc');
    const path = 'models/core/Extra.tla';
    const extra = '------------------------------ MODULE Extra ------------------------------\nValue == TRUE\n=============================================================================\n';
    await mergeReceiptedFile(dir, path, extra, 'models/core/Gate.tla');
    assert.ok(command(dir, ['missing']).items.some(item => item.item === `change:${path}`));
    assert.ok((await evidence(dir, name)).held.every(file => file.path !== path));
    const before = await tracked(dir);
    const folder = await answerFolder({
      'models/core/model.md': await read(dir, 'models/core/model.md'),
      'models/core/Gate.tla': await read(dir, 'models/core/Gate.tla'),
      [path]: extra,
    });
    const r = forma(dir, ['answer', `change:${path}`, folder, ...explainer, '--json']);
    assertRefused(r, 'models.md §');
    assert.deepEqual(await tracked(dir), before);
  });
});

describe('evidence.md §reductions Reductions', () => {
  test('evidence.md §reductions: lifecycle surprises have no reductions at phase level', async () => {
    const { dir, name } = await surpriseProject();
    assert.ok((await tree(dir)).every(p => !p.startsWith(`models/${name}.reduction-`)));
    assert.ok(command(dir, ['missing']).items.every(i => i.item !== `run:${name}/reduction`));
  });
  test('evidence.md §reductions: TLC reduces constants in row order, restarts after a kept result and caps at six', external, async () => {
    const { dir, name } = await nativeSurprise('tlc', { files: {
      'models/core/Gate.tla': t => t.replace('CONSTANT Count', 'CONSTANT Count, Extra'),
      'models/core/model.md': t => t.replace('| constant Count | 2 | one ticket and two attempted openings between resets |',
        '| constant Count | 2 | one ticket and two attempted openings between resets |\n| constant Extra | 2 | an independent reduction dimension |'),
    } });
    const expected = [[1, 2], [0, 2], [1, 1], [0, 1], [1, 0], [0, 0]];
    // engines.md §tlc checks TypeOK before Invariant at Count=0;
    // evidence.md §keys, §reductions give reduction fields and discard a different violated property.
    for (let i = 0; i < expected.length; i++) {
      const e = await evidence(dir, `${name}.reduction-${i + 1}`);
      assert.equal(e.kind, 'reduction');
      assert.equal(e.reduces, name);
      assert.equal(e.bounds['constant Count'], String(expected[i][0]));
      assert.equal(e.bounds['constant Extra'], String(expected[i][1]));
      assert.equal(e.found.property, i % 2 === 0 ? 'Invariant' : 'TypeOK');
      assert.equal(Object.hasOwn(e, 'expected'), false);
      assert.equal(Object.hasOwn(e, 'matches'), false);
      assert.equal(Object.hasOwn(e, 'previous'), false);
    }
    assert.equal(await read(dir, `models/${name}.reduction-7.json`), null);
    const before = await tracked(dir);
    run(dir);
    assert.deepEqual(await tracked(dir), before);
  });
  test('evidence.md §reductions: TLC stops after a rejected minimum bound', external, async () => {
    const { dir, name } = await nativeSurprise('tlc');
    const a = await evidence(dir, `${name}.reduction-1`);
    const b = await evidence(dir, `${name}.reduction-2`);
    assert.equal(a.bounds['constant Count'], '1');
    assert.equal(a.found.property, 'Invariant');
    assert.equal(b.bounds['constant Count'], '0');
    assert.equal(b.found.property, 'TypeOK');
    assert.equal(await read(dir, `models/${name}.reduction-3.json`), null);
  });
  test('evidence.md §reductions: Alloy decreases only the default scope and stops at one', external, async () => {
    const { dir, name, surprise } = await nativeSurprise('alloy', { files: {
      // evidence.md §reductions preserves signature bounds. Explicitly retaining two
      // Phase atoms keeps this fixture satisfiable even at default scope one.
      'models/relational/model.md': text => text.replace('| scope | 3 |', '| scope | 3 but exactly 1 Ticket, exactly 2 Phase |'),
    } });
    for (const [n, scope] of [[1, '2 but exactly 1 Ticket, exactly 2 Phase'], [2, '1 but exactly 1 Ticket, exactly 2 Phase']]) {
      const e = await evidence(dir, `${name}.reduction-${n}`);
      assert.deepEqual(e.bounds, { ...surprise.bounds, scope });
      assert.deepEqual(e.found, { outcome: 'violation', property: 'Claim' });
    }
    assert.equal(await read(dir, `models/${name}.reduction-3.json`), null);
  });
  test('evidence.md §never-counts, §reductions: reductions have no expected outcome, standing or surprises of their own', external, async () => {
    const { dir, name } = await nativeSurprise('tlc');
    const e = await evidence(dir, `${name}.reduction-1`);
    // evidence.md §keys, engines.md §trace: reduction-specific keys and a violation's trace.
    orderedKeys(e, ['name', 'kind', 'reduces', 'bounds', 'limits', 'basis', 'found', 'measures', 'trace', 'rendered', 'established', 'digest']);
    assert.ok((await tree(dir)).every(p => !p.includes('.reduction-1.surprise-')));
    const box = command(dir, ['box']);
    // account.md §standing, §box: this failed, unaccepted claim does not enter the box.
    assert.ok(box.claims.every(c => c.ref !== 'gate/claims/safe'));
  });
});

describe('evidence.md §weaker Weaker forms', () => {
  for (const engine of ['tlc', 'alloy']) {
    test(`evidence.md §never-counts, §weaker: ${engine} weaker forms retain answer order, run once and never open surprises`, external, async () => {
      const { dir, name, surprise } = await nativeSurprise(engine);
      const ext = engine === 'tlc' ? 'tla' : 'als';
      const failing = engine === 'tlc' ? 'Invariant == n = 0\n' : 'assert Claim { always Ticket.count = 0 }\n';
      const passingText = engine === 'tlc' ? 'Invariant == TRUE\n' : 'assert Claim { always (Ticket.count = Ticket.count) }\n';
      const beforeSpent = (await fileJSON(dir, 'work/spent.json')).runs;
      const explanationText = explanation(surprise, { Weaker: 'strong, middle, weak' });
      const response = await submitExplanation(dir, name, {
        'explain.md': explanationText,
        [`weaker/strong.${ext}`]: failing,
        [`weaker/middle.${ext}`]: failing,
        [`weaker/weak.${ext}`]: passingText,
      });
      assert.equal(response.status, 0, response.stdout);
      run(dir); // evidence.md §forma-run completes any work left after acceptance.
      for (const [key, outcome] of [['strong', 'violation'], ['middle', 'violation'], ['weak', 'no violation']]) {
        const e = await evidence(dir, `${name}.weaker-${key}`);
        assert.equal(e.weakens, name);
        assert.equal(e.kind, 'weaker');
        // evidence.md §keys, engines.md §trace fix the weaker schema and keep violation traces.
        orderedKeys(e, ['name', 'kind', 'weakens', 'bounds', 'limits', 'basis', 'found', 'measures',
          ...(outcome === 'violation' ? ['trace', 'rendered'] : []), 'established', 'digest']);
        assert.deepEqual(e.bounds, surprise.bounds);
        assert.equal(e.found.outcome, outcome);
        assert.equal(Object.hasOwn(e, 'expected'), false);
        assert.equal(Object.hasOwn(e, 'matches'), false);
        assert.equal(Object.hasOwn(e, 'trace'), outcome === 'violation');
      }
      const before = await tracked(dir);
      assert.deepEqual(run(dir).ran, []);
      assert.deepEqual(await tracked(dir), before);
      assert.ok((await tree(dir)).every(p => !/\.weaker-[^.]+\.surprise-/.test(p)));
      assert.equal(await read(dir, `models/${name}.explained.md`), explanationText);
      assert.equal((await fileJSON(dir, 'work/spent.json')).runs - beforeSpent, 3);
    });
  }
});

describe('evidence.md §sent-back Sent back first', () => {
  test('evidence.md §sent-back: a guarded lifecycle transition waits for an accepted explanation before its decision', async () => {
    const { dir, name } = await surpriseProject({ files: {
      [`${P}/actions.md`]: t => t.replace('| none | none | stated |', '| none | The ticket has permission. | stated |'),
    } });
    const withheld = forma(dir, ['show', 'rule', name, '--json']);
    assert.equal(withheld.status, 1);
    assert.ok(withheld.json?.refused?.length);
    // evidence.md §sent-back / account.md §commands specify the reason's presence, but
    // leave its JSON representation and wording open. door.md §gives copies it.
    const item = command(dir, ['missing']).items.find(item => item.item === `explain:${name}`);
    assert.ok(item && Object.hasOwn(item, 'found') && item.found != null);
    const packet = await tempFolder('evidence-sent-back-');
    command(dir, ['give', `explain:${name}`, packet]);
    assert.deepEqual((await fileJSON(packet, 'item.json')).item, item);
    const accepted = await submitExplanation(dir, name, { 'explain.md': explanation(await evidence(dir, name)) });
    assert.equal(accepted.status, 0, accepted.stdout);
    assert.ok(command(dir, ['show', 'rule', name]).shown);

  });
  test('evidence.md §sent-back: an unreachable lifecycle start is sent back as refusal at step zero', async () => {
    const dir = await fixture({ files: {
      [lifePage]: t => t.replace('| closed | opened | closed |', '| closed | closed | closed |'),
      [positivePage]: t => t.replace('| Step | Actor', '| Lifecycle | Entity | Phase |\n| --- | --- | --- |\n| door | door | opened |\n\n| Step | Actor'),
    } });
    const r = run(dir);
    const name = r.opened.find(n => n.includes('open-once/lifecycle-path.surprise-'));
    assert.ok(name);
    assert.deepEqual((await evidence(dir, name)).found, { outcome: 'refused', step: 0 });
    const item = command(dir, ['missing']).items.find(item => item.item === `explain:${name}`);
    assert.ok(item && Object.hasOwn(item, 'found') && item.found != null);
    const packet = await tempFolder('evidence-unreachable-start-');
    command(dir, ['give', `explain:${name}`, packet]);
    assert.deepEqual((await fileJSON(packet, 'item.json')).item, item);
    const withheld = forma(dir, ['show', 'rule', name, '--json']);
    assert.equal(withheld.status, 1);
    assert.ok(withheld.json?.refused?.length);

  });
});

async function explainAndRule(dir, name, s) {
  const accepted = await submitExplanation(dir, name, { 'explain.md': explanation(s) });
  assert.equal(accepted.status, 0, accepted.stdout);
  const showing = command(dir, ['show', 'rule', name]);
  return command(dir, ['decide', 'rule', name, '--shown', showing.token,
    '--verdict', 'real finding', '--level', 'requirement', '--target', 'brief',
    '--words', 'The brief forbids a useful opened ticket.', '--by', 'Developer',
    '--provider', 'fixture', '--model', 'developer', '--session', 'ruler']);
}

describe('evidence.md §at-ruling Closing surprises', () => {
  test('evidence.md §at-ruling: a ruling removes its stem and explanation receipt, preserving question evidence', async () => {
    const { dir, name, surprise } = await surpriseProject();
    const before = await read(dir, `models/${surprise.question}.json`);
    const r = await explainAndRule(dir, name, surprise);
    assert.ok(r.removed.includes(`models/${name}.json`));
    assert.ok(r.removed.includes(`models/${name}.explained.md`));
    assert.equal(await read(dir, `models/${name}.json`), null);
    assert.equal(await read(dir, `models/${surprise.question}.json`), before);
    assert.ok(!(await read(dir, `models/${C}/receipt`)).includes(`${name.split('/').at(-1)}.explained.md`));
    const rerun = run(dir);
    assert.deepEqual(rerun.opened, []);
  });
  test('evidence.md §at-ruling: run removes a merged closed surprise and files sharing its stem', async () => {
    const { dir, name, surprise } = await surpriseProject();
    const raw = await read(dir, `models/${name}.json`);
    await explainAndRule(dir, name, surprise);
    await writeFiles(dir, { [`models/${name}.json`]: raw, [`models/${name}.explained.md`]: explanation(surprise) });
    const r = run(dir);
    assert.ok(r.removed.includes(`models/${name}.json`));
    assert.ok(r.removed.includes(`models/${name}.explained.md`));
    assert.deepEqual(r.opened, []);
  });
  test('evidence.md §at-ruling: files of an absent surprise count for nothing and open nothing', async () => {
    const dir = await passing();
    const stem = `${C}/base.surprise-${'0'.repeat(12)}`;
    await writeFiles(dir, { [`models/${stem}.explained.md`]: '| Field | Value |\n| --- | --- |\n' });
    assert.deepEqual(run(dir).opened, []);
    assert.ok(command(dir, ['missing']).items.every(i => i.item !== `explain:${stem}` && i.item !== `rule:${stem}`));
  });
});

describe('presentation.md §rendering Rendering', () => {
  test('presentation.md §rendering: the displayed surprise uses the action sentence and confirmed lifecycle picture', async () => {
    const { dir, name, surprise } = await surpriseProject();
    const response = await submitExplanation(dir, name, { 'explain.md': explanation(surprise) });
    assert.equal(response.status, 0, response.stdout);
    const showing = command(dir, ['show', 'rule', name]);
    const text = showing.shown;
    assert.ok(text.includes('Open the ticket.'));
    assert.ok(text.includes('closed'));
    assert.ok(text.includes('opened'));
    assert.ok(text.includes('visited'));
    assert.ok(text.includes('The robot opens the ticket.'));
    const pictures = retainedPictures(text);
    const picture = pictures.find(value => value.lifecycle === 'gate/lifecycles/door');
    assert.ok(picture, 'the confirmed lifecycle picture is retained as structured data');
    assert.equal(picture.source.question, surprise.question);
    assert.match(picture.source.digest, hash);
    assert.deepEqual(picture.phases.filter(phase => phase.classes.includes('visited')).map(phase => phase.key).sort(), ['closed', 'opened']);
    const taken = picture.moves.filter(move => move.steps.length);
    assert.deepEqual(taken.map(move => [move.from, move.action, move.case, move.to]), [['closed', 'open', null, 'opened']]);
    assert.deepEqual(taken[0].steps, [{ step: 1, loop: false }]);
    const placed = picture.marks.filter(mark => mark.action);
    assert.equal(placed.length, 1);
    assert.equal(placed[0].from, 'closed');
    assert.equal(placed[0].to, 'opened');
    assert.equal(placed[0].action, 'open');
    assert.deepEqual(placed[0].steps, [1]);
    const entities = Object.keys(surprise.trace.states[0].phases['gate/door']);
    assert.equal(entities.length, 1);
    assert.equal(placed[0].entity, entities[0], 'a placed move retains the known trace entity');
    assert.deepEqual(picture.basis.files.find(file => file.path === lifePage), { path: lifePage, sha256: sha256(await read(dir, lifePage)) });
    const ruling = command(dir, ['decide', 'rule', name, '--shown', showing.token,
      '--verdict', 'real finding', '--level', 'requirement', '--target', 'brief',
      '--words', 'The brief forbids a useful opened ticket.', '--by', 'Developer',
      '--provider', 'fixture', '--model', 'developer', '--session', 'ruler']);
    assert.deepEqual(retainedPictures(await read(dir, ruling.recorded[0])), pictures, 'the ruling keeps the exact marked picture and its basis');
  });
  test('presentation.md §rendering: a fault trace preserves its removed mechanism for rendering', external, async () => {
    const dir = await nativeFixture('tlc', { files: {
      'models/core/parts/gate/claims/safe/fault-reopen.md': t => t.replace("n' = n + 1", "n' = Count + 1"),
    } });
    const r = run(dir);
    const name = r.opened.find(n => n.includes('/fault-reopen.') && n.includes('.surprise-'));
    assert.ok(name);
    const s = await evidence(dir, name);
    assert.ok(s.trace);
    const fault = s.rendered.find(row => row.fault);
    assert.equal(fault.fault, 'models/core/parts/gate/claims/safe/fault-reopen.md');
    assert.equal(fault.mechanism, 'The guard that refuses another opening until the ticket resets.');
  });

});

describe('evidence.md §explain Explain answers', () => {
  for (const verdict of ['model wrong', 'property wrong', 'abstraction too coarse', 'real finding']) {
    test(`evidence.md §explain: accepts recommended verdict ${verdict} without deciding it`, async () => {
      const { dir, name, surprise } = await surpriseProject();
      const text = explanation(surprise, { Verdict: verdict });
      const beforeDecisions = (await tree(dir)).filter(p => p.includes('/decisions/'));
      const r = await submitExplanation(dir, name, { 'explain.md': text });
      assert.equal(r.status, 0, r.stdout);
      assert.equal(r.json.accepted, true);
      assert.equal(await read(dir, `models/${name}.explained.md`), text);
      assert.ok(await read(dir, `models/${name}.json`));
      assert.deepEqual((await tree(dir)).filter(p => p.includes('/decisions/')), beforeDecisions);
      const receipt = (await read(dir, `models/${C}/receipt`)).trim().split('\n').map(JSON.parse);
      assert.ok(receipt.some(line => line.file === `${name.split('/').at(-1)}.explained.md` && line.sha256 === sha256(text)));
    });
  }
  for (const level of ['implementation', 'requirement']) {
    test(`evidence.md §explain: accepts recommended level ${level} and deeper prose headings`, async () => {
      const { dir, name, surprise } = await surpriseProject();
      const text = explanation(surprise, { Level: level }).replace('The robot opens the ticket.', '### Observed action\n\nThe robot opens the ticket.');
      const r = await submitExplanation(dir, name, { 'explain.md': text });
      assert.equal(r.status, 0, r.stdout);
      assert.equal(await read(dir, `models/${name}.explained.md`), text);
    });
  }
  const malformed = [
    ['missing field', s => explanation(s).replace('| Level | specification |\n', '')],
    ['extra field', s => explanation(s).replace('| Level |', '| Extra | unwanted |\n| Level |')],
    ['repeated field', s => explanation(s).replace('| Basis |', `| Question | ${s.question} |\n| Basis |`)],
    ['unknown verdict', s => explanation(s, { Verdict: 'probably fine' })],
    ['unknown level', s => explanation(s, { Level: 'code' })],
    ['missing section', s => explanation(s).replace('## Failure shape\n\nAn opened ticket is forbidden.\n\n', '')],
    ['extra level-two section', s => `${explanation(s)}\n## Extra\n\nUnrequested.\n`],
    ['wrong section order', s => explanation(s).replace('## Trace', '## Temporary').replace('## Failure shape', '## Trace').replace('## Temporary', '## Failure shape')],
    ['empty Trace', s => explanation(s).replace('The robot opens the ticket.', '')],
    ['empty Failure shape', s => explanation(s).replace('An opened ticket is forbidden.', '')],
    ['empty Mechanism', s => explanation(s).replace('The forbidden combination includes the opened phase.', '')],
    ['wrong question', s => explanation(s, { Question: `${C}/witness-open` })],
    ['wrong basis', s => explanation(s, { Basis: 'f'.repeat(12) })],
    ['whole basis instead of twelve digits', s => explanation(s, { Basis: basisDigest(s.basis) })],
    ['unlisted weaker key', s => explanation(s, { Weaker: 'missing' })],
    ['duplicate weaker key', s => explanation(s, { Weaker: 'missing, missing' })],
  ];
  for (const [label, make] of malformed) {
    test(`evidence.md §explain checks 1–2: refuses ${label}`, async () => {
      const { dir, name, surprise } = await surpriseProject();
      const before = await tracked(dir);
      const r = await submitExplanation(dir, name, { 'explain.md': make(surprise) });
      assertRefused(r);
      assert.deepEqual(await tracked(dir), before);
    });
  }
  test('evidence.md §explain check 1: reports multiple independent form failures', async () => {
    const { dir, name, surprise } = await surpriseProject();
    const r = await submitExplanation(dir, name, { 'explain.md': explanation(surprise, { Verdict: 'invalid', Level: 'invalid' }) });
    assertRefused(r);
    assert.ok(r.json.reasons.some(reason => reason.field === 'Verdict'));
    assert.ok(r.json.reasons.some(reason => reason.field === 'Level'));
  });
  test('evidence.md §explain check 1: refuses unrelated answer files', async () => {
    const { dir, name, surprise } = await surpriseProject();
    const r = await submitExplanation(dir, name, { 'explain.md': explanation(surprise), 'unrelated.md': 'No place for this.\n' });
    assertRefused(r, 'door.md §');
  });
  test('evidence.md §explain check 2: an already explained surprise accepts no second explanation', async () => {
    const { dir, name, surprise } = await surpriseProject();
    const content = { 'explain.md': explanation(surprise) };
    assert.equal((await submitExplanation(dir, name, content)).status, 0);
    const before = await tracked(dir);
    const r = await submitExplanation(dir, name, content);
    assertRefused(r, 'door.md §'); // The item is no longer missing: the door checks first.
    assert.deepEqual(await tracked(dir), before);
  });
  test('evidence.md §explain check 2: a closed surprise cannot be explained', async () => {
    const { dir, name, surprise } = await surpriseProject();
    await explainAndRule(dir, name, surprise);
    const r = await submitExplanation(dir, name, { 'explain.md': explanation(surprise) });
    assertRefused(r, 'door.md §');
  });
  test('evidence.md §explain: refuses an author of the lifecycle model before its own checks', async () => {
    const { dir, name, surprise } = await surpriseProject();
    const r = await submitExplanation(dir, name, { 'explain.md': explanation(surprise) },
      ['--provider', author.provider, '--model', author.model, '--session', author.session]);
    assertRefused(r, 'door.md §forma-answer');
  });
  test('evidence.md §explain check 3: a lifecycle base explanation may not offer weaker forms', async () => {
    const { dir, name, surprise } = await surpriseProject();
    const r = await submitExplanation(dir, name, {
      'explain.md': explanation(surprise, { Weaker: 'weak' }),
      'weaker/weak.md': '| Lifecycle | Phase |\n| --- | --- |\n| door | closed |\n',
    });
    assertRefused(r);
  });
  for (const engine of ['tlc', 'alloy']) {
    for (const invalid of ['none', 'syntax', 'wrong extension', 'bad key', 'unlisted file']) {
      test(`evidence.md §explain checks 1, 3: ${engine} refuses weaker forms with ${invalid}`, external, async () => {
        const { dir, name, surprise } = await nativeSurprise(engine);
        const ext = engine === 'tlc' ? 'tla' : 'als';
        const valid = engine === 'tlc' ? 'Invariant == TRUE\n' : 'assert Claim { always (Ticket.count = Ticket.count) }\n';
        const key = invalid === 'bad key' ? 'Bad_Key' : 'weak';
        const files = { 'explain.md': explanation(surprise, { Weaker: invalid === 'none' ? 'none' : key }) };
        if (invalid !== 'none') files[`weaker/${key}.${invalid === 'wrong extension' ? 'md' : ext}`] = invalid === 'syntax' ? 'not native text\n' : valid;
        if (invalid === 'unlisted file') files[`weaker/extra.${ext}`] = valid;
        const r = await submitExplanation(dir, name, files);
        assert.equal(r.status, 1);
        assert.ok(r.json?.reasons?.length);
        assert.ok(r.json.reasons.some(reason => /^(evidence|models|door)\.md §/.test(reason.check)));
      });
    }
  }
  for (const weaker of ['none', 'one']) {
    test(`evidence.md §weaker, §explain check 3: a TLC base type violation ${weaker === 'none' ? 'accepts no weaker forms' : 'refuses a weaker form'}`, external, async () => {
      // evidence.md §questions, engines.md §tlc: conformance questions terminate before Reset
      // can break TypeOK. engines.md §model-phases requires a Phases row for every
      // lifecycle, so remove this fixture's lifecycle and its projection.
      // The base encoding itself is always true.
      const { dir, name, surprise } = await nativeSurprise('tlc', { files: {
        [lifePage]: null,
        [`${P}/README.md`]: text => text.split('\n').filter(line => !line.includes('(lifecycles/door/)')).join('\n'),
        [encoding]: null,
        [`models/${C}/witness-open.md`]: null,
        [`models/${C}/fault-reopen.md`]: null,
        'models/core/Gate.tla': text => text.replace("Reset == n' = 0", "Reset == IF n = 1 THEN n' = Count + 1 ELSE n' = 0"),
        'models/core/model.md': text => text.replace('| gate/door | t \\in Tickets | DoorPhase(t) |\n', ''),
        'models/core/parts/gate/journeys/open-once/schedule.md': text => text.replace('| door | "ticket" |\n', ''),
        'models/core/parts/gate/journeys/open-twice/schedule.md': text => text.replace('| door | "ticket" |\n', ''),
        'models/core/parts/gate/claims/safe/encoding.tla': 'Invariant == TRUE\n',
      } });
      assert.deepEqual(surprise.found, { outcome: 'violation', property: 'TypeOK' });
      const files = { 'explain.md': explanation(surprise, { Weaker: weaker === 'none' ? 'none' : 'weak' }) };
      if (weaker === 'one') files['weaker/weak.tla'] = 'Invariant == TRUE\n';
      const before = await tracked(dir);
      const r = await submitExplanation(dir, name, files);
      if (weaker === 'none') {
        assert.equal(r.status, 0, r.stdout);
        assert.equal(r.json.accepted, true);
        assert.equal(await read(dir, `models/${name}.explained.md`), files['explain.md']);
        assert.ok((await tree(dir)).every(path => !path.startsWith(`models/${name}.weaker-`)));
      } else {
        assertRefused(r);
        assert.deepEqual(await tracked(dir), before);
      }
    });
  }
});

describe('evidence.md §rerun: a run this machine lacks is made again', () => {
  for (const held of ['no run folder', 'output without basis', 'a malformed basis', 'a different basis']) {
    test(`evidence.md §rerun: with ${held}, the run is made again for Explain without spending or tracked changes`, async () => {
      const original = await surpriseProject();
      const dir = await copyWithout(original.dir, ['runs']);
      const question = original.surprise.question;
      if (held === 'output without basis') await writeFiles(dir, { [`runs/${question}/output/stale.txt`]: 'old output without its basis\n' });
      if (held === 'a malformed basis') await writeFiles(dir, { [`runs/${question}/basis.json`]: '{' });
      if (held === 'a different basis') await writeFiles(dir, { [`runs/${question}/basis.json`]: jsonText({
        name: question, basis: { ...original.surprise.basis, runtime: { name: 'node', version: 'old' } }, finished: epoch,
      }) });
      const before = await tracked(dir);
      const spent = await read(dir, 'work/spent.json');
      const packet = await tempFolder('evidence-explain-');
      const r = command(dir, ['give', `explain:${original.name}`, packet]);
      assert.deepEqual(r.differ, []);
      assert.deepEqual(await tracked(dir), before);
      assert.equal(await read(dir, 'work/spent.json'), spent);
      const b = await fileJSON(dir, `runs/${question}/basis.json`);
      assert.deepEqual(b.basis, original.surprise.basis);
      assert.ok((await tree(packet)).some(p => p.startsWith(`runs/${question}/output/`)));
      assert.deepEqual((await evidence(dir, original.name)).limits, original.surprise.limits);
    });
  }
  test('evidence.md §rerun: an unreceipted input cannot regenerate engine output', async () => {
    const original = await surpriseProject();
    const dir = await copyWithout(original.dir, ['runs']);
    await writeFiles(dir, { [encoding]: 'unaccepted changed encoding\n' });
    const before = await tracked(dir);
    const packet = await tempFolder('evidence-uncomposable-');
    command(dir, ['give', `explain:${original.name}`, packet]);
    assert.deepEqual(await tracked(dir), before);
    assert.ok((await tree(packet)).every(p => !p.startsWith(`runs/${original.surprise.question}/output/`)));
  });
  test('evidence.md §rerun / door.md §gives: an Explain packet includes all explanation contracts and the refusal reasons', async () => {
    const { dir, name, surprise } = await surpriseProject();
    const refusal = await submitExplanation(dir, name, { 'explain.md': explanation(surprise, { Verdict: 'invalid' }) });
    assertRefused(refusal);
    const before = await tracked(dir);
    const spent = await read(dir, 'work/spent.json');
    const packet = await tempFolder('evidence-explain-contracts-');
    const given = command(dir, ['give', `explain:${name}`, packet]);
    for (const contract of ['door', 'account', 'evidence', 'models', 'decisions', 'design']) {
      assert.equal(await read(packet, `forma/${contract}.md`), await read(repo, `spec/${contract}.md`));
    }
    assert.equal(await read(packet, `models/${name}.json`), await read(dir, `models/${name}.json`));
    for (const held of surprise.held) assert.equal(await read(packet, held.path), await read(dir, held.path));
    const item = await fileJSON(packet, 'item.json');
    // door.md §gives, §scratch fix which reasons are handed over, not their nesting.
    const reasonObjects = value => value && typeof value === 'object' ? [
      ...(Object.hasOwn(value, 'check') ? [value] : []), ...Object.values(value).flatMap(reasonObjects),
    ] : [];
    for (const reason of refusal.json.reasons) {
      assert.ok(reasonObjects(item.refused).some(candidate =>
        ['check', 'file', 'entry', 'field', 'says'].every(key => candidate[key] === reason[key])));
    }
    const paths = await tree(packet);
    assert.ok(paths.every(path => !path.startsWith('work/') && !path.endsWith('/receipt') && !path.includes('/decisions/')));
    assert.deepEqual(given.files.map(file => file.path), sorted(paths));
    for (const file of given.files) assert.equal(file.sha256, sha256(await read(packet, file.path)));
    assert.deepEqual(await tracked(dir), before);
    assert.equal(await read(dir, 'work/spent.json'), spent);
  });
});

describe('evidence.md §forma-run forma run', () => {
  test('evidence.md §forma-run: an empty project succeeds with the exact empty JSON result', async () => {
    const dir = await project();
    assert.deepEqual(run(dir), { ran: [], opened: [], removed: [], skipped: [], runs: { spent: 0, left: 0 } });
  });
  test('evidence.md §forma-run: one allowed run composes names in byte order and leaves the rest owed', async () => {
    const dir = await fixture({ runs: 1 });
    const r = run(dir);
    assert.equal(r.ran.length, 1);
    assert.equal(r.ran[0].name, `${J}/open-once/lifecycle-path`);
    assert.deepEqual(r.runs, { spent: 1, left: 0 });
    assert.ok(r.skipped.some(s => s.name === `${J}/open-twice/lifecycle-path-refused-at-2` && s.reason === 'no run left'));
    assert.deepEqual(await fileJSON(dir, 'work/spent.json'), { answers: 0, runs: 1 });
  });
  test('evidence.md §forma-run: no run starts before an intake allows it', async () => {
    const dir = await fixture({ intake: false });
    const r = run(dir);
    assert.deepEqual(r.ran, []);
    assert.deepEqual(r.runs, { spent: 0, left: 0 });
    assert.deepEqual(await allEvidence(dir), []);
  });
  test('evidence.md §forma-run: the lifecycle run loop continues from journeys to newly owed claim questions', async () => {
    const dir = await fixture();
    const r = run(dir);
    assert.equal(r.ran.length, 5);
    assert.deepEqual(r.ran.slice(0, 2).map(row => row.name), [
      `${J}/open-once/lifecycle-path`, `${J}/open-twice/lifecycle-path-refused-at-2`,
    ]);
    assert.deepEqual(r.ran.slice(2).map(row => row.name), [`${C}/base`, `${C}/fault-reopen`, `${C}/witness-open`]);
    assert.deepEqual(r.runs, { spent: 5, left: 95 });
    assert.equal(await read(dir, 'work/lock'), null);
  });
  test('evidence.md §forma-run: text output has composed run lines and a final allowance line', async () => {
    const dir = await fixture({ runs: 1 });
    const r = forma(dir, ['run']);
    assert.equal(r.status, 0, r.stderr);
    const lines = r.stdout.trimEnd().split('\n');
    // evidence.md §forma-run fixes the words and milliseconds, not decimal versus exponent notation.
    const first = lines[0].match(/^lifecycles-gate\/parts\/gate\/journeys\/open-once\/lifecycle-path: admitted, as expected, (.+) ms, wrote$/);
    assert.ok(first);
    assert.ok(Number.isFinite(Number(first[1])) && Number(first[1]) >= 0);
    assert.ok(lines.includes(`not run ${J}/open-twice/lifecycle-path-refused-at-2: no run left`));
    assert.equal(lines.at(-1), 'runs: 1 spent here, 0 left');
  });
  test('evidence.md §forma-run: a tracked time over one minute in the future refuses with no writes', async () => {
    const dir = await fixture();
    const path = `${P}/lifecycles/door/receipt`;
    const receipt = (await read(dir, path)).trim().split('\n').map(JSON.parse);
    for (const line of receipt) line.at = new Date(Date.now() + 600_000).toISOString();
    await writeFiles(dir, { [path]: receipt.map(line => JSON.stringify(line) + '\n').join('') });
    const before = await snapshot(dir);
    const r = forma(dir, ['run', '--json']);
    assert.equal(r.status, 1);
    keys(r.json, ['refused']);
    assert.ok(r.json.refused.length > 0);
    assert.deepEqual(await snapshot(dir), before);
  });
  for (const [label, args] of [
    ['unknown option', ['run', '--unknown', '--json']],
    ['duplicate option', ['run', '--json', '--json']],
    ['unexpected session', ['run', '--session', 'not-an-answer', '--json']],
    ['extra argument', ['run', 'extra', '--json']],
  ]) {
    test(`evidence.md §forma-run / project.md §commands: ${label} refuses without running or writing`, async () => {
      const dir = await fixture();
      const before = await snapshot(dir);
      const r = forma(dir, args);
      assert.equal(r.status, 1);
      keys(r.json, ['refused']);
      assert.ok(r.json.refused.length);
      assert.deepEqual(await snapshot(dir), before);
    });
  }
  test('evidence.md §forma-run / project.md §commands: a nonexistent project is refused', async () => {
    const dir = await tempFolder('evidence-no-project-');
    const r = forma(`${dir}/absent`, ['run', '--json']);
    assert.equal(r.status, 1);
    keys(r.json, ['refused']);
    assert.ok(r.json.refused.length);
    assert.deepEqual(await tree(dir), []);
  });
});

// For Restate integration tests, a damaged front page creates a real change
// item; the answer repairs that page and applies the contract's removal/move.
async function restateChange(dir, files) {
  const path = `${P}/README.md`;
  const front = await read(dir, path);
  await writeFiles(dir, { [path]: `${front}\nUnaccepted editor text.\n` });
  const folder = await answerFolder({ [path]: front, ...files });
  const r = forma(dir, ['answer', `change:${path}`, folder, ...explainer, '--json']);
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.equal(r.json.accepted, true);
  return r.json;
}

describe('evidence.md §moved to §removed Moving and removal', () => {
  test('evidence.md §moved, §removed: re-filing rewrites evidence identity and removing its span deletes it', async () => {
    const dir = await passing();
    const before = await evidence(dir, `${C}/base`);
    const claim = await read(dir, claimPage);
    const front = (await read(dir, `${P}/README.md`)).replace('4. [Safe opening](claims/safe/)\n', '');
    await restateChange(dir, {
      [`${P}/README.md`]: front,
      'removed.md': `${P}/claims/safe\n`,
      'design/spans/archive/README.md': '# Archived filing\n\nFiles the ticket claim for reading.\n\n1. [Safe opening](claims/safe/)\n',
      'design/spans/archive/claims/safe/README.md': claim,
    });
    const nextName = `${L}/spans/archive/claims/safe/base`;
    const after = await evidence(dir, nextName);
    const expected = structuredClone(before);
    expected.name = nextName;
    for (const input of expected.basis.files) {
      if (input.path?.startsWith(`models/${C}/`)) input.path = input.path.replace(`models/${C}/`, `models/${L}/spans/archive/claims/safe/`);
      if (input.path?.startsWith(`${P}/claims/safe/`)) input.path = input.path.replace(`${P}/claims/safe/`, 'design/spans/archive/claims/safe/');
    }
    for (const input of expected.basis.entries) if (input.entry === 'gate/claims/safe') input.entry = 'archive/claims/safe';
    // Preserve the values and restore evidence.md §basis's required ordering after renaming.
    expected.basis.files.sort((a, b) => Number(Boolean(a.generated)) - Number(Boolean(b.generated)) ||
      Buffer.compare(Buffer.from(a.path ?? a.generated), Buffer.from(b.path ?? b.generated)));
    expected.basis.entries.sort((a, b) => Buffer.compare(Buffer.from(a.entry), Buffer.from(b.entry)));
    assert.deepEqual(after, JSON.parse(sealed(expected)));
    assert.equal(await read(dir, `models/${C}/base.json`), null);
    assert.ok(run(dir).ran.every(row => row.name !== nextName));
    await restateChange(dir, { 'removed.md': 'design/spans/archive\n' });
    assert.ok((await tree(dir)).every(path => !path.startsWith(`models/${L}/spans/archive/`)));
  });
  test('evidence.md §removed: removing a claim removes its evidence from every model', async () => {
    const dir = await passing();
    const front = (await read(dir, `${P}/README.md`)).replace('4. [Safe opening](claims/safe/)\n', '');
    await restateChange(dir, { [`${P}/README.md`]: front, 'removed.md': `${P}/claims/safe\n` });
    assert.ok((await tree(dir)).every(p => !p.startsWith(`models/${C}/`)));
    assert.ok(await read(dir, `models/${J}/open-once/lifecycle-path.json`));
  });
  test('evidence.md §removed: removing and restoring the same key and pin in one answer preserves evidence', async () => {
    const dir = await passing();
    const before = await read(dir, `models/${C}/base.json`);
    const claim = await read(dir, claimPage);
    await restateChange(dir, { 'removed.md': `${P}/claims/safe\n`, [claimPage]: claim });
    assert.equal(await read(dir, `models/${C}/base.json`), before);
    assert.deepEqual(run(dir).ran, []);
  });
  test('evidence.md §removed: a later re-addition does not resurrect removed evidence', async () => {
    const dir = await passing();
    const claim = await read(dir, claimPage);
    const front = await read(dir, `${P}/README.md`);
    await restateChange(dir, { [`${P}/README.md`]: front.replace('4. [Safe opening](claims/safe/)\n', ''), 'removed.md': `${P}/claims/safe\n` });
    await restateChange(dir, { [`${P}/README.md`]: front, [claimPage]: claim });
    assert.equal(await read(dir, `models/${C}/base.json`), null);
    assert.equal(await read(dir, encoding), null);
  });
  test('evidence.md §removed, §surprise-file: a Restate answer cannot remove what an open surprise rests on', async () => {
    const { dir } = await surpriseProject();
    const front = await read(dir, `${P}/README.md`);
    await writeFiles(dir, { [`${P}/README.md`]: `${front}\nUnaccepted edit.\n` });
    const before = await tracked(dir);
    const folder = await answerFolder({ [`${P}/README.md`]: front.replace('4. [Safe opening](claims/safe/)\n', ''), 'removed.md': `${P}/claims/safe\n` });
    const r = forma(dir, ['answer', `change:${P}/README.md`, folder, ...explainer, '--json']);
    assertRefused(r, 'design.md §restate');
    assert.deepEqual(await tracked(dir), before);
  });
});

describe('evidence.md §explain Additional accepted form', () => {
  test('evidence.md §explain: Explain tables accept reordered fields and case-insensitive reordered columns', async () => {
    const { dir, name, surprise } = await surpriseProject();
    const standard = explanation(surprise);
    const rows = table(standard, 'Field').reverse();
    const text = '| VALUE | field |\n| --- | --- |\n' + rows.map(r => `| ${r.Value} | ${r.Field.toLowerCase()} |\n`).join('') + standard.slice(standard.indexOf('\n## Trace'));
    const r = await submitExplanation(dir, name, { 'explain.md': text });
    assert.equal(r.status, 0, r.stdout);
    assert.equal(await read(dir, `models/${name}.explained.md`), text);
  });
});

describe('evidence.md §rerun: a run this machine holds is handed over', () => {
  test('evidence.md §rerun: a matching run is handed over unchanged without running again', async () => {
    const { dir, name, surprise } = await surpriseProject();
    const before = await snapshot(dir);
    const packet = await tempFolder('evidence-cached-');
    command(dir, ['give', `explain:${name}`, packet]);
    const after = await snapshot(dir);
    // evidence.md §rerun: a run this machine holds is handed over as it is, with nothing written in the project.
    assert.deepEqual(after, before);
    const b = await read(packet, `runs/${surprise.question}/basis.json`);
    assert.equal(b, before[`runs/${surprise.question}/basis.json`]);
  });
});

describe('engines.md §lifecycle-engine, presentation.md §rendering More lifecycle semantics', () => {
  test('engines.md §lifecycle-engine: an entered-by lifecycle starts absent, is created once, and can then reach another phase', async () => {
    const dir = await passing({ files: {
      [lifePage]: t => t.replace('| Initial | closed |', '| Initial | closed, entered by open |')
        .replace('| closed | opened | closed |', '| closed | closed | opened |'),
    } });
    const e = await evidence(dir, `${C}/witness-open`);
    assert.equal(e.found.outcome, 'reached');
    assert.equal(e.trace.states.length, 3);
    assert.deepEqual(e.trace.states.slice(1).map(s => s.rows), [
      [{ action: 'gate/open', case: '-' }], [{ action: 'gate/reset', case: '-' }],
    ]);
    assert.deepEqual((await evidence(dir, `${J}/open-twice/lifecycle-path-refused-at-2`)).found, { outcome: 'refused', step: 2 });
  });
  test('engines.md §lifecycle-engine: an action is refused when any participating lifecycle refuses it', async () => {
    const dir = await fixture({ files: {
      [`${P}/lifecycles/latch/README.md`]: '# Latch\n\n| Field | Value |\n| --- | --- |\n| Entity | ticket |\n| Initial | latched |\n| Ends | none |\n| Unaffected | reset |\n| Origin | stated |\n| Cites | design/brief/gate.md#gate |\n\n| Phase | open |\n| --- | --- |\n| latched | None. |\n',
    } });
    run(dir);
    assert.deepEqual((await evidence(dir, `${J}/open-once/lifecycle-path`)).found, { outcome: 'refused', step: 1 });
  });
  test('engines.md §lifecycle-engine: an unaffected lifecycle stays in its phase while another moves', async () => {
    const dir = await passing({ files: {
      [`${P}/lifecycles/latch/README.md`]: '# Latch\n\n| Field | Value |\n| --- | --- |\n| Entity | ticket |\n| Initial | latched |\n| Ends | none |\n| Unaffected | open, reset |\n| Origin | stated |\n| Cites | design/brief/gate.md#gate |\n\n| Phase |\n| --- |\n| latched |\n',
      [`models/${C}/witness-open.md`]: '| Field | Value |\n| --- | --- |\n| Meaning | The opened ticket retains its latch. |\n\n| Lifecycle | Phase |\n| --- | --- |\n| door | opened |\n| latch | latched |\n',
    } });
    const e = await evidence(dir, `${C}/witness-open`);
    assert.equal(e.found.outcome, 'reached');
    assert.equal(e.trace.states.length, 2);
    for (const state of e.trace.states) assert.ok(JSON.stringify(state.phases).includes('latched'));
  });
  test('presentation.md §rendering: rendering uses saved action wording after accepted action words change', async () => {
    const { dir, name, surprise } = await surpriseProject();
    await reviseFixture(dir, { [`${P}/actions.md`]: t => t.replace('Open the ticket.', 'Request that the ticket opens.') }, false);
    const r = await submitExplanation(dir, name, { 'explain.md': explanation(surprise) });
    assert.equal(r.status, 0, r.stdout);
    const text = command(dir, ['show', 'rule', name]).shown;
    assert.ok(text.includes('Open the ticket.'));
    const saved = await evidence(dir, name);
    assert.ok(saved.rendered.some(row => row.content.includes('Sentence: Open the ticket.')));
  });
});

describe('evidence.md §question-names, engines.md §composition Native starts', () => {
  for (const engine of ['tlc', 'alloy']) {
    test(`evidence.md §question-names, engines.md §composition: ${engine} starts from a reachable noninitial phase and preserves the start trace`, external, async () => {
      const model = modelFor(engine);
      const dir = await nativeFixture(engine, { files: {
        [positivePage]: t => t.replace('The ticket is open.', 'The ticket is closed.')
          .replace('| Step | Actor', '| Lifecycle | Entity | Phase |\n| --- | --- | --- |\n| door | door | opened |\n\n| Step | Actor')
          .replace('| open | This ticket |', '| reset | This ticket |'),
        // engines.md §slot-forms: reset must end closed, matching this journey's Expected end.
        [`models/${model}/parts/gate/journeys/open-once/schedule.md`]: t => t.replace('| Step | Bindings |',
          `| Start |\n| --- |\n| ${engine === 'tlc' ? 'n = 1' : 'Ticket.count = 1'} |\n\n| Step | Bindings |`)
          .replace('The ticket is open.', 'The ticket is closed.')
          .replace(engine === 'tlc' ? 'End == n = 1' : 'pred End { Ticket.count = 1 }',
            engine === 'tlc' ? 'End == n = 0' : 'pred End { Ticket.count = 0 }'),
      } });
      run(dir);
      const d = boundsDigest(modelBounds(await read(dir, `models/${model}/model.md`)));
      const start = await evidence(dir, `${model}/parts/gate/journeys/open-once/start.${d}`);
      assert.deepEqual(start.expected, { outcome: 'reached' });
      assert.deepEqual(start.found, { outcome: 'reached' });
      assert.ok(start.trace.states.length >= 2);
      assert.ok(start.basis.entries.some(e => e.entry === 'gate/lifecycles/door'));
      assert.deepEqual((await evidence(dir, `${model}/parts/gate/journeys/open-once/path.${d}`)).found, { outcome: 'reached' });
    });
  }
});

describe('evidence.md §questions to engines.md §composition Misbehaviour questions', () => {
  const worldFiles = { [`${P}/boundary.md`]: t => t.replace('| robot | The robot | actor | machine | - |', '| robot | The robot | actor | world | person |') };
  const menu = ['drop', 'duplicate', 'delay', 'reorder', 'fail-forever', 'fail-then-succeed', 'crash', 'go-silent'];
  test('evidence.md §questions, §question-names, engines.md §tlc: every TLC world-menu witness and enabled question has its fixed path and expected reached', external, async () => {
    const dir = await fixture({ engine: 'tlc-world', files: worldFiles });
    run(dir);
    const d = boundsDigest(modelBounds(await read(dir, 'models/core/model.md')));
    for (const item of menu) {
      for (const [kind, suffix] of [['misbehaviour', `${item}.${d}`], ['enabled', `${item}.enabled.${d}`]]) {
        const e = await evidence(dir, `core/world/gate/robot/${suffix}`);
        assert.equal(e.kind, kind);
        assert.deepEqual(e.expected, { outcome: 'reached' });
        assert.deepEqual(e.found, { outcome: 'reached' });
        assert.equal(e.matches, true);
        assert.ok(e.basis.entries.some(p => p.entry === 'gate/boundary/robot'));
      }
    }
  });
  test('evidence.md §questions, engines.md §tlc: striking a TLC world row stops asking its questions while keeping its evidence', external, async () => {
    const dir = await fixture({ engine: 'tlc-world', files: worldFiles });
    run(dir);
    const d = boundsDigest(modelBounds(await read(dir, 'models/core/model.md')));
    const path = `models/core/world/gate/robot/drop.${d}.json`;
    const before = await read(dir, path);
    // decisions.md §carry: a strike pins this exact canonical single line.
    const carry = decision('carry', 'strike:gate/robot/drop', sha256('Strike: drop at The robot'),
      [['Choice', 'carry'], ['Basis', '-']], '2020-01-03T00:00:00.000Z', 'an observed drop at The robot');
    await writeFiles(dir, { [`${P}/decisions/${carry.name}.md`]: carry.text });
    const r = run(dir);
    assert.ok(r.ran.every(row => !row.name.startsWith('core/world/gate/robot/drop.')));
    assert.equal(await read(dir, path), before);
  });
  test('engines.md §trace, presentation.md §rendering: a TLC misbehaviour trace records the world row, bindings and saved domain wording', external, async () => {
    const dir = await fixture({ engine: 'tlc-world', files: { ...worldFiles,
      'models/core/parts/gate/claims/safe/encoding.tla': 'Invariant == last # 1\n',
    } });
    const r = run(dir);
    const name = r.opened.find(n => n.startsWith('core/parts/gate/claims/safe/base.'));
    assert.ok(name);
    const s = await evidence(dir, name);
    assert.ok(s.trace.states.slice(1).some(state => state.rows.some(row => row.misbehaviour === 'gate/robot/drop')));
    const row = s.trace.states.flatMap(state => state.rows ?? []).find(row => row.misbehaviour === 'gate/robot/drop');
    assert.deepEqual(row.bindings, {});
    const content = meanings(await snapshot(dir))['gate/boundary/robot'];
    assert.ok(s.rendered.some(r => r.entry === 'gate/boundary/robot' && r.pin === sha256(content) && r.content === content));
  });
});

describe('engines.md §composition Cases', () => {
  const caseFiles = {
    [`${P}/actions.md`]: t => t.replace('| Open the ticket. | none |', '| Open the ticket. | approved, rejected |'),
    [lifePage]: t => t.replace('| closed | opened | closed |', '| closed | approved: opened<br>rejected: closed | closed |')
      .replace('| opened | None. | closed |', '| opened | approved: None.<br>rejected: None. | closed |'),
    [positivePage]: t => t.replace('| - | - |', '| - | approved |'),
    [negativePage]: t => t.replaceAll('| - | - |', '| - | approved |'),
    [`models/${C}/fault-reopen.md`]: t => t.replace('| door | opened | open | closed |', '| door | opened | open | approved: closed<br>rejected: None. |'),
  };
  test('engines.md §lifecycle-engine: the lifecycle engine enumerates cases and traces the case taken', async () => {
    const dir = await passing({ files: caseFiles });
    const witness = await evidence(dir, `${C}/witness-open`);
    assert.deepEqual(witness.trace.states[1].rows, [{ action: 'gate/open', case: 'approved' }]);
    assert.deepEqual((await evidence(dir, `${J}/open-once/lifecycle-path`)).found, { outcome: 'admitted' });
    assert.deepEqual((await evidence(dir, `${J}/open-twice/lifecycle-path-refused-at-2`)).found, { outcome: 'refused', step: 2 });
  });
  for (const engine of ['tlc', 'alloy']) {
    test(`engines.md §composition: ${engine} asks a case through the phase transition and records no operator-only cases`, external, async () => {
      const dir = await nativeFixture(engine, { files: caseFiles });
      run(dir);
      const model = modelFor(engine);
      const d = boundsDigest(modelBounds(await read(dir, `models/${model}/model.md`)));
      for (const suffix of ['open-once/path', 'open-twice/path-to-1', 'open-twice/refusal-at-2']) {
        const e = await evidence(dir, `${model}/parts/gate/journeys/${suffix}.${d}`);
        assert.deepEqual(e.cases, []);
        assert.equal(e.matches, true);
      }
    });
  }
});

describe('engines.md §tlc TLC bounds and liveness', () => {
  test('evidence.md §bounds, engines.md §tlc: all liveness claim questions omit the constraint from bounds and configuration', external, async () => {
    const dir = await nativeFixture('tlc', { files: {
      [claimPage]: t => t.replace('| Kind | safety |', '| Kind | liveness |').replace('| Rests on | none |', '| Rests on | fair |'),
      [`${P}/premises/fair/README.md`]: '# Fair opening\n\n| Field | Value |\n| --- | --- |\n| Statement | A continuously available opening eventually happens. |\n| Class | fairness |\n| Why not examined | not verifiable here |\n| Falsifier | The ticket remains closed despite continuous permission. |\n| Provider | The scheduler |\n| Origin | stated |\n| Cites | design/brief/gate.md#gate |\n',
      'models/core/model.md': t => t.replace('between resets |', 'between resets |\n| constraint | n <= 1 | only ordinary counter states |'),
      'models/core/parts/gate/claims/safe/encoding.tla': 'Property == []<>(n = 1)\nFairness == WF_vars(Open)\n',
      'models/core/parts/gate/claims/safe/fault-reopen.md': t => t.replace('Fault == /\\ n < Count\n         /\\ n\' = n + 1', "Fault == n' = 0"),
      [encoding]: '| Field | Value |\n| --- | --- |\n| Cannot express | Liveness needs fairness beyond phase safety. |\n',
    } });
    run(dir);
    const questions = (await allEvidence(dir, 'core')).filter(e => !e.question && ['base', 'fault', 'witness'].includes(e.kind));
    assert.equal(questions.length, 3);
    for (const e of questions) {
      assert.equal(Object.hasOwn(e.bounds, 'constraint'), false);
      const cfg = await read(dir, `runs/${e.name}/inputs/FormaExam.cfg`);
      assert.ok(!/\bCONSTRAINT\b/.test(cfg));
    }
    const action = (await allEvidence(dir, 'core')).find(e => e.name.startsWith('core/actions/'));
    assert.equal(action.bounds.constraint, 'n <= 1');
  });
  test('engines.md §tlc: range, negative and escaped-string constants are wrapper definitions substituted by the configuration', external, async () => {
    // engines.md §tlc: nested negative values require wrapper definitions;
    // homogeneous sets keep Nested within the values TLC can compare.
    const dir = await nativeFixture('tlc', { files: {
      'models/core/Gate.tla': t => t.replace('CONSTANT Count', 'CONSTANT Count, Range, Negative, Escaped, Nested').replace('EXTENDS Naturals', 'EXTENDS Integers'),
      'models/core/model.md': t => t.replace('between resets |', 'between resets |\n| constant Range | 1 .. 3 | three numeric values |\n| constant Negative | -1 | a negative value |\n| constant Escaped | `"a\\"b"` | a quoted label |\n| constant Nested | `{{-1, 0}, {1, 2}}` | nested values |'),
    } });
    run(dir);
    const e = (await allEvidence(dir, 'core')).find(e => e.kind === 'base');
    assert.equal(e.bounds['constant Range'], '1..3');
    assert.equal(e.bounds['constant Negative'], '-1');
    assert.equal(e.bounds['constant Escaped'], '"a\\"b"');
    const cfg = await read(dir, `runs/${e.name}/inputs/FormaExam.cfg`);
    const wrapper = await read(dir, `runs/${e.name}/inputs/FormaExam.tla`);
    for (const name of ['Range', 'Negative', 'Escaped', 'Nested']) {
      const match = cfg.match(new RegExp(`\\b${name}\\s*<-\\s*((?:Forma|forma)[A-Za-z0-9_]*)`));
      assert.ok(match, `${name} must be substituted`);
      assert.ok(wrapper.includes(match[1]));
    }
  });
});

describe('engines.md §alloy, evidence.md §flags Alloy facts and flags', () => {
  test('engines.md §alloy: inconsistent Alloy facts are not reached and block claim questions', external, async () => {
    const dir = await nativeFixture('alloy', { files: { 'models/relational/Gate.als': t => `${t}\nfact Impossible { no Ticket }\n` } });
    run(dir);
    const records = await allEvidence(dir, 'relational');
    const e = records.find(e => e.kind === 'facts' && !e.question);
    assert.deepEqual(e.found, { outcome: 'not reached' });
    assert.equal(e.matches, false);
    assert.ok(records.every(e => e.kind !== 'base'));
  });
  for (const multiplicity of ['', 'one ', 'lone ', 'abstract ']) {
    test(`evidence.md §flags: Alloy scope one ${multiplicity || 'ordinary '}signature applies tiny-scope only to an ordinary signature`, external, async () => {
      const dir = await nativeFixture('alloy', { unconfirmed: ['gate/journeys/open-twice'], files: {
        'models/relational/Gate.als': t => `${t.replace("Ticket.count' = 1", "Ticket.count' = 0")}\n${multiplicity}sig Spare {}\n`,
        'models/relational/model.md': t => t.replace('| scope | 3 |', '| scope | 1 |').replace('| steps | 1..4 |', '| steps | 1 |'),
        [positivePage]: t => t.replace('| open | This ticket |', '| reset | This ticket |'),
        // engines.md §slot-forms: the journey now ends at count 0, so its End says so.
        'models/relational/parts/gate/journeys/open-once/schedule.md': t => t.replace('pred End { Ticket.count = 1 }', 'pred End { Ticket.count = 0 }'),
      } });
      run(dir);
      const e = (await allEvidence(dir, 'relational')).find(e => e.kind === 'base');
      assert.ok(e);
      assert.equal(e.flags.includes('tiny-scope'), multiplicity === '');
      assert.ok(e.flags.includes('tiny-trace'));
    });
  }
});

describe('evidence.md §reductions Bound reduction forms', () => {
  for (const [value, expected] of [
    ['{a, b, c, d}', ['{a, b}', '{a}', '{}']],
    ['1..4', ['1..2', '1..1']],
    ['2', ['1', '0']],
    ['TRUE', []],
    ['"constant text"', []],
  ]) {
    test(`evidence.md §reductions: TLC reduces ${value} by its specified steps only`, external, async () => {
      const dir = await nativeFixture('tlc', { files: {
        'models/core/Gate.tla': t => t.replace('CONSTANT Count', 'CONSTANT Count, Extra'),
        'models/core/model.md': t => t.replace('between resets |', `between resets |\n| constant Extra | ${value} | a reduction dimension |`),
        'models/core/parts/gate/claims/safe/encoding.tla': 'Invariant == FALSE\n',
      } });
      const r = run(dir);
      const name = r.opened.find(n => n.startsWith('core/parts/gate/claims/safe/base.'));
      assert.ok(name);
      // Count 2 -> 1 -> 0 occupies the first two reductions; the initial
      // state already violates Invariant, so both are kept before Extra.
      assert.equal((await evidence(dir, `${name}.reduction-1`)).bounds['constant Count'], '1');
      assert.equal((await evidence(dir, `${name}.reduction-2`)).bounds['constant Count'], '0');
      for (let i = 0; i < expected.length; i++) {
        const e = await evidence(dir, `${name}.reduction-${i + 3}`);
        assert.equal(e.bounds['constant Extra'], expected[i]);
        assert.equal(e.found.property, 'Invariant');
      }
      assert.equal(await read(dir, `models/${name}.reduction-${expected.length + 3}.json`), null);
    });
  }
  test('evidence.md §reductions: Alloy scope without a default number has no reductions', external, async () => {
    const { dir, name } = await nativeSurprise('alloy', { files: {
      'models/relational/model.md': t => t.replace('| scope | 3 |', '| scope | exactly 1 Ticket |'),
    } });
    assert.equal(await read(dir, `models/${name}.reduction-1.json`), null);
  });
});

describe('engines.md §replay, §trace Trace edge cases', () => {
  test('engines.md §replay, §trace: TLC without Phases retains the trace without replay, phases or bindings and says why', external, async () => {
    const dir = await nativeFixture('tlc', { edit: files => {
      delete files[lifePage];
      for (const path of Object.keys(files)) if (path.startsWith(`models/${L}/`)) delete files[path];
      files[`${P}/README.md`] = files[`${P}/README.md`].replace('1. [Door](lifecycles/door/)\n', '');
      files['models/core/model.md'] = files['models/core/model.md'].replace('| gate/door | t \\in Tickets | DoorPhase(t) |\n', '');
      for (const key of ['open-once', 'open-twice']) {
        const path = `models/core/parts/gate/journeys/${key}/schedule.md`;
        files[path] = files[path].replace('| door | "ticket" |\n', '');
      }
    } });
    run(dir);
    const e = (await allEvidence(dir, 'core')).find(e => e.kind === 'witness');
    assert.ok(e.trace.states.length > 1);
    assert.equal(typeof e.trace.replay, 'string');
    assert.ok(e.trace.replay.length);
    for (const s of e.trace.states) {
      assert.equal(Object.hasOwn(s, 'phases'), false);
      for (const row of s.rows ?? []) assert.equal(Object.hasOwn(row, 'bindings'), false);
    }
    assert.ok((await tree(dir)).every(p => !p.startsWith(`runs/${e.name}/replay/`)));
  });
  test('engines.md §alloy, §trace, presentation.md §rendering: Alloy records no row for an unclassified step and retains the closing loop', external, async () => {
    const dir = await nativeFixture('alloy', { files: {
      'models/relational/Gate.als': t => t.replace('always (Open or Reset)', "always (Open or Reset or Ticket.count' = 2)"),
    } });
    const r = run(dir);
    const name = r.opened.find(n => n.startsWith('relational/parts/gate/claims/safe/base.'));
    assert.ok(name);
    const e = await evidence(dir, name);
    assert.ok(e.trace.states.slice(1).some(s => s.rows.length === 0));
    keys(e.trace.loop, ['to', 'rows']);
    assert.ok(Number.isInteger(e.trace.loop.to) && e.trace.loop.to >= 0 && e.trace.loop.to < e.trace.states.length);
    assert.equal(Object.hasOwn(e.trace, 'replay'), false);
  });
});

describe('evidence.md §surprises More surprise lifecycle rules', () => {
  test('evidence.md §at-ruling: ruling one independent surprise leaves the other one open', async () => {
    const { dir, name, surprise } = await surpriseProject({ files: {
      [`models/${C}/witness-open.md`]: '| Field | Value |\n| --- | --- |\n| Meaning | Opening an open ticket closes it. |\n\n| Lifecycle | From | Action | To |\n| --- | --- | --- | --- |\n| door | opened | open | closed |\n',
    } });
    const other = (await allEvidence(dir)).find(e => e.question === `${C}/witness-open`);
    assert.ok(other);
    const before = await read(dir, `models/${other.name}.json`);
    await explainAndRule(dir, name, surprise);
    assert.equal(await read(dir, `models/${other.name}.json`), before);
    assert.ok(command(dir, ['missing']).items.some(i => i.item === `explain:${other.name}`));
  });
  test('evidence.md §reductions: interrupted reductions resume from recorded kept bounds without repeating earlier runs', external, async () => {
    const original = await nativeSurprise('tlc', { files: { 'models/core/model.md': t => t.replace('| constant Count | 2 |', '| constant Count | 9 |') } });
    const remove = [];
    for (let i = 2; i <= 6; i++) remove.push(`models/${original.name}.reduction-${i}.json`, `runs/${original.name}.reduction-${i}`);
    const dir = await copyWithout(original.dir, remove);
    const first = await read(dir, `models/${original.name}.reduction-1.json`);
    await writeFiles(dir, { 'work/spent.json': '{"answers":0,"runs":99}\n' });
    const r = run(dir);
    assert.deepEqual(r.ran.map(row => row.name), [`${original.name}.reduction-2`]);
    assert.equal((await evidence(dir, `${original.name}.reduction-2`)).bounds['constant Count'], '7');
    assert.equal(await read(dir, `models/${original.name}.reduction-1.json`), first);
    assert.equal(await read(dir, `models/${original.name}.reduction-3.json`), null);
    assert.deepEqual(r.runs, { spent: 100, left: 0 });
  });
});

describe('evidence.md §written, §at-ruling Record transitions', () => {
  test('evidence.md §written: a property-only change becomes previous even when the violation outcome is unchanged', external, async () => {
    const original = await nativeSurprise('tlc');
    const dir = await copyWithout(original.dir, [`models/${original.name}.json`]);
    await changeEvidence(dir, original.surprise.question, e => { e.found = { outcome: 'violation', property: 'TypeOK' }; });
    run(dir);
    const e = await evidence(dir, original.surprise.question);
    assert.deepEqual(e.found, { outcome: 'violation', property: 'Invariant' });
    assert.deepEqual(e.previous, { outcome: 'violation', property: 'TypeOK', until: e.established });
  });
  test('evidence.md §written: a refused-step-only change becomes previous', async () => {
    const dir = await passing();
    const name = `${J}/open-twice/lifecycle-path-refused-at-2`;
    await changeEvidence(dir, name, e => { e.found = { outcome: 'refused', step: 1 }; e.matches = false; });
    run(dir);
    const e = await evidence(dir, name);
    assert.deepEqual(e.found, { outcome: 'refused', step: 2 });
    assert.deepEqual(e.previous, { outcome: 'refused', step: 1, until: e.established });
  });
  test('evidence.md §at-ruling: ruling a native surprise removes reductions, weaker source and evidence, and explanation together', external, async () => {
    const { dir, name, surprise } = await nativeSurprise('tlc');
    const accepted = await submitExplanation(dir, name, {
      'explain.md': explanation(surprise, { Weaker: 'weak' }),
      'weaker/weak.tla': 'Invariant == TRUE\n',
    });
    assert.equal(accepted.status, 0, accepted.stdout);
    run(dir);
    const question = await read(dir, `models/${surprise.question}.json`);
    const own = (await tree(dir)).filter(p => p.startsWith(`models/${name}.`));
    for (const suffix of ['json', 'reduction-1.json', 'reduction-2.json', 'weaker-weak.tla', 'weaker-weak.json', 'explained.md']) {
      assert.ok(own.includes(`models/${name}.${suffix}`));
    }
    const shown = command(dir, ['show', 'rule', name]);
    const r = command(dir, ['decide', 'rule', name, '--shown', shown.token,
      '--verdict', 'real finding', '--level', 'requirement', '--target', 'brief',
      '--words', 'Revise the requirement.', '--by', 'Developer',
      '--provider', 'fixture', '--model', 'developer', '--session', 'ruler']);
    for (const p of own) {
      assert.ok(r.removed.includes(p));
      assert.equal(await read(dir, p), null);
    }
    assert.equal(await read(dir, `models/${surprise.question}.json`), question);
    const receipt = await read(dir, 'models/core/parts/gate/claims/safe/receipt');
    assert.ok(!receipt.includes(`${name.split('/').at(-1)}.`));
  });
  test('evidence.md §versions, §forma-run: text output identifies a free version-only run', async () => {
    const dir = await passing();
    await changeEvidence(dir, `${C}/base`, e => { e.basis.runtime.version = 'old-node'; });
    const r = forma(dir, ['run']);
    assert.equal(r.status, 0, r.stderr);
    const line = r.stdout.split('\n').find(line => line.startsWith(`${C}/base:`));
    assert.match(line, /, wrote, spent nothing$/);
    assert.equal(r.stdout.trimEnd().split('\n').at(-1), 'runs: 5 spent here, 95 left');
  });
});

describe('evidence.md §question-names Changed bounds', () => {
  for (const engine of ['tlc', 'alloy']) {
    test(`evidence.md §question-names: ${engine} changed bounds create new names and retain the original evidence`, external, async () => {
      const dir = await nativeFixture(engine);
      run(dir);
      const model = modelFor(engine);
      const old = (await allEvidence(dir, model)).find(e => e.kind === 'base');
      const bytes = await read(dir, `models/${old.name}.json`);
      await reviseFixture(dir, { [`models/${model}/model.md`]: text => engine === 'tlc' ?
        text.replace('| constant Count | 2 |', '| constant Count | 3 |') : text.replace('| scope | 3 |', '| scope | 2 |') });
      run(dir);
      const d = boundsDigest(modelBounds(await read(dir, `models/${model}/model.md`)));
      const current = await evidence(dir, `${model}/parts/gate/claims/safe/base.${d}`);
      assert.notEqual(current.name, old.name);
      assert.equal(await read(dir, `models/${old.name}.json`), bytes);
      assert.notDeepEqual(current.bounds, old.bounds);
    });
  }
});

describe('evidence.md §outcomes Native refusal outcomes', () => {
  for (const engine of ['tlc', 'alloy']) {
    test(`engines.md §composition, evidence.md §outcomes: ${engine} reports an enabled forbidden step separately from its reachable prefix`, external, async () => {
      const model = modelFor(engine);
      const path = `models/${model}/Gate.${engine === 'tlc' ? 'tla' : 'als'}`;
      const dir = await nativeFixture(engine, { files: {
        [path]: text => engine === 'tlc' ? text.replace("Open == /\\ n = 0\n        /\\ n' = 1", "Open == n' = 1") :
          text.replace('pred Open {\n  Ticket.count = 0', 'pred Open {'),
      } });
      run(dir);
      const d = boundsDigest(modelBounds(await read(dir, `models/${model}/model.md`)));
      const prefix = await evidence(dir, `${model}/parts/gate/journeys/open-twice/path-to-1.${d}`);
      const refusal = await evidence(dir, `${model}/parts/gate/journeys/open-twice/refusal-at-2.${d}`);
      assert.deepEqual(prefix.expected, { outcome: 'reached', step: 1 });
      assert.deepEqual(prefix.found, { outcome: 'reached' });
      assert.deepEqual(refusal.expected, { outcome: 'not enabled', step: 2 });
      assert.deepEqual(refusal.found, { outcome: 'enabled' });
      assert.equal(refusal.matches, false);
      assert.ok((await allEvidence(dir, model)).every(e => e.kind !== 'base'));
    });
  }
});

describe('evidence.md §questions Model prerequisites', () => {
  for (const engine of ['tlc', 'alloy']) {
    test(`evidence.md §questions: ${engine} questions keep evidence but do not run with an unaccepted model file`, external, async () => {
      const dir = await nativeFixture(engine);
      run(dir);
      const model = modelFor(engine);
      const before = await allEvidence(dir, model);
      const path = `models/${model}/Gate.${engine === 'tlc' ? 'tla' : 'als'}`;
      await writeFiles(dir, { [path]: `${await read(dir, path)}\nUnaccepted edit.\n` });
      const r = run(dir);
      assert.ok(r.ran.every(row => !row.name.startsWith(`${model}/`)));
      assert.deepEqual(await allEvidence(dir, model), before);
    });
    test(`evidence.md §questions: ${engine} questions wait while an added action owes a Model answer`, external, async () => {
      const dir = await nativeFixture(engine, { files: {
        [`${P}/actions.md`]: text => `${text}| wait | robot | Wait for the ticket. | none | none | stated | design/brief/gate.md#gate |\n`,
        [lifePage]: text => text.replace('| Unaffected | none |', '| Unaffected | wait |'),
      } });
      const r = run(dir);
      assert.ok(r.ran.every(row => !row.name.startsWith(`${modelFor(engine)}/`)));
      assert.ok(command(dir, ['missing']).items.some(i => i.item === `model:${modelFor(engine)}`));
    });
  }
  test('evidence.md §questions: every Alloy question links every lifecycle named by Phases', external, async () => {
    const dir = await nativeFixture('alloy');
    run(dir);
    for (const e of await allEvidence(dir, 'relational')) {
      assert.ok(e.basis.entries.some(p => p.entry === 'gate/lifecycles/door'), e.name);
    }
  });
  test('evidence.md §questions: a failed misbehaviour witness blocks native claim questions', external, async () => {
    const dir = await fixture({ engine: 'tlc-world', files: {
      [`${P}/boundary.md`]: text => text.replace('| robot | The robot | actor | machine | - |', '| robot | The robot | actor | world | person |'),
      'models/core/world/gate/robot/drop.tla': 'Target == FALSE\n',
    } });
    run(dir);
    const records = await allEvidence(dir, 'core');
    assert.ok(records.some(e => e.kind === 'misbehaviour' && e.found.outcome === 'not reached'));
    assert.ok(records.every(e => !['base', 'fault', 'witness'].includes(e.kind)));
  });
  test('evidence.md §questions: a never-enabled native action blocks claim questions', external, async () => {
    const dir = await nativeFixture('tlc', { files: { 'models/core/Gate.tla': text => text.replace("Reset == n' = 0", 'Reset == FALSE') } });
    run(dir);
    const records = await allEvidence(dir, 'core');
    assert.ok(records.some(e => e.kind === 'enabled' && e.found.outcome === 'not reached'));
    assert.ok(records.every(e => !['base', 'fault', 'witness'].includes(e.kind)));
  });
});

describe('evidence.md §question-names Code-added journeys', () => {
  test('evidence.md §question-names; decisions.md §confirm, §expects: declining an offered journey owes its lifecycle part a repair until its lifecycle changes', async () => {
    const dir = await fixture({ files: {
      [lifePage]: text => text.replace('| Initial | closed |', '| Initial | closed, entered by open |')
        .replace('| closed | opened | closed |', '| closed | closed | opened |'),
    } });
    const offered = 'gate/journeys/reach-door--opened';
    // design.md §pins: this one-row part-list pin is Purpose then Cites.
    const citation = meanings(await snapshot(dir))['gate/claims/safe'].split('\n').find(line => line.startsWith('Cites: '));
    const parts = decision('confirm', 'parts', sha256(`Purpose: Controls a ticket.\n${citation}`), [], '2020-01-02T00:00:00.000Z');
    await writeFiles(dir, { [`design/decisions/${parts.name}.md`]: parts.text });
    const showing = command(dir, ['show', 'decline', offered]);
    const declined = command(dir, ['decide', 'decline', offered, '--shown', showing.token,
      '--words', 'Reset must leave the ticket closed.', '--by', 'Developer',
      '--provider', 'fixture', '--model', 'developer', '--session', 'decliner']);
    const name = declined.recorded[0].split('/').at(-1).replace(/\.md$/, '');
    const repair = command(dir, ['missing']).items.find(item => item.item === `repair:${name}`);
    assert.ok(repair, 'decisions.md §expects gives an offered-journey decline an outstanding repair');
    const packet = await tempFolder('evidence-offered-repair-');
    command(dir, ['give', repair.item, packet]);
    // door.md §gives: the repair packet is the restatement of the lifecycle's part.
    assert.ok(await read(packet, lifePage));
    assert.ok(await read(packet, `${P}/actions.md`));
    await restateChange(dir, {
      [lifePage]: (await read(dir, lifePage)).replace('| closed | closed | opened |', '| closed | closed | closed |'),
    });
    assert.ok(command(dir, ['missing']).items.every(item => item.item !== repair.item));
    assert.ok(await read(dir, declined.recorded[0]), 'the decline record remains after its repair is met');
  });
  test('evidence.md §question-names: a confirmed offered journey has evidence under its reserved key and no page', async () => {
    const dir = await fixture();
    const key = 'reach-door--opened';
    const entry = `gate/journeys/${key}`;
    const page = (await read(dir, positivePage)).replace('# Open once', '# Offered journey')
      .replace('The ticket is open.', 'The ticket reaches opened.')
      .replace('| Origin | stated |', '| Origin | added |')
      .replace('| This ticket |', '| - |');
    const files = { ...await snapshot(dir), [`${P}/journeys/${key}/README.md`]: page };
    const d = decision('confirm', entry, entryPins(files)[entry], [], '2020-01-03T00:00:00.000Z');
    // decisions.md §decision-file, §confirm: a confirmed offered journey is recorded in the
    // decision, after Shown, with its hash recomputed after adding that section.
    const text = `${d.text}\n## Journey\n\n### ${entry}\n\n${page.slice(page.indexOf('| Field'))}`;
    const name = d.name.replace(/[0-9a-f]{12}$/, sha256(text).slice(0, 12));
    await writeFiles(dir, { [`${P}/decisions/${name}.md`]: text });
    run(dir);
    assert.equal((await evidence(dir, `${J}/${key}/lifecycle-path`)).found.outcome, 'admitted');
    assert.equal(await read(dir, `${P}/journeys/${key}/README.md`), null);
  });
});

describe('engines.md §lifecycle-engine, evidence.md §at-ruling Lifecycle traces kept by a ruling', () => {
  for (const entered of [false, true]) {
    test(`engines.md §lifecycle-engine, evidence.md §at-ruling; decisions.md §kept-journeys: a model-wrong ruling keeps a lifecycle trace ${entered ? 'whose entity enters after the first state' : 'from its initial phase'}`, async () => {
      const files = entered ? {
        [lifePage]: text => text.replace('| Initial | closed |', '| Initial | closed, entered by open |')
          .replace('| closed | opened | closed |', '| closed | closed | opened |'),
      } : {};
      const { dir, name, surprise } = await surpriseProject({ files });
      const accepted = await submitExplanation(dir, name, { 'explain.md': explanation(surprise) });
      assert.equal(accepted.status, 0, accepted.stdout);
      const shown = command(dir, ['show', 'rule', name]);
      const result = command(dir, ['decide', 'rule', name, '--shown', shown.token,
        '--verdict', 'model wrong', '--level', 'specification',
        '--words', 'The lifecycle permits a phase forbidden by the claim.', '--by', 'Developer',
        '--provider', 'fixture', '--model', 'developer', '--session', 'lifecycle-ruler']);
      const ruling = await read(dir, result.recorded[0]);
      const section = ruling.split('\n## Kept\n')[1]?.split(`### ${name}\n`)[1];
      assert.ok(section, 'decisions.md §kept-journeys records the kept journey under its surprise heading');
      const rows = Object.fromEntries(section.split('\n')
        .filter(line => /^\|\s*(Journey|Pin|Polarity|Expected end|Refused step|Origin)\s*\|/.test(line))
        .map(line => line.split('|').slice(1, 3).map(cell => cell.trim())));
      const key = `kept-${basisDigest(surprise.basis).slice(0, 12)}`;
      assert.equal(rows.Journey, `gate/journeys/${key}`);
      assert.match(rows.Pin, hash);
      assert.equal(rows.Polarity, 'must not');
      assert.equal(rows['Expected end'], '-');
      assert.equal(rows.Origin, 'added');
      const steps = table(section, 'Step');
      assert.equal(Number(rows['Refused step']), steps.length);
      assert.deepEqual(steps.map(step => step.Action.split('/').at(-1)), entered ? ['open', 'reset'] : ['open']);
      for (const step of steps) {
        assert.equal(step.Actor, 'The robot');
        assert.equal(step.Arguments, '-');
        assert.equal(step.Entity, '-');
        assert.equal(step.Case, '-');
      }
      // decisions.md §kept-journeys omits initial-phase and initially absent entities from Start.
      assert.deepEqual(table(section, 'Lifecycle'), []);
      assert.equal(await read(dir, `${P}/journeys/${key}/README.md`), null);
      assert.equal(await read(dir, `models/${name}.json`), null);
      run(dir);
      const kept = await evidence(dir, `${J}/${key}/lifecycle-path-to-${steps.length - 1}`);
      assert.deepEqual(kept.found, { outcome: 'admitted' });
    });
  }
  test('evidence.md §questions, §at-ruling; decisions.md §in-force: a kept journey follows the ruling in force for its own surprise', async () => {
    const { dir, name, surprise } = await surpriseProject();
    // evidence.md §surprise-file: merging a failure of the same question on another
    // lifecycle basis preserves both. This trace takes reset instead of open,
    // so the kept journeys also have distinct meaning pins (design.md §pins).
    const otherProject = await surpriseProject({ files: {
      [lifePage]: text => text.replace('| closed | opened | closed |', '| closed | closed | opened |'),
    } });
    const other = otherProject.surprise;
    await writeFiles(dir, { [`models/${other.name}.json`]: sealed(other) });
    for (const s of [surprise, other]) {
      const accepted = await submitExplanation(dir, s.name, { 'explain.md': explanation(s) });
      assert.equal(accepted.status, 0, accepted.stdout);
    }
    // decisions.md §rulings permits the developer to rule independent waiting decisions together.
    const both = `${name},${other.name}`;
    const shown = command(dir, ['show', 'rule', both]);
    const result = command(dir, ['decide', 'rule', both, '--shown', shown.token,
      '--verdict', 'model wrong', '--level', 'specification', '--words', 'Repair the same lifecycle defect.',
      '--by', 'Developer', '--provider', 'fixture', '--model', 'developer', '--session', 'combined-ruler']);
    const ruling = await read(dir, result.recorded[0]);
    run(dir);
    const questions = [surprise, other].map(s => `${J}/kept-${basisDigest(s.basis).slice(0, 12)}/lifecycle-path-to-0`);
    for (const question of questions) {
      assert.deepEqual((await evidence(dir, question)).found, { outcome: 'admitted' });
      await changeEvidence(dir, question, e => { e.basis.runtime.version = 'historical-node'; });
    }
    const retained = await read(dir, `models/${questions[1]}.json`);
    // decisions.md §decision-file, §rulings, §in-force: model a merged, later ruling of just the second
    // surprise. Its own showing is hand-written; its Surprises rows keep that
    // surprise's recorded question, basis, entries and pins.
    const at = new Date(Date.parse(fields(ruling).At) + 1).toISOString();
    const later = decision('rule', other.name, null, [
      ['Verdict', 'real finding'], ['Level', 'requirement'], ['Target', 'brief'],
      ['Target pin', '-'], ['Basis', '-'],
    ], at, 'The later finding belongs in the requirement.');
    const surpriseTables = ruling.split('\n## Surprises\n')[1].split('\n## ')[0]
      .split('\n').filter(line => !line.startsWith(`| ${name} |`)).join('\n');
    // decisions.md §decision-file orders Surprises before Shown.
    const text = later.text.replace('\n## Shown\n', `\n## Surprises\n${surpriseTables.trimEnd()}\n\n## Shown\n`);
    const laterName = later.name.replace(/[0-9a-f]{12}$/, sha256(text).slice(0, 12));
    await writeFiles(dir, { [`${P}/decisions/${laterName}.md`]: text });
    const rerun = run(dir);
    assert.ok(rerun.ran.some(row => row.name === questions[0]));
    assert.ok(rerun.ran.every(row => row.name !== questions[1]));
    assert.equal(await read(dir, `models/${questions[1]}.json`), retained);
  });
});

describe('evidence.md §versions Newer open surprises', () => {
  test('evidence.md §versions: a newer open surprise protects its question from an older build', async () => {
    const original = await surpriseProject();
    const dir = await copyWithout(original.dir, [`models/${original.name}.json`]);
    const future = structuredClone(original.surprise);
    future.basis.forma.version = '999.0.0';
    future.basis.engine.version = '999.0.0';
    future.name = `${future.question}.surprise-${basisDigest(future.basis).slice(0, 12)}`;
    await writeFiles(dir, { [`models/${future.name}.json`]: sealed(future) });
    const before = await tracked(dir);
    const r = run(dir);
    assert.ok(r.ran.every(row => row.name !== future.question));
    assert.ok(r.skipped.some(row => row.name === future.question && row.reason === 'written by Forma 999.0.0'));
    assert.deepEqual(await tracked(dir), before);
  });
});

describe('evidence.md §surprise-file Failures after ruling', () => {
  test('evidence.md §surprise-file: a new basis failing after a ruling opens a different surprise', async () => {
    const original = await surpriseProject();
    await explainAndRule(original.dir, original.name, original.surprise);
    await reviseFixture(original.dir, { [encoding]: text => `${text}\n` }, false);
    const r = run(original.dir);
    const next = await evidence(original.dir, original.surprise.question);
    const name = `${next.name}.surprise-${basisDigest(next.basis).slice(0, 12)}`;
    assert.notEqual(name, original.name);
    assert.deepEqual(next.found, original.surprise.found);
    assert.equal(next.matches, false);
    assert.ok(r.opened.includes(name));
    assert.equal(await read(original.dir, `models/${original.name}.json`), null);
  });
});

describe('evidence.md §rerun Reduction reconstruction', () => {
  test('evidence.md §rerun: Explain regenerates a missing reduction run without spending or touching the question run', external, async () => {
    const original = await nativeSurprise('tlc');
    const name = `${original.name}.reduction-1`;
    const reduction = await evidence(original.dir, name);
    const dir = await copyWithout(original.dir, [`runs/${name}`]);
    const before = await tracked(dir);
    const spent = await read(dir, 'work/spent.json');
    const questionRun = await read(dir, `runs/${original.surprise.question}/basis.json`);
    const packet = await tempFolder('evidence-reduction-packet-');
    const r = command(dir, ['give', `explain:${original.name}`, packet]);
    assert.deepEqual(r.differ, []);
    assert.deepEqual(await tracked(dir), before);
    assert.equal(await read(dir, 'work/spent.json'), spent);
    assert.equal(await read(dir, `runs/${original.surprise.question}/basis.json`), questionRun);
    assert.deepEqual((await fileJSON(dir, `runs/${name}/basis.json`)).basis, reduction.basis);
    assert.ok((await tree(packet)).some(p => p.startsWith(`runs/${name}/output/`)));
  });
});

describe('engines.md §composition More native composition', () => {
  test('engines.md §tlc: replacing an action row leaves a model alias of the original action unchanged', external, async () => {
    const dir = await nativeFixture('tlc', { files: {
      'models/core/Gate.tla': text => text.replace('DoorPhase(t) ==', 'Alias == Open\n\nDoorPhase(t) =='),
      'models/core/parts/gate/claims/safe/encoding.tla': 'Invariant == (n = 0) => ENABLED Alias\n',
      'models/core/parts/gate/claims/safe/fault-reopen.md': '| Field | Value |\n| --- | --- |\n| Action | gate/open |\n| Mechanism | Opening is disabled in its action row. |\n\n```tla\nFault == /\\ n\' = n\n         /\\ FALSE\n```\n',
    } });
    const original = await read(dir, 'models/core/Gate.tla');
    run(dir);
    const d = boundsDigest(modelBounds(await read(dir, 'models/core/model.md')));
    const e = await evidence(dir, `core/parts/gate/claims/safe/fault-reopen.${d}`);
    assert.deepEqual(e.found, { outcome: 'no violation' });
    assert.equal(e.matches, false);
    assert.equal(await read(dir, 'models/core/Gate.tla'), original);
  });
  test('engines.md §tlc: a must-not journey refused at step one reaches its empty prefix in the initial state', external, async () => {
    const dir = await nativeFixture('tlc', { files: {
      [negativePage]: text => text.replace('| Refused step | 2 |', '| Refused step | 1 |').replace('| 2 | The robot | open | This ticket again | - | - |\n', ''),
      'models/core/parts/gate/journeys/open-twice/schedule.md': text => text.replace('| 2 | none |\n', ''),
    } });
    run(dir);
    const d = boundsDigest(modelBounds(await read(dir, 'models/core/model.md')));
    const prefix = await evidence(dir, `core/parts/gate/journeys/open-twice/path-to-0.${d}`);
    assert.deepEqual(prefix.expected, { outcome: 'reached', step: 0 });
    assert.deepEqual(prefix.found, { outcome: 'reached' });
    // evidence.md §measures: TLC reports no state count for this initial-state answer.
    assert.equal(prefix.measures.states, null);
    const refusal = await evidence(dir, `core/parts/gate/journeys/open-twice/refusal-at-1.${d}`);
    assert.deepEqual(refusal.expected, { outcome: 'not enabled', step: 1 });
    assert.deepEqual(refusal.found, { outcome: 'enabled' });
  });
  test('engines.md §alloy: a fault copies the imported predicate module and leaves model files unchanged', external, async () => {
    const dir = await nativeFixture('alloy', { files: {
      'models/relational/Gate.als': 'module Gate\nopen State\nopen Actions\n\nfact Behaviour {\n  Ticket.count = 0\n  always (Open or Reset)\n}\n',
      'models/relational/State.als': 'module State\n\nabstract sig Phase {}\none sig closed, opened extends Phase {}\none sig Ticket { var count: one Int }\n\nfun DoorPhase[t: Ticket]: one Phase {\n  t.count = 1 => opened else closed\n}\n',
      'models/relational/Actions.als': 'module Actions\nopen State\n\npred Open {\n  Ticket.count = 0\n  Ticket.count\' = 1\n}\n\npred Reset {\n  Ticket.count\' = 0\n}\n',
    } });
    const sources = {};
    for (const file of ['Gate.als', 'State.als', 'Actions.als']) sources[file] = await read(dir, `models/relational/${file}`);
    run(dir);
    const d = boundsDigest(modelBounds(await read(dir, 'models/relational/model.md')));
    const e = await evidence(dir, `relational/parts/gate/claims/safe/fault-reopen.${d}`);
    assert.deepEqual(e.found, { outcome: 'violation', property: 'Claim' });
    assert.equal(e.matches, true);
    assert.ok(e.basis.files.some(f => f.generated === 'Actions.als'));
    const copy = await read(dir, `runs/${e.name}/inputs/Actions.als`);
    const slot = await read(dir, 'models/relational/parts/gate/claims/safe/fault-reopen.md');
    const native = slot.split('```alloy\n')[1].split('```')[0].trimEnd();
    assert.ok(copy.includes(native));
    for (const [file, bytes] of Object.entries(sources)) assert.equal(await read(dir, `models/relational/${file}`), bytes);
  });
});

describe('evidence.md §reductions Reduction bounds retained', () => {
  test('evidence.md §reductions: TLC reductions retain constraint and choose rows unchanged', external, async () => {
    const { dir, name, surprise } = await nativeSurprise('tlc', { files: {
      'models/core/Gate.tla': text => text.replace('DoorPhase(t) ==', 'Pick == CHOOSE x \\in {0, 1} : TRUE\n\nDoorPhase(t) =='),
      'models/core/model.md': text => text.replace('between resets |', 'between resets |\n| constraint | n <= 2 | at most two attempts |\n| choose Pick | - | one of two markers is selected; the other is unexplored |'),
    } });
    for (const [number, count] of [[1, '1'], [2, '0']]) {
      assert.deepEqual((await evidence(dir, `${name}.reduction-${number}`)).bounds, { ...surprise.bounds, 'constant Count': count });
    }
    assert.equal(await read(dir, `models/${name}.reduction-3.json`), null);
  });
});

describe('evidence.md §removed Wider removals', () => {
  test('evidence.md §removed: removing a part clears its thing, action and world evidence together', external, async () => {
    const dir = await fixture({ engine: 'tlc-world', files: {
      [`${P}/boundary.md`]: text => text.replace('| robot | The robot | actor | machine | - |', '| robot | The robot | actor | world | person |'),
    } });
    run(dir);
    await writeFiles(dir, { 'design/README.md': 'An unaccepted front page.\n' });
    const folder = await answerFolder({
      'design/README.md': '# Empty design\n\n| Part | Purpose | Cites |\n| --- | --- | --- |\n',
      'removed.md': `${P}\n`,
    });
    const r = forma(dir, ['answer', 'change:design/README.md', folder, ...explainer, '--json']);
    assert.equal(r.status, 0, r.stdout);
    const paths = await tree(dir);
    for (const prefix of ['models/core/parts/gate/', 'models/core/actions/gate/', 'models/core/world/gate/', `models/${L}/parts/gate/`]) {
      assert.ok(paths.every(p => !p.startsWith(prefix)), prefix);
    }
  });
  test('evidence.md §removed: a Model answer dropping a part removes its slots and evidence on that model', external, async () => {
    const dir = await nativeFixture('tlc');
    run(dir);
    await reviseFixture(dir, {
      'design/README.md': text => text.replace('| gate | Controls a ticket. | design/brief/gate.md#gate |', '| gate | Controls a ticket. | design/brief/gate.md#gate |\n| auxiliary | Holds an unused boundary. | design/brief/gate.md#gate |'),
      'design/parts/auxiliary/README.md': '# Auxiliary\n',
      'design/parts/auxiliary/actions.md': '# Actions\n\n| Action | Actor | Sentence | Cases | Guard | Origin | Cites |\n| --- | --- | --- | --- | --- | --- | --- |\n',
      'design/parts/auxiliary/boundary.md': '# Boundary\n',
      'design/parts/auxiliary/omissions.md': '# Omissions\n\n| Passage | Reason |\n| --- | --- |\n',
    }, false);
    const path = 'models/core/model.md';
    const model = (await read(dir, path)).replace('| Parts | gate |', '| Parts | auxiliary |')
      .replace('| gate/open | Open | none |\n', '').replace('| gate/reset | Reset | none |\n', '')
      .replace('| gate/door | t \\in Tickets | DoorPhase(t) |\n', '');
    const sourcePath = 'models/core/Gate.tla';
    const source = await read(dir, sourcePath);
    // door.md §change / models.md §parts-change to §one-model-first: keep model.md counting so the answer
    // drops the model's recorded part instead of becoming its first model.
    await writeFiles(dir, { [sourcePath]: 'unaccepted edit\n' });
    const folder = await answerFolder({ [path]: model, [sourcePath]: source });
    const r = forma(dir, ['answer', `change:${sourcePath}`, folder, ...explainer, '--json']);
    assert.equal(r.status, 0, r.stdout);
    const paths = await tree(dir);
    assert.ok(paths.every(p => !p.startsWith('models/core/parts/gate/')));
    assert.ok(paths.every(p => !p.startsWith('models/core/actions/gate/')));
    assert.ok(await read(dir, `models/${C}/base.json`));
  });
});

describe('engines.md §alloy Schedule entity cardinality', () => {
  for (const count of ['none', 'several']) {
    test(`engines.md §alloy: an Alloy schedule naming ${count} atoms does not reach its path`, external, async () => {
      const dir = await nativeFixture('alloy', { files: count === 'none' ? {
        'models/relational/parts/gate/journeys/open-once/schedule.md': text => text.replace('| door | Ticket |', '| door | none |'),
      } : {
        'models/relational/Gate.als': text => text.replace('one sig Ticket', 'sig Ticket') + '\nfact TwoTickets { #Ticket = 2 }\n',
      } });
      run(dir);
      const d = boundsDigest(modelBounds(await read(dir, 'models/relational/model.md')));
      assert.deepEqual((await evidence(dir, `relational/facts.${d}`)).found, { outcome: 'reached' });
      assert.deepEqual((await evidence(dir, `relational/parts/gate/journeys/open-once/path.${d}`)).found, { outcome: 'not reached' });
    });
  }
});

describe('engines.md §composition Operator-only cases', () => {
  for (const engine of ['tlc', 'alloy']) {
    test(`engines.md §composition: ${engine} lists each case step that no lifecycle column checks`, external, async () => {
      const dir = await nativeFixture(engine, { files: {
        [`${P}/actions.md`]: text => text.replace('| Open the ticket. | none |', '| Open the ticket. | approved, rejected |'),
        [positivePage]: text => text.replace('| - | - |', '| - | approved |'),
        [negativePage]: text => text.replaceAll('| - | - |', '| - | approved |'),
        [lifePage]: text => text.replace('| Unaffected | none |', '| Unaffected | open |')
          .replace('| Phase | open | reset |', '| Phase | reset |').replace('| --- | --- | --- |', '| --- | --- |')
          .replace('| closed | opened | closed |', '| closed | opened |').replace('| opened | None. | closed |', '| opened | closed |'),
        [encoding]: '| Field | Value |\n| --- | --- |\n| Cannot express | Phase does not record opening. |\n',
      } });
      run(dir);
      const model = modelFor(engine);
      const d = boundsDigest(modelBounds(await read(dir, `models/${model}/model.md`)));
      assert.deepEqual((await evidence(dir, `${model}/parts/gate/journeys/open-once/path.${d}`)).cases, [1]);
      assert.deepEqual((await evidence(dir, `${model}/parts/gate/journeys/open-twice/path-to-1.${d}`)).cases, [1]);
      assert.deepEqual((await evidence(dir, `${model}/parts/gate/journeys/open-twice/refusal-at-2.${d}`)).cases, [1, 2]);
    });
  }
});

describe('engines.md §trace Native bindings', () => {
  for (const engine of ['tlc', 'alloy']) {
    test(`engines.md §trace: ${engine} records the engine-evaluated parameter binding of a witness step`, external, async () => {
      const model = modelFor(engine);
      const files = engine === 'tlc' ? {
        'models/core/Gate.tla': text => text.replace('Open ==', 'Open(t) =='),
        'models/core/model.md': text => text.replace('| gate/open | Open | none |', '| gate/open | Open | t \\in Tickets |'),
        'models/core/parts/gate/claims/safe/fault-reopen.md': text => text.replace('Fault ==', 'Fault(t) =='),
      } : {
        'models/relational/Gate.als': text => text.replace('pred Open {', 'pred Open[t: Ticket] {').replace('always (Open or Reset)', 'always ((some t: Ticket | Open[t]) or Reset)'),
        'models/relational/model.md': text => text.replace('| gate/open | Open | none |', '| gate/open | Open | t: Ticket |'),
        'models/relational/parts/gate/claims/safe/fault-reopen.md': text => text.replace('pred Fault {', 'pred Fault[t: Ticket] {'),
      };
      for (const journey of ['open-once', 'open-twice']) files[`models/${model}/parts/gate/journeys/${journey}/schedule.md`] =
        text => text.replaceAll('| none |', `| t = ${engine === 'tlc' ? '"ticket"' : 'Ticket'} |`);
      const dir = await nativeFixture(engine, { files });
      run(dir);
      const witness = (await allEvidence(dir, model)).find(e => e.kind === 'witness');
      const row = witness.trace.states.flatMap(state => state.rows ?? []).find(row => row.action === 'gate/open');
      assert.ok(row);
      keys(row.bindings, ['t']);
      assert.equal(typeof row.bindings.t, 'string');
      assert.ok(row.bindings.t.length);
    });
  }
});

describe('engines.md §lifecycle-engine, evidence.md §flags Unspecified lifecycle cells', () => {
  test('engines.md §lifecycle-engine, evidence.md §flags: an unpicked posed cell admits every phase and is flagged open', async () => {
    const choice = '# Reset outcome\n\n| Field | Value |\n| --- | --- |\n| Question | Does resetting a closed ticket open it? |\n| Recommendation | a: retain the closed phase. |\n| Cites | design/brief/gate.md#gate |\n\n';
    const alternative = (name, end, outcome) => `## ${name}\n\n| Field | Value |\n| --- | --- |\n| Polarity | should happen |\n| Expected end | ${end} |\n| Refused step | - |\n\n| Step | Actor | Action | Arguments | Entity | Case |\n| --- | --- | --- | --- | --- | --- |\n| 1 | The robot | reset | This ticket | - | - |\n\n| Lifecycle | Phase | Action | Outcome |\n| --- | --- | --- | --- |\n| door | closed | reset | ${outcome} |\n\n`;
    const dir = await passing({ files: {
      [lifePage]: text => text.replace('| closed | opened | closed |', '| closed | opened | choice:reset-outcome |'),
      [`${P}/choices/reset-outcome/README.md`]: choice + alternative('a', 'The ticket is closed.', 'closed') + alternative('b', 'The ticket is open.', 'opened'),
      [`models/${C}/witness-open.md`]: '| Field | Value |\n| --- | --- |\n| Meaning | Resetting a closed ticket can open it. |\n\n| Lifecycle | From | Action | To |\n| --- | --- | --- | --- |\n| door | closed | reset | opened |\n',
    } });
    assert.equal((await evidence(dir, `${C}/witness-open`)).found.outcome, 'reached');
    assert.ok((await evidence(dir, `${C}/base`)).flags.includes('open-pair door/closed/reset'));
    // account.md §items: a posed cell's flag is owed by its pick, not a Restate.
    const items = command(dir, ['missing']).items;
    assert.ok(items.some(item => item.item === 'pick:gate/choices/reset-outcome'));
    assert.ok(items.every(item => item.item !== 'restate:gate' || item.why !== 'flagged'));
  });
});

describe('engines.md §alloy Phase observers', () => {
  for (const expression of ['none', 'closed + opened']) {
    test(`engines.md §alloy: Alloy phases reject ${expression} instead of exactly one phase`, external, async () => {
      const dir = await nativeFixture('alloy', { files: {
        'models/relational/model.md': text => text.replace('| DoorPhase[t] |', `| ${expression} |`),
      } });
      run(dir);
      const d = boundsDigest(modelBounds(await read(dir, 'models/relational/model.md')));
      assert.equal((await evidence(dir, `relational/facts.${d}`)).found.outcome, 'reached');
      assert.deepEqual((await evidence(dir, `relational/phases.${d}`)).found, { outcome: 'violation', property: 'phases' });
    });
  }
  test('engines.md §alloy, §trace: Alloy observes every action predicate holding for the same step', external, async () => {
    const dir = await nativeFixture('alloy', { files: {
      'models/relational/Gate.als': text => text.replace("pred Reset {\n  Ticket.count' = 0", "pred Reset {\n  Ticket.count' = 0 or Ticket.count' = 1"),
    } });
    run(dir);
    const witness = (await allEvidence(dir, 'relational')).find(e => e.kind === 'witness');
    const step = witness.trace.states.find(s => s.rows?.some(r => r.action === 'gate/open'));
    assert.ok(step);
    assert.deepEqual(sorted(step.rows.map(r => r.action)), ['gate/open', 'gate/reset']);
  });
});

describe('evidence.md §questions, engines.md §alloy Alloy world rows', () => {
  const worldFiles = { [`${P}/boundary.md`]: text => text.replace('| robot | The robot | actor | machine | - |', '| robot | The robot | actor | world | person |') };
  test('evidence.md §questions, §question-names, engines.md §alloy: every Alloy world-menu witness and enabled question uses its fixed path', external, async () => {
    const dir = await fixture({ engine: 'alloy-world', files: worldFiles });
    run(dir);
    const d = boundsDigest(modelBounds(await read(dir, 'models/relational/model.md')));
    for (const item of ['drop', 'duplicate', 'delay', 'reorder', 'fail-forever', 'fail-then-succeed', 'crash', 'go-silent']) {
      for (const suffix of [`${item}.${d}`, `${item}.enabled.${d}`]) {
        const e = await evidence(dir, `relational/world/gate/robot/${suffix}`);
        assert.deepEqual(e.expected, { outcome: 'reached' });
        assert.deepEqual(e.found, { outcome: 'reached' });
        assert.equal(e.matches, true);
        assert.ok(e.basis.entries.some(p => p.entry === 'gate/boundary/robot'));
      }
    }
  });
  test('engines.md §alloy: Alloy excludes struck world steps even when its own facts permit them', external, async () => {
    const dir = await fixture({ engine: 'alloy-world', files: { ...worldFiles,
      'models/relational/parts/gate/claims/safe/encoding.als': 'assert Claim { always Ticket.last != 1 }\n',
    } });
    const strike = decision('carry', 'strike:gate/robot/drop', sha256('Strike: drop at The robot'),
      [['Choice', 'carry'], ['Basis', '-']], '2020-01-03T00:00:00.000Z', 'an observed drop at The robot');
    await writeFiles(dir, { [`${P}/decisions/${strike.name}.md`]: strike.text });
    const r = run(dir);
    assert.ok(r.ran.every(row => !row.name.startsWith('relational/world/gate/robot/drop.')));
    const e = (await allEvidence(dir, 'relational')).find(e => e.kind === 'base');
    assert.deepEqual(e.found, { outcome: 'no violation' });
    assert.equal(e.matches, true);
  });
});

describe('evidence.md §rerun Stale-slot replay', () => {
  test('evidence.md §rerun: Explain replays a frozen slot even when its claim pin makes it owed again', external, async () => {
    const original = await nativeSurprise('tlc');
    const dir = await copyWithout(original.dir, ['runs']);
    const receiptPath = 'models/core/parts/gate/claims/safe/receipt';
    const oldReceipt = await read(dir, receiptPath);
    await reviseFixture(dir, { [claimPage]: text => text.replace('Opening an open ticket never changes it.', 'The robot never opens a ticket.') }, false);
    await writeFiles(dir, { [receiptPath]: oldReceipt });
    const missing = command(dir, ['missing']);
    // account.md §items: even an owed-again slot waits for its open surprise's ruling.
    const slot = missing.items.find(item => item.item === 'slot:core/parts/gate/claims/safe/encoding');
    assert.equal(slot?.why, 'owed-again');
    assert.ok(slot.waits.includes(`rule:${original.name}`));
    const before = await tracked(dir);
    const spent = await read(dir, 'work/spent.json');
    const packet = await tempFolder('evidence-stale-slot-');
    command(dir, ['give', `explain:${original.name}`, packet]);
    assert.ok((await tree(packet)).some(p => p.startsWith(`runs/${original.surprise.question}/output/`)));
    assert.deepEqual(await tracked(dir), before);
    assert.equal(await read(dir, 'work/spent.json'), spent);
  });
});

describe('engines.md §tlc, §trace Temporal traces', () => {
  for (const stutter of [false, true]) {
    test(`engines.md §tlc, §trace: TLC retains a temporal counterexample ${stutter ? 'ending in stutter' : 'with its closing loop rows'}`, external, async () => {
      const fairness = stutter ? 'Fairness == WF_vars(Open)\n' : 'Fairness == /\\ WF_vars(Open)\n            /\\ WF_vars(Reset)\n';
      const dir = await nativeFixture('tlc', { files: {
        [claimPage]: text => text.replace('| Kind | safety |', '| Kind | liveness |').replace('| Rests on | none |', '| Rests on | fair |'),
        [`${P}/premises/fair/README.md`]: '# Fair actions\n\n| Field | Value |\n| --- | --- |\n| Statement | Continuously available actions eventually happen. |\n| Class | fairness |\n| Why not examined | not verifiable here |\n| Falsifier | An available action is ignored forever. |\n| Provider | The scheduler |\n| Origin | stated |\n| Cites | design/brief/gate.md#gate |\n',
        [encoding]: '| Field | Value |\n| --- | --- |\n| Cannot express | Phase safety cannot express eventual progress. |\n',
        'models/core/Gate.tla': text => stutter ? text.replace("Reset == n' = 0", "Reset == /\\ n = 0\n         /\\ n' = 0") : text,
        'models/core/model.md': text => text.replace('between resets |', 'between resets |\n| constraint | n <= 1 | a safety-only cutoff |'),
        'models/core/parts/gate/claims/safe/encoding.tla': `Property == <>(n = 2)\n${fairness}`,
      } });
      const r = run(dir);
      const name = r.opened.find(n => n.startsWith('core/parts/gate/claims/safe/base.'));
      assert.ok(name);
      const s = await evidence(dir, name);
      assert.deepEqual(s.found, { outcome: 'violation', property: 'Property' });
      if (stutter) assert.equal(s.trace.loop, 'stutter');
      else {
        keys(s.trace.loop, ['to', 'rows']);
        assert.ok(Number.isInteger(s.trace.loop.to) && s.trace.loop.to >= 0 && s.trace.loop.to < s.trace.states.length);
        assert.ok(s.trace.loop.rows.length > 0);
      }
      for (const e of await allEvidence(dir, 'core')) {
        if (['base', 'fault', 'witness', 'reduction'].includes(e.kind)) assert.equal(Object.hasOwn(e.bounds, 'constraint'), false);
      }
      const accepted = await submitExplanation(dir, name, {
        'explain.md': explanation(s, { Weaker: 'open-eventually' }),
        'weaker/open-eventually.tla': `Property == <>(n = 1)\n${fairness}`,
      });
      assert.equal(accepted.status, 0, accepted.stdout);
      run(dir);
      const weaker = await evidence(dir, `${name}.weaker-open-eventually`);
      assert.equal(Object.hasOwn(weaker.bounds, 'constraint'), false);
      assert.equal(weaker.found.outcome, 'no violation');
    });
  }
  test('engines.md §tlc: a type invariant conjunct is attributed to its containing invariant', external, async () => {
    const dir = await nativeFixture('tlc', { files: {
      'models/core/Gate.tla': text => text.replace('EXTENDS Naturals', 'EXTENDS Integers').replace('TypeOK == n \\in 0..Count', 'TypeOK == /\\ n \\in -1..Count\n          /\\ n >= 0'),
      'models/core/parts/gate/claims/safe/fault-reopen.md': text => text.replace("n' = n + 1", "n' = -1"),
    } });
    run(dir);
    const e = (await allEvidence(dir, 'core')).find(e => e.kind === 'fault' && !e.question);
    assert.deepEqual(e.found, { outcome: 'violation', property: 'TypeOK' });
    assert.equal(e.matches, false);
  });
});

describe('evidence.md §measures to §flags Additional Alloy reporting', () => {
  // evidence.md §flags: bounds follow the command summary and the language
  // server's multiplicities, which do not expose an extension's parent.
  for (const [label, declaration, scope] of [
    ['private signature at the default bound', 'private sig Spare {}', '1'],
    ['subset of a singleton', 'one sig Parent {}\nsig Spare in Parent {}', '3'],
  ]) {
    test(`evidence.md §flags: Alloy flags a tiny ${label}`, external, async () => {
      const dir = await nativeFixture('alloy', { files: {
        'models/relational/Gate.als': text => `${text}\n${declaration}\n`,
        'models/relational/model.md': text => text.replace('| scope | 3 |', `| scope | ${scope} |`),
      } });
      run(dir);
      const e = (await allEvidence(dir, 'relational')).find(e => e.kind === 'base');
      assert.ok(e.flags.includes('tiny-scope'));
    });
  }
  test('evidence.md §measures: omitted Alloy steps and integer bitwidth have null measures', external, async () => {
    const dir = await nativeFixture('alloy', { files: {
      'models/relational/model.md': text => text.split('\n').filter(line => !line.startsWith('| steps |') && !line.startsWith('| int |')).join('\n'),
    } });
    run(dir);
    const e = (await allEvidence(dir, 'relational')).find(e => e.kind === 'base');
    assert.equal(e.measures.steps, null);
    assert.equal(e.measures.bitwidth, null);
  });
  test('evidence.md §measures: an Alloy scope without a default number reports null scope', external, async () => {
    const dir = await nativeFixture('alloy', { files: { 'models/relational/model.md': text => text.replace('| scope | 3 |', '| scope | exactly 1 Ticket |') } });
    run(dir);
    const e = (await allEvidence(dir, 'relational')).find(e => e.kind === 'base');
    assert.equal(e.measures.scope, null);
  });
});

describe('evidence.md §own-check Unicode serialization', () => {
  test('evidence.md §own-check: rendered Unicode remains literal while quotes and backslashes use canonical JSON escapes', async () => {
    const dir = await passing({ files: {
      [`${P}/actions.md`]: text => text.replace('Open the ticket.', 'Open the café ticket and say "yes" at C:\\door.'),
    } });
    const raw = await read(dir, `models/${C}/witness-open.json`);
    const e = checkEvidenceBytes(raw);
    assert.ok(raw.includes('café'));
    assert.ok(!raw.includes('caf\\u00e9'));
    assert.ok(e.rendered.some(row => row.content.includes('Open the café ticket and say "yes" at C:\\door.')));
  });
});

describe('evidence.md §reductions Independent reduction caps', () => {
  test('evidence.md §reductions: two open surprises each receive their own six reductions', external, async () => {
    const source = await snapshot(await project('evidence/tlc'));
    source['models/core/model.md'] = source['models/core/model.md'].replace('| constant Count | 2 |', '| constant Count | 9 |');
    source['models/core/parts/gate/claims/safe/encoding.tla'] = 'Invariant == n = 0\n';
    const files = { ...source };
    for (const [path, bytes] of Object.entries(source)) files[path.replace('models/core/', 'models/second/')] = bytes;
    const dir = await fixture({ files });
    const r = run(dir);
    const names = r.opened.filter(name => /^(core|second)\/parts\/gate\/claims\/safe\/base\./.test(name));
    assert.equal(names.length, 2);
    for (const name of names) {
      for (let n = 1; n <= 6; n++) {
        const e = await evidence(dir, `${name}.reduction-${n}`);
        assert.equal(e.reduces, name);
        assert.equal(e.bounds['constant Count'], String(9 - n));
      }
      assert.equal(await read(dir, `models/${name}.reduction-7.json`), null);
    }
  });
});

describe('evidence.md §currency Historical currency', () => {
  test('evidence.md §currency: a folder diff judges historical evidence by its recorded versions and project inputs', async () => {
    const dir = await passing();
    const earlier = await project(null, await snapshot(dir));
    await changeEvidence(earlier, `${C}/base`, e => {
      e.basis.runtime.version = 'historical-node';
      e.basis.forma.source = '0'.repeat(12);
      e.basis.files.find(f => f.generated).sha256 = '0'.repeat(64);
    });
    // account.md §diff, linked by evidence.md §currency: historical comparison checks
    // project-file hashes and entry pins, without current versions/composition.
    const result = command(dir, ['diff', earlier]);
    assert.deepEqual(result.stale, []);
    assert.deepEqual(result.changedOutcome, []);
    assert.deepEqual(result.opened, []);
    assert.deepEqual(result.closed, []);
  });
});

describe('evidence.md §weaker, §explain, §forma-run Weaker run allowance', () => {
  test('evidence.md §weaker, §explain, §forma-run: an accepted weaker form waits for a run allowance and then spends exactly one run', external, async () => {
    const { dir, name, surprise } = await nativeSurprise('tlc');
    await writeFiles(dir, { 'work/spent.json': '{"answers":0,"runs":100}\n' });
    const accepted = await submitExplanation(dir, name, {
      'explain.md': explanation(surprise, { Weaker: 'weak' }),
      'weaker/weak.tla': 'Invariant == TRUE\n',
    });
    assert.equal(accepted.status, 0, accepted.stdout);
    assert.ok(await read(dir, `models/${name}.weaker-weak.tla`));
    assert.equal(await read(dir, `models/${name}.weaker-weak.json`), null);
    const stalled = run(dir);
    assert.deepEqual(stalled.ran, []);
    assert.ok(stalled.skipped.some(row => row.name === `${name}.weaker-weak` && row.reason === 'no run left'));
    command(dir, ['decide', 'allow', '--runs', '1', '--by', 'Developer',
      '--provider', 'fixture', '--model', 'developer', '--session', 'allow-one']);
    const resumed = run(dir);
    assert.deepEqual(resumed.ran.map(row => row.name), [`${name}.weaker-weak`]);
    assert.deepEqual(resumed.runs, { spent: 101, left: 0 });
  });
});

describe('evidence.md §moved Picked journey moves', () => {
  test('evidence.md §moved: re-filing a choice moves both picked journeys without rerunning them', async () => {
    const choice = '# Opening direction\n\n| Field | Value |\n| --- | --- |\n| Question | Should the robot open or reset first? |\n| Recommendation | a: open first. |\n| Cites | design/brief/gate.md#gate |\n\n' +
      ['a', 'b'].map((key, n) => `## ${key}\n\n| Field | Value |\n| --- | --- |\n| Polarity | should happen |\n| Expected end | The first operation is complete. |\n| Refused step | - |\n\n| Step | Actor | Action | Arguments | Entity | Case |\n| --- | --- | --- | --- | --- | --- |\n| 1 | The robot | gate/${n ? 'reset' : 'open'} | This ticket | - | - |\n\n`).join('');
    const files = {
      'design/README.md': text => text.replace('| gate | Controls a ticket. | design/brief/gate.md#gate |', '| gate | Controls a ticket. | design/brief/gate.md#gate |\n| alpha | First filing. | design/brief/gate.md#gate |\n| beta | Second filing. | design/brief/gate.md#gate |'),
      'design/parts/alpha/choices/direction/README.md': choice,
    };
    for (const part of ['alpha', 'beta']) {
      files[`design/parts/${part}/README.md`] = `# ${part}\n`;
      files[`design/parts/${part}/actions.md`] = '# Actions\n\n| Action | Actor | Sentence | Cases | Guard | Origin | Cites |\n| --- | --- | --- | --- | --- | --- | --- |\n';
      files[`design/parts/${part}/boundary.md`] = '# Boundary\n';
      files[`design/parts/${part}/omissions.md`] = '# Omissions\n\n| Passage | Reason |\n| --- | --- |\n';
    }
    const dir = await fixture({ files });
    const shown = command(dir, ['show', 'pick', 'alpha/choices/direction']);
    command(dir, ['decide', 'pick', 'alpha/choices/direction', '--shown', shown.token, '--choice', 'a', '--by', 'Developer',
      '--provider', 'fixture', '--model', 'developer', '--session', 'picker']);
    run(dir);
    const suffixes = ['direction-a/lifecycle-path', 'direction-not-b/lifecycle-path-to-0'];
    const before = {};
    for (const suffix of suffixes) before[suffix] = await evidence(dir, `${L}/parts/alpha/journeys/${suffix}`);
    await restateChange(dir, {
      'removed.md': 'design/parts/alpha/choices/direction\n',
      'design/parts/beta/choices/direction/README.md': choice,
    });
    for (const suffix of suffixes) {
      const e = await evidence(dir, `${L}/parts/beta/journeys/${suffix}`);
      assert.deepEqual(e.found, before[suffix].found);
      assert.equal(e.established, before[suffix].established);
      assert.equal(await read(dir, `models/${L}/parts/alpha/journeys/${suffix}.json`), null);
    }
    assert.ok(run(dir).ran.every(row => !row.name.startsWith(`${L}/parts/beta/journeys/`)));
  });
});

describe('evidence.md §removed Individual row removals', () => {
  test('evidence.md §removed: removing one action removes its evidence and retains other stale evidence', external, async () => {
    const dir = await nativeFixture('tlc');
    run(dir);
    const base = (await allEvidence(dir, 'core')).find(e => e.kind === 'base');
    const before = await read(dir, `models/${base.name}.json`);
    await restateChange(dir, {
      [`${P}/actions.md`]: (await read(dir, `${P}/actions.md`)).split('\n').filter(line => !line.startsWith('| reset |')).join('\n'),
      [lifePage]: (await read(dir, lifePage)).replace('| Ends | none |', '| Ends | opened |')
        .replace('| Phase | open | reset |', '| Phase | open |').replace('| --- | --- | --- |', '| --- | --- |')
        .replace('| closed | opened | closed |', '| closed | opened |').replace('| opened | None. | closed |', '| opened | None. |'),
    });
    const paths = await tree(dir);
    assert.ok(paths.every(p => !p.startsWith('models/core/actions/gate/reset.')));
    assert.ok(paths.some(p => p.startsWith('models/core/actions/gate/open.')));
    assert.equal(await read(dir, `models/${base.name}.json`), before);
  });
  test('evidence.md §removed: removing one world row removes its witnesses and evidence', external, async () => {
    const dir = await fixture({ engine: 'tlc-world', files: {
      [`${P}/boundary.md`]: text => text.replace('| robot | The robot | actor | machine | - |', '| robot | The robot | actor | world | person |'),
    } });
    run(dir);
    await restateChange(dir, {
      [`${P}/boundary.md`]: (await read(dir, `${P}/boundary.md`))
        .replace('| robot | The robot | actor | world | person |', '| controller | The robot | actor | machine | - |')
        .replace('| robot | robot | stated |', '| controller | controller | stated |'),
      [`${P}/actions.md`]: (await read(dir, `${P}/actions.md`)).replaceAll('| robot |', '| controller |'),
    });
    assert.ok((await tree(dir)).every(p => !p.startsWith('models/core/world/gate/robot/')));
  });
});

// These integration tests exercise the account and door rules that determine
// whether evidence can be asked, counted, repaired or handed to an explainer.
describe('evidence.md §currency to §forma-run Revised account and door integration', () => {
  for (const folder of ['work', 'runs']) {
    for (const state of ['missing', 'altered']) {
      test(`evidence.md §runs / door.md §change item 7: ${state} ${folder}/.gitignore is no change item`, async () => {
        const original = await passing();
        const before = command(original, ['account']);
        const path = `${folder}/.gitignore`;
        const dir = await copyWithout(original, [path]);
        if (state === 'altered') await writeFiles(dir, { [path]: 'local scratch rule\n' });
        const trackedBefore = await tracked(dir);
        // account.md §what-it-is, §commands: scratch ignores affect neither standing nor items.
        const missing = command(dir, ['missing']);
        assert.ok(missing.items.every(item => item.item !== `change:${path}`));
        assert.deepEqual(command(dir, ['account']), before);
        assert.deepEqual(await tracked(dir), trackedBefore);
      });
    }
  }

  test('evidence.md §currency / account.md §commands: reading evidence writes nothing', async () => {
    const original = await passing();
    const dir = await copyWithout(original, ['work']);
    // account.md §commands, door.md §lock: a read writes nothing, so it makes no work/ either.
    const before = await snapshot(dir);
    command(dir, ['account']);
    assert.deepEqual(await snapshot(dir), before);
  });

  for (const kind of ['witness', 'fault']) {
    test(`evidence.md §questions / door.md §forma-give: a filled claim still gives an optional ${kind} packet`, async () => {
      const dir = await passing();
      const item = `slot:${C}/${kind}`;
      assert.ok(command(dir, ['missing']).items.every(row => row.item !== item));
      const packet = await tempFolder('evidence-optional-slot-');
      const before = await tracked(dir);
      const result = command(dir, ['give', item, packet]);
      assert.equal(result.item, item);
      // door.md §gives: optional slots receive the claim and its other accepted slots.
      assert.equal(await read(packet, claimPage), await read(dir, claimPage));
      assert.equal(await read(packet, encoding), await read(dir, encoding));
      for (const contract of ['door', 'account', 'models', 'design', 'evidence']) {
        assert.equal(await read(packet, `forma/${contract}.md`), await read(repo, `spec/${contract}.md`));
      }
      assert.deepEqual(await tracked(dir), before);
    });
  }

  test('evidence.md §currency / presentation.md §reading: an accepted unestablished claim is listed under Accepted', async () => {
    const dir = await passing();
    const on = 'gate/claims/safe';
    const d = decision('accept', on, entryPins(await snapshot(dir))[on], [['Choice', 'accept']],
      '2020-01-03T00:00:00.000Z', 'The bounded checks are sufficient for this prototype.');
    await writeFiles(dir, { [`${P}/claims/safe/decisions/${d.name}.md`]: d.text });
    const part = command(dir, ['account', 'gate']).parts.find(p => p.ref === 'gate');
    assert.ok(part);
    keys(part, ['ref', 'name', 'span', 'open', 'accepted', 'established', 'assumed', 'decided', 'leftOut', 'lifecycles']);
    const claim = part.accepted.find(entry => entry.ref === on);
    assert.ok(claim);
    assert.equal(claim.standing, 'accepted');
    assert.deepEqual(claim.acceptance, { decision: d.name,
      words: 'The bounded checks are sufficient for this prototype.', by: 'Fixture developer', at: '2020-01-03T00:00:00.000Z' });
    assert.ok(claim.models.some(model => model.model === L && model.fails.length > 0));
    assert.ok(part.open.every(entry => entry.ref !== on));
    assert.ok(part.established.every(entry => entry.ref !== on));
    const text = forma(dir, ['account', 'gate']);
    assert.equal(text.status, 0, text.stderr);
    const headings = text.stdout.split('\n').filter(line => /^### (Open|Accepted|Established)$/.test(line));
    assert.deepEqual(headings, ['### Open', '### Accepted', '### Established']);
  });

  test('evidence.md §result-says / forms.md §premise-says: a lifecycle bound premise states its limit and provider', async () => {
    const dir = await passing();
    const premiseName = `bound:${L}/gate/safe`;
    const statement = `Beyond phase level on ${L}: Opening an open ticket never changes it.`;
    const reading = command(dir, ['account', 'gate']);
    const premise = reading.parts.find(p => p.ref === 'gate').assumed.find(p => p.premise === premiseName);
    assert.ok(premise);
    assert.equal(premise.class, 'bound');
    assert.equal(premise.statement, statement);
    assert.equal(premise.falsifier, '-');
    // forms.md §premise-says fixes the displayed provider; presentation.md §reading does not
    // allocate it a JSON key, so inspect text without inventing such a key.
    const display = forma(dir, ['account', 'gate']);
    assert.equal(display.status, 0, display.stderr);
    assert.ok(display.stdout.includes("the developer's carry"));
    const claimPin = entryPins(await snapshot(dir))['gate/claims/safe'];
    // decisions.md §carry: exact canonical bound premise pin.
    const pin = sha256(`Model: ${L}\nClaim: ${claimPin}\nBound: phase level`);
    const d = decision('carry', premiseName, pin, [['Choice', 'carry'], ['Basis', '-']],
      '2020-01-03T00:00:00.000Z', 'A data value changes the result without changing phase.');
    await writeFiles(dir, { [`${P}/decisions/${d.name}.md`]: d.text });
    const box = command(dir, ['box']);
    const carried = box.premises.find(p => p.premise === premiseName);
    assert.ok(carried);
    assert.equal(carried.statement, statement);
    assert.equal(carried.falsifier, 'A data value changes the result without changing phase.');
    const boxText = forma(dir, ['box']);
    assert.equal(boxText.status, 0, boxText.stderr);
    assert.ok(boxText.stdout.includes("the developer's carry"));
  });

  test('evidence.md §currency / design.md §restate-applied: an existing failure outside held pages does not refuse Restate', async () => {
    const dir = await passing();
    await reviseFixture(dir, { [claimPage]: text => text.replace('| Rests on | none |', '| Rests on | absent-premise |') }, false);
    const original = await read(dir, `models/${J}/open-once/lifecycle-path.json`);
    const revised = (await read(dir, positivePage)).replace('The ticket is open.', 'The ticket has reached its open phase.');
    await restateChange(dir, { [positivePage]: revised });
    assert.equal(await read(dir, positivePage), revised);
    // evidence.md §removed, §currency: an accepted edit stales, but does not remove, evidence.
    assert.equal(await read(dir, `models/${J}/open-once/lifecycle-path.json`), original);
    const account = command(dir, ['account', 'gate/journeys/open-once']);
    assert.ok(account.thing.evidence.some(e => e.question === `${J}/open-once/lifecycle-path` && !e.current));
  });

  test('evidence.md §currency / design.md §restate-applied: a held page with an existing failure still refuses Restate', async () => {
    const dir = await passing();
    await reviseFixture(dir, { [claimPage]: text => text.replace('| Rests on | none |', '| Rests on | absent-premise |') }, false);
    const before = await tracked(dir);
    const folder = await answerFolder({ [claimPage]: await read(dir, claimPage) });
    const result = forma(dir, ['answer', 'restate:gate', folder, ...explainer, '--json']);
    assertRefused(result, 'design.md §restate');
    assert.ok(result.json.reasons.some(reason => reason.file === claimPage));
    assert.deepEqual(await tracked(dir), before);
  });

  test('evidence.md §currency / design.md §restate-applied: a newly broken reference outside the answer refuses Restate', async () => {
    const dir = await passing();
    const frontPath = `${P}/README.md`;
    const front = await read(dir, frontPath);
    await writeFiles(dir, { [frontPath]: `${front}\nUnaccepted editor text.\n` });
    const before = await tracked(dir);
    const actionsPath = `${P}/actions.md`;
    const actions = (await read(dir, actionsPath)).split('\n').filter(line => !line.startsWith('| open |')).join('\n');
    const folder = await answerFolder({ [frontPath]: front, [actionsPath]: actions });
    const result = forma(dir, ['answer', `change:${frontPath}`, folder, ...explainer, '--json']);
    assertRefused(result, 'design.md §restate');
    assert.ok(result.json.reasons.some(reason => [positivePage, negativePage, lifePage].includes(reason.file)));
    assert.deepEqual(await tracked(dir), before);
  });
});

describe('evidence.md §currency to §surprises Ruling-directed model repairs', () => {
  async function ruled(verdict) {
    const setup = await surpriseProject();
    const { dir, name, surprise } = setup;
    const explained = await submitExplanation(dir, name, { 'explain.md': explanation(surprise, { Verdict: verdict }) });
    assert.equal(explained.status, 0, explained.stderr || explained.stdout);
    const showing = command(dir, ['show', 'rule', name]);
    const ruling = command(dir, ['decide', 'rule', name, '--shown', showing.token, '--verdict', verdict,
      '--level', 'specification', '--words', 'Revise what forbids an opened ticket.', '--by', 'Developer',
      '--provider', 'fixture', '--model', 'developer', '--session', 'repair-ruler']);
    const decisionName = ruling.recorded[0].split('/').at(-1).replace(/\.md$/, '');
    // account.md §items always appends the model, even for one model.
    const item = `repair:${decisionName}/${L}`;
    assert.ok(command(dir, ['missing']).items.some(row => row.item === item));
    return { ...setup, item, decisionName };
  }
  const repairText = '| Field | Value |\n| --- | --- |\n| Mechanism | Allow the "opened" phase on C:\\tickets — α. |\n';

  test('evidence.md §currency to §surprises / models.md §model-repair: property wrong accepts an encoding-only repair and owes its question again', async () => {
    const { dir, item, decisionName, surprise } = await ruled('property wrong');
    const originalModel = await read(dir, lifePage);
    const packet = await tempFolder('evidence-property-repair-');
    command(dir, ['give', item, packet]);
    // door.md §gives: either repair kind's inputs, including decisions.md.
    for (const contract of ['door', 'account', 'design', 'models', 'evidence', 'decisions']) {
      assert.equal(await read(packet, `forma/${contract}.md`), await read(repo, `spec/${contract}.md`));
    }
    assert.equal(await read(packet, claimPage), await read(dir, claimPage));
    assert.equal(await read(packet, encoding), await read(dir, encoding));
    const revised = '| Lifecycle | From | Action | To |\n| --- | --- | --- | --- |\n| door | opened | open | closed |\n';
    const folder = await answerFolder({ [encoding]: revised, 'repair.md': repairText });
    const accepted = command(dir, ['answer', item, folder, ...explainer]);
    assert.equal(accepted.accepted, true);
    assert.equal(await read(dir, lifePage), originalModel);
    const receiptText = await read(dir, `models/${C}/receipt`);
    assert.ok(receiptText.endsWith('\n'));
    const lines = receiptText.slice(0, -1).split('\n');
    // door.md §receipts fixes JSON.stringify's exact bytes, including Unicode/escaping.
    for (const line of lines) assert.equal(line, JSON.stringify(JSON.parse(line)));
    const receipt = lines.map(line => JSON.parse(line)).find(line => line.file === 'encoding.md');
    orderedKeys(receipt, ['file', 'sha256', 'at', 'session', 'authors', 'pins', 'answers', 'mechanisms', 'before']);
    assert.deepEqual(receipt.mechanisms, [{ decision: decisionName, mechanism: fields(repairText).Mechanism }]);
    assert.ok(receipt.answers.includes(decisionName));
    const missing = command(dir, ['missing']).items;
    assert.ok(missing.every(row => row.item !== item));
    assert.ok(missing.some(row => row.item === `run:${surprise.question}`));
  });

  test('evidence.md §currency to §surprises / models.md §model-repair: property wrong refuses an encoding repair that also changes model files', async () => {
    const { dir, item } = await ruled('property wrong');
    const before = await tracked(dir);
    const folder = await answerFolder({
      [encoding]: '| Lifecycle | From | Action | To |\n| --- | --- | --- | --- |\n| door | opened | open | closed |\n',
      [lifePage]: `${await read(dir, lifePage)}\n`, 'repair.md': repairText,
    });
    assertRefused(forma(dir, ['answer', item, folder, ...explainer, '--json']), 'models.md §model-repair');
    assert.deepEqual(await tracked(dir), before);
  });

  test('evidence.md §currency to §surprises / models.md §model-repair: changing only an unread slot cannot meet a model repair', async () => {
    const { dir, item, surprise } = await ruled('model wrong');
    const path = `models/${C}/witness-open.md`;
    assert.ok(surprise.basis.files.every(file => file.path !== path));
    const before = await tracked(dir);
    const folder = await answerFolder({ [path]: `${await read(dir, path)}\n`, 'repair.md': repairText });
    assertRefused(forma(dir, ['answer', item, folder, ...explainer, '--json']), 'models.md §model-repair');
    assert.deepEqual(await tracked(dir), before);
  });

  test('evidence.md §currency to §surprises / door.md §gives: property wrong also accepts a Restate repair for the same item', async () => {
    const { dir, item, decisionName } = await ruled('property wrong');
    const originalEncoding = await read(dir, encoding);
    const revised = (await read(dir, claimPage)).replace('Opening an open ticket never changes it.', 'Resetting a ticket always closes it.');
    const folder = await answerFolder({ [claimPage]: revised, 'repair.md': repairText });
    const result = command(dir, ['answer', item, folder, ...explainer]);
    assert.equal(result.accepted, true);
    assert.equal(await read(dir, claimPage), revised);
    assert.equal(await read(dir, encoding), originalEncoding);
    // decisions.md §rulings, §expects: changing the claim's pin meets property wrong.
    assert.ok(command(dir, ['missing']).items.every(row => row.item !== item));
    const receipt = (await read(dir, `${P}/claims/safe/receipt`)).trimEnd().split('\n').map(JSON.parse)
      .find(line => line.file === 'README.md');
    assert.ok(receipt.answers.includes(decisionName));
  });

  test('evidence.md §lifecycle-journeys, §at-ruling / models.md §model-repair: a real finding on a journey repairs its model without a claim fault', async () => {
    const dir = await fixture({ unconfirmed: ['gate/journeys/open-twice'], files: {
      [lifePage]: text => text.replace('| closed | opened | closed |', '| closed | None. | closed |'),
    } });
    const opened = run(dir).opened;
    const name = opened.find(value => value.startsWith(`${J}/open-once/lifecycle-path.surprise-`));
    assert.ok(name);
    const surprise = await evidence(dir, name);
    const explained = await submitExplanation(dir, name, { 'explain.md': explanation(surprise, { Verdict: 'real finding' }) });
    assert.equal(explained.status, 0, explained.stderr || explained.stdout);
    const shown = command(dir, ['show', 'rule', name]);
    const ruling = command(dir, ['decide', 'rule', name, '--shown', shown.token,
      '--verdict', 'real finding', '--level', 'specification', '--target', L,
      '--words', 'The model must admit opening a closed ticket.', '--by', 'Developer',
      '--provider', 'fixture', '--model', 'developer', '--session', 'journey-ruler']);
    const decisionName = ruling.recorded[0].split('/').at(-1).replace(/\.md$/, '');
    const item = `repair:${decisionName}/${L}`;
    const repaired = (await read(dir, lifePage)).replace('| closed | None. | closed |', '| closed | opened | closed |');
    const folder = await answerFolder({ [lifePage]: repaired, 'repair.md': repairText });
    const result = command(dir, ['answer', item, folder, ...explainer]);
    assert.equal(result.accepted, true);
    assert.ok(result.written.every(file => !file.path.includes('/fault-')));
    assert.ok(command(dir, ['missing']).items.every(row => row.item !== item));
    // models.md §model-repair / decisions.md §expects: the repaired lifecycle's receipt meets
    // the ruling. Its changed meaning awaits confirmation before another run.
    const receipt = (await read(dir, `${P}/lifecycles/door/receipt`)).trimEnd().split('\n').map(JSON.parse)
      .find(line => line.file === 'README.md');
    assert.ok(receipt.answers.includes(decisionName));
    assert.ok(command(dir, ['missing']).items.some(row => row.item === 'confirm:gate/lifecycles/door'));
  });
});

describe('evidence.md §running / models.md §one-model-first Another engine without unanswered evidence', () => {
  for (const source of ['tlc', 'alloy']) {
    for (const sameEngine of [false, true]) {
      test(`evidence.md §running / models.md §one-model-first: a cannot-express ${source} model ${sameEngine ? 'refuses a split on the same engine' : 'permits a split on another engine'}`, external, async () => {
        const sourceModel = modelFor(source);
        const target = sameEngine ? source : source === 'tlc' ? 'alloy' : 'tlc';
        const templateModel = modelFor(target);
        const targetModel = sameEngine ? `${sourceModel}-small` : templateModel;
        const cannot = '| Field | Value |\n| --- | --- |\n| Cannot express | This abstraction cannot express the claim. |\n';
        // forms.md §part-readme, §part-tables: a second part may have no things or tables.
        // The original model covers both; the answer covers only gate, a split.
        const dir = await nativeFixture(source, { files: {
          'design/README.md': text => text.replace('\n\n1.', '\n| auxiliary | Supplies context for the gate. | design/brief/gate.md#gate |\n\n1.'),
          'design/parts/auxiliary/README.md': '# Auxiliary\n',
          [`models/${sourceModel}/model.md`]: text => text.replace('| Parts | gate |', '| Parts | auxiliary, gate |'),
          [encoding]: cannot,
          [`models/${sourceModel}/parts/gate/claims/safe/encoding.${source === 'tlc' ? 'tla' : 'als'}`]: null,
          [`models/${sourceModel}/parts/gate/claims/safe/encoding.md`]: cannot,
        } });
        const item = 'express:gate/claims/safe';
        assert.ok(command(dir, ['missing']).items.some(row => row.item === item));
        // No engine has run: the new exception cannot rest on unanswered evidence.
        assert.ok((await tree(dir)).every(path => !path.startsWith('models/') || !path.endsWith('.json')));
        const template = await project(`evidence/${target}`);
        const answer = {};
        for (const name of ['model.md', `Gate.${target === 'tlc' ? 'tla' : 'als'}`]) {
          answer[`models/${targetModel}/${name}`] = await read(template, `models/${templateModel}/${name}`);
        }
        const folder = await answerFolder(answer);
        const before = await tracked(dir);
        const result = forma(dir, ['answer', item, folder, ...explainer, '--json']);
        if (sameEngine) {
          assertRefused(result, 'models.md');
          assert.deepEqual(await tracked(dir), before);
        } else {
          assert.equal(result.status, 0, result.stderr || result.stdout);
          assert.equal(result.json.accepted, true);
          assert.equal(await read(dir, `models/${targetModel}/model.md`), answer[`models/${targetModel}/model.md`]);
        }
      });
    }
  }
});

// evidence.md §questions, engines.md §tlc to §alloy, evidence.md §outcomes, §keys, §surprise-file: taking every step is insufficient
// when the schedule's reading of Expected end fails in the final state.
describe('evidence.md §outcomes expected ends', () => {
  for (const [engine, start] of [['tlc', false], ['tlc', true], ['alloy', false]]) {
    test(`evidence.md §outcomes: ${engine} ${start ? 'with a start' : 'without a start'} opens a surprise when only the steps succeed`, external, async () => {
      const model = modelFor(engine);
      const schedule = `models/${model}/parts/gate/journeys/open-once/schedule.md`;
      const dir = await nativeFixture(engine, { files: {
        [positivePage]: text => text.replace('The ticket is open.', 'The ticket is closed.')
          .replace('| Step | Actor |', (start
            ? '| Lifecycle | Entity | Phase |\n| --- | --- | --- |\n| door | door | closed |\n\n' : '') + '| Step | Actor |'),
        [schedule]: text => text.replace('The ticket is open.', 'The ticket is closed.')
          .replace(engine === 'tlc' ? 'End == n = 1' : 'pred End { Ticket.count = 1 }',
            engine === 'tlc' ? 'End == n = 0' : 'pred End { Ticket.count = 0 }')
          .replace('| Step | Bindings |', (start ? '| Start |\n| --- |\n| n = 0 |\n\n' : '') + '| Step | Bindings |'),
      } });
      const result = run(dir);
      const name = result.opened.find(n => n.startsWith(`${model}/parts/gate/journeys/open-once/path.`));
      assert.ok(name, 'the final-state mismatch opens a path surprise');
      const surprise = await evidence(dir, name);
      const found = { outcome: 'not reached', ...(engine === 'tlc' && !start
        ? { reason: 'the expected end does not hold after step 1' } : {}) };
      assert.deepEqual(surprise.found, found);
      const path = await evidence(dir, surprise.question);
      assert.deepEqual(path.expected, { outcome: 'reached' });
      assert.deepEqual(path.found, found);
      assert.equal(path.matches, false);
      // evidence.md §lifecycle-journeys: the lifecycle engine still checks steps without End.
      assert.equal((await evidence(dir, `${J}/open-once/lifecycle-path`)).found.outcome, 'admitted');
      // presentation.md §showings, decisions.md §rulings: even a traceless path surprise shows its entire slot,
      // including the end predicate and its developer-facing Meaning.
      const explained = await submitExplanation(dir, name, { 'explain.md': explanation(surprise) });
      assert.equal(explained.status, 0, explained.stdout);
      const shown = command(dir, ['show', 'rule', name]).shown;
      const bytes = await read(dir, schedule);
      assert.ok(shown.includes(`Slot ${schedule}:\n${bytes.trimEnd().split('\n').map(line => `  ${line}`).join('\n')}`));
    });
  }
});

// engines.md §trace, presentation.md §rendering: TLC stops before the enabled refused step; its saved
// journey supplies that step to the rendering. Alloy takes it in the trace.
describe('presentation.md §rendering refused-step rendering', () => {
  for (const engine of ['tlc', 'alloy']) {
    test(`presentation.md §rendering: ${engine} renders the enabled refused step after the admitted prefix`, external, async () => {
      const dir = await nativeFixture(engine, { files: {
        [negativePage]: text => text.replace('| 2 | The robot | open | This ticket again |', '| 2 | The robot | reset | This ticket again |'),
      } });
      const result = run(dir);
      const name = result.opened.find(n => n.startsWith(`${modelFor(engine)}/parts/gate/journeys/open-twice/refusal-at-2.`));
      assert.ok(name);
      const surprise = await evidence(dir, name);
      assert.deepEqual(surprise.found, { outcome: 'enabled' });
      const entry = 'gate/journeys/open-twice';
      const content = meanings(await snapshot(dir))[entry];
      assert.deepEqual(surprise.rendered.find(row => row.entry === entry), { entry, pin: sha256(content), content });
      // presentation.md §reading exposes the rendered journey separately from actions,
      // entry pages and the agent's explanation: these words must be in it.
      const account = command(dir, ['account', 'gate']);
      const open = account.parts.flatMap(part => part.open).find(row => row.surprise === name);
      assert.ok(open);
      const rendered = JSON.stringify(open.journey);
      assert.ok(rendered.includes('Open the ticket.'));
      assert.ok(rendered.includes('Reset the ticket.'));
      assert.ok(rendered.includes('enabled'));
      assert.ok(rendered.indexOf('Open the ticket.') < rendered.lastIndexOf('Reset the ticket.'));
    });
  }
});

// evidence.md §forma-run: run and surprise lines precede the final summary; removals
// are labelled too. This sync harness checks lines, not wall-clock delivery.
describe('evidence.md §forma-run progress line content', () => {
  test('evidence.md §forma-run: a mismatch prints its run, surprise and last summary', async () => {
    const dir = await fixture({ files: { [encoding]: '| Lifecycle | Phase |\n| --- | --- |\n| door | opened |\n' } });
    const result = forma(dir, ['run']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const lines = result.stdout.trimEnd().split('\n');
    const runAt = lines.findIndex(line => line.startsWith(`${C}/base: violation`));
    assert.ok(runAt >= 0);
    assert.match(lines[runAt], /not as expected, .+ ms, wrote$/);
    const surpriseAt = lines.findIndex(line => line.startsWith(`surprise ${C}/base.surprise-`));
    assert.ok(surpriseAt >= 0);
    assert.ok(runAt < lines.length - 1);
    assert.match(lines.at(-1), /^runs: \d+ spent here, \d+ left$/);
    assert.ok(surpriseAt < lines.length - 1);
  });
  test('evidence.md §forma-run: a merged closed surprise prints removed paths before its summary', async () => {
    const { dir, name, surprise } = await surpriseProject();
    const path = `models/${name}.json`, raw = await read(dir, path);
    await explainAndRule(dir, name, surprise);
    await writeFiles(dir, { [path]: raw });
    const result = forma(dir, ['run']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const lines = result.stdout.trimEnd().split('\n');
    assert.ok(lines.includes(`removed ${path}`));
    assert.match(lines.at(-1), /^runs: \d+ spent here, \d+ left$/);
    assert.equal(await read(dir, path), null);
  });
});
