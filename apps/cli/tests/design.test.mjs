import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { project, answerFolder, forma, read, writeFiles, snapshot, tree, sha256, hasToolchain } from './helpers/forma.mjs';

// Deliberately unspecified: presentation.md §reading does not fix nested
// page/table/facts/move representations, and decisions.md §forma-show
// does not fix the shape inside `pins`. Assertions below use fixed outer forms,
// decision Pin fields, structured picture facts and finding codes, without inventing schemas.
// No supported CLI/harness operation forces the internal tool failure in
// lifecycle-tool.md §findings / design.md §restate-checks. Internal-brief symlink deduplication
// (design.md §brief) also lacks a harness operation: project() resolves copied symlinks
// to their original fixture paths, outside the temporary project's brief.

const CITE = 'design/brief/overview.md#system';
const WORK = 'passage:design/brief/work.md#work';
const PART = 'design/parts/alpha/';
const LIFE = `${PART}lifecycles/ticket/README.md`;
const AT = '2000-01-01T00:00:00.000Z';
const AUTHOR = { provider: 'fixture', model: 'author', session: 'answer-session' };
const BASE = await snapshot(await project('design/base'));

// forms.md §page-rules specifies these hand-written field/table fixture forms.
function table(columns, rows) {
  return `| ${columns.join(' | ')} |\n| ${columns.map(() => '---').join(' | ')} |\n${rows.map(row => `| ${row.join(' | ')} |\n`).join('')}`;
}
function fields(rows) { return table(['Field', 'Value'], rows); }
function page(title, rows, rest = '') { return `# ${title}\n\n${fields(rows)}${rest ? `\n${rest}` : ''}`; }
function claim(overrides = {}) {
  return page('Ticket safety', Object.entries({ Sentence: 'A closed ticket stays closed.', Kind: 'safety', Stake: 'A client loses its ticket.', 'Rests on': 'none', Parts: 'alpha', Origin: 'stated', Cites: CITE, ...overrides }));
}
function premise(overrides = {}) {
  return page('Reliable client', Object.entries({ Statement: 'The client eventually retries.', Class: 'fairness', 'Why not examined': 'not verifiable here', Falsifier: 'The client never retries.', Provider: 'The client operator', Origin: 'stated', Cites: CITE, ...overrides }));
}
function journey(overrides = {}, steps = [[1, 'Client', 'open', '-', '-', '-']], starts = []) {
  return page('Opening a ticket', Object.entries({ Polarity: 'should happen', 'Expected end': 'The ticket is active.', 'Refused step': '-', Origin: 'stated', Cites: CITE, ...overrides }),
    (starts.length ? `${table(['Lifecycle', 'Entity', 'Phase'], starts)}\n` : '') + table(['Step', 'Actor', 'Action', 'Arguments', 'Entity', 'Case'], steps));
}
function lifecycle(overrides = {}, rows = [['idle', 'active', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']], actions = ['open', 'close']) {
  return page('Ticket state', Object.entries({ Entity: 'ticket', Initial: 'idle', Ends: 'closed', Unaffected: 'none', Origin: 'stated', Cites: CITE, ...overrides }), table(['Phase', ...actions], rows));
}
function choice(overrides = {}, a = {}, b = {}, effectsA = [], effectsB = []) {
  const alt = (values, defaultAction, effects) => fields(Object.entries({ Polarity: 'should happen', 'Expected end': 'The operation completes.', 'Refused step': '-', ...(values.fields ?? {}) })) + '\n' +
    (values.starts?.length ? table(['Lifecycle', 'Entity', 'Phase'], values.starts) + '\n' : '') +
    table(['Step', 'Actor', 'Action', 'Arguments', 'Entity', 'Case'], values.steps ?? [[1, 'Client', defaultAction, '-', '-', '-']]) +
    (effects.length ? '\n' + table(['Lifecycle', 'Phase', 'Action', 'Outcome'], effects) : '');
  return page('Which operation?', Object.entries({ Question: 'Which operation should happen?', Recommendation: 'a: Opening is useful.', Cites: CITE, ...overrides }),
    `## a\n\n${alt(a, 'open', effectsA)}\n## b\n\n${alt(b, 'close', effectsB)}`);
}

// door.md §receipts: receipt bytes, digest, author and accepting entry.
async function receiptFiles(dir, files) {
  const folders = new Map();
  for (const [path, content] of Object.entries(files)) {
    if (content === null || !path.startsWith('design/') || path.startsWith('design/brief/') || path.includes('/decisions/') || !path.endsWith('.md')) continue;
    const at = path.lastIndexOf('/');
    const folder = path.slice(0, at);
    const line = { file: path.slice(at + 1), sha256: sha256(content), at: AT, session: AUTHOR, authors: [AUTHOR] };
    if (!folders.has(folder)) folders.set(folder, []);
    folders.get(folder).push(JSON.stringify(line));
  }
  await writeFiles(dir, Object.fromEntries([...folders].map(([folder, lines]) => [`${folder}/receipt`, lines.sort().join('\n') + '\n'])));
}

// decisions.md §decision-file, §kinds, §intake: hand-written intake,
// including SHA-256 of Shown's content with its final line feed.
function intakeFiles() {
  const shown = 'Design new; allow 1000 answers and 100 runs.\n';
  const text = page('intake intake', [
    ['Kind', 'intake'], ['On', 'intake'], ['Pin', sha256(shown)], ['Situation', 'design new'],
    ['Answers', '1000'], ['Runs', '100'], ['TLC seconds', '30'], ['TLC megabytes', '256'],
    ['Alloy seconds', '30'], ['Alloy megabytes', '256'], ['Lifecycle seconds', '30'],
    ['Cadence', 'span'], ['Inbox cap', '7'], ['Provider', '-'], ['Model', '-'], ['Session', '-'],
    ['By', 'Fixture developer'], ['At', AT],
  ], '## Words\n\n```text\nExternal integrations are out of scope because this is a small design.\n```\n\n## Shown\n\n```text\n' + shown + '```\n');
  return { [`design/decisions/20000101T000000Z-intake-${sha256(text).slice(0, 12)}.md`]: text };
}
async function setup(overrides = {}, { base = true, receipts = true } = {}) {
  // door.md §change, §copies: an accepted design fixture also has
  // the required git attributes, avoiding unrelated change: items on every read.
  const files = { ...(base ? BASE : {}), 'design/.gitattributes': '* -text -ident -filter -working-tree-encoding\nreceipt merge=union\nbrief/** !text !ident !filter !working-tree-encoding !merge\n', ...overrides, ...intakeFiles() };
  for (const path of Object.keys(files)) if (files[path] === null) delete files[path];
  const dir = await project(null, files);
  if (receipts) await receiptFiles(dir, files);
  return dir;
}
// project.md §commands: successful status and one JSON object with --json.
function ok(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.ok(result.json && typeof result.json === 'object' && !Array.isArray(result.json), result.stdout);
  return result.json;
}
function query(dir, args) { return ok(forma(dir, [...args, '--json'])); }
// account.md §commands fixes missing.items and the item fields used throughout.
function items(dir) { const json = query(dir, ['missing']); assert.ok(Array.isArray(json.items)); return json.items; }
// presentation.md §reading fixes every outer reading/entry field inspected below;
// account.md §items fixes item names and why values, and account.md §commands fixes item objects.
function account(dir, scope) { return query(dir, ['account', ...(scope ? [scope] : [])]); }
async function submit(dir, files, item = WORK) {
  const folder = await answerFolder(files);
  return forma(dir, ['answer', item, folder, '--provider', 'fixture', '--model', 'author', '--session', 'answer-session', '--json']);
}
// door.md §forma-answer fixes the answer envelope; door.md §receipts fixes SHA-256 form.
function accepted(result) {
  const json = ok(result);
  assert.deepEqual(Object.keys(json).sort(), ['accepted', 'answers', 'item', 'kind', 'reasons', 'removed', 'written']);
  assert.equal(json.accepted, true, JSON.stringify(json.reasons));
  assert.deepEqual(json.reasons, []);
  assert.ok(['restate', 'repair', 'slot', 'model', 'explain'].includes(json.kind));
  for (const file of json.written) {
    assert.deepEqual(Object.keys(file).sort(), ['path', 'sha256']);
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
  }
  assert.deepEqual(Object.keys(json.answers).sort(), ['allowed', 'spent']);
  return json;
}
// door.md §forma-answer fixes reasons; design.md §restate-applied preserves all tracked
// files on refusal. work/ and runs/ are scratch (project.md §tree).
async function rejected(dir, files, { file, field, entry, item = WORK } = {}) {
  const before = await snapshot(dir, { skip: ['work', 'runs'] });
  const result = await submit(dir, files, item);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.ok(result.json, result.stderr || result.stdout);
  assert.equal(result.json.accepted, false);
  assert.ok(result.json.reasons.length > 0);
  for (const reason of result.json.reasons) {
    assert.deepEqual(Object.keys(reason).sort(), ['check', 'entry', 'field', 'file', 'says']);
    assert.match(reason.check, /\.md §[a-z]/);
    assert.equal(typeof reason.says, 'string');
  }
  if (file !== undefined || field !== undefined || entry !== undefined) {
    assert.ok(result.json.reasons.some(reason => (file === undefined || reason.file === file) && (field === undefined || reason.field === field) && (entry === undefined || reason.entry === entry)), JSON.stringify(result.json.reasons));
  }
  assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
  return result.json;
}
async function decide(dir, kind, on, options = []) {
  const showing = query(dir, ['show', kind, on]);
  return query(dir, ['decide', kind, on, '--shown', showing.token, '--by', 'Test developer', '--provider', 'fixture', '--model', 'reviewer', '--session', 'developer-session', ...options]);
}
async function confirmParts(dir) { return decide(dir, 'confirm', 'parts'); }
// decisions.md §decision-file exposes Pin, with forms.md §page-rules table-cell and
// column rules. Its spelling and padding are not a serialization contract.
function fieldValue(text, name) {
  const rows = text.split('\n').filter(line => line.includes('|')).map(line => {
    let cells = line.trim().split(/(?<!\\)\|/);
    if (cells[0] === '') cells.shift();
    if (cells.at(-1) === '') cells.pop();
    return cells.map(cell => {
      let value = cell.trim().replace(/\\\|/g, '|');
      const span = value.match(/^(`+)([\s\S]*?)\1$/);
      if (span) {
        value = span[2].replace(/\r\n?|\n/g, ' ');
        if (value.startsWith(' ') && value.endsWith(' ') && /[^ ]/.test(value)) value = value.slice(1, -1);
      }
      return value;
    });
  });
  const header = rows.findIndex(row => row.some(cell => cell.toLowerCase() === 'field') && row.some(cell => cell.toLowerCase() === 'value'));
  if (header < 0) return undefined;
  const field = rows[header].findIndex(cell => cell.toLowerCase() === 'field');
  const value = rows[header].findIndex(cell => cell.toLowerCase() === 'value');
  return rows.slice(header + 2).find(row => row[field]?.toLowerCase() === name.toLowerCase())?.[value];
}
// decisions.md §forma-decide gives recorded paths; decisions.md §kinds gives a confirmation's Pin.
async function decisionPin(dir, result) {
  assert.equal(result.recorded.length, 1);
  const text = await read(dir, result.recorded[0]);
  assert.ok(text);
  const pin = fieldValue(text, 'Pin');
  assert.match(pin, /^[a-f0-9]{64}$/, text);
  return pin;
}

describe('design.md §paths owned paths', () => {
  test('design.md §paths a page without an accepting receipt counts for nothing', async () => {
    // design.md §paths; door.md §change: an unreceipted page contributes no unit.
    const dir = await setup({}, { receipts: false });
    const missing = items(dir);
    assert.ok(missing.some(i => i.item === `change:${LIFE}`));
    assert.ok(!missing.some(i => i.item === 'confirm:alpha/lifecycles/ticket'));
  });
  test('design.md §paths an accepted page has its exact bytes and an accepting receipt', async () => {
    // design.md §paths, §removal; door.md §receipts: page bytes and their receipt hash.
    const dir = await setup();
    const path = `${PART}claims/safe/README.md`;
    const text = claim();
    const result = accepted(await submit(dir, { [path]: text }));
    assert.ok(result.written.some(f => f.path === path && f.sha256 === sha256(text)));
    assert.equal(await read(dir, path), text);
    const lines = (await read(dir, `${PART}claims/safe/receipt`)).trim().split('\n').map(JSON.parse);
    assert.ok(lines.some(l => l.file === 'README.md' && l.sha256 === sha256(text)));
  });
  test('design.md §paths editing an accepted page directly removes its contribution', async () => {
    // design.md §paths; door.md §change: directly edited bytes have no accepting entry.
    const dir = await setup();
    await writeFiles(dir, { [LIFE]: BASE[LIFE].replace('Ticket state', 'Changed title') });
    assert.ok(items(dir).some(i => i.item === `change:${LIFE}`));
  });
});

describe('design.md §brief the brief', () => {
  test('design.md §brief a symlink to an outside Markdown file is read at the link path', async () => {
    // design.md §brief, §passages; presentation.md §reading: passage address and coverage counts.
    const dir = await project('design/links', intakeFiles());
    const passages = items(dir).filter(i => i.item.startsWith('passage:'));
    assert.deepEqual(passages.map(i => i.item), ['passage:design/brief/external.MD#linked-document']);
    assert.deepEqual(account(dir).project.coverage, { passages: 1, covered: 0 });
  });
  test('design.md §brief Markdown extensions are case insensitive and other files are ignored without receipts', async () => {
    // design.md §brief: Markdown-only, case-insensitive discovery, no brief writes or receipt checks.
    const files = {
      'design/brief/nested/NOTE.Md': '# Nested\n\nA document.\n',
      'design/brief/ignored.txt': '# Ignored\n',
      'design/brief/ignored.json': '{"text":"ignored"}',
    };
    const dir = await setup(files);
    const before = await snapshot(`${dir}/design/brief`);
    const passages = items(dir).filter(i => i.item.startsWith('passage:')).map(i => i.item);
    assert.ok(passages.includes('passage:design/brief/nested/NOTE.Md#nested'));
    assert.ok(!passages.some(i => i.includes('ignored')));
    assert.deepEqual(await snapshot(`${dir}/design/brief`), before);
    assert.ok(!(await tree(`${dir}/design/brief`)).some(p => p.endsWith('receipt')));
  });
  test('design.md §brief front matter is excluded and CommonMark tables remain paragraphs', async () => {
    // design.md §brief, §passages: front matter contributes neither passages nor canonical text.
    const text = '---\ntitle: Metadata\n---\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n';
    const path = 'design/brief/table.md';
    const dir = await setup({ [path]: text });
    const found = items(dir).filter(i => i.item.startsWith(`passage:${path}`));
    assert.deepEqual(found.map(i => i.item), [`passage:${path}`]);
    const result = accepted(await submit(dir, { 'design/README.md': BASE['design/README.md'].replace(CITE, path) }));
    assert.equal(result.accepted, true);
    const pin = await decisionPin(dir, await confirmParts(dir));
    // design.md §pins: the parts pin contains the paragraph's canonical passage hash.
    assert.equal(pin, sha256(`Purpose: Manages tickets.\nCites: ${sha256('| A | B | | --- | --- | | 1 | 2 |')}`));
  });
  for (const date of ['2024-02-29', '2024-02', '2024', 'unknown']) {
    test(`design.md §brief a source with complete string provenance and date ${date} is citable`, async () => {
      // design.md §brief; design.md §restate-checks: all four nonblank strings and an allowed date make a source citable.
      const src = `---\ntitle: Source\nauthor: Writer\ndate: "${date}"\norigin: Saved by the developer from a supplied note.\n---\n# Source\n\nA source statement.\n`;
      const dir = await setup({ 'design/brief/sources/source.md': src });
      accepted(await submit(dir, { [`${PART}claims/source/README.md`]: claim({ Cites: 'design/brief/sources/source.md#source' }) }));
    });
  }
  for (const [label, front] of [
    ['missing title', 'author: Writer\ndate: "2024"\norigin: Saved by developer'],
    ['missing author', 'title: Source\ndate: "2024"\norigin: Saved by developer'],
    ['missing date', 'title: Source\nauthor: Writer\norigin: Saved by developer'],
    ['missing origin', 'title: Source\nauthor: Writer\ndate: "2024"'],
    ['nonstring title', 'title: 42\nauthor: Writer\ndate: "2024"\norigin: Saved'],
    ['nonstring author', 'title: Source\nauthor: false\ndate: "2024"\norigin: Saved'],
    ['nonstring date', 'title: Source\nauthor: Writer\ndate: 2024\norigin: Saved'],
    ['nonstring origin', 'title: Source\nauthor: Writer\ndate: "2024"\norigin: [Saved]'],
    ...['title', 'author', 'date', 'origin'].flatMap(field => ['', ' \t '].map(value => [
      `${value === '' ? 'empty' : 'whitespace-only'} ${field}`,
      Object.entries({ title: 'Source', author: 'Writer', date: '2024', origin: 'Saved by developer', [field]: value })
        .map(([key, text]) => `${key}: ${JSON.stringify(text)}`).join('\n'),
    ])),
    ...['2023-02-29', '2024-13', '2024-04-31', '24-01-01', 'yesterday'].map(d => [`invalid date ${d}`, `title: Source\nauthor: Writer\ndate: "${d}"\norigin: Saved`]),
  ]) {
    test(`design.md §brief ${label} prevents citation but permits omission coverage`, async () => {
      // design.md §brief, §coverage, forms.md §omissions: uncitable sources still require coverage, including omissions.
      const addr = 'design/brief/sources/source.md#source';
      const dir = await setup({ 'design/brief/sources/source.md': `---\n${front}\n---\n# Source\n\nA statement.\n` });
      assert.ok(items(dir).some(i => i.item === `passage:${addr}`));
      const path = `${PART}claims/source/README.md`;
      await rejected(dir, { [path]: claim({ Cites: addr }) }, { file: path, field: 'Cites' });
      accepted(await submit(dir, { [`${PART}omissions.md`]: '# Left out\n\n' + table(['Passage', 'Reason'], [[addr, 'Provenance is incomplete.']]) }));
      assert.ok(!items(dir).some(i => i.item === `passage:${addr}`));
    });
  }
});

describe('design.md §passages passages', () => {
  test('design.md §passages opening text and top-level headings of every level delimit passages', async () => {
    // design.md §passages: only top-level headings start sections; opening text has the bare path.
    const path = 'design/brief/sections.md';
    const dir = await setup({ [path]: 'Opening.\n\n# One\n\n> ## Quoted\n> Quote.\n\n- ### Listed\n  List text.\n\n## Two\n\nText.\n\nSetext\n------\n\n#### Four\n' });
    assert.deepEqual(items(dir).filter(i => i.item.startsWith(`passage:${path}`)).map(i => i.item).sort(),
      [path, `${path}#one`, `${path}#two`, `${path}#setext`, `${path}#four`].map(a => `passage:${a}`).sort());
  });
  test('design.md §passages anchors strip inline markup and punctuation, retain Unicode letters, and disambiguate in file order', async () => {
    // design.md §passages: inline text/alt text, lowercase, allowed characters, and least-unused suffix.
    const path = 'design/brief/anchors.md';
    const dir = await setup({ [path]: '# **Été** [Link](https://example.test) ![Alt](x) `Code` _Under_ A_B — 2!\n\n# Same\n\n# Same\n\n# Same-1\n\n# Same\n' });
    assert.deepEqual(items(dir).filter(i => i.item.startsWith(`passage:${path}`)).map(i => i.item).sort(), [
      'été-link-alt-code-under-a_b--2', 'same', 'same-1', 'same-1-1', 'same-2',
    ].map(slug => `passage:${path}#${slug}`).sort());
  });
  test('design.md §passages anchors retain Unicode L and Nd but remove marks and other number categories', async () => {
    // design.md §passages: Unicode category L letters and Nd digits alone survive besides space, hyphen and underscore.
    const path = 'design/brief/unicode-anchors.md';
    const dir = await setup({ [path]: '# Ω Ж 漢\n\n# ١२𝟠\n\n# x\u0301y\n\n# AⅫ²B\n' });
    assert.deepEqual(items(dir).filter(i => i.item.startsWith(`passage:${path}`)).map(i => i.item).sort(),
      ['ω-ж-漢', '١२𝟠', 'xy', 'ab'].map(slug => `passage:${path}#${slug}`).sort());
  });
  const canonicalCases = [
    ['paragraph whitespace', '# System\n\nTickets\t can\nbe opened.\n', '# System\n\nTickets can be opened.'],
    ['CRLF lines', '# System\r\n\r\nTickets can be opened.\r\n', '# System\n\nTickets can be opened.'],
    ['CR lines', '# System\r\rTickets can be opened.\r', '# System\n\nTickets can be opened.'],
    ['reference definitions', '# System\n\n[guide]: /guide "Title"\n\nRead [guide].\n', '# System\n\n[guide]: /guide "Title"\n\nRead [guide].'],
    ['fenced code spaces', '# System\n\n```text  \n  a   b  \n c\t \n```\n', '# System\n\n```text\n  a   b\n c\n```'],
    ['nested fenced code', '# System\n\n> Before   text.\n>\n> ```text\n>   a   b  \n> ```\n>\n> After   text.\n', '# System\n\n> Before text. >\n> ```text\n>   a   b\n> ```\n> > After text.'],
    ['Unicode White_Space but not format characters', '# System\n\nAlpha\u0085\u00a0\u1680\u2000\u200a\u2028\u2029\u202f\u205f\u3000Beta\ufeff\u200bGamma.\n', '# System\n\nAlpha Beta\ufeff\u200bGamma.'],
    ['Unicode trailing whitespace in fenced code', '# System\n\n```text\u00a0\n  a\u2003b\u0085\u00a0\n c\ufeff \n```\n', '# System\n\n```text\n  a\u2003b\n c\ufeff\n```'],
  ];
  for (const [label, text, canonical] of canonicalCases) {
    test(`design.md §passages passage hash canonicalizes ${label}`, async () => {
      const dir = await setup({ 'design/brief/overview.md': text });
      const pin = await decisionPin(dir, await confirmParts(dir));
      // design.md §passages; design.md §pins: Unicode White_Space normalization feeds the hand-derived parts pin.
      assert.equal(pin, sha256(`Purpose: Manages tickets.\nCites: ${sha256(canonical)}`));
    });
  }
  test('design.md §passages renaming a heading leaves its old citation unresolved and its new address uncovered', async () => {
    // design.md §passages; account.md §items: the old address is unresolved and the new one uncovered.
    const dir = await setup();
    await writeFiles(dir, { 'design/brief/overview.md': BASE['design/brief/overview.md'].replace('# System', '# Renamed') });
    const missing = items(dir);
    assert.ok(missing.some(i => i.item === `passage:${CITE}` && i.why === 'unresolved'));
    assert.ok(missing.some(i => i.item === 'passage:design/brief/overview.md#renamed' && i.why === 'uncovered'));
  });
});

describe('design.md §coverage coverage and additions', () => {
  test('design.md §coverage every document and source passage counts and citations or omissions cover it once', async () => {
    // design.md §coverage; presentation.md §reading: distinct passages count once toward coverage.
    const dir = await setup({
      'design/brief/sources/source.md': '# Uncitable\n\nA source.\n',
      [`${PART}claims/safe/README.md`]: claim(),
      [`${PART}omissions.md`]: '# Left out\n\n' + table(['Passage', 'Reason'], [['design/brief/sources/source.md#uncitable', 'Awaiting provenance.']]),
    });
    assert.deepEqual(account(dir).project.coverage, { passages: 3, covered: 2 });
    assert.ok(items(dir).some(i => i.item === WORK && i.why === 'uncovered'));
  });
  test('design.md §coverage source-only entries are added regardless of their written Origin', async () => {
    // design.md §coverage, §units; account.md §items: an added claim is its own unit.
    const addr = 'design/brief/sources/source.md#source';
    const dir = await setup({
      'design/brief/sources/source.md': '---\ntitle: Source\nauthor: Writer\ndate: "unknown"\norigin: Saved by developer\n---\n# Source\n',
      [`${PART}claims/source/README.md`]: claim({ Cites: addr, Origin: 'stated' }),
    });
    assert.ok(items(dir).some(i => i.item === 'confirm:alpha/claims/source'));
    await confirmParts(dir);
    assert.equal(forma(dir, ['show', 'confirm', 'alpha/claims/source', '--json']).status, 0);
  });
  test('design.md §coverage a mixed document-and-source citation can remain in the stated unit', async () => {
    // design.md §coverage, §units: source-only entries are additions; a stated mixed claim stays in stated.
    const dir = await setup({
      'design/brief/sources/source.md': '---\ntitle: Source\nauthor: Writer\ndate: "unknown"\norigin: Saved by developer\n---\n# Source\n',
      [`${PART}claims/mixed/README.md`]: claim({ Cites: `${CITE}, design/brief/sources/source.md#source` }),
    });
    const missing = items(dir);
    assert.ok(missing.some(i => i.item === 'confirm:alpha/stated'));
    assert.ok(!missing.some(i => i.item === 'confirm:alpha/claims/mixed'));
  });
});

describe('forms.md §page-rules shared page forms', () => {
  const path = `${PART}claims/safe/README.md`;
  const mutations = [
    ['front matter', t => '---\ntitle: Claim\n---\n' + t],
    ['text before heading', t => 'Preface\n\n' + t],
    ['blank first line', t => '\n' + t],
    ['level-two initial heading', t => t.replace('# Ticket safety', '## Ticket safety')],
    ['second level-one heading', t => t + '\n# Extra\n'],
    ['extra paragraph', t => t + '\nUnspecified prose.\n'],
    ['missing field', t => t.replace('| Stake | A client loses its ticket. |\n', '')],
    ['duplicate field', t => t + '| Stake | Another stake. |\n'],
    ['unknown field', t => t + '| Extra | Value |\n'],
    ['empty cell', t => t.replace('A client loses its ticket.', '')],
    ['extra column', t => t.replace('| Field | Value |', '| Field | Value | Extra |').replace('| --- | --- |', '| --- | --- | --- |')],
    ['duplicate column', t => t.replace('| Field | Value |', '| Field | FIELD |')],
    ['missing column', t => t.replace('| Field | Value |', '| Field |')],
    ['unescaped pipe', t => t.replace('A client loses its ticket.', 'A client | loses its ticket.')],
    ['too few cells', t => t.replace('| Stake | A client loses its ticket. |', '| Stake |')],
    ['no citation', t => t.replace(CITE, 'none')],
    ['unknown origin', t => t.replace('| Origin | stated |', '| Origin | inferred |')],
  ];
  for (const [label, mutate] of mutations) {
    test(`forms.md §page-rules refuses ${label}`, async () => {
      // forms.md §page-rules, §claims, design.md §restate-checks: fixed blocks, cells, columns, fields, citations and origins.
      await rejected(await setup(), { [path]: mutate(claim()) }, { file: path });
    });
  }
  test('forms.md §page-rules columns and field names are trimmed and case insensitive, in arbitrary column order', async () => {
    // forms.md §page-rules: field columns may be reversed; names are trimmed and case-insensitive, with fields each once.
    const text = '# Claim\n\n' + table([' value ', ' FIELD '], Object.entries({ Sentence: 'A closed ticket stays closed.', Kind: 'safety', Stake: 'A client loses its ticket.', 'Rests on': 'none', Parts: 'alpha', Origin: 'stated', Cites: CITE }).reverse().map(([k, v]) => [v, ` ${k.toUpperCase()} `]));
    accepted(await submit(await setup(), { [path]: text }));
  });
  test('forms.md §page-rules code-span cells strip their backticks, escaped pipes and free-text commas survive', async () => {
    // forms.md §page-rules; presentation.md §reading: parsed free text is the claim entry's sentence.
    const text = claim({ Sentence: '`Tickets preserve a\\|b, c.`', Kind: '`safety`', Parts: '`alpha`', Origin: '`stated`', Cites: '`' + CITE + '`' });
    const dir = await setup();
    accepted(await submit(dir, { [path]: text }));
    const found = account(dir, 'alpha').parts.find(p => p.ref === 'alpha').open.find(e => e.ref === 'alpha/claims/safe');
    assert.equal(found.sentence, 'Tickets preserve a|b, c.');
  });
  for (const [label, file, text] of [
    ['part purpose', 'design/README.md', '# Design\n\n' + table(['Part', 'Purpose', 'Cites'], [['alpha', '', CITE]])],
    ['action sentence', `${PART}actions.md`, BASE[`${PART}actions.md`].replace('Opens a ticket.', '')],
    ['action guard', `${PART}actions.md`, BASE[`${PART}actions.md`].replace('Opens a ticket. | none | none', 'Opens a ticket. | none | ')],
    ['boundary names', `${PART}boundary.md`, BASE[`${PART}boundary.md`].replace('| Client |', '| |')],
    ['surface direction', `${PART}boundary.md`, BASE[`${PART}boundary.md`] + '\n## Surface\n\n' + table(['Direction', 'Name', 'Cites'], [['', 'created', CITE]])],
    ['omission reason', `${PART}omissions.md`, '# Omissions\n\n' + table(['Passage', 'Reason'], [[CITE, '']])],
  ]) {
    test(`forms.md §page-rules refuses an empty required ${label} cell`, async () => {
      // forms.md §page-rules, design.md §restate-checks: empty cells are permitted only in lifecycle matrix action columns.
      await rejected(await setup(), { [file]: text }, { file });
    });
  }
  test('forms.md §page-rules front-page and part-table columns may appear in arbitrary order', async () => {
    // forms.md §page-rules, §part-list, forms.md §actions to §omissions: every table's fixed columns may be reordered.
    const dir = await setup();
    accepted(await submit(dir, {
      'design/README.md': '# Design\n\n' + table(['Cites', 'Purpose', 'Part'], [[CITE, 'Manages tickets.', 'alpha']]),
      [`${PART}actions.md`]: '# Actions\n\n' + table(['Cites', 'Origin', 'Guard', 'Cases', 'Sentence', 'Actor', 'Action'], [
        [CITE, 'stated', 'none', 'none', 'Opens a ticket.', 'client', 'open'],
        [CITE, 'stated', 'none', 'none', 'Closes a ticket.', 'client', 'close'],
      ]),
      [`${PART}boundary.md`]: '# Boundary\n\n## Boundary\n\n' + table(['Cites', 'Origin', 'Writes', 'Reads', 'Isolation', 'Seam', 'Side', 'Kind', 'Names', 'Row'], [
        [CITE, 'stated', '-', '-', '-', 'person', 'world', 'actor', 'Client', 'client'],
        [CITE, 'stated', 'client', 'client', '-', '-', 'machine', 'entity', 'Ticket', 'ticket'],
        [CITE, 'stated', 'client', 'client', 'serializable', '-', 'machine', 'store', 'Records', 'records'],
      ]) + '\n## Surface\n\n' + table(['Cites', 'Name', 'Direction'], [[CITE, 'created', 'emits']]),
      [`${PART}omissions.md`]: '# Omissions\n\n' + table(['Reason', 'Passage'], [['No further restatement needed.', CITE]]),
    }));
  });
  for (const key of ['Upper', '1key', 'trailing-', 'two--hyphens', 'under_score', '-start']) {
    test(`forms.md §page-rules refuses malformed thing key ${key}`, async () => {
      // forms.md §page-rules; design.md §restate-checks: folder keys must match the exact lowercase key grammar.
      const target = `${PART}claims/${key}/README.md`;
      await rejected(await setup(), { [target]: claim() }, { file: target });
    });
  }
  test('forms.md §page-rules the action key phase is reserved and remains a resolution failure on read', async () => {
    // forms.md §page-rules reserves phase for the matrix header; design.md §restate-checks check 2 and design.md §at-read
    // classify every key rule as resolution, so the accepted-shaped page still counts.
    const path = `${PART}actions.md`;
    const text = '# Actions\n\n' + table(['Action', 'Actor', 'Sentence', 'Cases', 'Guard', 'Origin', 'Cites'], [
      ['phase', 'client', 'Observes the ticket.', 'none', 'none', 'stated', CITE],
    ]);
    const dir = await setup({ [LIFE]: null });
    await rejected(dir, { [path]: text }, { file: path });
    const readDir = await setup({ [LIFE]: null, [path]: text });
    const missing = items(readDir);
    assert.ok(missing.some(item => item.item === 'restate:alpha' && item.why === 'unresolved'));
    assert.ok(!missing.some(item => item.item === `change:${path}`));
  });
  test('forms.md §page-rules keys may repeat across distinct kinds and across parts', async () => {
    // forms.md §page-rules: claims and premises are distinct kinds; premises and boundary rows share a namespace.
    const dir = await setup();
    accepted(await submit(dir, {
      'design/README.md': BASE['design/README.md'].replace('\n\n1.', `\n| beta | Stores tickets. | ${CITE} |\n\n1.`),
      'design/parts/beta/README.md': '# Storage\n',
      [`${PART}claims/safe/README.md`]: claim(),
      [`${PART}premises/safe/README.md`]: premise(),
      'design/parts/beta/claims/safe/README.md': claim({ Parts: 'beta' }),
    }));
  });
  for (const cites of [`${CITE},${CITE}`, `${CITE}; ${CITE}`]) {
    test(`forms.md §page-rules refuses list separators other than comma-space: ${cites}`, async () => {
      // forms.md §page-rules: citation list items use exactly comma-space, and each must resolve (design.md §restate-checks).
      await rejected(await setup(), { [path]: claim({ Cites: cites }) }, { file: path, field: 'Cites' });
    });
  }
  test('forms.md §page-rules a local reference must be bare and a remote reference qualified', async () => {
    // forms.md §page-rules; forms.md §lifecycles: Entity references qualify only another part, and a no-action part has only Phase.
    const dir = await setup();
    await rejected(dir, { [LIFE]: lifecycle({ Entity: 'alpha/ticket' }) }, { file: LIFE, field: 'Entity' });
    accepted(await submit(dir, {
      'design/README.md': BASE['design/README.md'].replace('\n\n1.', `\n| beta | Stores tickets. | ${CITE} |\n\n1.`),
      'design/parts/beta/README.md': '# Storage\n',
      'design/parts/beta/lifecycles/ticket/README.md': lifecycle({ Entity: 'alpha/ticket', Initial: 'idle', Ends: 'idle' }, [['idle']], []),
    }));
  });
});

describe('forms.md §front-pages front pages', () => {
  test('forms.md §part-list the part table matches every part folder, excludes spans, and alone determines its pin', async () => {
    // forms.md §part-list, §spans, design.md §pins: only part rows determine the parts pin.
    const dir = await setup({ 'design/spans/flow/README.md': '# Flow\n\nDescribes the ticket flow.\n' });
    const result = await confirmParts(dir);
    assert.equal(await decisionPin(dir, result), sha256(`Purpose: Manages tickets.\nCites: ${sha256('# System\n\nTickets can be opened and closed by a client. Records retain tickets.')}`));
    accepted(await submit(dir, { 'design/README.md': BASE['design/README.md'].replace('# Ticket system', '# Different').replace('[Tickets]', '[Arbitrary words]').replace('1.', '8.') }));
    // forms.md §reading-order, design.md §confirmation-pins: headings, link labels and list numbers do not lapse that confirmation.
    assert.ok(!items(dir).some(i => i.item === 'confirm:parts'));
  });
  for (const [label, files] of [
    ['row with no part', { 'design/README.md': BASE['design/README.md'].replace('| alpha |', '| absent |') }],
    ['part without a row', { 'design/parts/beta/README.md': '# Beta\n' }],
    ['duplicate part row', { 'design/README.md': BASE['design/README.md'].replace('\n\n1.', `\n| alpha | Another purpose. | ${CITE} |\n\n1.`) }],
    ['part and span sharing a key', { 'design/spans/alpha/README.md': '# Span\n\nSpans tickets.\n' }],
    ['part front page extra purpose paragraph', { [`${PART}README.md`]: '# Tickets\n\nManages tickets.\n' }],
    ['span missing purpose', { 'design/spans/flow/README.md': '# Flow\n' }],
  ]) {
    test(`forms.md §front-pages refuses ${label}`, async () => {
      // forms.md §page-rules; forms.md §part-list, §part-readme, §spans: keys, exact front-page blocks and matching part rows.
      await rejected(await setup(), files);
    });
  }
  for (const [label, item] of [
    ['bare text', '1. Ticket state'], ['unordered list', '- [State](lifecycles/ticket/)'],
    ['extra item text', '1. [State](lifecycles/ticket/) extra'], ['two links', '1. [A](lifecycles/ticket/) [B](lifecycles/ticket/)'],
    ['file destination', '1. [State](lifecycles/ticket/README.md)'], ['no trailing slash', '1. [State](lifecycles/ticket)'],
    ['nonexistent thing', '1. [Absent](claims/absent/)'], ['code journey', '1. [Offered](journeys/reach-ticket--active/)'],
    ['another part', '1. [Elsewhere](../beta/)'],
  ]) {
    test(`forms.md §reading-order reading order refuses ${label}`, async () => {
      // forms.md §reading-order; design.md §restate-checks: one local folder link per ordered item, to an existing written page.
      await rejected(await setup(), { [`${PART}README.md`]: `# Tickets\n\n${item}\n` }, { file: `${PART}README.md` });
    });
  }
  test('forms.md §reading-order named parts and spans precede unnamed ones in code-point order', async () => {
    // forms.md §reading-order; presentation.md §reading: destinations define the prefix and remaining keys follow in code-point order.
    const dir = await setup({
      'design/README.md': '# Design\n\n' + table(['Part', 'Purpose', 'Cites'], [['alpha', 'Manages tickets.', CITE], ['zeta', 'Stores records.', CITE], ['beta', 'Sends notices.', CITE]]) + '\n9. [Anything](parts/zeta/)\n4. [Flow](spans/flow/)\n',
      'design/parts/zeta/README.md': '# Records\n', 'design/parts/beta/README.md': '# Notices\n',
      'design/spans/flow/README.md': '# Flow\n\nExplains cooperation.\n',
    });
    assert.deepEqual(account(dir).parts.map(p => [p.ref, p.span]), [['zeta', false], ['flow', true], ['alpha', false], ['beta', false]]);
  });
  test('forms.md §reading-order named things precede unnamed things by key without rewriting their front page', async () => {
    // forms.md §reading-order; presentation.md §reading: claim entries follow reading order and the front page is not rewritten.
    const front = '# Tickets\n\n7. [Read last alphabetically first](claims/zeta/)\n';
    const dir = await setup({ [`${PART}README.md`]: front, ...Object.fromEntries(['zeta', 'beta', 'alpha'].map(k => [`${PART}claims/${k}/README.md`, claim()])) });
    const p = account(dir, 'alpha').parts.find(p => p.ref === 'alpha');
    assert.deepEqual(p.open.filter(e => e.ref?.includes('/claims/')).map(e => e.ref), ['alpha/claims/zeta', 'alpha/claims/alpha', 'alpha/claims/beta']);
    assert.equal(await read(dir, `${PART}README.md`), front);
  });
});

describe('forms.md §part-tables part tables', () => {
  test('forms.md §part-tables table pages may be absent or have no rows, and boundary sections are independently optional', async () => {
    // forms.md §part-tables, §boundary: absent/empty table pages and either optional boundary section are valid.
    const dir = await setup({ [`${PART}actions.md`]: null, [`${PART}boundary.md`]: null, [LIFE]: null });
    accepted(await submit(dir, {
      [`${PART}actions.md`]: '# Actions\n\n' + table(['Action', 'Actor', 'Sentence', 'Cases', 'Guard', 'Origin', 'Cites'], []),
      [`${PART}boundary.md`]: '# Boundary\n\n## Surface\n\n' + table(['Direction', 'Name', 'Cites'], []),
      [`${PART}omissions.md`]: '# Left out\n\n' + table(['Passage', 'Reason'], []),
    }));
    accepted(await submit(dir, { [`${PART}boundary.md`]: '# Boundary\n\n## Boundary\n\n' + table(['Row', 'Names', 'Kind', 'Side', 'Seam', 'Isolation', 'Reads', 'Writes', 'Origin', 'Cites'], []) }));
  });
  for (const kind of ['actor', 'service', 'queue', 'clock']) {
    test(`forms.md §actions ${kind} is a permitted action actor`, async () => {
      // forms.md §actions; forms.md §boundary: actor/service/queue/clock rows can act and read or write entities/stores.
      const dir = await setup();
      accepted(await submit(dir, { [`${PART}boundary.md`]: BASE[`${PART}boundary.md`].replace('| actor |', `| ${kind} |`) }));
    });
  }
  for (const [label, text] of [
    ['store actor', BASE[`${PART}actions.md`].replaceAll('| client |', '| records |')],
    ['entity actor', BASE[`${PART}actions.md`].replaceAll('| client |', '| ticket |')],
    ['one case', BASE[`${PART}actions.md`].replace('open | client | Opens a ticket. | none', 'open | client | Opens a ticket. | only')],
    ['duplicate cases', BASE[`${PART}actions.md`].replace('open | client | Opens a ticket. | none', 'open | client | Opens a ticket. | yes, yes')],
    ['invalid case key', BASE[`${PART}actions.md`].replace('open | client | Opens a ticket. | none', 'open | client | Opens a ticket. | Yes, no')],
    ['duplicate action key', BASE[`${PART}actions.md`].replace('| close |', '| open |')],
  ]) {
    test(`forms.md §actions refuses ${label}`, async () => {
      // forms.md §page-rules; forms.md §actions; design.md §restate-checks: unique action keys, allowed actors and distinct case keys.
      await rejected(await setup(), { [`${PART}actions.md`]: text }, { file: `${PART}actions.md` });
    });
  }
  test('forms.md §actions guards and two distinct cases are admitted and placed in lifecycle cells', async () => {
    // forms.md §actions; forms.md §lifecycles: guards and two named cases are valid when every action cell has those cases.
    const actions = BASE[`${PART}actions.md`].replace('Opens a ticket. | none | none', 'Opens a ticket. | yes, no | A ticket is available.');
    accepted(await submit(await setup(), { [`${PART}actions.md`]: actions, [LIFE]: lifecycle({}, [['idle', 'yes: active<br>no: idle', 'None.'], ['active', 'yes: active<br>no: active', 'closed'], ['closed', 'yes: None.<br>no: None.', 'None.']]) }));
  });
  for (const seam of ['request-response', 'webhook', 'queue', 'clock', 'person']) {
    test(`forms.md §boundary permits world seam ${seam}`, async () => {
      // forms.md §boundary: a world actor admits exactly the five seam names.
      accepted(await submit(await setup(), { [`${PART}boundary.md`]: BASE[`${PART}boundary.md`].replace('| person |', `| ${seam} |`) }));
    });
  }
  const boundaryInvalid = [
    ['unknown kind', '| actor |', '| object |'], ['unknown side', '| world |', '| external |'],
    ['missing world seam', '| person |', '| - |'], ['unknown seam', '| person |', '| rpc |'],
    ['machine seam', '| actor | world | person |', '| actor | machine | person |'],
    ['entity seam', '| entity | machine | - |', '| entity | machine | person |'],
    ['non-store isolation', '| entity | machine | - | - |', '| entity | machine | - | serializable |'],
    ['store lacks isolation', '| serializable |', '| - |'], ['unknown isolation', '| serializable |', '| strong |'],
    ['actor reads list', '| person | - | - | - |', '| person | - | client | - |'],
    ['wrong reader kind', '| - | - | client | client |', '| - | - | records | client |'],
    ['wrong writer kind', '| - | - | client | client |', '| - | - | client | ticket |'],
    ['duplicate row key', '| ticket | Ticket |', '| client | Ticket |'],
  ];
  for (const [label, from, to] of boundaryInvalid) {
    test(`forms.md §boundary refuses ${label}`, async () => {
      // forms.md §page-rules; forms.md §boundary; forms.md §store-premises: unique keys, closed kinds/sides/seams/isolations, and reader/writer kinds.
      await rejected(await setup(), { [`${PART}boundary.md`]: BASE[`${PART}boundary.md`].replace(from, to) }, { file: `${PART}boundary.md` });
    });
  }
  for (const [label, alphaRows, betaRows] of [
    ['emitted and consumed event', [['emits', 'created']], [['consumes', 'alpha/created']]],
    ['both read same row', [['reads', 'records']], [['reads', 'alpha/records']]],
    ['read and write same row', [['reads', 'records']], [['writes', 'alpha/records']]],
    ['both write same row', [['writes', 'records']], [['writes', 'alpha/records']]],
    ['both call same world row', [['calls', 'client']], [['calls', 'alpha/client']]],
  ]) {
    test(`forms.md §surface declared surfaces form a sorted span for ${label}`, async () => {
      // forms.md §surface; account.md §items: declared interactions form the sorted pair, owed with no claim/journey entry.
      const surface = rows => '## Surface\n\n' + table(['Direction', 'Name', 'Cites'], rows.map(r => [...r, CITE]));
      const dir = await setup({
        'design/README.md': BASE['design/README.md'].replace('\n\n1.', `\n| beta | Stores tickets. | ${CITE} |\n\n1.`),
        'design/parts/beta/README.md': '# Beta\n',
        [`${PART}boundary.md`]: BASE[`${PART}boundary.md`] + '\n' + surface(alphaRows),
        'design/parts/beta/boundary.md': '# Surface\n\n' + surface(betaRows),
      });
      assert.ok(items(dir).some(i => i.item === 'span:alpha+beta' && i.why === 'no-entry'));
    });
  }
  test('forms.md §surface words, shared actor references, and span folders alone form no span', async () => {
    // forms.md §surface: only declared surfaces form a span, not prose, action actor references or span folders.
    const dir = await setup({
      'design/README.md': BASE['design/README.md'].replace('\n\n1.', `\n| beta | Calls alpha and shares Records. | ${CITE} |\n\n1.`),
      'design/parts/beta/README.md': '# Beta\n',
      'design/parts/beta/actions.md': '# Actions\n\n' + table(['Action', 'Actor', 'Sentence', 'Cases', 'Guard', 'Origin', 'Cites'], [['call', 'alpha/client', 'Calls alpha.', 'none', 'none', 'stated', CITE]]),
      'design/spans/cooperation/README.md': '# Cooperation\n\nConnects alpha and beta.\n',
    });
    assert.ok(!items(dir).some(i => i.item.startsWith('span:')));
  });
  for (const [direction, name] of [['emits', 'alpha/event'], ['consumes', 'absent'], ['reads', 'client'], ['writes', 'client'], ['calls', 'records'], ['sends', 'client']]) {
    test(`forms.md §surface refuses invalid surface ${direction} ${name}`, async () => {
      // forms.md §surface; forms.md §page-rules; design.md §restate-checks: surface directions have the listed name/reference kinds.
      await rejected(await setup(), { [`${PART}boundary.md`]: BASE[`${PART}boundary.md`] + '\n## Surface\n\n' + table(['Direction', 'Name', 'Cites'], [[direction, name, CITE]]) }, { file: `${PART}boundary.md` });
    });
  }
  test('forms.md §surface each direction/name pair is unique and local consumed events are bare', async () => {
    // forms.md §surface: a local consume uses the emitted event's bare key, and direction/name pairs cannot repeat.
    const dir = await setup();
    const rows = [['emits', 'created', CITE], ['consumes', 'created', CITE]];
    accepted(await submit(dir, { [`${PART}boundary.md`]: BASE[`${PART}boundary.md`] + '\n## Surface\n\n' + table(['Direction', 'Name', 'Cites'], rows) }));
    await rejected(dir, { [`${PART}boundary.md`]: BASE[`${PART}boundary.md`] + '\n## Surface\n\n' + table(['Direction', 'Name', 'Cites'], [...rows, rows[0]]) }, { file: `${PART}boundary.md` });
  });
  test('forms.md §omissions omissions name existing passages once per part and retain their reasons', async () => {
    // forms.md §omissions, design.md §restate-checks; presentation.md §reading: unique resolving addresses and the fixed omission entry.
    const dir = await setup();
    const path = `${PART}omissions.md`;
    const row = ['design/brief/work.md#work', 'Outside this design.'];
    accepted(await submit(dir, { [path]: '# Omissions\n\n' + table(['Passage', 'Reason'], [row]) }));
    assert.deepEqual(account(dir, 'alpha').parts.find(p => p.ref === 'alpha').leftOut, [{ passage: row[0], reason: row[1], confirmed: false }]);
    // Use a newly uncovered passage so subsequent refusal tests still have an answerable item.
    await writeFiles(dir, { 'design/brief/next.md': '# Next\n' });
    await rejected(dir, { [path]: '# Omissions\n\n' + table(['Passage', 'Reason'], [row, row]) }, { file: path, item: 'passage:design/brief/next.md#next' });
    await rejected(dir, { [path]: '# Omissions\n\n' + table(['Passage', 'Reason'], [['design/brief/absent.md', 'Not present.']]) }, { file: path, item: 'passage:design/brief/next.md#next' });
  });
});

// Helpers local to forms.md §thing-pages to §code-premises: hand-written pages assembled from the fixed tables.
// forms.md §part-list, §actions give these front/action tables.
function twoPartList() {
  return '# Ticket system\n\n' + table(['Part', 'Purpose', 'Cites'], [
    ['alpha', 'Manages tickets.', CITE], ['beta', 'Archives tickets.', CITE],
  ]);
}
function secondPart() {
  return {
    'design/README.md': twoPartList(),
    'design/parts/beta/README.md': '# Archive\n',
    'design/parts/beta/actions.md': '# Archive actions\n\n' + table(
      ['Action', 'Actor', 'Sentence', 'Cases', 'Guard', 'Origin', 'Cites'],
      [['archive', 'alpha/client', 'Archives a ticket.', 'none', 'none', 'stated', CITE]]),
  };
}
// forms.md §lifecycles: cased actions have one outcome per case or an empty cell.
function casedLifecycle(cells = ['yes: active<br>no: None.', 'yes: active<br>no: active', 'yes: None.<br>no: None.']) {
  return {
    [`${PART}actions.md`]: BASE[`${PART}actions.md`].replace('| open | client | Opens a ticket. | none |', '| open | client | Opens a ticket. | yes, no |'),
    [LIFE]: lifecycle({}, [['idle', cells[0], 'None.'], ['active', cells[1], 'closed'], ['closed', cells[2], 'None.']]),
  };
}
// forms.md §choices: both alternatives resolve exactly the posed cell.
function posedLifecycle() {
  return {
    [LIFE]: lifecycle({}, [['idle', 'choice:operation', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']]),
    [`${PART}choices/operation/README.md`]: choice({}, {}, {
      fields: { Polarity: 'must not', 'Expected end': '-', 'Refused step': '1' },
      steps: [[1, 'Client', 'open', '-', '-', '-']],
    }, [['ticket', 'idle', 'open', 'active']], [['ticket', 'idle', 'open', 'None.']]),
  };
}

describe('forms.md §thing-pages thing pages', () => {
  // forms.md §thing-pages fixes paths; forms.md §lifecycles, §journeys, §claims, §premises, §choices
  // fix each field table. forms.md §page-rules requires exactly those fields once.
  const forms = [
    ['lifecycle', LIFE, lifecycle(), ['Entity', 'Initial', 'Ends', 'Unaffected', 'Origin', 'Cites']],
    ['journey', `${PART}journeys/opening/README.md`, journey(), ['Polarity', 'Expected end', 'Refused step', 'Origin', 'Cites']],
    ['claim', `${PART}claims/safety/README.md`, claim(), ['Sentence', 'Kind', 'Stake', 'Rests on', 'Parts', 'Origin', 'Cites']],
    ['premise', `${PART}premises/retries/README.md`, premise(), ['Statement', 'Class', 'Why not examined', 'Falsifier', 'Provider', 'Origin', 'Cites']],
    ['choice', `${PART}choices/operation/README.md`, choice(), ['Question', 'Recommendation', 'Cites']],
  ];
  for (const [kind, file, text, names] of forms) {
    test(`forms.md §thing-pages: accepts the complete ${kind} page at its prescribed path`, async () => {
      const dir = await setup();
      accepted(await submit(dir, { [file]: text }));
      // design.md §removal: acceptance writes the supplied page.
      assert.equal(await read(dir, file), text);
    });
    for (const name of names) {
      test(`forms.md §thing-pages: the ${kind} field table requires ${name}`, async () => {
        const dir = await setup();
        const missing = text.split('\n').filter(line => !line.startsWith(`| ${name} |`)).join('\n');
        await rejected(dir, { [file]: missing }, { file });
      });
    }
    test(`forms.md §thing-pages: the ${kind} field table permits no extra field`, async () => {
      const dir = await setup();
      await rejected(dir, { [file]: text.replace('| --- | --- |\n', '| --- | --- |\n| Extra | not a field |\n') }, { file });
    });
  }

  test('forms.md §thing-pages: a folder without a page is no thing', async () => {
    // forms.md §thing-pages: no page means no thing, hence no item about it.
    const files = {
      [`${PART}claims/removed/receipt`]: '',
    };
    const dir = await setup(files);
    assert.ok(!items(dir).some(item => JSON.stringify(item).includes('alpha/claims/removed')));
  });

  for (const kind of ['lifecycles', 'premises', 'choices']) {
    test(`forms.md §thing-pages: a span cannot hold ${kind}`, async () => {
      // forms.md §thing-pages: a span holds only journeys and claims.
      const dir = await setup();
      const text = kind === 'lifecycles' ? lifecycle({ Entity: 'alpha/ticket' }) : kind === 'premises' ? premise() : choice();
      const file = `design/spans/cross/${kind}/entry/README.md`;
      await rejected(dir, {
        'design/spans/cross/README.md': '# Cross-part reading\n\nRelates tickets to archives.\n',
        [file]: text,
      });
    });
  }
});

describe('forms.md §lifecycles lifecycles', () => {
  test('forms.md §lifecycles: accepts entered-by, no ends, unaffected actions and an unspecified cell', async () => {
    // forms.md §lifecycles allows these fields and empty action cells;
    // design.md §removal writes the accepted page.
    const dir = await setup();
    const text = lifecycle({ Initial: 'idle, entered by open', Ends: 'none', Unaffected: 'close' }, [['idle', 'active'], ['active', '']], ['open']);
    accepted(await submit(dir, { [LIFE]: text }));
    assert.equal(await read(dir, LIFE), text);
  });

  test('forms.md §lifecycles: an entity reference may name an entity of another part', async () => {
    // forms.md §lifecycles permits an entity of any part; forms.md §page-rules qualifies it.
    const dir = await setup(secondPart());
    const file = 'design/parts/beta/lifecycles/archived/README.md';
    accepted(await submit(dir, { [file]: lifecycle({ Entity: 'alpha/ticket', Initial: 'ready', Ends: 'done' }, [['ready', 'done'], ['done', 'None.']], ['archive']) }));
  });

  test('forms.md §lifecycles: each case has an outcome and an empty case outcome is accepted', async () => {
    // forms.md §lifecycles explicitly allows empty case outcomes and whole cells.
    const dir = await setup();
    accepted(await submit(dir, casedLifecycle(['yes: active<br>no: ', '', 'yes: None.<br>no: None.'])));
  });

  for (const columns of [['open', 'Phase', 'close'], ['close', 'open', 'Phase']]) {
    test(`forms.md §lifecycles: accepts lifecycle matrix columns ${columns.join(', ')}`, async () => {
      // forms.md §lifecycles, §page-rules: Phase and action columns
      // may appear in any order; accepted pages are written (design.md §removal).
      const dir = await setup();
      const positions = { Phase: 0, open: 1, close: 2 };
      const rows = [['idle', 'active', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']];
      const text = lifecycle().replace(table(['Phase', 'open', 'close'], rows),
        table(columns, rows.map(row => columns.map(column => row[positions[column]]))));
      accepted(await submit(dir, { [LIFE]: text }));
      assert.equal(await read(dir, LIFE), text);
    });
  }

  for (const [label, text] of [
    ['Phase cell', lifecycle({}, [['idle', 'active', 'None.'], ['', 'active', 'closed'], ['closed', 'None.', 'None.']])],
    ['field value', lifecycle({ Entity: '' })],
  ]) {
    test(`forms.md §lifecycles: refuses an empty lifecycle ${label}`, async () => {
      // forms.md §page-rules restricts the empty-cell exception to matrix action columns;
      // design.md §restate-checks refuses pages outside their form. On read, design.md §at-read
      // makes this a page-form change, not merely an unresolved phase/key.
      const dir = await setup();
      await rejected(dir, { [LIFE]: text }, { file: LIFE });
      const readDir = await setup({ [LIFE]: text });
      assert.ok(items(readDir).some(item => item.item === `change:${LIFE}`));
    });
  }

  // forms.md §lifecycles; design.md §restate-checks:
  // Entity is an entity row, phases exist, and entry/unaffected actions belong to this part.
  const invalidFields = [
    ['entity row of the wrong kind', { Entity: 'client' }],
    ['unresolved entity', { Entity: 'absent' }],
    ['initial phase outside the matrix', { Initial: 'absent' }],
    ['end phase outside the matrix', { Ends: 'absent' }],
    ['entered-by action outside the part', { Initial: 'idle, entered by beta/archive' }],
    ['unknown entered-by action', { Initial: 'idle, entered by missing' }],
    ['unaffected action outside the part', { Unaffected: 'beta/archive' }],
    ['unknown unaffected action', { Unaffected: 'missing' }],
    ['action both a column and unaffected', { Unaffected: 'open' }],
  ];
  for (const [label, change] of invalidFields) {
    test(`forms.md §lifecycles: refuses ${label}`, async () => {
      const dir = await setup(secondPart());
      await rejected(dir, { [LIFE]: lifecycle(change) }, { file: LIFE });
    });
  }

  // forms.md §lifecycles fixes columns, unique phase keys and outcomes;
  // forms.md §page-rules fixes key syntax and exact action-column matching;
  // design.md §restate-checks requires all named phases/choices/actions to resolve.
  const invalidMatrices = [
    ['a missing action column', lifecycle({}, [['idle', 'active'], ['active', 'active'], ['closed', 'None.']], ['open'])],
    ['a repeated action column', lifecycle({}, [['idle', 'active', 'active', 'None.'], ['active', 'active', 'active', 'closed'], ['closed', 'None.', 'None.', 'None.']], ['open', 'open', 'close'])],
    ['a foreign action column', lifecycle({}, [['idle', 'active', 'None.', 'idle'], ['active', 'active', 'closed', 'active'], ['closed', 'None.', 'None.', 'closed']], ['open', 'close', 'beta/archive'])],
    ['a repeated phase row', lifecycle({}, [['idle', 'active', 'None.'], ['active', 'active', 'closed'], ['active', 'None.', 'None.'], ['closed', 'None.', 'None.']])],
    ['an invalid phase key', lifecycle({ Initial: 'Idle' }, [['Idle', 'active', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']])],
    ['an action column with altered case', lifecycle({}, [['idle', 'active', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']], ['Open', 'close'])],
    ['an unresolved outcome phase', lifecycle({}, [['idle', 'absent', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']])],
    ['None without its period', lifecycle({}, [['idle', 'None', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']])],
    ['a space after choice colon', lifecycle({}, [['idle', 'choice: operation', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']])],
    ['an unresolved choice', lifecycle({}, [['idle', 'choice:missing', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']])],
    ['cases on an action with no cases', lifecycle({}, [['idle', 'yes: active<br>no: None.', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']])],
  ];
  for (const [label, text] of invalidMatrices) {
    test(`forms.md §lifecycles: refuses ${label}`, async () => {
      const dir = await setup(secondPart());
      await rejected(dir, { [LIFE]: text }, { file: LIFE });
    });
  }

  test('forms.md §lifecycles a repeated action column owes Restate and its lifecycle page still counts', async () => {
    // forms.md §page-rules assigns repeated action columns to check 2; design.md §at-read keeps the
    // page in the restatement and owes restate:alpha rather than change:path.
    const text = lifecycle({}, [
      ['idle', 'active', 'active', 'None.'], ['active', 'active', 'active', 'closed'],
      ['closed', 'None.', 'None.', 'None.'],
    ], ['open', 'open', 'close']);
    const dir = await setup({ [LIFE]: text });
    const missing = items(dir);
    assert.ok(missing.some(item => item.item === 'restate:alpha' && item.why === 'unresolved'));
    assert.ok(!missing.some(item => item.item === `change:${LIFE}`));
  });

  // forms.md §lifecycles: every declared case exactly once, with a valid outcome.
  for (const [label, cell] of [
    ['a phase instead of cases', 'active'], ['None. instead of cases', 'None.'],
    ['a missing case', 'yes: active'], ['a repeated case', 'yes: active<br>yes: None.'],
    ['an unknown case', 'yes: active<br>other: None.'],
    ['an unknown case outcome', 'yes: absent<br>no: None.'],
  ]) {
    test(`forms.md §lifecycles: a cased action refuses ${label}`, async () => {
      const dir = await setup();
      await rejected(dir, casedLifecycle([cell, 'yes: active<br>no: active', 'yes: None.<br>no: None.']), { file: LIFE });
    });
  }
});

describe('forms.md §journeys journeys', () => {
  const file = `${PART}journeys/example/README.md`;
  test('forms.md §journeys: accepts must-not with a refused step and no expected end', async () => {
    // forms.md §journeys fixes polarity, refused step and step cells.
    const dir = await setup();
    const text = journey({ Polarity: 'must not', 'Expected end': '-', 'Refused step': '1' }, [[1, 'A person', 'close', 'any ticket', '-', '-']]);
    accepted(await submit(dir, { [file]: text }));
  });
  test('forms.md §journeys: accepts a start table, multiple numbered steps, and free actor and argument text', async () => {
    // forms.md §journeys permits starts and developer-word Actor/Arguments;
    // forms.md §page-rules permits commas in free text. Findings do not refuse (design.md §restate-checks).
    const dir = await setup();
    const text = journey({}, [[1, 'An operator, using a client', 'open', 'the current ticket, again', 'one', '-'], [2, 'Another operator', 'close', 'the same ticket', 'one', '-']], [['ticket', 'one', 'active']]);
    accepted(await submit(dir, { [file]: text }));
  });
  test('forms.md §journeys: accepts a case named by its action and an action of another part', async () => {
    // forms.md §journeys: actions may be of any part and Case names their case.
    const dir = await setup({ ...secondPart(), ...casedLifecycle() });
    accepted(await submit(dir, { [file]: journey({}, [[1, 'Client', 'open', '-', '-', 'yes'], [2, 'Archivist', 'beta/archive', '-', '-', '-']]) }));
  });

  // forms.md §journeys fixes polarity, starts, step numbers and cases;
  // design.md §at-read explicitly requires the refused step to be one of the steps;
  // design.md §restate-checks resolves every action, start lifecycle and phase.
  for (const [label, text] of [
    ['an unknown polarity', journey({ Polarity: 'sometimes' })],
    ['should-happen with a refused step', journey({ 'Refused step': '1' })],
    ['must-not with an expected end', journey({ Polarity: 'must not', 'Refused step': '1' })],
    ['must-not with no refused step', journey({ Polarity: 'must not', 'Expected end': '-' })],
    ['a refused step outside its steps', journey({ Polarity: 'must not', 'Expected end': '-', 'Refused step': '2' })],
    ['zero steps', journey({}, [])],
    ['numbering that starts at zero', journey({}, [[0, 'Client', 'open', '-', '-', '-']])],
    ['a gap in step numbering', journey({}, [[1, 'Client', 'open', '-', '-', '-'], [3, 'Client', 'close', '-', '-', '-']])],
    ['a repeated step number', journey({}, [[1, 'Client', 'open', '-', '-', '-'], [1, 'Client', 'close', '-', '-', '-']])],
    ['an unresolved action', journey({}, [[1, 'Client', 'missing', '-', '-', '-']])],
    ['a case on an action without cases', journey({}, [[1, 'Client', 'open', '-', '-', 'yes']])],
    ['an unresolved start lifecycle', journey({}, undefined, [['absent', 'one', 'active']])],
    ['a phase outside the start lifecycle', journey({}, undefined, [['ticket', 'one', 'absent']])],
    ['two starts for one entity in one lifecycle', journey({}, undefined, [['ticket', 'one', 'active'], ['ticket', 'one', 'closed']])],
  ]) {
    test(`forms.md §journeys: refuses ${label}`, async () => {
      const dir = await setup();
      await rejected(dir, { [file]: text }, { file });
    });
  }
  for (const value of ['-', 'other']) {
    test(`forms.md §journeys: an action with cases refuses journey Case ${value}`, async () => {
      // forms.md §journeys requires one of the action's cases, not '-' or an unknown key.
      const dir = await setup(casedLifecycle());
      await rejected(dir, { [file]: journey({}, [[1, 'Client', 'open', '-', '-', value]]) }, { file });
    });
  }
  for (const key of ['reach-example', 'kept-example', 'operation-a', 'operation-b', 'operation-not-a', 'operation-not-b']) {
    test(`forms.md §journeys: refuses the reserved written journey key ${key}`, async () => {
      // forms.md §journeys reserves reach-/kept- and this part's choice-derived keys.
      const dir = await setup({ [`${PART}choices/operation/README.md`]: choice() });
      const reserved = `${PART}journeys/${key}/README.md`;
      await rejected(dir, { [reserved]: journey() }, { file: reserved });
    });
  }
  test('forms.md §journeys: choice suffixes are reserved only for a choice in the journey part', async () => {
    // forms.md §journeys only reserves suffix keys belonging to a choice of that part.
    const dir = await setup({
      ...secondPart(),
      'design/parts/beta/choices/operation/README.md': choice({},
        { steps: [[1, 'Client', 'alpha/open', '-', '-', '-']] },
        { steps: [[1, 'Client', 'alpha/close', '-', '-', '-']] }),
    });
    accepted(await submit(dir, { [`${PART}journeys/operation-a/README.md`]: journey() }));
  });
});

describe('forms.md §claims claims', () => {
  const file = `${PART}claims/property/README.md`;
  for (const kind of ['safety', 'liveness', 'structure']) {
    test(`forms.md §claims: accepts claim kind ${kind}`, async () => {
      // forms.md §claims fixes kinds and requires fairness for liveness.
      const dir = await setup({ [`${PART}premises/fair-client/README.md`]: premise() });
      accepted(await submit(dir, { [file]: claim({ Kind: kind, 'Rests on': kind === 'liveness' ? 'fair-client' : 'none' }) }));
    });
  }
  test('forms.md §claims: Rests on resolves premise, boundary, store and choice references', async () => {
    // forms.md §claims enumerates these four kinds of explicit reference.
    const dir = await setup({
      [`${PART}premises/fair-client/README.md`]: premise(),
      [`${PART}choices/operation/README.md`]: choice(),
    });
    accepted(await submit(dir, { [file]: claim({ 'Rests on': 'fair-client, client, store:records, choice:operation' }) }));
  });
  test('forms.md §claims: references can name premises, rows, stores and choices of another part', async () => {
    // forms.md §claims permits references of any part; forms.md §page-rules qualifies them.
    const dir = await setup({ ...secondPart(), [`${PART}premises/fair-client/README.md`]: premise(), [`${PART}choices/operation/README.md`]: choice() });
    accepted(await submit(dir, { 'design/parts/beta/claims/elsewhere/README.md': claim({ 'Rests on': 'alpha/fair-client, alpha/client, store:alpha/records, choice:alpha/operation', Parts: 'alpha, beta' }) }));
  });
  for (const key of ['client', 'ticket', 'records']) {
    test(`forms.md §claims: refuses premise key ${key} already used by a boundary row`, async () => {
      // forms.md §page-rules puts premises and all boundary rows in one key space;
      // design.md §restate-checks checks uniqueness over the restatement after the answer.
      const dir = await setup();
      await rejected(dir, { [`${PART}premises/${key}/README.md`]: premise() });
    });
  }
  test('forms.md §claims: refuses a boundary row key already used by a premise', async () => {
    // forms.md §page-rules, design.md §restate-checks apply in either creation order.
    const dir = await setup({ [`${PART}premises/assumption/README.md`]: premise() });
    await rejected(dir, { [`${PART}boundary.md`]: BASE[`${PART}boundary.md`].replace('| records |', '| assumption |') });
  });
  test('forms.md §claims: a premise and boundary row may share a key in different parts', async () => {
    // forms.md §page-rules scopes uniqueness to a part/span and qualifies foreign
    // references; forms.md §claims permits both premise and boundary references in Rests on.
    const dir = await setup(secondPart());
    accepted(await submit(dir, {
      'design/parts/beta/premises/client/README.md': premise(),
      [file]: claim({ 'Rests on': 'client, beta/client', Parts: 'alpha, beta' }),
    }));
  });
  // forms.md §claims fixes kind, parts and fairness; design.md §restate-checks
  // resolves references to their required kinds and existing parts.
  for (const [label, change] of [
    ['unknown claim kind', { Kind: 'performance' }],
    ['liveness without a fairness premise', { Kind: 'liveness' }],
    ['liveness resting only on a world premise', { Kind: 'liveness', 'Rests on': 'external' }],
    ['no claim parts', { Parts: 'none' }],
    ['an unknown part', { Parts: 'unknown' }],
    ['an unresolved premise or row', { 'Rests on': 'unknown' }],
    ['store applied to a non-store row', { 'Rests on': 'store:client' }],
    ['an unresolved choice premise', { 'Rests on': 'choice:unknown' }],
  ]) {
    test(`forms.md §claims: refuses ${label}`, async () => {
      const dir = await setup({ [`${PART}premises/external/README.md`]: premise({ Class: 'world' }) });
      await rejected(dir, { [file]: claim(change) }, { file });
    });
  }
  test('forms.md §claims: prose mentioning a store and choice creates no implicit Rests-on references', async () => {
    // forms.md §claims: code matches nothing by words; forms.md §store-premises
    // and forms.md §choice-premises create the premises. presentation.md §reading lists dependents.
    const dir = await setup({ [`${PART}choices/operation/README.md`]: choice(), [file]: claim({ Sentence: 'Records and the operation choice keep tickets safe.' }) });
    const assumed = account(dir, 'alpha').parts.find(part => part.ref === 'alpha').assumed;
    for (const name of ['store:alpha/records', 'choice:alpha/operation']) {
      const row = assumed.find(entry => entry.premise === name);
      assert.ok(row);
      assert.deepEqual(row.claims, []);
    }
  });
  for (const engine of ['alloy', 'tlc']) {
    test(`forms.md §claims a claim no covering model can express ${engine === 'alloy' ? 'allows a split to another engine' : 'does not allow a split to the same engine'}`, { skip: !hasToolchain && 'toolchain absent' }, async () => {
      // forms.md §claims gives the claim's parts; models.md §one-model-first to §owed permits a
      // smaller model without unanswered evidence only on an engine different
      // from every model split from, while the covered claim is owed that engine.
      const dir = await setup({
        'design/README.md': twoPartList(), 'design/parts/beta/README.md': '# Archive\n',
        [`${PART}actions.md`]: null, [`${PART}boundary.md`]: null, [LIFE]: null,
        [file]: claim(),
      });
      const model = (modelEngine, parts, entry) => page('Ticket model', [
        ['Engine', modelEngine], ['Parts', parts], ['Entry', entry], ['Type invariant', modelEngine === 'tlc' ? 'TypeOK' : '-'],
      ], '## Bounds\n\n' + table(['Bound', 'Value', 'Meaning'], modelEngine === 'alloy' ? [['scope', '1', 'One ticket.']] : []) +
        '\n## Actions\n\n' + table(['Action', 'Operator', 'Parameters'], []) +
        '\n## Misbehaviours\n\n' + table(['Row', 'Item', 'Operator', 'Parameters'], []) +
        '\n## Phases\n\n' + table(['Lifecycle', 'Over', 'Expression'], []));
      const tla = '---- MODULE Ticket ----\nVARIABLE x\nvars == <<x>>\nInit == x = 0\nTypeOK == x \\in {0}\n====\n';
      accepted(await submit(dir, { 'models/whole/model.md': model('tlc', 'alpha, beta', 'Ticket.tla'), 'models/whole/Ticket.tla': tla }, 'cover:alpha+beta'));
      // engines.md §slot-forms permits a reason encoding on any engine; account.md §items
      // then owes express: for this design claim, without requiring a failed run.
      accepted(await submit(dir, {
        'models/whole/parts/alpha/claims/property/encoding.md': fields([['Cannot express', 'The property needs a relation unavailable in this encoding.']]),
      }, 'slot:whole/parts/alpha/claims/property/encoding'));
      const item = 'express:alpha/claims/property';
      assert.ok(items(dir).some(entry => entry.item === item));
      const entry = engine === 'alloy' ? 'tickets.als' : 'Ticket.tla';
      const files = {
        'models/smaller/model.md': model(engine, 'alpha', entry),
        [`models/smaller/${entry}`]: engine === 'alloy' ? 'module tickets\none sig Ticket {}\n' : tla,
      };
      if (engine === 'alloy') {
        accepted(await submit(dir, files, item));
        // evidence.md §questions asks facts independently of claim progress; evidence.md §bounds fixes
        // this bounds digest and evidence.md §measures fixes Alloy's measures and unset defaults.
        query(dir, ['run']);
        const digest = sha256('scope = 1\n').slice(0, 12);
        const facts = JSON.parse(await read(dir, `models/smaller/facts.${digest}.json`));
        assert.equal(facts.found.outcome, 'reached');
        assert.deepEqual(Object.keys(facts.measures).sort(), ['bitwidth', 'duration', 'scope', 'steps']);
        assert.equal(facts.measures.steps, null);
        assert.equal(facts.measures.bitwidth, null);
      } else await rejected(dir, files, { item });
    });
  }
});

describe('forms.md §premises premises', () => {
  const file = `${PART}premises/assumption/README.md`;
  for (const name of ['world', 'promise', 'fairness', 'atomicity', 'bound', 'omission']) {
    test(`forms.md §premises: accepts premise class ${name}`, async () => {
      // forms.md §premises gives six page classes and the promise provider rule.
      const dir = await setup(secondPart());
      accepted(await submit(dir, { [file]: premise({ Class: name, Provider: name === 'promise' ? 'beta' : 'An outside operator' }) }));
    });
  }
  for (const why of ['impossible', 'not worth the cost', 'not verifiable here']) {
    for (const suffix of ['', ': a deployment observation is required']) {
      test(`forms.md §premises: accepts Why not examined ${why}${suffix ? ' with a reason' : ' alone'}`, async () => {
        // forms.md §premises allows each listed reason alone or followed by ': ' and words.
        const dir = await setup();
        accepted(await submit(dir, { [file]: premise({ 'Why not examined': why + suffix }) }));
      });
    }
  }
  // forms.md §premises limits classes/reasons and forbids the same promise provider;
  // design.md §restate-checks requires a promise's Provider part to exist.
  for (const [label, change] of [
    ['a store phenomena page', { Class: 'store phenomena' }],
    ['a choice premise page', { Class: 'choice' }],
    ['an unknown premise class', { Class: 'probability' }],
    ['an unknown examination reason', { 'Why not examined': 'too difficult' }],
    ['a promise by the same part', { Class: 'promise', Provider: 'alpha' }],
    ['a promise by an unknown part', { Class: 'promise', Provider: 'unknown' }],
  ]) {
    test(`forms.md §premises: refuses ${label}`, async () => {
      const dir = await setup();
      await rejected(dir, { [file]: premise(change) }, { file });
    });
  }
  test('forms.md §premises: one premise page may support several claims', async () => {
    // forms.md §premises permits several dependents on one page; presentation.md §reading
    // lists the one premise and the claims resting on it.
    const dir = await setup();
    accepted(await submit(dir, {
      [file]: premise(), [`${PART}claims/one/README.md`]: claim({ 'Rests on': 'assumption' }),
      [`${PART}claims/two/README.md`]: claim({ 'Rests on': 'assumption', Sentence: 'An open ticket remains available.' }),
    }));
    const rows = account(dir, 'alpha').parts.find(part => part.ref === 'alpha').assumed.filter(entry => entry.premise === 'alpha/premises/assumption');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].claims.length, 2);
  });
});

describe('forms.md §choices choices', () => {
  const file = `${PART}choices/operation/README.md`;
  test('forms.md §choices: both alternatives resolve exactly the cell posed by the choice', async () => {
    // forms.md §choices requires exactly one outcome in both alternatives.
    const dir = await setup();
    accepted(await submit(dir, posedLifecycle()));
  });
  test('forms.md §choices: alternatives may differ in start, polarity, actor, arguments and step count', async () => {
    // forms.md §choices permits alternatives to differ in anything a journey holds;
    // lifecycle findings do not refuse the answer (design.md §restate-checks).
    const dir = await setup();
    const text = choice({ Recommendation: 'b: Closing is preferable.' }, {
      starts: [['ticket', 'ticket-one', 'active']],
      steps: [[1, 'Operator', 'close', 'ticket one', 'ticket-one', '-']],
    }, {
      fields: { Polarity: 'must not', 'Expected end': '-', 'Refused step': '2' },
      steps: [[1, 'Client', 'open', '-', '-', '-'], [2, 'Client', 'open', 'again', '-', '-']],
    });
    accepted(await submit(dir, { [file]: text }));
  });
  test('forms.md §choices: a choice may pose one case while other cases keep their outcomes', async () => {
    // forms.md §choices permits effects only for posed cases, keeping the others.
    const dir = await setup();
    const files = casedLifecycle(['yes: choice:operation<br>no: None.', 'yes: active<br>no: active', 'yes: None.<br>no: None.']);
    files[file] = choice({}, { steps: [[1, 'Client', 'open', '-', '-', 'yes']] }, {
      fields: { Polarity: 'must not', 'Expected end': '-', 'Refused step': '1' },
      steps: [[1, 'Client', 'open', '-', '-', 'yes']],
    }, [['ticket', 'idle', 'open', 'yes: active']], [['ticket', 'idle', 'open', 'yes: None.']]);
    accepted(await submit(dir, files));
  });
  // forms.md §choices fixes the recommendation, alternatives' order,
  // fields and difference; forms.md §page-rules permits no extra page blocks.
  for (const [label, text] of [
    ['unknown recommendation', choice({ Recommendation: 'c: A third way.' })],
    ['recommendation without a reason', choice({ Recommendation: 'a' })],
    ['identical alternatives', choice({}, {}, { steps: [[1, 'Client', 'open', '-', '-', '-']] })],
    ['reversed alternatives', choice().replace('## a', '## temporary').replace('## b', '## a').replace('## temporary', '## b')],
    ['an Origin in an alternative', choice({}, { fields: { Origin: 'stated' } })],
    ['Cites in an alternative', choice({}, { fields: { Cites: CITE } })],
    ['a third alternative', choice() + '\n## c\n\n' + fields([['Polarity', 'should happen'], ['Expected end', 'Done.'], ['Refused step', '-']]) + '\n' + table(['Step', 'Actor', 'Action', 'Arguments', 'Entity', 'Case'], [[1, 'Client', 'open', '-', '-', '-']])],
  ]) {
    test(`forms.md §choices: refuses ${label}`, async () => {
      const dir = await setup();
      await rejected(dir, { [file]: text }, { file });
    });
  }
  test('forms.md §choices: a choice key cannot end in -not', async () => {
    // forms.md §choices forbids the suffix to keep computed journey keys distinct.
    const dir = await setup();
    await rejected(dir, { [`${PART}choices/operation-not/README.md`]: choice() });
  });
  // forms.md §choices requires exactly the posed cells, local
  // lifecycle keys and non-choice outcomes; design.md §restate-checks resolves every name.
  // forms.md §page-rules excludes effects tables from the empty-cell exception.
  for (const [label, a, b] of [
    ['missing effects in one alternative', [], [['ticket', 'idle', 'open', 'None.']]],
    ['a repeated effects row', [['ticket', 'idle', 'open', 'active'], ['ticket', 'idle', 'open', 'active']], [['ticket', 'idle', 'open', 'None.']]],
    ['effects on an unposed cell', [['ticket', 'idle', 'open', 'active'], ['ticket', 'active', 'close', 'closed']], [['ticket', 'idle', 'open', 'None.']]],
    ['an unresolved lifecycle', [['missing', 'idle', 'open', 'active']], [['ticket', 'idle', 'open', 'None.']]],
    ['a qualified lifecycle instead of its local key', [['alpha/ticket', 'idle', 'open', 'active']], [['ticket', 'idle', 'open', 'None.']]],
    ['an unresolved phase', [['ticket', 'missing', 'open', 'active']], [['ticket', 'idle', 'open', 'None.']]],
    ['an unresolved action', [['ticket', 'idle', 'missing', 'active']], [['ticket', 'idle', 'open', 'None.']]],
    ['a choice as an effect outcome', [['ticket', 'idle', 'open', 'choice:operation']], [['ticket', 'idle', 'open', 'None.']]],
    ['an empty effect outcome', [['ticket', 'idle', 'open', '']], [['ticket', 'idle', 'open', 'None.']]],
    ['an unresolved effect outcome', [['ticket', 'idle', 'open', 'missing']], [['ticket', 'idle', 'open', 'None.']]],
  ]) {
    test(`forms.md §choices: refuses ${label}`, async () => {
      const dir = await setup();
      const files = posedLifecycle();
      files[file] = choice({}, {}, {
        fields: { Polarity: 'must not', 'Expected end': '-', 'Refused step': '1' },
        steps: [[1, 'Client', 'open', '-', '-', '-']],
      }, a, b);
      await rejected(dir, files, { file });
    });
  }
  // forms.md §choices: exactly the posed cases, once, with no choice outcome.
  for (const [label, outcome] of [
    ['an effect on a case not posed', 'yes: active<br>no: active'],
    ['a missing posed case outcome', 'no: None.'],
    ['a repeated posed case', 'yes: active<br>yes: None.'],
    ['a choice as a case outcome', 'yes: choice:operation'],
  ]) {
    test(`forms.md §choices: refuses ${label}`, async () => {
      const dir = await setup();
      const files = casedLifecycle(['yes: choice:operation<br>no: None.', 'yes: active<br>no: active', 'yes: None.<br>no: None.']);
      files[file] = choice({}, { steps: [[1, 'Client', 'open', '-', '-', 'yes']] }, {
        fields: { Polarity: 'must not', 'Expected end': '-', 'Refused step': '1' },
        steps: [[1, 'Client', 'open', '-', '-', 'yes']],
      }, [['ticket', 'idle', 'open', outcome]], [['ticket', 'idle', 'open', 'yes: None.']]);
      await rejected(dir, files, { file });
    });
  }
});

describe('design.md §filing parts and filing', () => {
  for (const home of ['design/parts/alpha/', 'design/parts/beta/', 'design/spans/cross/']) {
    test(`design.md §filing: accepts a multi-part claim and journey filed in ${home}`, async () => {
      // design.md §filing: filing in any part/span is permitted; forms.md §page-rules
      // fixes local/foreign reference spelling; design.md §removal writes each page.
      const dir = await setup(secondPart());
      const files = {
        [`${home}claims/shared/README.md`]: claim({ Parts: 'alpha, beta' }),
        [`${home}journeys/shared/README.md`]: journey({}, [[1, 'Client', home === PART ? 'open' : 'alpha/open', '-', '-', '-'], [2, 'Archivist', home === 'design/parts/beta/' ? 'archive' : 'beta/archive', '-', '-', '-']]),
      };
      if (home.startsWith('design/spans/')) files[`${home}README.md`] = '# Cross-part reading\n\nRelates tickets to archives.\n';
      accepted(await submit(dir, files));
      for (const [path, text] of Object.entries(files)) assert.equal(await read(dir, path), text);
    });
  }
  test('design.md §filing: a single-part claim and journey may be filed in a span', async () => {
    // design.md §filing: no rule refuses a claim/journey for its filing folder.
    const dir = await setup();
    accepted(await submit(dir, {
      'design/spans/reading/README.md': '# Reading\n\nGroups the useful paths.\n',
      'design/spans/reading/claims/one/README.md': claim(),
      'design/spans/reading/journeys/one/README.md': journey({}, [[1, 'Client', 'alpha/open', '-', '-', '-']]),
    }));
  });
  test('design.md §filing: a claim pin is unchanged by its part or span folder', async () => {
    // design.md §filing, §pins: references are
    // resolved in canonical text, filing preserves pins, and an acceptance pins the claim.
    const pins = [];
    for (const [home, prefix] of [['design/parts/alpha/', ''], ['design/parts/beta/', 'alpha/'], ['design/spans/cross/', 'alpha/']]) {
      const files = { ...secondPart(), [`${home}claims/shared/README.md`]: claim({ Parts: 'alpha, beta', 'Rests on': `store:${prefix}records` }) };
      if (home.startsWith('design/spans/')) files[`${home}README.md`] = '# Cross-part reading\n\nRelates tickets to archives.\n';
      const dir = await setup(files);
      const on = `${home.split('/')[2]}/claims/shared`;
      pins.push(await decisionPin(dir, await decide(dir, 'accept', on, ['--choice', 'accept', '--words', 'The risk is accepted.'])));
    }
    assert.equal(new Set(pins).size, 1);
  });
  test('design.md §filing: a journey pin is unchanged by its filing folder and equivalent qualified references', async () => {
    // design.md §filing, §pins preserve
    // the pin after equivalent references are resolved; design.md §units makes a journey one unit.
    const pins = [];
    for (const home of ['design/parts/alpha/', 'design/parts/beta/', 'design/spans/cross/']) {
      const files = { ...secondPart(), [`${home}journeys/shared/README.md`]: journey({}, [[1, 'Client', home === PART ? 'open' : 'alpha/open', '-', '-', '-'], [2, 'Archivist', home === 'design/parts/beta/' ? 'archive' : 'beta/archive', '-', '-', '-']]) };
      if (home.startsWith('design/spans/')) files[`${home}README.md`] = '# Cross-part reading\n\nRelates tickets to archives.\n';
      const dir = await setup(files);
      await confirmParts(dir);
      pins.push(await decisionPin(dir, await decide(dir, 'confirm', `${home.split('/')[2]}/journeys/shared`)));
    }
    assert.equal(new Set(pins).size, 1);
  });
  test('design.md §filing: a claim about another part can be a carry basis despite being filed beside the premise', async () => {
    // design.md §filing derives claim parts from Parts, not filing;
    // decisions.md §carry permits a disjoint-part basis (counting awaits establishment),
    // and decisions.md §forma-decide returns each recorded decision path.
    const dir = await setup({ ...secondPart(), [`${PART}premises/external/README.md`]: premise(), [`${PART}claims/basis/README.md`]: claim({ Parts: 'beta' }) });
    const result = await decide(dir, 'carry', 'alpha/premises/external', ['--choice', 'carry', '--words', 'The client never retries.', '--basis', 'alpha/claims/basis']);
    assert.equal(result.recorded.length, 1);
  });
  test('design.md §filing: moving a claim to another folder does not hide its part from the carry-basis check', async () => {
    // design.md §filing keeps the claim's declared parts; decisions.md §carry
    // and decisions.md §forma-decide refuse a same-part basis, recording nothing.
    const dir = await setup({ ...secondPart(), [`${PART}premises/external/README.md`]: premise(), 'design/parts/beta/claims/basis/README.md': claim({ Parts: 'alpha' }) });
    const shown = query(dir, ['show', 'carry', 'alpha/premises/external']);
    const before = await snapshot(dir, { skip: ['work', 'runs'] });
    const result = forma(dir, ['decide', 'carry', 'alpha/premises/external', '--shown', shown.token, '--by', 'Test developer', '--provider', 'fixture', '--model', 'reviewer', '--session', 'developer-session', '--choice', 'carry', '--words', 'The client never retries.', '--basis', 'beta/claims/basis', '--json']);
    assert.equal(result.status, 1);
    assert.ok(result.json.refused.length);
    assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
  });
  for (const home of ['beta', 'cross']) {
    for (const multiPart of [false, true]) {
      test(`design.md §filing: a journey filed in ${home} is judged on the parts of ${multiPart ? 'both named actions' : 'its alpha action alone'}`, async () => {
        // design.md §filing derives journey parts from its actions. models.md §slots
        // requires every part to be covered; models.md §lifecycle-model creates only
        // lifecycles-alpha here. presentation.md §reading exposes model entries.
        const folder = home === 'beta' ? 'design/parts/beta/' : 'design/spans/cross/';
        const steps = [[1, 'Client', 'alpha/open', '-', '-', '-']];
        if (multiPart) steps.push([2, 'Archivist', home === 'beta' ? 'archive' : 'beta/archive', '-', '-', '-']);
        const files = { ...secondPart(), [`${folder}journeys/operation/README.md`]: journey({}, steps) };
        if (home === 'cross') files[`${folder}README.md`] = '# Cross-part reading\n\nRelates tickets to archives.\n';
        const dir = await setup(files);
        await confirmParts(dir);
        await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
        await decide(dir, 'confirm', `${home}/journeys/operation`);
        const part = account(dir).parts.find(entry => entry.ref === home);
        const row = [...part.open, ...part.established].find(entry => entry.ref === `${home}/journeys/operation`);
        assert.ok(row);
        assert.deepEqual(row.models.map(model => model.model), multiPart ? [] : ['lifecycles-alpha']);
      });
    }
  }
});

describe('forms.md §code-premises premises code adds', () => {
  // forms.md §premise-says fixes these words in the reading and box. presentation.md §reading to account.md §box
  // fixes statement/falsifier and reading class, but does not name a provider
  // JSON key or a box class key; inspect their text without inventing those keys.
  function shownWords(dir, args, words) {
    const result = forma(dir, args);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const text = result.stdout.replace(/\s+/g, ' ');
    for (const word of words) assert.ok(text.includes(word), `Missing ${JSON.stringify(word)} in ${args.join(' ')}`);
  }
  function premiseReading(dir, name) {
    // presentation.md §reading fixes a premise entry's fields but not the placement of a
    // computed span premise; locate that entry without choosing its heading.
    const matches = [];
    const visit = value => {
      if (!value || typeof value !== 'object') return;
      if (value.premise === name && Object.hasOwn(value, 'class')) matches.push(value);
      for (const child of Object.values(value)) visit(child);
    };
    visit(account(dir));
    assert.ok(matches.length, `Missing premise ${name}`);
    return matches[0];
  }
  function boxedPremise(dir, name, expected) {
    // account.md §box includes every carried premise and every picked choice.
    const row = query(dir, ['box']).premises.find(entry => entry.premise === name);
    assert.ok(row, `Missing boxed premise ${name}`);
    assert.equal(row.statement, expected.statement);
    assert.equal(row.falsifier, expected.falsifier);
    shownWords(dir, ['box'], [expected.class, expected.provider]);
  }
  // forms.md §store-premises specifies every permitted anomaly set below;
  // fixes its statement/order, class, falsifier and provider.
  const isolationRows = [
    ['read uncommitted', 'dirty read, read skew, lost update, write skew, phantom'],
    ['read committed', 'read skew, lost update, write skew, phantom'],
    ['postgres read committed', 'read skew, lost update, write skew, phantom'],
    ['oracle read committed', 'read skew, lost update, write skew, phantom'],
    ['sql server read committed', 'read skew, lost update, write skew, phantom'],
    ['snapshot isolation', 'write skew, phantom'],
    ['postgres repeatable read', 'write skew, phantom'],
    ['oracle serializable', 'write skew, phantom'],
    ['sql server snapshot', 'write skew, phantom'],
    ['mysql repeatable read', 'lost update, write skew, phantom'],
    ['sql server repeatable read', 'read skew, phantom'],
    ['serializable', 'no anomaly'], ['postgres serializable', 'no anomaly'],
    ['sql server serializable', 'no anomaly'], ['mysql serializable', 'no anomaly'],
    ['cockroachdb serializable', 'no anomaly'],
    ['unknown', 'dirty read, read skew, lost update, write skew, phantom'],
  ];
  for (const [isolation, anomalies] of isolationRows) {
    test(`forms.md §store-premises: ${isolation} has exactly its prescribed store premise and pin`, async () => {
      // presentation.md §reading exposes the premise and precisely these
      // fields, with no carry/pick before one is in force and no claims in this fixture.
      const dir = await setup({ [`${PART}boundary.md`]: BASE[`${PART}boundary.md`].replace('serializable', isolation) });
      const entries = account(dir, 'alpha').parts.find(part => part.ref === 'alpha').assumed;
      const row = entries.find(entry => entry.premise === 'store:alpha/records');
      const statement = `Records permits exactly ${anomalies} and prevents the rest.`;
      assert.ok(row);
      // forms.md §premise-says now requires the provider too; presentation.md §reading leaves its JSON key open.
      shownWords(dir, ['account', 'alpha'], ["the store's documented and measured isolation"]);
      assert.equal(row.class, 'store phenomena');
      assert.equal(row.statement, statement);
      assert.equal(row.falsifier, 'an observed prevented anomaly');
      assert.deepEqual(row.claims, []);
      // decisions.md §carry hashes these three UTF-8 lines with no final LF.
      const pin = sha256(`Statement: ${statement}\nFalsifier: an observed prevented anomaly\nProvider: the store's documented and measured isolation`);
      const carried = await decide(dir, 'carry', 'store:alpha/records', ['--choice', 'carry', '--words', 'an observed prevented anomaly']);
      assert.equal(await decisionPin(dir, carried), pin);
      boxedPremise(dir, 'store:alpha/records', { class: 'store phenomena', statement,
        falsifier: 'an observed prevented anomaly', provider: "the store's documented and measured isolation" });
      // design.md §paths and decisions.md §forma-decide permit only the
      // carry decision write here, not a computed premise page.
      assert.ok(!(await tree(dir)).some(path => path.includes('/premises/') && path.endsWith('/README.md')));
    });
  }

  test('forms.md §store-premises: store premise dependencies require an explicit store reference', async () => {
    // forms.md §claims and forms.md §store-premises distinguish a row
    // reference from its store: premise; presentation.md §reading lists dependents.
    const dir = await setup({
      [`${PART}claims/direct/README.md`]: claim({ 'Rests on': 'store:records' }),
      [`${PART}claims/row-only/README.md`]: claim({ 'Rests on': 'records' }),
    });
    const store = account(dir, 'alpha').parts.find(part => part.ref === 'alpha').assumed.find(entry => entry.premise === 'store:alpha/records');
    assert.equal(store.claims.length, 1);
    assert.ok(JSON.stringify(store.claims).includes('alpha/claims/direct'));
    assert.ok(!JSON.stringify(store.claims).includes('alpha/claims/row-only'));
  });

  test('forms.md §choice-premises: each choice has one computed choice premise carried by its pick', async () => {
    // forms.md §choice-premises gives one choice premise and its explicit dependents;
    // presentation.md §reading includes pick only when in force. forms.md §premise-says fixes
    // the unpicked and picked statement, falsifier and provider.
    const file = `${PART}choices/operation/README.md`;
    const dir = await setup({
      [file]: choice({}, {}, { steps: [[1, 'Client', 'open', '-', '-', '-'], [2, 'Client', 'close', '-', '-', '-']] }),
      [`${PART}claims/chosen/README.md`]: claim({ 'Rests on': 'choice:operation' }),
    });
    const find = () => account(dir, 'alpha').parts.find(part => part.ref === 'alpha').assumed.filter(entry => entry.premise === 'choice:alpha/operation');
    let rows = find();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].class, 'choice');
    assert.equal(rows[0].statement, 'Which operation should happen? Not yet picked.');
    assert.equal(rows[0].falsifier, 'a pick of the other alternative');
    shownWords(dir, ['account', 'alpha'], ["the developer's pick"]);
    assert.equal(rows[0].claims.length, 1);
    assert.ok(!Object.hasOwn(rows[0], 'pick'));
    await decide(dir, 'pick', 'alpha/choices/operation', ['--choice', 'a']);
    rows = find();
    assert.equal(rows.length, 1);
    assert.ok(Object.hasOwn(rows[0], 'pick'));
    const statement = 'Which operation should happen? Picked a. The operation completes.';
    assert.equal(rows[0].statement, statement);
    assert.equal(rows[0].falsifier, 'a pick of the other alternative');
    boxedPremise(dir, 'choice:alpha/operation', { class: 'choice', statement,
      falsifier: 'a pick of the other alternative', provider: "the developer's pick" });
    // design.md §paths and decisions.md §forma-decide: a pick writes
    // its decision, with no premise page.
    assert.ok(!(await tree(dir)).some(path => path.includes('/premises/') && path.endsWith('/README.md')));
  });

  for (const [item, words] of [
    ['drop', 'drop'], ['duplicate', 'duplicate'], ['delay', 'delay'], ['reorder', 'reorder'],
    ['fail-forever', 'fail forever'], ['fail-then-succeed', 'fail then succeed'], ['crash', 'crash'], ['go-silent', 'go silent mid-step'],
  ]) {
    test(`forms.md §struck: striking ${item} adds a world premise`, async () => {
      // forms.md §struck gives the world premise; forms.md §menu
      // gives each menu phrase/path. decisions.md §carry keeps
      // the default falsifier when no words are supplied. presentation.md §reading
      // exposes carry, whose decision name is the basename (decisions.md §decision-file).
      const dir = await setup();
      const on = `strike:alpha/client/${item}`;
      const result = await decide(dir, 'carry', on, ['--choice', 'carry']);
      const entries = account(dir, 'alpha').parts.find(part => part.ref === 'alpha').assumed;
      const row = entries.find(entry => entry.premise === on);
      assert.ok(row);
      assert.equal(row.class, 'world');
      const statement = `Client never does ${words}.`;
      assert.equal(row.statement, statement);
      assert.equal(row.falsifier, `an observed ${words} at Client`);
      shownWords(dir, ['account', 'alpha'], ["the developer's strike"]);
      boxedPremise(dir, on, { class: 'world', statement,
        falsifier: `an observed ${words} at Client`, provider: "the developer's strike" });
      assert.ok(row.carry);
      assert.equal(row.carry.decision, result.recorded[0].split('/').at(-1).replace(/\.md$/, ''));
    });
  }

  test('forms.md §premise-says a picked must-not alternative adds no expected end to its choice premise', async () => {
    // forms.md §journeys, §premise-says: a must-not alternative has no Expected end, and the
    // premise ends after Picked b.; account.md §box admits it through its pick.
    const dir = await setup({
      [`${PART}choices/operation/README.md`]: choice({}, {}, {
        fields: { Polarity: 'must not', 'Expected end': '-', 'Refused step': '1' },
      }),
    });
    await decide(dir, 'pick', 'alpha/choices/operation', ['--choice', 'b']);
    const row = premiseReading(dir, 'choice:alpha/operation');
    const statement = 'Which operation should happen? Picked b.';
    assert.equal(row.class, 'choice');
    assert.equal(row.statement, statement);
    assert.equal(row.falsifier, 'a pick of the other alternative');
    shownWords(dir, ['account'], ["the developer's pick"]);
    boxedPremise(dir, 'choice:alpha/operation', { class: 'choice', statement,
      falsifier: 'a pick of the other alternative', provider: "the developer's pick" });
  });

  test('forms.md §premise-says a strike premise uses the developer edited falsifier in the reading and box', async () => {
    // forms.md §premise-says and decisions.md §carry: before a strike Forma pre-writes the
    // menu's falsifier; the words of the strike in force then supply it.
    const dir = await setup();
    const on = 'strike:alpha/client/go-silent';
    assert.ok(query(dir, ['show', 'carry', on]).shown.includes('an observed go silent mid-step at Client'));
    const falsifier = 'A client stops responding after it opens a ticket.';
    await decide(dir, 'carry', on, ['--choice', 'carry', '--words', falsifier]);
    const row = premiseReading(dir, on);
    const statement = 'Client never does go silent mid-step.';
    assert.equal(row.class, 'world');
    assert.equal(row.statement, statement);
    assert.equal(row.falsifier, falsifier);
    shownWords(dir, ['account'], ["the developer's strike"]);
    boxedPremise(dir, on, { class: 'world', statement, falsifier, provider: "the developer's strike" });
  });

  test('forms.md §premise-says a span premise names both purposes and shared surfaces and its carry supplies the falsifier', async () => {
    // forms.md §surface, §premise-says: purposes use part-key order, independent of the part
    // table. forms.md §premise-says does not fix surface-row order, so either order is allowed.
    const dir = await setup({
      'design/README.md': '# Parts\n\n' + table(['Part', 'Purpose', 'Cites'], [
        ['beta', 'Archives tickets.', CITE], ['alpha', 'Manages tickets.', CITE],
      ]),
      'design/parts/beta/README.md': '# Archive\n',
      [`${PART}boundary.md`]: BASE[`${PART}boundary.md`] + '\n## Surface\n\n' +
        table(['Direction', 'Name', 'Cites'], [['emits', 'created', CITE]]),
      'design/parts/beta/boundary.md': '# Surface\n\n## Surface\n\n' +
        table(['Direction', 'Name', 'Cites'], [['consumes', 'alpha/created', CITE]]),
    });
    const on = 'span:alpha+beta';
    const prefix = 'Manages tickets. and Archives tickets. hold together over what they share: ';
    const statements = [
      `${prefix}emits created, consumes alpha/created.`,
      `${prefix}consumes alpha/created, emits created.`,
    ];
    let row = premiseReading(dir, on);
    assert.equal(row.class, 'span');
    assert.ok(statements.includes(row.statement), row.statement);
    assert.equal(row.falsifier, '-');
    shownWords(dir, ['account'], ["the developer's carry"]);
    const falsifier = 'An emitted ticket is lost before the archive consumes it.';
    await decide(dir, 'carry', on, ['--choice', 'carry', '--words', falsifier]);
    row = premiseReading(dir, on);
    assert.ok(statements.includes(row.statement), row.statement);
    assert.equal(row.falsifier, falsifier);
    boxedPremise(dir, on, { class: 'span', statement: row.statement, falsifier, provider: "the developer's carry" });
  });

  test('forms.md §premise-says lifecycle bounds name phase level and use the carry falsifier', async () => {
    // models.md §lifecycle-model creates the lifecycle model after confirmation. design.md
    // forms.md §premise-says fixes its bound premise before and after decisions.md §carry's carry.
    const dir = await setup({ [`${PART}claims/safe/README.md`]: claim() });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    const on = 'bound:lifecycles-alpha/alpha/safe';
    const statement = 'Beyond phase level on lifecycles-alpha: A closed ticket stays closed.';
    let row = premiseReading(dir, on);
    assert.equal(row.class, 'bound');
    assert.equal(row.statement, statement);
    assert.equal(row.falsifier, '-');
    shownWords(dir, ['account'], ["the developer's carry"]);
    const falsifier = 'Ticket data permits a closed ticket to reopen.';
    await decide(dir, 'carry', on, ['--choice', 'carry', '--words', falsifier]);
    row = premiseReading(dir, on);
    assert.equal(row.statement, statement);
    assert.equal(row.falsifier, falsifier);
    boxedPremise(dir, on, { class: 'bound', statement, falsifier, provider: "the developer's carry" });
  });

  for (const kind of ['safety', 'liveness']) {
    test(`forms.md §premise-says TLC ${kind} bound premises keep model order and omit constraints only for liveness`, { skip: !hasToolchain && 'toolchain absent' }, async () => {
      // forms.md §premise-says fixes the statement; engines.md §bounds bounds a liveness
      // claim by every row except constraint. The parser needs the toolchain.
      const dir = await setup({
        [LIFE]: null,
        [`${PART}actions.md`]: '# Actions\n\n' + table(['Action', 'Actor', 'Sentence', 'Cases', 'Guard', 'Origin', 'Cites'], [
          ['open', 'client', 'Opens a ticket.', 'none', 'none', 'stated', CITE],
        ]),
        [`${PART}boundary.md`]: BASE[`${PART}boundary.md`].replace('| actor | world | person |', '| actor | machine | - |'),
        [`${PART}premises/fair/README.md`]: premise(),
        [`${PART}claims/safe/README.md`]: claim({ Kind: kind, 'Rests on': kind === 'liveness' ? 'fair' : 'none' }),
      });
      const model = page('Bounded tickets', [['Engine', 'tlc'], ['Parts', 'alpha'], ['Entry', 'Ticket.tla'], ['Type invariant', 'TypeOK']],
        '## Bounds\n\n' + table(['Bound', 'Value', 'Meaning'], [
          ['constant Z', '2', 'Two ticket labels.'], ['constraint', 'x = 0', 'Only the initial ticket state.'],
          ['constant A', '1', 'One client.'],
        ]) + '\n## Actions\n\n' + table(['Action', 'Operator', 'Parameters'], [['alpha/open', 'Open', 'none']]) +
        '\n## Misbehaviours\n\n' + table(['Row', 'Item', 'Operator', 'Parameters'], []) +
        '\n## Phases\n\n' + table(['Lifecycle', 'Over', 'Expression'], []));
      const engine = '---- MODULE Ticket ----\nEXTENDS Naturals\nCONSTANTS Z, A\nVARIABLE x\nvars == <<x>>\nInit == x = 0\nTypeOK == x \\in {0, 1}\nOpen == x\' = 1\n====\n';
      accepted(await submit(dir, { 'models/tickets/model.md': model, 'models/tickets/Ticket.tla': engine }, 'cover:alpha'));
      const on = 'bound:tickets/alpha/safe';
      const bounds = kind === 'liveness' ? 'constant Z = 2, constant A = 1' : 'constant Z = 2, constraint = x = 0, constant A = 1';
      const statement = `Beyond its bounds on tickets (${bounds}): A closed ticket stays closed.`;
      let row = premiseReading(dir, on);
      assert.equal(row.class, 'bound');
      assert.equal(row.statement, statement);
      assert.equal(row.falsifier, '-');
      shownWords(dir, ['account'], ["the developer's carry"]);
      const falsifier = 'More tickets or clients invalidate the property.';
      await decide(dir, 'carry', on, ['--choice', 'carry', '--words', falsifier]);
      row = premiseReading(dir, on);
      assert.equal(row.statement, statement);
      assert.equal(row.falsifier, falsifier);
      boxedPremise(dir, on, { class: 'bound', statement, falsifier, provider: "the developer's carry" });
    });
  }
});

// presentation.md §reading fixes the outer account/lifecycle keys; design.md
// lifecycle-tool.md §findings requires reported finding codes but leaves `facts`' inner shape open.
// Search only for those required codes, without imposing a findings JSON schema.
function lifeEntry(dir, key = 'ticket', part = 'alpha') {
  const entry = account(dir).parts.flatMap(p => p.lifecycles).find(l => l.ref === `${part}/lifecycles/${key}`);
  assert.ok(entry, `No account entry for ${part}/lifecycles/${key}`);
  return entry;
}
function lifeFound(dir) { return JSON.stringify(account(dir)); }
function lifeHas(dir, code) { assert.ok(lifeFound(dir).includes(code), `Expected lifecycle finding ${code}`); }
function lifeLacks(dir, ...codes) {
  const found = lifeFound(dir);
  for (const code of codes) assert.ok(!found.includes(code), `Unexpected lifecycle finding ${code}: ${found}`);
}
function lifeActions(rows) {
  return '# Actions\n\n' + table(['Action', 'Actor', 'Sentence', 'Cases', 'Guard', 'Origin', 'Cites'],
    rows.map(([key, sentence, cases = 'none', guard = 'none']) => [key, 'client', sentence, cases, guard, 'stated', CITE]));
}
function lifeOfferNames(dir) {
  return items(dir).filter(i => i.item.startsWith('confirm:alpha/journeys/reach-')).map(i => i.item).sort();
}
function lifeShow(dir, key, kind = 'confirm') { return query(dir, ['show', kind, `alpha/journeys/${key}`]).shown; }
function lifeBlocked(dir, unit) {
  // decisions.md §forma-show: a blocked confirmation is refused in this outer form.
  const result = forma(dir, ['show', 'confirm', unit, '--json']);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.ok(result.json && Array.isArray(result.json.refused) && result.json.refused.length);
}
function lifePicture(dir, expected, key = 'ticket') {
  // lifecycle-tool.md §as-read: source facts, ordered moves and distinct identities,
  // without prescribing the identifier encoding or an XState internal representation.
  const picture = lifeEntry(dir, key).picture;
  assert.equal(picture.format, 1);
  assert.equal(picture.lifecycle, `alpha/lifecycles/${key}`);
  for (const field of ['basis', 'source', 'entity', 'initial', 'ends', 'phases', 'actions', 'cells', 'moves', 'machine', 'mapping', 'marks', 'facts']) {
    assert.ok(Object.hasOwn(picture, field), `missing picture.${field}`);
  }
  assert.deepEqual(picture.phases.map(phase => phase.key), expected.phases);
  assert.equal(picture.initial.phase, expected.initial);
  assert.equal(picture.initial.enteredBy ?? null, expected.enteredBy ?? null);
  assert.deepEqual(picture.ends, expected.ends);
  assert.deepEqual(picture.moves.map(move => [move.from, move.to, move.action, move.case ?? null]),
    expected.moves.map(([from, to, action, caseName = null]) => [from, to, action, caseName]));
  for (const phase of picture.phases) assert.deepEqual([...phase.classes].sort(), [...(expected.classes?.[phase.key] ?? [])].sort(), phase.key);
  assert.equal(new Set(picture.phases.map(phase => phase.id)).size, picture.phases.length);
  assert.equal(new Set(picture.moves.map(move => move.id)).size, picture.moves.length);
  for (const move of picture.moves) {
    assert.equal(typeof move.id, 'string');
    assert.equal(typeof move.cell, 'string');
    assert.deepEqual(move.steps, []);
  }
  assert.equal(picture.source, null);
  assert.deepEqual(picture.marks, []);
  return picture;
}

describe('lifecycle-tool.md §as-read lifecycle pictures and picked cells', () => {
  // Trace: lifecycle-tool.md §as-read; account.md §commands.
  test('lifecycle-tool.md §as-read draws every phase, move and end in the prescribed order', async () => {
    const dir = await setup();
    const before = await snapshot(dir, { skip: ['work', 'runs'] });
    const picture = lifePicture(dir, {
      phases: ['idle', 'active', 'closed'], initial: 'idle', ends: ['closed'],
      moves: [['idle', 'active', 'open'], ['active', 'active', 'open'], ['active', 'closed', 'close']],
    });
    assert.equal(picture.cells.idle.close.kind, 'refused');
    assert.equal(picture.cells.closed.open.kind, 'refused');
    assert.equal(picture.cells.closed.close.kind, 'refused');
    assert.deepEqual(picture.basis.files.find(file => file.path === LIFE), { path: LIFE, sha256: sha256(await read(dir, LIFE)) });
    assert.deepEqual(lifeEntry(dir).picture, picture, 'an identical read retains the same structured picture');
    // account.md §commands: a read makes no tracked write.
    assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
  });

  // Trace: lifecycle-tool.md §as-read; lifecycle-tool.md §findings.
  test('lifecycle-tool.md §as-read orders initial entry, matrix columns, ends and all unlit overlays exactly', async () => {
    const dir = await setup({
      [LIFE]: lifecycle({ Initial: 'idle, entered by open', Ends: 'active, closed' }, [
        ['closed', 'None.', 'None.'], ['idle', '', 'choice:route'], ['active', 'closed', 'active'], ['dead', 'None.', 'None.'],
      ], ['close', 'open']),
      [`${PART}choices/route/README.md`]: choice({}, {}, {},
        [['ticket', 'idle', 'open', 'active']], [['ticket', 'idle', 'open', 'closed']]),
    });
    const picture = lifePicture(dir, {
      phases: ['closed', 'idle', 'active', 'dead'], initial: 'idle', enteredBy: 'open', ends: ['active', 'closed'],
      moves: [['active', 'closed', 'close'], ['active', 'active', 'open']],
      classes: { closed: ['unreachable'], idle: ['posed', 'empty'], active: ['unreachable'], dead: ['unreachable', 'stuck'] },
    });
    assert.equal(picture.cells.idle.close.kind, 'empty');
    assert.equal(picture.cells.idle.open.kind, 'choice');
    assert.equal(picture.cells.idle.open.choice, 'route');
  });

  // Trace: lifecycle-tool.md §as-read; forms.md §lifecycles.
  test('lifecycle-tool.md §as-read emits case moves in written case order and does not draw refused outcomes', async () => {
    const dir = await setup({
      [`${PART}actions.md`]: lifeActions([['open', 'Opens a ticket.', 'zeta, alpha'], ['close', 'Closes a ticket.']]),
      [LIFE]: lifecycle({}, [
        ['idle', 'zeta: closed<br>alpha: active', 'None.'],
        ['active', 'alpha: active<br>zeta: None.', 'closed'],
        ['closed', 'alpha: None.<br>zeta: None.', 'None.'],
      ]),
    });
    const picture = lifePicture(dir, {
      phases: ['idle', 'active', 'closed'], initial: 'idle', ends: ['closed'],
      moves: [['idle', 'closed', 'open', 'zeta'], ['idle', 'active', 'open', 'alpha'], ['active', 'active', 'open', 'alpha'], ['active', 'closed', 'close']],
    });
    assert.equal(picture.cells.active.open.cases.find(item => item.case === 'zeta').outcome.kind, 'refused');
  });

  // lifecycle-tool.md §as-read: identity belongs to the source cell, not its target.
  test('lifecycle-tool.md §as-read a changed target keeps its source move and cell identifiers', async () => {
    const originalDir = await setup();
    const changedDir = await setup({ [LIFE]: lifecycle({}, [['idle', 'closed', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']]) });
    const original = lifeEntry(originalDir).picture;
    const changed = lifeEntry(changedDir).picture;
    const before = original.moves.find(move => move.from === 'idle' && move.action === 'open');
    const after = changed.moves.find(move => move.from === 'idle' && move.action === 'open');
    assert.equal(before.to, 'active');
    assert.equal(after.to, 'closed');
    assert.equal(after.id, before.id);
    assert.equal(after.cell, before.cell);
    for (const phase of changed.phases) assert.equal(phase.id, original.phases.find(before => before.key === phase.key).id);
  });

  // Trace: lifecycle-tool.md §as-read; presentation.md §showings; decisions.md §pick.
  test('lifecycle-tool.md §as-read a pick fills its posed cell without changing the lifecycle pin', async () => {
    const dir = await setup({
      [LIFE]: lifecycle({}, [['idle', 'choice:route', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']]),
      [`${PART}choices/route/README.md`]: choice({}, {}, { fields: { Polarity: 'must not', 'Expected end': '-', 'Refused step': '1' } },
        [['ticket', 'idle', 'open', 'active']], [['ticket', 'idle', 'open', 'closed']]),
    });
    await confirmParts(dir);
    const before = await decisionPin(dir, await decide(dir, 'confirm', 'alpha/lifecycles/ticket'));
    lifeHas(dir, 'posed-cell');
    await decide(dir, 'pick', 'alpha/choices/route', ['--choice', 'a']);
    lifeLacks(dir, 'posed-cell');
    const picture = lifeEntry(dir).picture;
    assert.ok(picture.moves.some(move => move.from === 'idle' && move.to === 'active' && move.action === 'open' && move.case === null));
    assert.equal(picture.cells.idle.open.filledBy, 'alpha/choices/route');
    assert.equal(picture.cells.idle.open.pick, 'a');
    assert.ok(picture.basis.picks.some(fill => fill.choice === 'alpha/choices/route' && fill.pick === 'a'));
    const shown = query(dir, ['show', 'confirm', 'alpha/lifecycles/ticket']).shown;
    assert.ok(shown.includes('choice route, picked a: active'));
    assert.equal(await decisionPin(dir, await decide(dir, 'confirm', 'alpha/lifecycles/ticket')), before);
    assert.equal(await read(dir, LIFE), lifecycle({}, [['idle', 'choice:route', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']]));
  });
});

describe('lifecycle-tool.md §stepping stepping journeys', () => {
  // Trace: lifecycle-tool.md §stepping; lifecycle-tool.md §findings.
  test('lifecycle-tool.md §stepping unaffected actions neither admit nor refuse in that lifecycle', async () => {
    const dir = await setup({
      [`${PART}lifecycles/checkpoint/README.md`]: lifecycle({ Unaffected: 'open', Initial: 'ready', Ends: 'done' }, [['ready', 'done'], ['done', 'done']], ['close']),
      [`${PART}journeys/complete/README.md`]: journey({}, [[1, 'Client', 'open', '-', '-', '-'], [2, 'Client', 'close', '-', '-', '-']]),
    });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/journeys/complete');
    lifeLacks(dir, 'step-refused', 'step-entity');
  });

  // Trace: lifecycle-tool.md §stepping; lifecycle-tool.md §findings.
  test('lifecycle-tool.md §stepping an entering action enters the initial phase instead of reading its cell', async () => {
    const dir = await setup({
      [LIFE]: lifecycle({ Initial: 'idle, entered by open' }, [['idle', 'None.', 'closed'], ['closed', 'None.', 'None.']]),
      [`${PART}journeys/create/README.md`]: journey({}, [[1, 'Client', 'open', '-', '-', '-'], [2, 'Client', 'close', '-', '-', '-']]),
    });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/journeys/create');
    lifeLacks(dir, 'step-refused', 'creates-existing-entity');
  });

  for (const [label, starts, entity] of [
    ['the default entity', [], '-'],
    ['one of several named entities', [['ticket', 'present', 'idle']], 'absent'],
  ]) {
    // lifecycle-tool.md §stepping Entities and lifecycle-tool.md §findings step-refused: an entered-by entity
    // without a start row is absent even when its initial-phase cell admits close.
    test(`lifecycle-tool.md §stepping refuses another action on ${label} until its entering action occurs`, async () => {
      const dir = await setup({
        [LIFE]: lifecycle({ Initial: 'idle, entered by open' }, [['idle', 'None.', 'closed'], ['closed', 'None.', 'None.']]),
        [`${PART}journeys/too-early/README.md`]: journey({}, [[1, 'Client', 'close', '-', entity, '-']], starts),
      });
      lifeHas(dir, 'step-refused');
      lifeLacks(dir, 'step-entity', 'unchecked');
      await confirmParts(dir);
      lifeBlocked(dir, 'alpha/journeys/too-early');
      lifeBlocked(dir, 'alpha/lifecycles/ticket');
    });
  }

  // lifecycle-tool.md §stepping Entities: a start row already holds an entered-by entity;
  // it may take an ordinary action without first taking the entering action.
  test('lifecycle-tool.md §stepping a start row makes an entered-by entity present before its first step', async () => {
    const dir = await setup({
      [LIFE]: lifecycle({ Initial: 'idle, entered by open' }, [['idle', 'None.', 'closed'], ['closed', 'None.', 'None.']]),
      [`${PART}journeys/present/README.md`]: journey({}, [[1, 'Client', 'close', '-', '-', '-']], [['ticket', 'sample', 'idle']]),
    });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/journeys/present');
    lifeLacks(dir, 'step-refused', 'step-entity', 'creates-existing-entity');
  });

  for (const [label, outcome, cases] of [
    ['an empty action cell', '', false],
    ['a posed action cell', 'choice:route', false],
    ['an empty case outcome', 'fast: <br>slow: active', true],
    ['a posed case outcome', 'fast: choice:route<br>slow: active', true],
  ]) {
    // lifecycle-tool.md §stepping Steps: refusal by any moved lifecycle wins over unknown
    // cells in every other lifecycle, before unchecked or later-step findings.
    test(`lifecycle-tool.md §stepping a refusal takes precedence over ${label} in another lifecycle`, async () => {
      const posed = outcome.includes('choice:');
      const stepCase = cases ? 'fast' : '-';
      const dir = await setup({
        [`${PART}actions.md`]: lifeActions([['open', 'Opens a ticket.', cases ? 'fast, slow' : 'none'], ['close', 'Closes a ticket.']]),
        [LIFE]: lifecycle({}, [
          ['idle', cases ? 'fast: None.<br>slow: active' : 'None.', 'closed'],
          ['active', cases ? 'fast: active<br>slow: active' : 'active', 'closed'],
          ['closed', cases ? 'fast: None.<br>slow: None.' : 'None.', 'None.'],
        ]),
        [`${PART}lifecycles/a-unknown/README.md`]: lifecycle({}, [
          ['idle', outcome, 'closed'],
          ['active', cases ? 'fast: active<br>slow: active' : 'active', 'closed'],
          ['closed', cases ? 'fast: None.<br>slow: None.' : 'None.', 'None.'],
        ]),
        ...(posed ? { [`${PART}choices/route/README.md`]: choice({},
          { steps: [[1, 'Client', 'open', '-', '-', stepCase]] },
          { fields: { Polarity: 'must not', 'Expected end': '-', 'Refused step': '1' }, steps: [[1, 'Client', 'open', '-', '-', stepCase]] },
          [['a-unknown', 'idle', 'open', cases ? 'fast: active' : 'active']],
          [['a-unknown', 'idle', 'open', cases ? 'fast: closed' : 'closed']]) } : {}),
        [`${PART}journeys/refusal-first/README.md`]: journey({}, [
          [1, 'Client', 'open', '-', '-', stepCase], [2, 'Client', 'close', '-', 'unneeded', '-'],
        ]),
      });
      lifeHas(dir, 'step-refused');
      lifeLacks(dir, 'unchecked', 'step-entity');
      await confirmParts(dir);
      lifeBlocked(dir, 'alpha/journeys/refusal-first');
      lifeBlocked(dir, 'alpha/lifecycles/ticket');
    });
  }

  // Trace: lifecycle-tool.md §stepping; lifecycle-tool.md §findings.
  test('lifecycle-tool.md §stepping entities in start rows keep independent phases through multiple steps', async () => {
    const dir = await setup({
      [`${PART}journeys/two-tickets/README.md`]: journey({}, [
        [1, 'Client', 'close', '-', 'first', '-'], [2, 'Client', 'open', '-', 'second', '-'], [3, 'Client', 'close', '-', 'second', '-'],
      ], [['ticket', 'first', 'active'], ['ticket', 'second', 'idle']]),
    });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/journeys/two-tickets');
    lifeLacks(dir, 'step-refused', 'step-entity', 'start-phase');
  });

  // Trace: lifecycle-tool.md §stepping; lifecycle-tool.md §findings.
  test('lifecycle-tool.md §stepping a name assigned to another moved lifecycle is not an extra entity here', async () => {
    const dir = await setup({
      [`${PART}lifecycles/checkpoint/README.md`]: lifecycle({ Initial: 'ready', Ends: 'done', Unaffected: 'open' }, [['ready', 'done'], ['done', 'done']], ['close']),
      [`${PART}journeys/two-kinds/README.md`]: journey({}, [[1, 'Client', 'close', '-', 'first', '-']], [
        ['ticket', 'first', 'active'], ['ticket', 'second', 'active'], ['checkpoint', 'checkpoint', 'ready'],
      ]),
    });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/journeys/two-kinds');
    lifeLacks(dir, 'step-refused', 'step-entity');
  });

  // Trace: forms.md §actions; lifecycle-tool.md §stepping; lifecycle-tool.md §findings.
  test('lifecycle-tool.md §stepping guards are data conditions and do not refuse an admitted phase move', async () => {
    const dir = await setup({
      [`${PART}actions.md`]: lifeActions([['open', 'Opens a ticket.', 'none', 'The account has credit.'], ['close', 'Closes a ticket.']]),
      [`${PART}journeys/open/README.md`]: journey(),
    });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/journeys/open');
    lifeLacks(dir, 'step-refused');
  });

  // Trace: lifecycle-tool.md §stepping; lifecycle-tool.md §findings.
  test('lifecycle-tool.md §stepping an action moves only lifecycles of its own part', async () => {
    const dir = await setup({
      'design/README.md': '# Ticket system\n\n' + table(['Part', 'Purpose', 'Cites'], [['alpha', 'Manages tickets.', CITE], ['beta', 'Tracks completion.', CITE]]),
      'design/parts/beta/README.md': '# Completion\n',
      'design/parts/beta/actions.md': '# Actions\n\n' + table(['Action', 'Actor', 'Sentence', 'Cases', 'Guard', 'Origin', 'Cites'], [['reset', 'alpha/client', 'Resets completion.', 'none', 'none', 'stated', CITE]]),
      'design/parts/beta/lifecycles/completion/README.md': lifecycle({ Entity: 'alpha/ticket', Initial: 'waiting', Ends: 'done' }, [['waiting', 'done'], ['done', 'None.']], ['reset']),
      [`${PART}journeys/both/README.md`]: journey({}, [[1, 'Client', 'beta/reset', '-', '-', '-'], [2, 'Client', 'open', '-', '-', '-']]),
    });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/journeys/both');
    lifeLacks(dir, 'step-refused', 'unchecked');
  });

  // Trace: lifecycle-tool.md §stepping; lifecycle-tool.md §findings.
  test('lifecycle-tool.md §stepping a refused step stops stepping before a later invalid Entity', async () => {
    const dir = await setup({
      [`${PART}journeys/stopped/README.md`]: journey({}, [
        [1, 'Client', 'close', '-', '-', '-'], [2, 'Client', 'open', '-', 'extra', '-'],
      ]),
    });
    lifeHas(dir, 'step-refused');
    lifeLacks(dir, 'step-entity');
  });

  for (const refusedAction of ['close', 'open']) {
    // Trace: lifecycle-tool.md §stepping; lifecycle-tool.md §findings.
    test(`lifecycle-tool.md §stepping must-not stops at its refused step whether ${refusedAction} is admitted or refused`, async () => {
      const dir = await setup({
        [`${PART}journeys/negative/README.md`]: journey({ Polarity: 'must not', 'Expected end': '-', 'Refused step': '1' }, [
          [1, 'Client', refusedAction, '-', '-', '-'], [2, 'Client', 'close', '-', 'extra', '-'],
        ]),
      });
      await confirmParts(dir);
      await decide(dir, 'confirm', 'alpha/journeys/negative');
      lifeLacks(dir, 'step-refused', 'step-entity');
    });
  }

  // Trace: lifecycle-tool.md §stepping; design.md §code-journeys.
  test('lifecycle-tool.md §stepping a must-not refused step contributes no reached phase even when admitted', async () => {
    const dir = await setup({
      [`${PART}journeys/negative/README.md`]: journey({ Polarity: 'must not', 'Expected end': '-', 'Refused step': '1' }),
    });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/journeys/negative');
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    assert.ok(lifeOfferNames(dir).includes('confirm:alpha/journeys/reach-ticket--active'));
  });

  // Trace: lifecycle-tool.md §stepping; design.md §code-journeys.
  test('lifecycle-tool.md §stepping phases held at a journey start and after its admitted steps are reached', async () => {
    const dir = await setup({
      [`${PART}journeys/finish/README.md`]: journey({}, [[1, 'Client', 'close', '-', '-', '-']], [['ticket', 'the-ticket', 'active']]),
    });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/journeys/finish');
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    assert.deepEqual(lifeOfferNames(dir), []);
  });

  for (const [label, outcome, cases] of [
    ['an empty action cell', '', false],
    ['a posed action cell', 'choice:route', false],
    ['an empty case outcome', 'fast: <br>slow: active', true],
    ['a posed case outcome', 'fast: choice:route<br>slow: active', true],
  ]) {
    // lifecycle-tool.md §stepping, §findings: unknown movement stops stepping,
    // reports unchecked on the journey and blocks that journey's confirmation.
    // Trace: lifecycle-tool.md §stepping; lifecycle-tool.md §findings; account.md §items.
    test(`lifecycle-tool.md §stepping meeting ${label} reports unchecked and ends stepping`, async () => {
      const posed = outcome.includes('choice:');
      const stepCase = cases ? 'fast' : '-';
      const dir = await setup({
        [`${PART}actions.md`]: lifeActions([['open', 'Opens a ticket.', cases ? 'fast, slow' : 'none'], ['close', 'Closes a ticket.']]),
        [LIFE]: lifecycle({}, [
          ['idle', outcome, 'None.'],
          ['active', cases ? 'fast: active<br>slow: active' : 'active', 'closed'],
          ['closed', cases ? 'fast: None.<br>slow: None.' : 'None.', 'None.'],
        ]),
        ...(posed ? {
          [`${PART}choices/route/README.md`]: choice({},
            { steps: [[1, 'Client', 'open', '-', '-', stepCase]] },
            { fields: { Polarity: 'must not', 'Expected end': '-', 'Refused step': '1' }, steps: [[1, 'Client', 'open', '-', '-', stepCase]] },
            [['ticket', 'idle', 'open', cases ? 'fast: active' : 'active']],
            [['ticket', 'idle', 'open', cases ? 'fast: closed' : 'closed']]),
        } : {}),
        [`${PART}journeys/unknown/README.md`]: journey({}, [
          [1, 'Client', 'open', '-', '-', stepCase],
          [2, 'Client', 'close', '-', 'unneeded', '-'],
        ]),
      });
      lifeHas(dir, 'unchecked');
      lifeLacks(dir, 'step-refused', 'step-entity');
      await confirmParts(dir);
      lifeBlocked(dir, 'alpha/journeys/unknown');
      assert.ok(items(dir).find(i => i.item === 'confirm:alpha/journeys/unknown').waits.includes('findings:alpha'));
    });
  }
});

// These lifecycle-engine checks use only the CLI and tracked evidence. The
// journey's confirmation predates each lifecycle edit, so engine behavior can
// be checked without confirming a journey that the tool now marks unchecked.
describe('lifecycle-tool.md §stepping lifecycle questions after lifecycle edits', () => {
  // evidence.md §lifecycle-journeys, §currency: an unpicked posed cell suppresses the question,
  // preserving its old evidence as not current; a pick makes it askable again.
  // lifecycle-tool.md §findings allows the posed lifecycle itself to be reconfirmed.
  test('lifecycle-tool.md §stepping a posed step keeps confirmed journey evidence without asking its question until picked', async () => {
    const ref = 'alpha/journeys/opening';
    const dir = await setup({ [`${PART}journeys/opening/README.md`]: journey() });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    await decide(dir, 'confirm', ref);
    query(dir, ['run']);
    const initial = account(dir, ref).thing.evidence.find(entry => entry.model === 'lifecycles-alpha');
    assert.ok(initial && initial.current);
    const question = initial.question;
    const path = `models/${question}.json`;
    const before = await read(dir, path);
    accepted(await submit(dir, {
      [LIFE]: lifecycle({}, [['idle', 'choice:route', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']]),
      [`${PART}choices/route/README.md`]: choice({}, {}, { fields: { Polarity: 'must not', 'Expected end': '-', 'Refused step': '1' }, steps: [[1, 'Client', 'open', '-', '-', '-']] },
        [['ticket', 'idle', 'open', 'active']], [['ticket', 'idle', 'open', 'closed']]),
    }));
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    lifeHas(dir, 'unchecked');
    const pending = items(dir);
    assert.ok(pending.some(item => item.item === 'pick:alpha/choices/route'));
    assert.ok(!pending.some(item => item.item === `confirm:${ref}`));
    assert.ok(!pending.some(item => item.item === `run:${question}`));
    assert.equal(account(dir, ref).thing.evidence.find(entry => entry.question === question).current, false);
    assert.equal(await read(dir, path), before);
    assert.ok(!query(dir, ['run']).ran.some(run => run.name === question));
    assert.equal(await read(dir, path), before);
    await decide(dir, 'pick', 'alpha/choices/route', ['--choice', 'a']);
    assert.ok(items(dir).some(item => item.item === `run:${question}`));
    query(dir, ['run']);
    assert.equal(account(dir, ref).thing.evidence.find(entry => entry.question === question).current, true);
  });

  // evidence.md §lifecycle-journeys, engines.md §lifecycle-engine refuse entry of a present entity in the data
  // engine; lifecycle-tool.md §stepping resets it and lifecycle-tool.md §findings reports creates-existing-entity.
  test('lifecycle-tool.md §stepping the lifecycle engine refuses re-entry that the tool reports as creates-existing-entity', async () => {
    const ref = 'alpha/journeys/create-twice';
    const dir = await setup({
      [`${PART}actions.md`]: lifeActions([['create', 'Creates a ticket.']]),
      [LIFE]: lifecycle({ Initial: 'idle', Ends: 'idle' }, [['idle', 'idle']], ['create']),
      [`${PART}journeys/create-twice/README.md`]: journey({}, [[1, 'Client', 'create', '-', '-', '-'], [2, 'Client', 'create', '-', '-', '-']]),
    });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    await decide(dir, 'confirm', ref);
    query(dir, ['run']);
    const initial = account(dir, ref).thing.evidence.find(entry => entry.model === 'lifecycles-alpha');
    assert.ok(initial && initial.current);
    accepted(await submit(dir, { [LIFE]: lifecycle({ Initial: 'idle, entered by create', Ends: 'idle' }, [['idle', 'idle']], ['create']) }));
    lifeHas(dir, 'creates-existing-entity');
    lifeLacks(dir, 'step-refused');
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    const result = query(dir, ['run']);
    const evidence = JSON.parse(await read(dir, `models/${initial.question}.json`));
    // evidence.md §keys fixes these finding fields and matching behavior.
    assert.deepEqual(evidence.found, { outcome: 'refused', step: 2 });
    assert.equal(evidence.matches, false);
    assert.ok(result.opened.some(name => name.startsWith(`${initial.question}.surprise-`)));
  });
});

describe('lifecycle-tool.md §shortest shortest journeys', () => {
  // Trace: lifecycle-tool.md §shortest; design.md §code-journeys; presentation.md §showings.
  test('lifecycle-tool.md §shortest minimizes length before breaking ties by action key', async () => {
    const dir = await setup({
      [`${PART}actions.md`]: lifeActions([['z', 'Finishes directly.'], ['b', 'Opens by b.'], ['a', 'Opens by a.'], ['finish', 'Finishes.']]),
      [LIFE]: lifecycle({ Ends: 'done' }, [
        ['idle', 'done', 'active', 'active', 'None.'], ['active', 'done', 'active', 'active', 'done'], ['done', 'None.', 'None.', 'None.', 'None.'],
      ], ['z', 'b', 'a', 'finish']),
    });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    assert.ok(lifeShow(dir, 'reach-ticket--active').includes('1 | Client | a | - | - | -'));
    const done = lifeShow(dir, 'reach-ticket--done');
    assert.ok(done.includes('1 | Client | z | - | - | -'));
    assert.ok(!done.includes('2 | Client |'));
  });

  // Trace: lifecycle-tool.md §shortest; design.md §code-journeys; presentation.md §showings.
  test('lifecycle-tool.md §shortest breaks equal action paths by case key instead of written case order', async () => {
    const dir = await setup({
      [`${PART}actions.md`]: lifeActions([['open', 'Opens a ticket.', 'zeta, alpha']]),
      [LIFE]: lifecycle({ Ends: 'done' }, [['idle', 'zeta: done<br>alpha: done'], ['done', 'zeta: None.<br>alpha: None.']], ['open']),
    });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    assert.ok(lifeShow(dir, 'reach-ticket--done').includes(' | - | - | alpha'));
  });

  // Trace: lifecycle-tool.md §shortest; design.md §code-journeys; presentation.md §showings.
  test('lifecycle-tool.md §shortest shortest paths require admission by every lifecycle the action moves', async () => {
    const dir = await setup({
      [`${PART}lifecycles/lock/README.md`]: lifecycle({ Initial: 'locked', Ends: 'unlocked' }, [
        ['locked', 'None.', 'unlocked'], ['unlocked', 'unlocked', 'unlocked'],
      ]),
    });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    await decide(dir, 'confirm', 'alpha/lifecycles/lock');
    assert.deepEqual(lifeOfferNames(dir), []);
  });

  // Trace: lifecycle-tool.md §shortest; design.md §code-journeys; presentation.md §showings.
  test('lifecycle-tool.md §shortest never re-enters a lifecycle entity the shortest journey already holds', async () => {
    const dir = await setup({
      [`${PART}actions.md`]: lifeActions([['open', 'Opens a ticket.'], ['reset', 'Creates a ticket.']]),
      [LIFE]: lifecycle({ Initial: 'idle, entered by reset', Ends: 'active' }, [['idle', 'active', 'None.'], ['active', 'active', 'None.']], ['open', 'reset']),
      [`${PART}lifecycles/counter/README.md`]: lifecycle({ Initial: 'zero', Ends: 'three' }, [
        ['zero', 'zero', 'one'], ['one', 'two', 'one'], ['two', 'two', 'three'], ['three', 'three', 'three'],
      ], ['open', 'reset']),
    });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    await decide(dir, 'confirm', 'alpha/lifecycles/counter');
    const names = lifeOfferNames(dir);
    assert.ok(names.includes('confirm:alpha/journeys/reach-counter--two'));
    assert.ok(!names.includes('confirm:alpha/journeys/reach-counter--three'));
  });

  // lifecycle-tool.md §shortest starts entered-by entities absent; design.md §code-journeys fixes the offered
  // journey's steps; presentation.md §showings displays action keys and a separate Actions block.
  test('lifecycle-tool.md §shortest a shortest journey enters an absent entity before moving it', async () => {
    const dir = await setup({
      [`${PART}actions.md`]: lifeActions([['open', 'Opens a ticket.'], ['create', 'Creates a ticket.']]),
      [LIFE]: lifecycle({ Initial: 'idle, entered by create', Ends: 'active' }, [['idle', 'active', 'None.'], ['active', 'active', 'None.']], ['open', 'create']),
    });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    const shown = lifeShow(dir, 'reach-ticket--active');
    assert.ok(shown.includes('1 | Client | create | - | - | -'), shown);
    assert.ok(shown.includes('2 | Client | open | - | - | -'), shown);
    assert.ok(!shown.includes('3 | Client |'), shown);
  });

  // lifecycle-tool.md §shortest caps stepping at 250,000 combinations per part and reports
  // unchecked on every lifecycle, naming the limit. This counter has a unique
  // next increment: bit n rises only while every lower bit falls. Its final
  // phase needs 262,144 steps, so even an early-stopping search crosses the cap.
  test('lifecycle-tool.md §shortest passing 250000 combinations reports unchecked on every lifecycle of the part', async () => {
    const bitKeys = Array.from({ length: 18 }, (_, i) => `bit-${String(i).padStart(2, '0')}`);
    const increments = bitKeys.map((_, i) => `increment-${String(i).padStart(2, '0')}`);
    const files = {
      [LIFE]: null,
      [`${PART}actions.md`]: lifeActions([...increments.map(key => [key, `Takes ${key}.`]), ['finish', 'Finishes counting.']]),
      [`${PART}lifecycles/goal/README.md`]: lifecycle({ Initial: 'waiting', Ends: 'done', Unaffected: increments.join(', ') }, [['waiting', 'done'], ['done', 'done']], ['finish']),
    };
    for (let bit = 0; bit < bitKeys.length; bit++) {
      const columns = [...increments.slice(bit), 'finish'];
      files[`${PART}lifecycles/${bitKeys[bit]}/README.md`] = lifecycle({
        Initial: 'zero', Ends: 'none', Unaffected: bit ? increments.slice(0, bit).join(', ') : 'none',
      }, [
        ['zero', ...increments.slice(bit).map((_, offset) => offset === 0 ? 'one' : 'None.'), 'None.'],
        ['one', ...increments.slice(bit).map((_, offset) => offset === 0 ? 'None.' : 'zero'), 'one'],
      ], columns);
    }
    const dir = await setup(files);
    const lifecycles = account(dir).parts.find(part => part.ref === 'alpha').lifecycles;
    for (const key of [...bitKeys, 'goal']) {
      const entry = lifecycles.find(life => life.ref === `alpha/lifecycles/${key}`);
      assert.ok(entry, key);
      const facts = JSON.stringify(entry.facts);
      assert.ok(facts.includes('unchecked'), facts);
      // The facts must name the limit, but neither their nested shape nor the
      // reason's prose or numerical spelling is fixed; assert no representation.
    }
  });
});

describe('lifecycle-tool.md §findings findings and their confirmation scope', () => {
  const cases = [
    ['unreachable-phase', lifecycle({ Ends: 'closed, remote' }, [['idle', 'active', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.'], ['remote', 'None.', 'None.']])],
    ['no-way-out', lifecycle({ Ends: 'closed' }, [['idle', 'active', 'None.'], ['active', 'None.', 'None.'], ['closed', 'None.', 'None.']])],
    ['end-way-out', lifecycle({}, [['idle', 'active', 'None.'], ['active', 'active', 'closed'], ['closed', 'active', 'None.']])],
    ['empty-cell', lifecycle({}, [['idle', '', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']])],
  ];
  for (const [code, content] of cases) {
    // Trace: lifecycle-tool.md §findings; account.md §items.
    test(`lifecycle-tool.md §findings ${code} is accepted as a finding and blocks lifecycle confirmation`, async () => {
      const dir = await setup();
      accepted(await submit(dir, { [LIFE]: content }));
      lifeHas(dir, code);
      await confirmParts(dir);
      const pending = items(dir);
      assert.ok(pending.some(i => i.item === 'findings:alpha'));
      assert.ok(pending.find(i => i.item === 'confirm:alpha/lifecycles/ticket').waits.includes('findings:alpha'));
      lifeBlocked(dir, 'alpha/lifecycles/ticket');
    });
  }

  // Trace: lifecycle-tool.md §findings.
  test('lifecycle-tool.md §findings a reachable empty cell suppresses an unreachable-phase finding', async () => {
    const dir = await setup({ [LIFE]: lifecycle({}, [['idle', '', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']]) });
    lifeHas(dir, 'empty-cell');
    lifeLacks(dir, 'unreachable-phase');
  });

  // Trace: lifecycle-tool.md §findings.
  test('lifecycle-tool.md §findings an empty cell in an unreachable phase does not suppress unreachable-phase', async () => {
    const dir = await setup({ [LIFE]: lifecycle({}, [['idle', 'active', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.'], ['remote', '', 'None.']]) });
    lifeHas(dir, 'empty-cell');
    lifeHas(dir, 'unreachable-phase');
  });

  // Trace: lifecycle-tool.md §findings; lifecycle-tool.md §as-read.
  test('lifecycle-tool.md §findings no action columns makes every non-end phase no-way-out', async () => {
    const dir = await setup({ [LIFE]: lifecycle({ Initial: 'idle', Ends: 'none', Unaffected: 'open, close' }, [['idle']], []) });
    lifeHas(dir, 'no-way-out');
    lifePicture(dir, { phases: ['idle'], initial: 'idle', ends: [], moves: [], classes: { idle: ['stuck'] } });
  });

  // Trace: lifecycle-tool.md §findings.
  test('lifecycle-tool.md §findings end phases may refuse everything or have self moves', async () => {
    const dir = await setup({ [LIFE]: lifecycle({}, [['idle', 'active', 'None.'], ['active', 'active', 'closed'], ['closed', 'closed', 'None.']]) });
    lifeLacks(dir, 'no-way-out', 'end-way-out');
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
  });

  // Trace: lifecycle-tool.md §findings.
  test('lifecycle-tool.md §findings a case with an empty outcome is an empty-cell finding', async () => {
    const dir = await setup({
      [`${PART}actions.md`]: lifeActions([['open', 'Opens a ticket.', 'fast, slow'], ['close', 'Closes a ticket.']]),
      [LIFE]: lifecycle({}, [['idle', 'fast: active<br>slow: ', 'None.'], ['active', 'fast: active<br>slow: active', 'closed'], ['closed', 'fast: None.<br>slow: None.', 'None.']]),
    });
    lifeHas(dir, 'empty-cell');
    lifeLacks(dir, 'unreachable-phase');
  });

  // Trace: lifecycle-tool.md §findings; account.md §items.
  test('lifecycle-tool.md §findings posed outcomes count toward potential reachability and do not block confirmation', async () => {
    const dir = await setup({
      [LIFE]: lifecycle({}, [['idle', 'choice:route', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']]),
      [`${PART}choices/route/README.md`]: choice({}, {}, { fields: { Polarity: 'must not', 'Expected end': '-', 'Refused step': '1' } },
        [['ticket', 'idle', 'open', 'active']], [['ticket', 'idle', 'open', 'closed']]),
    });
    lifeHas(dir, 'posed-cell');
    lifeLacks(dir, 'unreachable-phase', 'empty-cell');
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    assert.ok(!items(dir).some(i => i.item === 'findings:alpha'));
  });

  // Trace: lifecycle-tool.md §as-read; lifecycle-tool.md §findings.
  test('lifecycle-tool.md §findings a posed case is reported and a pick fills only that case', async () => {
    const dir = await setup({
      [`${PART}actions.md`]: lifeActions([['open', 'Opens a ticket.', 'fast, slow'], ['close', 'Closes a ticket.']]),
      [LIFE]: lifecycle({}, [['idle', 'fast: choice:route<br>slow: active', 'None.'], ['active', 'fast: active<br>slow: active', 'closed'], ['closed', 'fast: None.<br>slow: None.', 'None.']]),
      [`${PART}choices/route/README.md`]: choice({},
        { steps: [[1, 'Client', 'open', '-', '-', 'fast']] }, { steps: [[1, 'Client', 'open', '-', '-', 'slow']] },
        [['ticket', 'idle', 'open', 'fast: active']], [['ticket', 'idle', 'open', 'fast: closed']]),
    });
    lifeHas(dir, 'posed-cell');
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    await decide(dir, 'pick', 'alpha/choices/route', ['--choice', 'a']);
    lifeLacks(dir, 'posed-cell');
    const picture = lifeEntry(dir).picture;
    const moves = picture.moves.filter(move => move.from === 'idle' && move.action === 'open');
    assert.deepEqual(moves.map(move => [move.case, move.to]), [['fast', 'active'], ['slow', 'active']]);
    assert.notEqual(moves[0].id, moves[1].id, 'parallel case moves retain separate source identities');
    assert.notEqual(moves[0].cell, moves[1].cell);
    const cases = picture.cells.idle.open.cases;
    assert.equal(cases.find(item => item.case === 'fast').outcome.filledBy, 'alpha/choices/route');
    assert.equal(cases.find(item => item.case === 'slow').outcome.filledBy, undefined);
  });

  // Trace: lifecycle-tool.md §as-read; lifecycle-tool.md §findings.
  test('lifecycle-tool.md §findings start-phase bears on both the journey and its unreachable lifecycle', async () => {
    const dir = await setup({
      [LIFE]: lifecycle({}, [['idle', 'choice:route', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']]),
      [`${PART}choices/route/README.md`]: choice({}, {}, {}, [['ticket', 'idle', 'open', 'active']], [['ticket', 'idle', 'open', 'closed']]),
      [`${PART}journeys/from-remote/README.md`]: journey({}, [[1, 'Client', 'close', '-', '-', '-']], [['ticket', 'ticket', 'active']]),
    });
    lifeHas(dir, 'start-phase');
    lifeLacks(dir, 'unreachable-phase');
    await confirmParts(dir);
    lifeBlocked(dir, 'alpha/journeys/from-remote');
    lifeBlocked(dir, 'alpha/lifecycles/ticket');
  });

  // Trace: lifecycle-tool.md §findings.
  test('lifecycle-tool.md §findings even an unconfirmed step-refused journey blocks every lifecycle refusing it', async () => {
    const dir = await setup({
      [`${PART}lifecycles/second/README.md`]: lifecycle(),
      [`${PART}journeys/refused/README.md`]: journey({}, [[1, 'Client', 'close', '-', '-', '-']]),
    });
    lifeHas(dir, 'step-refused');
    await confirmParts(dir);
    for (const unit of ['alpha/journeys/refused', 'alpha/lifecycles/ticket', 'alpha/lifecycles/second']) lifeBlocked(dir, unit);
  });

  // Trace: lifecycle-tool.md §findings.
  test('lifecycle-tool.md §findings a step-refused finding does not block a lifecycle that admitted the step', async () => {
    const dir = await setup({
      [`${PART}lifecycles/second/README.md`]: lifecycle({ Initial: 'ready', Ends: 'none', Unaffected: 'open' }, [['ready', 'ready']], ['close']),
      [`${PART}journeys/refused/README.md`]: journey({}, [[1, 'Client', 'close', '-', '-', '-']]),
    });
    lifeHas(dir, 'step-refused');
    await confirmParts(dir);
    lifeBlocked(dir, 'alpha/lifecycles/ticket');
    await decide(dir, 'confirm', 'alpha/lifecycles/second');
  });

  // Trace: lifecycle-tool.md §stepping; lifecycle-tool.md §findings.
  test('lifecycle-tool.md §findings creates-existing-entity blocks the journey and still enters the initial phase', async () => {
    const dir = await setup({
      [LIFE]: lifecycle({ Initial: 'idle, entered by open' }, [['idle', 'None.', 'closed'], ['closed', 'None.', 'None.']]),
      [`${PART}journeys/recreate/README.md`]: journey({}, [
        [1, 'Client', 'open', '-', '-', '-'], [2, 'Client', 'close', '-', '-', '-'],
        [3, 'Client', 'open', '-', '-', '-'], [4, 'Client', 'close', '-', '-', '-'],
      ]),
    });
    lifeHas(dir, 'creates-existing-entity');
    lifeLacks(dir, 'step-refused');
    await confirmParts(dir);
    lifeBlocked(dir, 'alpha/journeys/recreate');
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
  });

  for (const [label, entity, starts] of [
    ['missing name among several', '-', [['ticket', 'first', 'active'], ['ticket', 'second', 'active']]],
    ['unneeded name for a single entity', 'single', []],
  ]) {
    // Trace: lifecycle-tool.md §stepping; lifecycle-tool.md §findings.
    test(`lifecycle-tool.md §findings step-entity reports ${label} and bears only on the journey`, async () => {
      const dir = await setup({ [`${PART}journeys/entity/README.md`]: journey({}, [[1, 'Client', 'open', '-', entity, '-']], starts) });
      lifeHas(dir, 'step-entity');
      await confirmParts(dir);
      lifeBlocked(dir, 'alpha/journeys/entity');
      await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    });
  }

  // Trace: lifecycle-tool.md §findings; design.md §at-read; door.md §read-checks.
  test('lifecycle-tool.md §findings unchecked reports a needed page that counts for nothing', async () => {
    const dir = await setup({ [`${PART}journeys/open/README.md`]: journey() });
    await writeFiles(dir, { [`${PART}actions.md`]: BASE[`${PART}actions.md`] + '\nUnreceipted edit.\n' });
    lifeHas(dir, 'unchecked');
    assert.ok(items(dir).some(i => i.item === `change:${PART}actions.md`));
  });

  // Trace: lifecycle-tool.md §findings; design.md §at-read.
  test('lifecycle-tool.md §findings unchecked reports unresolved references and failed placement on a read', async () => {
    for (const content of [lifecycle({ Entity: 'absent' }), lifecycle({}, [['idle', 'active'], ['active', 'closed'], ['closed', 'None.']], ['open'])]) {
      const dir = await setup({ [LIFE]: content });
      lifeHas(dir, 'unchecked');
      assert.ok(items(dir).some(i => i.item === 'restate:alpha'));
    }
  });

  // account.md §items assigns a posed cell's engine flag to pick:, not
  // restate:flagged. engines.md §lifecycle-engine admits every phase at that posed cell,
  // and evidence.md §flags fixes the one flag produced by this fully reachable small model.
  test('lifecycle-tool.md §findings a posed cell engine flag owes its pick without a flagged Restate item', async () => {
    const slot = 'lifecycles-alpha/parts/alpha/claims/safe';
    const dir = await setup({
      [`${PART}claims/safe/README.md`]: claim({ Origin: 'added' }),
      [LIFE]: lifecycle({}, [['idle', 'active', 'choice:route'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']]),
      [`${PART}choices/route/README.md`]: choice({}, {}, {}, [['ticket', 'idle', 'close', 'active']], [['ticket', 'idle', 'close', 'closed']]),
      [`${PART}journeys/opening/README.md`]: journey(),
    });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    await decide(dir, 'confirm', 'alpha/journeys/opening');
    // account.md §journey-rules and evidence.md §questions require the confirmed positive path
    // to conform before the base property is run.
    accepted(await submit(dir, { [`models/${slot}/encoding.md`]: table(['Lifecycle', 'From', 'Action', 'To'], [['ticket', 'closed', 'open', 'active']]) }, `slot:${slot}/encoding`));
    query(dir, ['run']);
    const reading = account(dir, 'alpha/claims/safe');
    const base = reading.thing.evidence.find(entry => entry.model === 'lifecycles-alpha' && entry.question.endsWith('/base'));
    assert.ok(base && base.current);
    const evidence = JSON.parse(await read(dir, `models/${base.question}.json`));
    assert.equal(evidence.found.outcome, 'no violation');
    assert.deepEqual(evidence.flags, ['open-pair ticket/idle/close']);
    const pending = items(dir);
    assert.ok(pending.some(item => item.item === 'pick:alpha/choices/route'));
    assert.ok(!pending.some(item => item.item === 'restate:alpha' && item.why === 'flagged'));
  });

  for (const holder of ['lifecycle', 'journey', 'action']) {
    // lifecycle-tool.md §findings unchecked excludes citation-only check-2 failures;
    // design.md §at-read and account.md §items owe passage:unresolved instead.
    test(`lifecycle-tool.md §findings an unresolved ${holder} citation does not make stepping unchecked`, async () => {
      const missing = 'design/brief/overview.md#missing';
      const dir = await setup({
        [LIFE]: lifecycle(holder === 'lifecycle' ? { Cites: missing } : {}),
        [`${PART}actions.md`]: holder === 'action' ? BASE[`${PART}actions.md`].replaceAll(CITE, missing) : BASE[`${PART}actions.md`],
        [`${PART}journeys/open/README.md`]: journey(holder === 'journey' ? { Cites: missing } : {}),
      });
      lifeLacks(dir, 'unchecked', 'step-refused');
      const pending = items(dir);
      assert.ok(pending.some(item => item.item === `passage:${missing}` && item.why === 'unresolved'));
      assert.ok(!pending.some(item => item.item === 'restate:alpha' || item.item === 'findings:alpha'));
    });
  }
});

describe('design.md §code-journeys journeys added by code', () => {
  // Trace: design.md §code-journeys; decisions.md §confirm; presentation.md §showings.
  test('design.md §code-journeys offers phase journeys only after lifecycle confirmation, with the fixed journey fields', async () => {
    const dir = await setup();
    await confirmParts(dir);
    assert.deepEqual(lifeOfferNames(dir), []);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    assert.deepEqual(lifeOfferNames(dir), ['confirm:alpha/journeys/reach-ticket--active', 'confirm:alpha/journeys/reach-ticket--closed']);
    const shown = lifeShow(dir, 'reach-ticket--closed');
    for (const line of ['Polarity: should happen', 'Expected end: Ticket reaches closed.', 'Refused step: -', 'Origin: added',
      '1 | Client | open | - | - | -', '2 | Client | close | - | - | -', `Cites ${CITE}:`]) assert.ok(shown.includes(line), shown);
    assert.ok(!shown.includes('Start:'));
    assert.ok(!(await tree(dir)).some(path => path.startsWith(`${PART}journeys/reach-`)));
    const result = await decide(dir, 'confirm', 'alpha/journeys/reach-ticket--closed');
    assert.ok(result.recorded.every(path => path.startsWith(`${PART}decisions/`)));
    const confirmed = await read(dir, result.recorded[0]);
    assert.ok(confirmed.includes('## Journey\n\n### alpha/journeys/reach-ticket--closed\n'));
    assert.ok(!confirmed.split('## Journey\n')[1].includes('| Lifecycle |'));
    assert.ok(lifeOfferNames(dir).includes('confirm:alpha/journeys/reach-ticket--active'), 'another offered journey reaching active does not suppress its offer');
  });

  // Trace: design.md §code-journeys; account.md §items.
  test('design.md §code-journeys a written journey in a span delays an offer and suppresses it once confirmed', async () => {
    const dir = await setup({
      'design/spans/review/README.md': '# Review\n\nReview follows the ticket.\n',
      'design/spans/review/journeys/open/README.md': journey({}, [[1, 'Client', 'alpha/open', '-', '-', '-']]),
    });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    assert.ok(items(dir).find(i => i.item === 'confirm:alpha/journeys/reach-ticket--active').waits.includes('confirm:review/journeys/open'));
    await decide(dir, 'confirm', 'review/journeys/open');
    assert.ok(!lifeOfferNames(dir).includes('confirm:alpha/journeys/reach-ticket--active'));
    assert.ok(lifeOfferNames(dir).includes('confirm:alpha/journeys/reach-ticket--closed'));
  });

  // design.md §code-journeys; decisions.md §confirm: confirming another journey
  // can remove an offer, but never renumbers a remaining offer or its decision's On.
  // Trace: design.md §code-journeys; decisions.md §confirm; decisions.md §decision-file; presentation.md §showings.
  test('design.md §code-journeys offered keys and decision On stay stable when another phase gains a confirmed journey', async () => {
    const dir = await setup({ [`${PART}journeys/open/README.md`]: journey() });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    assert.deepEqual(lifeOfferNames(dir), ['confirm:alpha/journeys/reach-ticket--active', 'confirm:alpha/journeys/reach-ticket--closed']);
    assert.ok(lifeShow(dir, 'reach-ticket--closed').includes('2 | Client | close | - | - | -'));
    await decide(dir, 'confirm', 'alpha/journeys/open');
    assert.deepEqual(lifeOfferNames(dir), ['confirm:alpha/journeys/reach-ticket--closed']);
    assert.ok(lifeShow(dir, 'reach-ticket--closed').includes('2 | Client | close | - | - | -'));
    const result = await decide(dir, 'confirm', 'alpha/journeys/reach-ticket--closed');
    const record = await read(dir, result.recorded[0]);
    // decisions.md §decision-file fixes the On field; forms.md §page-rules permits table padding.
    assert.equal(fieldValue(record, 'On'), 'alpha/journeys/reach-ticket--closed');
    assert.ok(record.includes('### alpha/journeys/reach-ticket--closed\n'));
  });

  // Trace: forms.md §choices; design.md §code-journeys; design.md §units; presentation.md §showings.
  test('design.md §code-journeys a one-step action pick copies its alternative and creates the other must-not journey', async () => {
    const starts = [['ticket', 'sample', 'active']];
    const dir = await setup({ [`${PART}choices/route/README.md`]: choice({}, { starts }, { starts }) });
    await confirmParts(dir);
    await decide(dir, 'pick', 'alpha/choices/route', ['--choice', 'a']);
    const picked = lifeShow(dir, 'route-a');
    const other = lifeShow(dir, 'route-not-b');
    for (const line of ['Polarity: should happen', 'Expected end: The operation completes.', 'Refused step: -', 'Ticket | sample | active', '1 | Client | open | - | - | -']) assert.ok(picked.includes(line), picked);
    for (const line of ['Polarity: must not', 'Expected end: -', 'Refused step: 1', 'Ticket | sample | active', '1 | Client | close | - | - | -']) assert.ok(other.includes(line), other);
    for (const shown of [picked, other]) { assert.ok(shown.includes(`Cites ${CITE}:`)); assert.ok(!shown.includes('Origin:')); }
    assert.ok(!items(dir).some(i => ['confirm:alpha/journeys/route-a', 'confirm:alpha/journeys/route-not-b'].includes(i.item)));
    assert.ok(!(await tree(dir)).some(path => /^design\/parts\/alpha\/journeys\/route-/.test(path)));
  });

  // Trace: forms.md §choices; design.md §code-journeys; presentation.md §showings.
  test('design.md §code-journeys a case-only difference at one step creates the other must-not journey for a b pick', async () => {
    const dir = await setup({
      [`${PART}actions.md`]: lifeActions([['open', 'Opens a ticket.', 'fast, slow'], ['close', 'Closes a ticket.']]),
      [LIFE]: lifecycle({}, [['idle', 'fast: active<br>slow: active', 'None.'], ['active', 'fast: active<br>slow: active', 'closed'], ['closed', 'fast: None.<br>slow: None.', 'None.']]),
      [`${PART}choices/route/README.md`]: choice({}, { steps: [[1, 'Client', 'open', '-', '-', 'fast']] }, { steps: [[1, 'Client', 'open', '-', '-', 'slow']] }),
    });
    await confirmParts(dir);
    await decide(dir, 'pick', 'alpha/choices/route', ['--choice', 'b']);
    assert.ok(lifeShow(dir, 'route-b').includes(' | - | - | slow'));
    const other = lifeShow(dir, 'route-not-a');
    assert.ok(other.includes('Polarity: must not'));
    assert.ok(other.includes(' | - | - | fast'));
  });

  for (const [label, a, b] of [
    ['different expected ends', {}, { fields: { 'Expected end': 'The ticket is closed.' } }],
    ['different actors', {}, { steps: [[1, 'Operator', 'close', '-', '-', '-']] }],
    ['different arguments', {}, { steps: [[1, 'Client', 'close', 'reason', '-', '-']] }],
    ['different polarities', {}, { fields: { Polarity: 'must not', 'Expected end': '-', 'Refused step': '1' } }],
    ['different step counts', {}, { steps: [[1, 'Client', 'open', '-', '-', '-'], [2, 'Client', 'close', '-', '-', '-']] }],
    ['two changed steps', { steps: [[1, 'Client', 'open', '-', '-', '-'], [2, 'Client', 'close', '-', '-', '-']] }, { steps: [[1, 'Client', 'close', '-', '-', '-'], [2, 'Client', 'open', '-', '-', '-']] }],
  ]) {
    // Trace: forms.md §choices; design.md §code-journeys; decisions.md §forma-show.
    test(`design.md §code-journeys ${label} creates only the picked journey`, async () => {
      const dir = await setup({ [LIFE]: null, [`${PART}README.md`]: '# Tickets\n', [`${PART}choices/route/README.md`]: choice({}, a, b) });
      await confirmParts(dir);
      await decide(dir, 'pick', 'alpha/choices/route', ['--choice', 'a']);
      lifeShow(dir, 'route-a');
      const result = forma(dir, ['show', 'confirm', 'alpha/journeys/route-not-b', '--json']);
      assert.equal(result.status, 1, result.stdout + result.stderr);
    });
  }

  // Trace: design.md §code-journeys; decisions.md §decision-file; presentation.md §showings.
  test('design.md §code-journeys a confirmed offered journey keeps its original steps across a shortest-path change', async () => {
    const dir = await setup();
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    const result = await decide(dir, 'confirm', 'alpha/journeys/reach-ticket--active');
    const record = await read(dir, result.recorded[0]);
    accepted(await submit(dir, { [LIFE]: lifecycle({}, [['idle', 'active', 'active'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']]) }));
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    assert.ok(lifeShow(dir, 'reach-ticket--active').includes('1 | Client | open | - | - | -'));
    assert.equal(await read(dir, result.recorded[0]), record);
    assert.ok(!(await tree(dir)).some(path => path.startsWith(`${PART}journeys/reach-ticket--active/`)));
  });

  // Trace: forms.md §choices; design.md §code-journeys; presentation.md §showings.
  test('design.md §code-journeys equal start rows in different orders still differ at one step', async () => {
    const starts = [['ticket', 'first', 'active'], ['ticket', 'second', 'active']];
    const dir = await setup({
      [`${PART}choices/route/README.md`]: choice({},
        { starts, steps: [[1, 'Client', 'open', '-', 'first', '-']] },
        { starts: [...starts].reverse(), steps: [[1, 'Client', 'close', '-', 'first', '-']] }),
    });
    await confirmParts(dir);
    await decide(dir, 'pick', 'alpha/choices/route', ['--choice', 'a']);
    const other = lifeShow(dir, 'route-not-b');
    assert.ok(other.includes('Polarity: must not'));
    assert.ok(other.includes('1 | Client | close | - | first | -'));
  });

  for (const [label, a, b] of [
    ['different start rows', { starts: [['ticket', 'sample', 'active']] }, { starts: [['ticket', 'sample', 'idle']], steps: [[1, 'Client', 'open', '-', '-', '-']] }],
    ['different entity names', { starts: [['ticket', 'first', 'active'], ['ticket', 'second', 'active']], steps: [[1, 'Client', 'open', '-', 'first', '-']] }, { starts: [['ticket', 'first', 'active'], ['ticket', 'second', 'active']], steps: [[1, 'Client', 'close', '-', 'second', '-']] }],
  ]) {
    // Trace: forms.md §choices; design.md §code-journeys; decisions.md §forma-show.
    test(`design.md §code-journeys ${label} does not add the other must-not journey`, async () => {
      const dir = await setup({ [`${PART}choices/route/README.md`]: choice({}, a, b) });
      await confirmParts(dir);
      await decide(dir, 'pick', 'alpha/choices/route', ['--choice', 'a']);
      lifeShow(dir, 'route-a');
      assert.equal(forma(dir, ['show', 'confirm', 'alpha/journeys/route-not-b', '--json']).status, 1);
    });
  }

  for (const owner of ['alpha', 'review']) {
    // Trace: design.md §code-journeys; lifecycle-tool.md §stepping; decisions.md §kept-journeys; decisions.md §in-force; decisions.md §decision-file.
    test(`design.md §code-journeys reads a kept journey from its historical ruling in ${owner === 'alpha' ? 'a part' : 'a span'}`, async () => {
      const folder = owner === 'alpha' ? 'parts/alpha' : 'spans/review';
      const citeHash = sha256('# System\n\nTickets can be opened and closed by a client. Records retain tickets.');
      // design.md §pins omits Origin from kept journey canonical text;
      // and qualified action references have the same meanings as local ones.
      const journeyPin = sha256([
        'Polarity: must not', 'Expected end: -', 'Refused step: 2', `Cites: ${citeHash}`,
        'Step 1: Client | Opens a ticket. | - | - | -', 'Step 2: Client | Closes a ticket. | - | - | -',
      ].join('\n'));
      const claimPin = sha256([
        'Sentence: A closed ticket stays closed.', 'Kind: safety', 'Stake: A client loses its ticket.',
        'Rests on: ', 'Parts: Manages tickets.', `Cites: ${citeHash}`,
      ].join('\n'));
      const actionPin = sentence => sha256([
        'Actor: Client (actor, world, person, -)', `Sentence: ${sentence}`, 'Cases: ', 'Guard: none', `Cites: ${citeHash}`,
      ].join('\n'));
      // evidence.md §basis, §own-check: historical basis from hand-written
      // lifecycle/encoding bytes and versions, hashed as two-space JSON plus LF.
      // decisions.md §in-force keeps this ruling after model/evidence files go.
      const lifecyclePin = sha256([
        'Entity: Ticket (entity, machine, -, -)', 'Initial: idle', 'Ends: closed', 'Unaffected: ', `Cites: ${citeHash}`,
        ...[
          'Cell: idle | Opens a ticket. | active', 'Cell: idle | Closes a ticket. | None.',
          'Cell: active | Opens a ticket. | active', 'Cell: active | Closes a ticket. | closed',
          'Cell: closed | Opens a ticket. | None.', 'Cell: closed | Closes a ticket. | None.',
        ].sort(),
      ].join('\n'));
      const basis = {
        files: [
          { path: `${PART}actions.md`, sha256: sha256(BASE[`${PART}actions.md`]) },
          { path: LIFE, sha256: sha256(BASE[LIFE]) },
          { path: `models/lifecycles-alpha/${folder}/claims/safe/encoding.md`, sha256: sha256(table(['Lifecycle', 'Phase'], [['ticket', 'closed']])) },
        ],
        entries: [
          { entry: 'alpha/actions/close', pin: actionPin('Closes a ticket.') },
          { entry: 'alpha/actions/open', pin: actionPin('Opens a ticket.') },
          { entry: `${owner}/claims/safe`, pin: claimPin },
          { entry: 'alpha/lifecycles/ticket', pin: lifecyclePin },
        ].sort((a, b) => a.entry < b.entry ? -1 : a.entry > b.entry ? 1 : 0),
        engine: { name: 'lifecycle', version: '0.0.1' }, runtime: { name: 'node', version: '22.0.0' },
        library: { name: 'xstate', version: '5.0.0' }, forma: { version: '0.0.1', source: sha256('historical Forma source\n').slice(0, 12) },
      };
      const digest = sha256(JSON.stringify(basis, null, 2) + '\n');
      const question = `lifecycles-alpha/${folder}/claims/safe/base`;
      const surprise = `${question}.surprise-${digest.slice(0, 12)}`;
      // A second, independently ruled surprise keeps the first ruling in force
      // after a later ruling supersedes only the kept journey's own surprise.
      // evidence.md §basis / evidence.md §own-check: the historical basis digest uses its input bytes.
      const otherBasis = {
        ...basis,
        files: [...basis.files.slice(0, 2), { path: `models/lifecycles-alpha/${folder}/claims/z-other/encoding.md`, sha256: sha256(table(['Lifecycle', 'Phase'], [['ticket', 'idle']])) }],
        entries: basis.entries.map(entry => entry.entry === `${owner}/claims/safe` ? { ...entry, entry: `${owner}/claims/z-other` } : entry),
      };
      const otherDigest = sha256(JSON.stringify(otherBasis, null, 2) + '\n');
      const otherQuestion = `lifecycles-alpha/${folder}/claims/z-other/base`;
      const otherSurprise = `${otherQuestion}.surprise-${otherDigest.slice(0, 12)}`;
      const key = `kept-${digest.slice(0, 12)}`;
      const ref = `${owner}/journeys/${key}`;
      const actionPrefix = owner === 'alpha' ? '' : 'alpha/';
      const keptTables = journey({ Polarity: 'must not', 'Expected end': '-', 'Refused step': '2', Origin: 'added' }, [
        [1, 'Client', `${actionPrefix}open`, '-', '-', '-'], [2, 'Client', `${actionPrefix}close`, '-', '-', '-'],
      ]).split('\n\n').slice(1).join('\n\n');
      const shown = `rule ${surprise}, ${otherSurprise}\n`;
      const ruling = page(`rule ${surprise}, ${otherSurprise}`, [
        ['Kind', 'rule'], ['On', `${surprise}, ${otherSurprise}`], ['Pin', sha256(shown)], ['Verdict', 'model wrong'], ['Level', 'specification'],
        ['Target', '-'], ['Target pin', '-'], ['Basis', '-'], ['Provider', '-'], ['Model', '-'], ['Session', '-'],
        ['By', 'Fixture developer'], ['At', '2000-01-01T00:00:01.000Z'],
      ], '## Words\n\n```text\nRepair the model to preserve the closed state.\n```\n\n## Surprises\n\n' +
        table(['Surprise', 'Question', 'Basis', 'Parts', 'Expected', 'Found'], [
          [surprise, question, digest, 'alpha', 'no violation', 'violation'],
          [otherSurprise, otherQuestion, otherDigest, 'alpha', 'no violation', 'violation'],
        ]) + '\n' +
        table(['Surprise', 'Entry', 'Pin'], [...basis.entries.map(e => [surprise, e.entry, e.pin]), ...otherBasis.entries.map(e => [otherSurprise, e.entry, e.pin])]) +
        '\n## Shown\n\n```text\n' + shown + '```\n\n## Kept\n\n### ' + surprise + '\n\n' + fields([['Journey', ref], ['Pin', journeyPin]]) + '\n' + keptTables +
        '\n### ' + otherSurprise + '\n\n' + fields([['Not kept', 'The violation is in the first state, so the trace has no steps.']]));
      // decisions.md §decision-file: the name comes from bytes, never an implementation.
      const rulingPath = `design/${folder}/claims/safe/decisions/20000101T000001Z-rule-${sha256(ruling).slice(0, 12)}.md`;
      const dir = await setup({
        [`design/${folder}/claims/safe/README.md`]: claim(),
        ...(owner === 'review' ? { 'design/spans/review/README.md': '# Review\n\nReviews the ticket claim.\n' } : {}),
        [rulingPath]: ruling,
      });
      await confirmParts(dir);
      const showing = query(dir, ['show', 'confirm', ref]).shown;
      for (const line of ['Polarity: must not', 'Expected end: -', 'Refused step: 2', 'Origin: added', `2 | Client | ${actionPrefix}close | - | - | -`, `Cites ${CITE}:`]) assert.ok(showing.includes(line), showing);
      assert.ok(!items(dir).some(i => i.item === `confirm:${ref}`), 'the ruling confirms the kept journey at its recorded pin');
      assert.ok(!(await tree(dir)).some(path => path.startsWith(`design/${folder}/journeys/${key}/`)));
      await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
      assert.ok(!lifeOfferNames(dir).includes('confirm:alpha/journeys/reach-ticket--active'), 'kept journeys count when deciding which phases need an offer');
      assert.ok(lifeOfferNames(dir).includes('confirm:alpha/journeys/reach-ticket--closed'), 'the refused step does not reach closed');
      assert.equal(await read(dir, rulingPath), ruling);

      // decisions.md §kept-journeys, §in-force: a later ruling naming this surprise removes
      // its kept journey, even while the old ruling is in force for its other one.
      const laterShown = `rule ${surprise}\n`;
      const later = page(`rule ${surprise}`, [
        ['Kind', 'rule'], ['On', surprise], ['Pin', sha256(laterShown)], ['Verdict', 'property wrong'], ['Level', 'specification'],
        ['Target', '-'], ['Target pin', '-'], ['Basis', '-'], ['Provider', '-'], ['Model', '-'], ['Session', '-'],
        ['By', 'Fixture developer'], ['At', '2000-01-01T00:00:02.000Z'],
      ], '## Words\n\n```text\nThe closing transition is permitted; revise the property.\n```\n\n## Surprises\n\n' +
        table(['Surprise', 'Question', 'Basis', 'Parts', 'Expected', 'Found'], [[surprise, question, digest, 'alpha', 'no violation', 'violation']]) + '\n' +
        table(['Surprise', 'Entry', 'Pin'], basis.entries.map(e => [surprise, e.entry, e.pin])) +
        '\n## Shown\n\n```text\n' + laterShown + '```\n');
      await writeFiles(dir, { [`design/${folder}/claims/safe/decisions/20000101T000002Z-rule-${sha256(later).slice(0, 12)}.md`]: later });
      assert.ok(!items(dir).some(item => item.item === `confirm:${ref}`));
      assert.equal(forma(dir, ['show', 'confirm', ref, '--json']).status, 1);
      assert.ok(lifeOfferNames(dir).includes('confirm:alpha/journeys/reach-ticket--active'));
      assert.equal(await read(dir, rulingPath), ruling);
    });
  }

  // Trace: design.md §code-journeys; lifecycle-tool.md §shortest; presentation.md §showings.
  test('design.md §code-journeys unconfirmed offered journeys are recomputed under their stable keys', async () => {
    const dir = await setup();
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    assert.ok(lifeShow(dir, 'reach-ticket--active').includes('1 | Client | open | - | - | -'));
    accepted(await submit(dir, { [LIFE]: lifecycle({}, [['idle', 'active', 'active'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']]) }));
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    assert.ok(lifeShow(dir, 'reach-ticket--active').includes('1 | Client | close | - | - | -'));
  });

  // design.md §code-journeys; decisions.md §confirm, §expects: declining an offer sends repair of
  // its lifecycle's part, met by a change to that lifecycle's pin. door.md §gives
  // includes the Restate contracts and decisions.md in the repair packet.
  test('design.md §code-journeys declining an offered journey owes repair until its lifecycle pin changes', async () => {
    const dir = await setup();
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    const ruling = await decide(dir, 'decline', 'alpha/journeys/reach-ticket--active', ['--words', 'Close should be allowed to activate an idle ticket.']);
    const decision = ruling.recorded[0].split('/').at(-1).slice(0, -3);
    const repair = `repair:${decision}`;
    assert.ok(items(dir).some(item => item.item === repair));
    const packet = await answerFolder({});
    query(dir, ['give', repair, packet]);
    for (const path of [LIFE, `${PART}actions.md`, 'forma/door.md', 'forma/account.md', 'forma/design.md', 'forma/decisions.md']) {
      assert.notEqual(await read(packet, path), null, path);
    }
    const replacement = lifecycle({}, [['idle', 'active', 'active'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']]);
    accepted(await submit(dir, { [LIFE]: replacement, 'repair.md': fields([['Mechanism', 'Allows close to activate an idle ticket.']]) }, repair));
    assert.ok(!items(dir).some(item => item.item === repair));
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    assert.ok(lifeShow(dir, 'reach-ticket--active').includes('1 | Client | close | - | - | -'));
  });

  // decisions.md §kept-journeys permits a lifecycle base trace, including an entity absent
  // until its entering action, to become a kept journey. design.md §code-journeys reads
  // it from the ruling, and engines.md §lifecycle-engine supplies the actual engine trace.
  test('design.md §code-journeys a lifecycle trace with an initially absent entity becomes a kept journey', async () => {
    const claimPath = `${PART}claims/safe/README.md`;
    const slotFolder = 'models/lifecycles-alpha/parts/alpha/claims/safe';
    const dir = await setup({
      [claimPath]: claim({ Origin: 'added', Sentence: 'A ticket never becomes active.' }),
      [`${PART}actions.md`]: lifeActions([['create', 'Creates a ticket.'], ['open', 'Opens a ticket.']]),
      [LIFE]: lifecycle({ Initial: 'idle, entered by create', Ends: 'active' }, [['idle', 'None.', 'active'], ['active', 'None.', 'active']], ['create', 'open']),
    });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    // account.md §journey-rules progress and evidence.md §questions: a confirmed should-happen
    // journey must conform before the lifecycle model asks its claim's base.
    await decide(dir, 'confirm', 'alpha/journeys/reach-ticket--active');
    accepted(await submit(dir, { [`${slotFolder}/encoding.md`]: table(['Lifecycle', 'Phase'], [['ticket', 'active']]) }, 'slot:lifecycles-alpha/parts/alpha/claims/safe/encoding'));
    query(dir, ['run']);
    const explain = items(dir).find(item => item.item.startsWith('explain:') && item.item.includes('/claims/safe/base'));
    assert.ok(explain);
    const surpriseName = explain.item.slice('explain:'.length);
    const surprise = JSON.parse(await read(dir, `models/${surpriseName}.json`));
    const digest = surpriseName.split('.surprise-').at(-1);
    const explanation = fields([['Question', surprise.question], ['Basis', digest], ['Verdict', 'model wrong'], ['Level', 'specification'], ['Weaker', 'none']]) +
      '\n## Trace\n\nThe client creates a ticket and then opens it.\n\n## Failure shape\n\nThe ticket becomes active after opening.\n\n## Mechanism\n\nOpening admits the forbidden active phase.\n';
    const folder = await answerFolder({ 'explain.md': explanation });
    accepted(forma(dir, ['answer', explain.item, folder, '--provider', 'fixture', '--model', 'explainer', '--session', 'explanation-session', '--json']));
    const waiting = items(dir).find(item => item.item.startsWith('rule:'));
    assert.ok(waiting);
    const result = await decide(dir, 'rule', waiting.item.slice('rule:'.length), ['--verdict', 'model wrong', '--level', 'specification', '--words', 'Opening must preserve the idle state.']);
    const keptRef = `alpha/journeys/kept-${digest}`;
    const record = await read(dir, result.recorded[0]);
    assert.ok(record.includes(`### ${surpriseName}\n`), record);
    assert.ok(record.includes(keptRef), record);
    const shown = query(dir, ['show', 'confirm', keptRef]).shown;
    for (const line of ['Polarity: must not', 'Expected end: -', 'Refused step: 2', 'Origin: added',
      '1 | Client | create | - | - | -', '2 | Client | open | - | - | -']) assert.ok(shown.includes(line), shown);
    assert.ok(!shown.includes('Start:'));
    assert.ok(!items(dir).some(item => item.item === `confirm:${keptRef}`));
    assert.ok(!(await tree(dir)).some(path => path.startsWith(`${PART}journeys/kept-${digest}/`)));
  });

  // Trace: design.md §code-journeys; lifecycle-tool.md §findings; decisions.md §confirm; presentation.md §showings.
  test('design.md §code-journeys breaking a confirmed offered journey makes a conflict until decline permits regeneration', async () => {
    const dir = await setup();
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    await decide(dir, 'confirm', 'alpha/journeys/reach-ticket--active');
    accepted(await submit(dir, { [LIFE]: lifecycle({}, [['idle', 'None.', 'active'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']]) }));
    lifeHas(dir, 'step-refused');
    assert.ok(lifeShow(dir, 'reach-ticket--active', 'decline').includes('1 | Client | open | - | - | -'));
    await decide(dir, 'decline', 'alpha/journeys/reach-ticket--active', ['--words', 'Use the newly intended route.']);
    lifeLacks(dir, 'step-refused');
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    assert.ok(lifeShow(dir, 'reach-ticket--active').includes('1 | Client | close | - | - | -'));
  });

  // Trace: design.md §code-journeys; design.md §pins; decisions.md §in-force; presentation.md §showings.
  test('design.md §code-journeys a decision-backed journey keeps unresolved citations and its confirmation lapses', async () => {
    const dir = await setup();
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    await decide(dir, 'confirm', 'alpha/journeys/reach-ticket--active');
    await writeFiles(dir, { 'design/brief/overview.md': BASE['design/brief/overview.md'].replace('# System', '# Renamed system') });
    assert.ok(items(dir).some(i => i.item === 'confirm:alpha/journeys/reach-ticket--active' && i.why === 'lapsed'));
    assert.ok(lifeShow(dir, 'reach-ticket--active', 'decline').includes(`missing ${CITE}`));
  });
});

// design.md §passages, §pins: canonical texts from the fixture's fields,
// not from Forma. Only the small assembly and hash operations are shared.
const PASSAGE_HASH = sha256('# System\n\nTickets can be opened and closed by a client. Records retain tickets.');
const CLIENT_NAME = 'Client (actor, world, person, -)';
const TICKET_NAME = 'Ticket (entity, machine, -, -)';
function canonicalClaim(overrides = {}) {
  return Object.entries({ Sentence: 'A closed ticket stays closed.', Kind: 'safety', Stake: 'A client loses its ticket.', 'Rests on': '', Parts: 'Manages tickets.', Cites: PASSAGE_HASH, ...overrides }).map(([key, value]) => `${key}: ${value}`).join('\n');
}
function canonicalPremise(overrides = {}) {
  return Object.entries({ Statement: 'The client eventually retries.', Class: 'fairness', 'Why not examined': 'not verifiable here', Falsifier: 'The client never retries.', Provider: 'The client operator', Cites: PASSAGE_HASH, ...overrides }).map(([key, value]) => `${key}: ${value}`).join('\n');
}
function canonicalAction(sentence, overrides = {}) {
  return Object.entries({ Actor: CLIENT_NAME, Sentence: sentence, Cases: '', Guard: 'none', Cites: PASSAGE_HASH, ...overrides }).map(([key, value]) => `${key}: ${value}`).join('\n');
}
function canonicalBoundary(names, kind, overrides = {}) {
  return Object.entries({ Names: names, Kind: kind, Side: kind === 'actor' ? 'world' : 'machine', Seam: kind === 'actor' ? 'person' : '-', Isolation: kind === 'store' ? 'serializable' : '-', Reads: kind === 'actor' ? '-' : CLIENT_NAME, Writes: kind === 'actor' ? '-' : CLIENT_NAME, Cites: PASSAGE_HASH, ...overrides }).map(([key, value]) => `${key}: ${value}`).join('\n');
}
async function confirmedPin(dir, unit) {
  await confirmParts(dir);
  return decisionPin(dir, await decide(dir, 'confirm', unit));
}

describe('design.md §units units and entry names', () => {
  // Trace: design.md §units; design.md §pins; account.md §items.
  test('design.md §units stated actions, claims, premises, boundary and surface rows share one unit', async () => {
    const dir = await setup({
      [`${PART}claims/safe/README.md`]: claim(), [`${PART}premises/fair/README.md`]: premise(),
      [`${PART}boundary.md`]: BASE[`${PART}boundary.md`] + '\n## Surface\n\n' + table(['Direction', 'Name', 'Cites'], [['emits', 'created', CITE]]),
    });
    const names = items(dir).filter(i => i.item.startsWith('confirm:')).map(i => i.item).sort();
    assert.deepEqual(names, ['confirm:alpha/lifecycles/ticket', 'confirm:alpha/stated', 'confirm:parts']);
    const entries = [
      ...['Opens a ticket.', 'Closes a ticket.'].map(v => `actions\n${canonicalAction(v)}`),
      `claims\n${canonicalClaim()}`, `premises\n${canonicalPremise()}`,
      `boundary\n${canonicalBoundary('Client', 'actor')}`,
      `boundary\n${canonicalBoundary('Ticket', 'entity')}`,
      `boundary\n${canonicalBoundary('Records', 'store')}`,
      `surface\nDirection: emits\nName: created\nCites: ${PASSAGE_HASH}`,
    ];
    assert.equal(await confirmedPin(dir, 'alpha/stated'), sha256(entries.sort().join('\n')));
  });
  // Trace: design.md §units; design.md §pins; account.md §items.
  test('design.md §units no stated unit exists for an empty part and span claims form their own stated unit', async () => {
    const dir = await setup({
      [`${PART}actions.md`]: null, [`${PART}boundary.md`]: null, [LIFE]: null,
      'design/spans/flow/README.md': '# Flow\n\nDescribes the flow.\n',
      'design/spans/flow/claims/safe/README.md': claim(),
    });
    const names = items(dir).map(i => i.item);
    assert.ok(!names.includes('confirm:alpha/stated'));
    assert.ok(names.includes('confirm:flow/stated'));
    assert.equal(await confirmedPin(dir, 'flow/stated'), sha256(`claims\n${canonicalClaim()}`));
  });
  for (const [kind, key, text] of [
    ['claims', 'safe', claim({ Origin: 'added' })], ['premises', 'fair', premise({ Origin: 'added' })],
    ['journeys', 'visit', journey({ Origin: 'added' })],
  ]) {
    // Trace: design.md §units; design.md §pins; account.md §items; account.md §commands.
    test(`design.md §units added ${kind} has its exact entry/unit name`, async () => {
      const dir = await setup({ [`${PART}${kind}/${key}/README.md`]: text });
      assert.ok(items(dir).some(i => i.item === `confirm:alpha/${kind}/${key}` && i.on === `alpha/${kind}/${key}`));
    });
  }
  // Trace: forms.md §surface; design.md §units; account.md §items.
  test('design.md §units added actions and boundary rows, source-only surface rows, omissions and lifecycles have separate units', async () => {
    const source = 'design/brief/sources/events.md#events';
    const omission = 'design/brief/work.md#work';
    const dir = await setup({
      'design/brief/sources/events.md': '---\ntitle: Events\nauthor: Writer\ndate: "unknown"\norigin: Supplied by developer\n---\n# Events\n',
      [`${PART}actions.md`]: BASE[`${PART}actions.md`].replaceAll('| stated |', '| added |'),
      [`${PART}boundary.md`]: BASE[`${PART}boundary.md`].replaceAll('| stated |', '| added |') + '\n## Surface\n\n' + table(['Direction', 'Name', 'Cites'], [['reads', 'records', source]]),
      [`${PART}omissions.md`]: '# Omitted\n\n' + table(['Passage', 'Reason'], [[omission, 'Out of scope.']]),
      [LIFE]: lifecycle({ Origin: 'added' }),
    });
    assert.deepEqual(items(dir).filter(i => i.item.startsWith('confirm:')).map(i => i.item).sort(), [
      'confirm:alpha/actions/close', 'confirm:alpha/actions/open', 'confirm:alpha/boundary/client',
      'confirm:alpha/boundary/records', 'confirm:alpha/boundary/ticket', 'confirm:alpha/lifecycles/ticket',
      `confirm:alpha/omissions/${omission}`, 'confirm:alpha/surface/reads/records', 'confirm:parts',
    ].sort());
  });
  // Trace: design.md §units; account.md §items; decisions.md §forma-show.
  test('design.md §units choices are picked and never confirmed as units', async () => {
    const dir = await setup({ [`${PART}choices/operation/README.md`]: choice() });
    const names = items(dir).map(i => i.item);
    assert.ok(names.includes('pick:alpha/choices/operation'));
    assert.ok(!names.includes('confirm:alpha/choices/operation'));
    await confirmParts(dir);
    const result = forma(dir, ['show', 'confirm', 'alpha/choices/operation', '--json']);
    assert.equal(result.status, 1);
    assert.ok(result.json.refused.length);
  });
});

describe('design.md §pins canonical texts and pins', () => {
  // Trace: design.md §pins.
  test('design.md §pins an initial entering action and Unaffected actions use their semantic replacements', async () => {
    const dir = await setup({ [LIFE]: lifecycle({ Initial: 'idle, entered by open', Ends: 'idle', Unaffected: 'close' }, [['idle', 'None.']], ['open']) });
    const canonical = [`Entity: ${TICKET_NAME}`, 'Initial: idle, entered by Opens a ticket.', 'Ends: idle',
      'Unaffected: Closes a ticket.', `Cites: ${PASSAGE_HASH}`, 'Cell: idle | Opens a ticket. | None.'].join('\n');
    assert.equal(await confirmedPin(dir, 'alpha/lifecycles/ticket'), sha256(canonical));
  });
  // Trace: design.md §pins; lifecycle-tool.md §findings; decisions.md §confirm.
  test('design.md §pins case cells sort case names and retain empty and posed outcomes in their pin', async () => {
    const actions = lifeActions([['open', 'Opens a ticket.', 'yes, no', 'The client is ready.'], ['close', 'Closes a ticket.']]);
    const dir = await setup({
      [`${PART}actions.md`]: actions,
      [LIFE]: lifecycle({ Ends: 'idle' }, [['idle', 'yes: choice:route<br>no: ', '']], ['open', 'close']),
      [`${PART}choices/route/README.md`]: choice({},
        { steps: [[1, 'Client', 'open', '-', '-', 'yes']] },
        { fields: { Polarity: 'must not', 'Expected end': '-', 'Refused step': '1' }, steps: [[1, 'Client', 'open', '-', '-', 'yes']] },
        [['ticket', 'idle', 'open', 'yes: idle']], [['ticket', 'idle', 'open', 'yes: None.']]),
    });
    await confirmParts(dir);
    const canonical = [`Entity: ${TICKET_NAME}`, 'Initial: idle', 'Ends: idle', 'Unaffected: ', `Cites: ${PASSAGE_HASH}`,
      'Cell: idle | Closes a ticket. | (empty)',
      'Cell: idle | Opens a ticket. (cases no, yes) (guard The client is ready.) | no: (empty); yes: choice Which operation should happen?'].join('\n');
    // lifecycle-tool.md §findings blocks this gap; decisions.md §confirm permits decline.
    assert.equal(await decisionPin(dir, await decide(dir, 'decline', 'alpha/lifecycles/ticket', ['--words', 'Fill the unspecified outcomes.'])), sha256(canonical));
  });
  // Trace: forms.md §surface; design.md §pins.
  test('design.md §pins a remote consumed event keeps its event key and replaces the emitting part', async () => {
    const addr = 'design/brief/sources/events.md#events';
    const dir = await setup({
      'design/brief/sources/events.md': '---\ntitle: Events\nauthor: Writer\ndate: "unknown"\norigin: Supplied\n---\n# Events\n',
      'design/README.md': BASE['design/README.md'].replace('\n\n1.', `\n| beta | Stores tickets. | ${CITE} |\n\n1.`),
      'design/parts/beta/README.md': '# Storage\n',
      [`${PART}boundary.md`]: BASE[`${PART}boundary.md`] + '\n## Surface\n\n' + table(['Direction', 'Name', 'Cites'], [['emits', 'created', CITE]]),
      'design/parts/beta/boundary.md': '# Surface\n\n## Surface\n\n' + table(['Direction', 'Name', 'Cites'], [['consumes', 'alpha/created', addr]]),
    });
    assert.equal(await confirmedPin(dir, 'beta/surface/consumes/alpha/created'), sha256(`Direction: consumes\nName: created (Manages tickets.)\nCites: ${sha256('# Events')}`));
  });
  // Trace: forms.md §claims; design.md §pins.
  test('design.md §pins an added claim pin omits its heading, key and Origin and hashes its ordered fields', async () => {
    const dir = await setup({ [`${PART}claims/safe/README.md`]: claim({ Origin: 'added' }) });
    assert.equal(await confirmedPin(dir, 'alpha/claims/safe'), sha256(canonicalClaim()));
  });
  // Trace: forms.md §actions; design.md §pins.
  test('design.md §pins an added action substitutes its actor and preserves guard and case names', async () => {
    const dir = await setup({
      [`${PART}actions.md`]: BASE[`${PART}actions.md`].replace('Opens a ticket. | none | none | stated', 'Opens a ticket. | yes, no | A ticket is available. | added'),
      [LIFE]: lifecycle({}, [['idle', 'yes: active<br>no: idle', 'None.'], ['active', 'yes: active<br>no: active', 'closed'], ['closed', 'yes: None.<br>no: None.', 'None.']]),
    });
    assert.equal(await confirmedPin(dir, 'alpha/actions/open'), sha256(canonicalAction('Opens a ticket.', { Cases: 'no, yes', Guard: 'A ticket is available.' })));
  });
  // Trace: forms.md §boundary; design.md §pins.
  test('design.md §pins an added boundary row resolves and sorts its read/write references', async () => {
    const dir = await setup({ [`${PART}boundary.md`]: BASE[`${PART}boundary.md`].replace('| serializable | client | client | stated |', '| serializable | client | client | added |') });
    assert.equal(await confirmedPin(dir, 'alpha/boundary/records'), sha256(canonicalBoundary('Records', 'store')));
  });
  // Trace: forms.md §premises; design.md §pins.
  test('design.md §pins a premise pin uses its fields, and promise Provider resolves to the part purpose', async () => {
    const dir = await setup({
      'design/README.md': BASE['design/README.md'].replace('\n\n1.', `\n| beta | Stores tickets. | ${CITE} |\n\n1.`),
      'design/parts/beta/README.md': '# Storage\n',
      [`${PART}premises/promise/README.md`]: premise({ Class: 'promise', Provider: 'beta', Origin: 'added' }),
    });
    assert.equal(await confirmedPin(dir, 'alpha/premises/promise'), sha256(canonicalPremise({ Class: 'promise', Provider: 'Stores tickets.' })));
  });
  // Trace: design.md §pins.
  test('design.md §pins claim dependencies substitute premises, boundary rows, stores, choices and parts', async () => {
    const dir = await setup({
      [`${PART}claims/safe/README.md`]: claim({ Origin: 'added', 'Rests on': 'fair, records, store:records, choice:operation' }),
      [`${PART}premises/fair/README.md`]: premise(), [`${PART}choices/operation/README.md`]: choice(),
    });
    const rests = ['The client eventually retries.', 'Records (store, machine, -, serializable)', 'store Records', 'choice Which operation should happen?'].sort().join(', ');
    assert.equal(await confirmedPin(dir, 'alpha/claims/safe'), sha256(canonicalClaim({ 'Rests on': rests })));
  });
  // Trace: forms.md §lifecycles; design.md §pins.
  test('design.md §pins lifecycle fields resolve entity and actions and sorted cells retain phases', async () => {
    const dir = await setup();
    const cells = [
      'Cell: idle | Opens a ticket. | active', 'Cell: idle | Closes a ticket. | None.',
      'Cell: active | Opens a ticket. | active', 'Cell: active | Closes a ticket. | closed',
      'Cell: closed | Opens a ticket. | None.', 'Cell: closed | Closes a ticket. | None.',
    ];
    const canonical = [`Entity: ${TICKET_NAME}`, 'Initial: idle', 'Ends: closed', 'Unaffected: ', `Cites: ${PASSAGE_HASH}`, ...cells.sort()].join('\n');
    assert.equal(await confirmedPin(dir, 'alpha/lifecycles/ticket'), sha256(canonical));
  });
  // Trace: design.md §pins.
  test('design.md §pins journey start rows resolve lifecycle names and steps remain in order', async () => {
    const dir = await setup({ [`${PART}journeys/finish/README.md`]: journey({ 'Expected end': 'The ticket closes.' }, [[1, 'Client', 'close', 'request  42', '-', '-']], [['ticket', 'one', 'active']]) });
    const canonical = ['Polarity: should happen', 'Expected end: The ticket closes.', 'Refused step: -', `Cites: ${PASSAGE_HASH}`, 'Start: Ticket | one | active', 'Step 1: Client | Closes a ticket. | request 42 | - | -'].join('\n');
    assert.equal(await confirmedPin(dir, 'alpha/journeys/finish'), sha256(canonical));
  });
  // Trace: design.md §pins.
  test('design.md §pins omissions hash Passage and Reason only', async () => {
    const addr = 'design/brief/work.md#work';
    const dir = await setup({ [`${PART}omissions.md`]: '# Omitted\n\n' + table(['Passage', 'Reason'], [[addr, 'Outside  this scope.']]) });
    assert.equal(await confirmedPin(dir, `alpha/omissions/${addr}`), sha256(`Passage: ${sha256('# Work\n\nReview the design.')}\nReason: Outside this scope.`));
  });
  // Trace: forms.md §surface; design.md §pins.
  test('design.md §pins a source-only surface row hashes its direction and resolved name', async () => {
    const addr = 'design/brief/sources/events.md#events';
    const dir = await setup({
      'design/brief/sources/events.md': '---\ntitle: Events\nauthor: Writer\ndate: "unknown"\norigin: Supplied\n---\n# Events\n',
      [`${PART}boundary.md`]: BASE[`${PART}boundary.md`] + '\n## Surface\n\n' + table(['Direction', 'Name', 'Cites'], [['reads', 'records', addr]]),
    });
    assert.equal(await confirmedPin(dir, 'alpha/surface/reads/records'), sha256(`Direction: reads\nName: Records (store, machine, -, serializable)\nCites: ${sha256('# Events')}`));
  });
  // Trace: design.md §pins.
  test('design.md §pins choice canonical text holds both alternatives then their sorted effects', async () => {
    const effectsA = [['ticket', 'idle', 'open', 'active']];
    const effectsB = [['ticket', 'idle', 'open', 'idle']];
    const alternativesA = { steps: [[1, 'Client', 'open', '-', '-', '-']] };
    const alternativesB = { fields: { 'Expected end': 'The ticket remains idle.' }, steps: [[1, 'Client', 'open', '-', '-', '-']] };
    const dir = await setup({
      [LIFE]: lifecycle({}, [['idle', 'choice:operation', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']]),
      [`${PART}choices/operation/README.md`]: choice({}, alternativesA, alternativesB, effectsA, effectsB),
    });
    await confirmParts(dir);
    const canonical = ['Question: Which operation should happen?', 'Recommendation: a: Opening is useful.', `Cites: ${PASSAGE_HASH}`,
      'Alternative a', 'Polarity: should happen', 'Expected end: The operation completes.', 'Refused step: -',
      'Step 1: Client | Opens a ticket. | - | - | -', 'Effect: Ticket | idle | Opens a ticket. | active',
      'Alternative b', 'Polarity: should happen', 'Expected end: The ticket remains idle.', 'Refused step: -',
      'Step 1: Client | Opens a ticket. | - | - | -', 'Effect: Ticket | idle | Opens a ticket. | idle'].join('\n');
    assert.equal(await decisionPin(dir, await decide(dir, 'pick', 'alpha/choices/operation', ['--choice', 'a'])), sha256(canonical));
  });
  // Trace: design.md §pins.
  test('design.md §pins sorting uses Unicode code points rather than locale order or UTF-16 order', async () => {
    const low = '\uE000 purpose.';
    const high = '\u{10000} purpose.';
    const dir = await setup({
      'design/README.md': '# Parts\n\n' + table(['Part', 'Purpose', 'Cites'], [['alpha', high, CITE], ['beta', low, CITE]]),
      'design/parts/beta/README.md': '# Beta\n',
    });
    assert.equal(await decisionPin(dir, await confirmParts(dir)), sha256(`Purpose: ${low}\nCites: ${PASSAGE_HASH}\nPurpose: ${high}\nCites: ${PASSAGE_HASH}`));
  });
  // Trace: design.md §pins; design.md §at-read.
  test('design.md §pins unresolved citations enter pins as missing followed by the written address', async () => {
    const addr = 'design/brief/absent.md#absent';
    const dir = await setup({ [`${PART}claims/safe/README.md`]: claim({ Origin: 'added', Cites: addr }) });
    assert.ok(items(dir).some(i => i.item === `passage:${addr}`));
    // design.md §at-read keeps the claim readable; design.md §pins fixes missing.
    assert.equal(await confirmedPin(dir, 'alpha/claims/safe'), sha256(canonicalClaim({ Cites: `missing ${addr}` })));
  });
  // Trace: design.md §pins; design.md §at-read.
  test('design.md §pins a reference to a page that does not count uses missing in its dependent pin', async () => {
    const path = `${PART}premises/fair/README.md`;
    const dir = await setup({ [path]: premise(), [`${PART}claims/safe/README.md`]: claim({ Origin: 'added', 'Rests on': 'fair' }) });
    await writeFiles(dir, { [path]: premise({ Statement: 'A direct unaccepted edit.' }) });
    const missing = items(dir);
    assert.ok(missing.some(i => i.item === `change:${path}`));
    assert.ok(!missing.some(i => i.item === 'restate:alpha'));
    assert.equal(await confirmedPin(dir, 'alpha/claims/safe'), sha256(canonicalClaim({ 'Rests on': 'missing fair' })));
  });
});

describe('design.md §confirmation-pins confirmations follow meaning', () => {
  // Trace: design.md §pins; design.md §confirmation-pins; design.md §removal; decisions.md §decision-file.
  test('design.md §confirmation-pins heading and key changes, whitespace and list order preserve confirmation by content', async () => {
    const oldPath = `${PART}claims/safe/README.md`;
    const newPath = `${PART}claims/renamed/README.md`;
    const dir = await setup({ [oldPath]: claim({ Origin: 'added', 'Rests on': 'ticket, records' }) });
    await confirmedPin(dir, 'alpha/claims/safe');
    const originalDecision = (await snapshot(dir))[Object.keys(await snapshot(dir)).find(p => p.startsWith(`${PART}claims/safe/decisions/`))];
    const rewritten = claim({ Origin: 'added', Sentence: 'A closed   ticket stays closed.', 'Rests on': 'records, ticket' }).replace('# Ticket safety', '# Renamed claim');
    accepted(await submit(dir, { 'removed.md': `${PART}claims/safe\n`, [newPath]: rewritten }));
    assert.ok(!items(dir).some(i => i.item === 'confirm:alpha/claims/renamed'));
    assert.ok(Object.values(await snapshot(`${dir}/${PART}claims/safe/decisions`)).includes(originalDecision));
  });
  for (const [position, columns, rows] of [
    ['middle', ['close', 'Phase', 'open'], [['None.', 'closed', 'None.'], ['closed', 'active', 'active'], ['None.', 'idle', 'active']]],
    ['last', ['close', 'open', 'Phase'], [['None.', 'None.', 'closed'], ['closed', 'active', 'active'], ['None.', 'active', 'idle']]],
  ]) {
    // forms.md §page-rules, §lifecycles permits Phase in any column;
    // design.md §pins, §confirmation-pins keeps the reordered meaning's confirmation.
    // Trace: forms.md §page-rules; forms.md §lifecycles; design.md §pins; design.md §confirmation-pins.
    test(`design.md §confirmation-pins lifecycle row reordering with Phase ${position} preserves confirmation`, async () => {
      const dir = await setup();
      const pin = await confirmedPin(dir, 'alpha/lifecycles/ticket');
      const original = lifeEntry(dir).picture;
      const reordered = page('Ticket state', Object.entries({ Entity: 'ticket', Initial: 'idle', Ends: 'closed', Unaffected: 'none', Origin: 'stated', Cites: CITE }), table(columns, rows));
      accepted(await submit(dir, { [LIFE]: reordered }));
      assert.ok(!items(dir).some(i => i.item === 'confirm:alpha/lifecycles/ticket'));
      assert.equal(await decisionPin(dir, await decide(dir, 'confirm', 'alpha/lifecycles/ticket')), pin);
      // lifecycle-tool.md §as-read uses row/column order for the picture, not its pin.
      const reorderedPicture = lifePicture(dir, {
        phases: ['closed', 'active', 'idle'], initial: 'idle', ends: ['closed'],
        moves: [['active', 'closed', 'close'], ['active', 'active', 'open'], ['idle', 'active', 'open']],
      });
      for (const phase of reorderedPicture.phases) assert.equal(phase.id, original.phases.find(before => before.key === phase.key).id);
      for (const move of reorderedPicture.moves) {
        const before = original.moves.find(before => before.from === move.from && before.action === move.action && before.case === move.case);
        assert.equal(move.id, before.id);
        assert.equal(move.cell, before.cell);
      }
    });
  }
  for (const [label, overrides, answer] of [
    ['entry meaning', {}, { [`${PART}claims/safe/README.md`]: claim({ Origin: 'added', Sentence: 'A closed ticket may reopen.' }) }],
    ['referenced boundary behavior', { 'Rests on': 'records' }, { [`${PART}boundary.md`]: BASE[`${PART}boundary.md`].replace('| serializable |', '| read committed |') }],
    ['referenced premise statement', { 'Rests on': 'fair' }, { [`${PART}premises/fair/README.md`]: premise({ Statement: 'The client retries twice.' }) }],
  ]) {
    // Trace: design.md §pins; design.md §confirmation-pins; account.md §items.
    test(`design.md §confirmation-pins changing ${label} lapses a confirmation even though the answer is accepted`, async () => {
      const dir = await setup({ [`${PART}claims/safe/README.md`]: claim({ Origin: 'added', ...overrides }), [`${PART}premises/fair/README.md`]: premise() });
      await confirmedPin(dir, 'alpha/claims/safe');
      accepted(await submit(dir, answer));
      assert.ok(items(dir).some(i => i.item === 'confirm:alpha/claims/safe' && i.why === 'lapsed'));
    });
  }
  // Trace: design.md §passages; design.md §pins; design.md §confirmation-pins; account.md §items.
  test('design.md §confirmation-pins paragraph rewrapping preserves a pin but a cited passage edit lapses it', async () => {
    const dir = await setup({ [`${PART}claims/safe/README.md`]: claim({ Origin: 'added' }) });
    await confirmedPin(dir, 'alpha/claims/safe');
    await writeFiles(dir, { 'design/brief/overview.md': '# System\n\nTickets can be opened and closed\nby a client. Records retain tickets.\n' });
    assert.ok(!items(dir).some(i => i.item === 'confirm:alpha/claims/safe'));
    await writeFiles(dir, { 'design/brief/overview.md': '# System\n\nTickets cannot be closed.\n' });
    assert.ok(items(dir).some(i => i.item === 'confirm:alpha/claims/safe' && i.why === 'lapsed'));
  });
});

describe('design.md §restate Restate answers, removal and re-filing', () => {
  const claimPath = `${PART}claims/safety/README.md`;
  const journeyPath = `${PART}journeys/opening/README.md`;
  const slotPath = 'models/lifecycles-alpha/parts/alpha/claims/safety/encoding.md';
  const spanPage = '# Shared reading\n\nGroups the ticket rules.\n';
  const movedClaim = 'design/spans/shared/claims/safety/README.md';
  const movedSlot = 'models/lifecycles-alpha/spans/shared/claims/safety/encoding.md';
  const slotItems = new Map();
  const claimSlotItem = 'slot:lifecycles-alpha/parts/alpha/claims/safety';
  const witnessPath = 'models/lifecycles-alpha/parts/alpha/claims/safety/witness-active.md';
  const witnessBytes = fields([['Meaning', 'An opened ticket is active.']]) + '\n' + table(['Lifecycle', 'Phase'], [['ticket', 'active']]);
  const faultPath = 'models/lifecycles-alpha/parts/alpha/claims/safety/fault-reopen.md';
  const faultBytes = fields([['Action', '-'], ['Mechanism', 'Allows a closed ticket to reopen.']]) + '\n' + table(['Lifecycle', 'Phase', 'Action', 'Outcome'], [['ticket', 'closed', 'open', 'active']]);

  // engines.md §slot-forms, models.md §lifecycle-model; evidence.md §questions, §surprise-file:
  // a minimal lifecycle model gives real
  // slots and, when requested, evidence; no fabricated implementation artifacts.
  async function withLifecycleModel({ run = false, surprise = false, slots = false, guarded = false } = {}) {
    const dir = await setup({
      [claimPath]: claim({ Origin: 'added' }), [journeyPath]: journey(),
      ...(guarded ? { [`${PART}actions.md`]: BASE[`${PART}actions.md`].replace('| open | client | Opens a ticket. | none | none |', '| open | client | Opens a ticket. | none | Permission exists. |') } : {}),
    });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    await decide(dir, 'confirm', 'alpha/journeys/opening');
    const encoding = surprise
      ? table(['Lifecycle', 'Phase'], [['ticket', 'active']])
      : table(['Lifecycle', 'From', 'Action', 'To'], [['ticket', 'closed', 'open', 'active']]);
    const owedSlot = items(dir).find(item => item.item.startsWith('slot:') && item.item.endsWith('/parts/alpha/claims/safety/encoding'));
    assert.ok(owedSlot);
    slotItems.set(dir, owedSlot.item);
    accepted(await submit(dir, { [slotPath]: encoding }, owedSlot.item));
    if (slots) {
      // engines.md §slot-forms, models.md §owed: fill additional claim slots before the surprise;
      // engines.md §lifecycle-engine does not compose them into the base question.
      accepted(await submit(dir, { [witnessPath]: witnessBytes }, `${claimSlotItem}/witness`));
      accepted(await submit(dir, { [faultPath]: faultBytes }, `${claimSlotItem}/fault`));
    }
    if (run || surprise) query(dir, ['run']);
    if (surprise) assert.ok(items(dir).some(item => item.item.startsWith('rule:')), 'the forbidden reachable phase opens a surprise');
    return dir;
  }

  async function checkReceipt(dir, path, bytes) {
    const slash = path.lastIndexOf('/');
    const receipt = await read(dir, `${path.slice(0, slash)}/receipt`);
    assert.ok(receipt, `missing receipt for ${path}`);
    // door.md §receipts: every receipt line, including the last, ends in LF.
    assert.ok(receipt.endsWith('\n'));
    const rawLines = receipt.trimEnd().split('\n');
    // door.md §receipts fixes each complete receipt line as JSON.stringify's text.
    for (const line of rawLines) assert.equal(line, JSON.stringify(JSON.parse(line)));
    const lines = rawLines.map(line => JSON.parse(line));
    assert.ok(lines.some(line => line.file === path.slice(slash + 1) && line.sha256 === sha256(bytes)));
  }

  // design.md §restate-holds, §removal; door.md §receipts.
  test('design.md §restate-holds: an answer may contain one page and no removed.md', async () => {
    const dir = await setup();
    const bytes = claim();
    const result = accepted(await submit(dir, { [claimPath]: bytes }));
    assert.ok(result.written.some(file => file.path === claimPath && file.sha256 === sha256(bytes)));
    assert.equal(await read(dir, claimPath), bytes);
    await checkReceipt(dir, claimPath, bytes);
  });

  // design.md §restate-holds, §removal; door.md §receipts.
  test('design.md §restate-holds: a nonempty removed.md may be the answer’s only file', async () => {
    const dir = await setup({ [claimPath]: claim() });
    const result = accepted(await submit(dir, { 'removed.md': `${PART}claims/safety\n` }));
    assert.ok(result.removed.includes(claimPath));
    assert.equal(await read(dir, claimPath), null);
    assert.equal(await read(dir, `${PART}claims/safety/receipt`), null);
    assert.equal(await read(dir, 'removed.md'), null);
  });

  for (const [name, files] of [
    ['an empty answer', {}],
    ['only an empty removal list', { 'removed.md': '' }],
    ['a brief document', { 'design/brief/new.md': '# New\n' }],
    ['a decision', { 'design/decisions/new.md': '# New\n' }],
    ['a receipt', { 'design/receipt': '{}' }],
    ['evidence', { 'models/lifecycles-alpha/parts/alpha/claims/safety/base.json': '{}' }],
    ['a model file', { 'models/core/model.md': '# Model\n' }],
    ['an unowned page path', { [`${PART}notes.md`]: '# Notes\n' }],
    ['a reserved offered-journey page', { [`${PART}journeys/reach-ticket--active/README.md`]: journey() }],
  ]) {
    // design.md §restate-holds, §removal; door.md §receipts.
    test(`design.md §restate-holds: refuses ${name}`, async () => {
      await rejected(await setup(), files);
    });
  }

  for (const [name, removed] of [
    ['a final slash', `${PART}claims/safety/\n`],
    ['a file instead of a thing path', `${claimPath}\n`],
    ['a missing thing', `${PART}claims/absent\n`],
    ['a duplicate path', `${PART}claims/safety\n${PART}claims/safety\n`],
    ['a path outside the restatement', 'design/brief\n'],
  ]) {
    // design.md §restate-holds, §removal; door.md §receipts.
    test(`design.md §restate-holds: removed.md refuses ${name}`, async () => {
      await rejected(await setup({ [claimPath]: claim() }), { 'removed.md': removed });
    });
  }

  // design.md §restate-holds, §removal; door.md §receipts.
  test('design.md §restate-holds: an empty submitted page is a form error and does not remove its page', async () => {
    await rejected(await setup({ [claimPath]: claim() }), { [claimPath]: '' }, { file: claimPath });
  });

  // design.md §restate-holds, §removal; door.md §receipts.
  test('design.md §restate-holds: removing a part removes its front page, tables and every thing page', async () => {
    const dir = await setup({ [claimPath]: claim() });
    accepted(await submit(dir, { 'removed.md': 'design/parts/alpha\n', 'design/README.md': '# No components\n\n' + table(['Part', 'Purpose', 'Cites'], []) }));
    assert.ok(!(await tree(dir)).some(path => path.startsWith(PART) && !path.includes('/decisions/')));
  });

  // design.md §restate-holds, §removal; door.md §receipts.
  test('design.md §restate-holds: removing a span removes its front page and all its things', async () => {
    const dir = await setup({ 'design/spans/shared/README.md': spanPage, [movedClaim]: claim() });
    accepted(await submit(dir, { 'removed.md': 'design/spans/shared\n' }));
    assert.ok(!(await tree(dir)).some(path => path.startsWith('design/spans/shared/')));
  });

  // design.md §restate-applied, §restate-checks; door.md §forma-answer.
  test('design.md §restate-applied: removal precedes replacement within the same answer', async () => {
    const dir = await setup({ [claimPath]: claim() });
    const changed = claim({ Sentence: 'Every ticket has one owner.' });
    accepted(await submit(dir, { 'removed.md': `${PART}claims/safety\n`, [claimPath]: changed }));
    assert.equal(await read(dir, claimPath), changed);
    await checkReceipt(dir, claimPath, changed);
  });

  // design.md §restate-applied, §restate-checks; door.md §forma-answer.
  test('design.md §restate-applied: several mutually referring parts enter in one answer', async () => {
    const dir = await setup({}, { base: false });
    await writeFiles(dir, { 'design/brief/overview.md': BASE['design/brief/overview.md'], 'design/brief/work.md': BASE['design/brief/work.md'] });
    const actions = part => '# Actions\n\n' + table(['Action', 'Actor', 'Sentence', 'Cases', 'Guard', 'Origin', 'Cites'], [['call', `${part}/client`, 'Calls the other client.', 'none', 'none', 'stated', CITE]]);
    const boundary = '# Boundary\n\n## Boundary\n\n' + table(['Row', 'Names', 'Kind', 'Side', 'Seam', 'Isolation', 'Reads', 'Writes', 'Origin', 'Cites'], [['client', 'Client', 'actor', 'world', 'person', '-', '-', '-', 'stated', CITE]]);
    accepted(await submit(dir, {
      'design/README.md': '# Components\n\n' + table(['Part', 'Purpose', 'Cites'], [['alpha', 'Handles requests.', CITE], ['beta', 'Answers requests.', CITE]]),
      [`${PART}README.md`]: '# Alpha\n', [`${PART}actions.md`]: actions('beta'), [`${PART}boundary.md`]: boundary,
      'design/parts/beta/README.md': '# Beta\n', 'design/parts/beta/actions.md': actions('alpha'), 'design/parts/beta/boundary.md': boundary,
    }));
    assert.deepEqual(account(dir).parts.map(part => part.ref), ['alpha', 'beta']);
  });

  // design.md §restate-applied: an existing failure outside the answer is left to its
  // own item; holding a different page of the same part does not inherit it.
  test('design.md §restate-applied: existing unresolved references in untouched pages do not refuse an answer', async () => {
    const dir = await setup({ [claimPath]: claim({ 'Rests on': 'missing-premise' }) });
    accepted(await submit(dir, { [`${PART}README.md`]: '# Reordered reading\n' }));
    assert.ok(items(dir).some(item => item.item === 'restate:alpha'));
  });

  // design.md §restate-applied: checks 2 and 3 refuse every failure in a held page,
  // even when the same failure was present before the answer.
  test('design.md §restate-applied: an existing unresolved reference in a held page still refuses the answer', async () => {
    const bytes = claim({ 'Rests on': 'missing-premise' });
    const dir = await setup({ [claimPath]: bytes });
    await rejected(dir, { [claimPath]: bytes }, { file: claimPath, field: 'Rests on', item: 'restate:alpha' });
  });

  // design.md §restate-applied: failures newly caused elsewhere refuse the answer.
  test('design.md §restate-applied: removing a premise refuses the new failure in an untouched claim', async () => {
    const path = `${PART}premises/reliable/README.md`;
    const dir = await setup({ [path]: premise(), [claimPath]: claim({ 'Rests on': 'reliable' }) });
    await rejected(dir, { 'removed.md': `${PART}premises/reliable\n` }, { file: claimPath, field: 'Rests on' });
  });

  // design.md §restate-applied: an unrelated part's existing check-3 failure does not
  // make repairs of another part wait for it.
  test('design.md §restate-applied: an existing placement failure in another part does not refuse an answer', async () => {
    const dir = await setup({
      [LIFE]: lifecycle({ Unaffected: 'open' }),
      'design/parts/beta/README.md': '# Beta\n',
      'design/README.md': '# Parts\n\n' + table(['Part', 'Purpose', 'Cites'], [['alpha', 'Manages tickets.', CITE], ['beta', 'Reads ticket reports.', CITE]]),
    });
    accepted(await submit(dir, { 'design/parts/beta/claims/report/README.md': claim({ Parts: 'beta' }) }));
    assert.ok(items(dir).some(item => item.item === 'restate:alpha'));
  });

  // design.md §restate-applied, §restate-checks check 3: adding an action newly leaves that
  // action absent from the untouched lifecycle's columns and Unaffected.
  test('design.md §restate-applied: a newly caused placement failure in an untouched lifecycle refuses an answer', async () => {
    const dir = await setup();
    const actions = BASE[`${PART}actions.md`] + `| pause | client | Pauses a ticket. | none | none | stated | ${CITE} |\n`;
    await rejected(dir, { [`${PART}actions.md`]: actions }, { file: LIFE });
  });

  // design.md §restate-applied, §restate-checks; door.md §forma-answer.
  test('design.md §restate-applied: one answer can mend the references of the whole proposed restatement', async () => {
    const dir = await setup({ [claimPath]: claim({ 'Rests on': 'missing-premise' }) });
    accepted(await submit(dir, { [`${PART}premises/missing-premise/README.md`]: premise() }, 'restate:alpha'));
    assert.ok(!items(dir).some(item => item.item === 'restate:alpha'));
  });

  // design.md §restate-applied, §restate-checks; door.md §forma-answer.
  test('design.md §restate-applied: every independent failed check is returned and the item remains missing', async () => {
    const missingClaim = claim({ 'Rests on': 'absent' });
    const missingJourney = journey({}, [[1, 'Client', 'absent', '-', '-', '-']]);
    const dir = await setup();
    const result = await rejected(dir, { [claimPath]: missingClaim, [journeyPath]: missingJourney });
    assert.ok(result.reasons.some(reason => reason.file === claimPath && reason.entry === 'alpha/claims/safety' && reason.field === 'Rests on'));
    assert.ok(result.reasons.some(reason => reason.file === journeyPath && reason.entry === 'alpha/journeys/opening' && reason.field === 'Action'));
    const stillMissing = items(dir).find(item => item.item === WORK);
    assert.ok(stillMissing);
    assert.ok(stillMissing.refused);
  });

  // design.md §restate-applied; door.md §forma-answer, §scratch:
  // refusal preserves tracked bytes while recording spending, session and reasons.
  // design.md §restate-applied, §restate-checks; door.md §forma-answer.
  test('design.md §restate-applied: a refused answer keeps tracked files and records its refusal in scratch', async () => {
    const dir = await setup();
    const before = account(dir).here.answers.spent;
    const result = await rejected(dir, { [claimPath]: claim({ 'Rests on': 'absent' }) });
    assert.equal(result.answers.spent, before + 1);
    const refusal = JSON.parse(await read(dir, `work/refused/${sha256(WORK).slice(0, 12)}.json`));
    assert.equal(refusal.item, WORK);
    assert.deepEqual(refusal.refusals, [result.reasons]);
    assert.ok(JSON.parse(await read(dir, 'work/sessions.json')).some(session =>
      session.provider === AUTHOR.provider && session.model === AUTHOR.model && session.session === AUTHOR.session));
    // account.md §commands: account reads this machine's refusal reasons too.
    assert.ok(account(dir).project.items.find(item => item.item === WORK)?.refused);
  });

  for (const [name, files] of [
    ['a part list without its existing part', { 'design/README.md': '# Components\n\n' + table(['Part', 'Purpose', 'Cites'], []) }],
    ['a part list naming an absent part', { 'design/README.md': '# Components\n\n' + table(['Part', 'Purpose', 'Cites'], [['alpha', 'Manages tickets.', CITE], ['absent', 'Does not exist.', CITE]]) }],
    ['a span sharing a part’s key', { 'design/spans/alpha/README.md': '# Span\n\nConnects related work.\n' }],
    ['a claim naming a nonexistent part', { [claimPath]: claim({ Parts: 'absent' }) }],
    ['a promise with a nonexistent provider part', { [`${PART}premises/promise/README.md`]: premise({ Class: 'promise', Provider: 'absent' }) }],
    ['a liveness claim without a fairness premise', { [claimPath]: claim({ Kind: 'liveness' }) }],
    ['a citation of a missing passage', { [claimPath]: claim({ Cites: 'design/brief/overview.md#absent' }) }],
    ['an omission of a missing passage', { [`${PART}omissions.md`]: '# Left out\n\n' + table(['Passage', 'Reason'], [['design/brief/overview.md#absent', 'Out of scope.']]) }],
    ['a front page naming a nonexistent thing', { [`${PART}README.md`]: '# Tickets\n\n1. [Absent](claims/absent/)\n' }],
  ]) {
    // design.md §restate-checks; models.md §freeze for freeze cases.
    test(`design.md §restate-checks check 2: refuses ${name}`, async () => {
      await rejected(await setup(), files);
    });
  }

  for (const [name, life] of [
    ['an action neither in a column nor Unaffected', lifecycle({}, [['idle', 'active'], ['active', 'closed'], ['closed', 'None.']], ['open'])],
    ['an action both a column and Unaffected', lifecycle({ Unaffected: 'open' })],
    ['a column naming another part’s action', lifecycle({}, [['idle', 'active', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']], ['open', 'beta/close'])],
    ['an absent Unaffected action', lifecycle({ Unaffected: 'absent' })],
    ['an absent entered-by action', lifecycle({ Initial: 'idle, entered by absent' })],
  ]) {
    // design.md §restate-checks; models.md §freeze for freeze cases.
    test(`design.md §restate-checks check 3: refuses ${name}`, async () => {
      await rejected(await setup(), { [LIFE]: life }, { file: LIFE });
    });
  }

  // design.md §restate-checks; models.md §freeze for freeze cases.
  test('design.md §restate-checks check 4: lifecycle findings do not refuse an otherwise valid answer', async () => {
    const dir = await setup();
    accepted(await submit(dir, { [LIFE]: lifecycle({}, [['idle', '', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']]) }));
    assert.ok(items(dir).some(item => item.item === 'findings:alpha'));
  });

  // design.md §restate-checks; models.md §freeze for freeze cases.
  test('design.md §restate-checks check 5: refuses a byte change to a lifecycle frozen by an open surprise', async () => {
    const dir = await withLifecycleModel({ surprise: true });
    const current = await read(dir, LIFE);
    await rejected(dir, { [LIFE]: current.replace('# Ticket state', '# Same lifecycle, another heading') }, { file: LIFE });
  });

  // design.md §restate-checks check 5 and models.md §freeze: holding a held page is
  // refused whatever its bytes, including identical bytes.
  test('design.md §restate-checks check 5: an open surprise refuses identical frozen lifecycle bytes', async () => {
    const dir = await withLifecycleModel({ surprise: true });
    const bytes = await read(dir, LIFE);
    await rejected(dir, { [LIFE]: bytes }, { file: LIFE });
  });

  // models.md §lifecycle-model, §freeze: only lifecycle pages confirmed at opening are
  // held; a lifecycle model has no engine files, and this new page is unconfirmed.
  test('design.md §restate-checks check 5: an unconfirmed lifecycle absent from the held manifest may be added', async () => {
    const dir = await withLifecycleModel({ surprise: true });
    const path = `${PART}lifecycles/second/README.md`;
    const surprise = items(dir).find(item => item.item.startsWith('explain:'));
    const held = JSON.parse(await read(dir, `models/${surprise.item.slice(8)}.json`)).held;
    assert.ok(!held.some(file => file.path === path));
    const bytes = lifecycle({ Ends: 'active, closed' });
    accepted(await submit(dir, { [path]: bytes }));
    assert.equal(await read(dir, path), bytes);
    assert.ok(items(dir).some(item => item.item === 'confirm:alpha/lifecycles/second' && item.why === 'unconfirmed'));
    assert.ok(!items(dir).some(item => item.item === `change:${path}`));
  });

  // evidence.md §surprise-file and models.md §freeze: held follows basis, sorted by path,
  // and includes every claim slot even when that question did not read it.
  test('design.md §restate-checks check 5: a surprise holds confirmed lifecycles and every slot of its claim', async () => {
    const dir = await withLifecycleModel({ surprise: true, slots: true });
    const explain = items(dir).find(item => item.item.startsWith('explain:') && item.item.includes('/base.'));
    assert.ok(explain);
    const surprise = JSON.parse(await read(dir, `models/${explain.item.slice(8)}.json`));
    const keys = Object.keys(surprise);
    assert.equal(keys[keys.indexOf('basis') + 1], 'held');
    const expected = [];
    for (const path of [LIFE, slotPath, witnessPath, faultPath].sort()) expected.push({ path, sha256: sha256(await read(dir, path)) });
    assert.deepEqual(surprise.held, expected);
    assert.ok(!surprise.basis.files.some(file => file.path === witnessPath || file.path === faultPath));
  });

  for (const [kind, path, bytes] of [
    ['witness', witnessPath, witnessBytes],
    ['fault', faultPath, faultBytes],
  ]) {
    // models.md §freeze and account.md §items: any slot of this claim waits for
    // the ruling, including a new slot that held does not yet name.
    test(`design.md §restate-checks check 5: a new ${kind} slot waits for the ruling and its answer is refused`, async () => {
      const dir = await withLifecycleModel({ surprise: true });
      const item = `${claimSlotItem}/${kind}`;
      const missing = items(dir).find(entry => entry.item === item);
      assert.ok(missing);
      assert.ok(missing.waits.some(wait => wait.startsWith('rule:')));
      await rejected(dir, { [path]: bytes }, { item, file: path });
    });
  }

  for (const [kind, path] of [['encoding', slotPath], ['witness', witnessPath], ['fault', faultPath]]) {
    for (const changed of [false, true]) {
      // models.md §freeze, §slot-currency, account.md §items: an ordinary claim edit leaves
      // its slots in place but owes their pins again; the open freeze still
      // refuses holding any of them, even identical bytes.
      test(`design.md §restate-checks check 5: a held ${kind} slot is refused with ${changed ? 'changed' : 'identical'} bytes`, async () => {
        const dir = await withLifecycleModel({ surprise: true, slots: true });
        accepted(await submit(dir, { [claimPath]: claim({ Origin: 'added', Sentence: 'A ticket remains closed after closing.' }) }));
        const item = `slot:${path.slice('models/'.length, -3)}`;
        assert.ok(items(dir).some(entry => entry.item === item && entry.why === 'owed-again'));
        const bytes = await read(dir, path);
        await rejected(dir, { [path]: changed ? bytes + '\n' : bytes }, { item, file: path });
      });
    }
  }

  // models.md §freeze freezes slots of the surprise's claim, not every claim
  // on the model. The other claim's first encoding remains answerable.
  test('design.md §restate-checks check 5: a surprise does not freeze another claim encoding on the same model', async () => {
    const dir = await withLifecycleModel({ surprise: true });
    const path = `${PART}claims/other/README.md`;
    accepted(await submit(dir, { [path]: claim({ Origin: 'added', Sentence: 'A ticket cannot reopen.' }) }));
    const encoding = 'models/lifecycles-alpha/parts/alpha/claims/other/encoding.md';
    const item = 'slot:lifecycles-alpha/parts/alpha/claims/other/encoding';
    const bytes = table(['Lifecycle', 'From', 'Action', 'To'], [['ticket', 'closed', 'open', 'active']]);
    accepted(await submit(dir, { [encoding]: bytes }, item));
    assert.equal(await read(dir, encoding), bytes);
  });

  for (const kind of ['witness', 'fault']) {
    // door.md §forma-give, §gives, models.md §owed: the generic further-slot packet may
    // be requested even when that claim already has a filled slot of the kind.
    test(`design.md §restate-checks: give accepts a further ${kind} item when no such item is missing`, async () => {
      const dir = await withLifecycleModel({ slots: true });
      const item = `${claimSlotItem}/${kind}`;
      assert.ok(!items(dir).some(entry => entry.item === item));
      const folder = await answerFolder({});
      const packet = query(dir, ['give', item, folder]);
      for (const path of [claimPath, LIFE, slotPath, 'forma/door.md', 'forma/account.md', 'forma/models.md', 'forma/design.md', 'forma/evidence.md']) assert.ok(packet.files.some(file => file.path === path));
    });
  }

  for (const [kind, path, bytes] of [
    ['witness', witnessPath, witnessBytes],
    ['fault', faultPath, faultBytes],
  ]) {
    // models.md §freeze at every read: a newly merged slot counts for nothing
    // despite its valid accepting receipt. Clone the record then merge it in.
    test(`design.md §at-read: a new receipted ${kind} slot is discounted while the surprise is open`, async () => {
      const before = await withLifecycleModel();
      accepted(await submit(before, { [path]: bytes }, `${claimSlotItem}/${kind}`));
      const receipt = await read(before, path.slice(0, path.lastIndexOf('/')) + '/receipt');
      const dir = await withLifecycleModel({ surprise: true });
      const target = path.slice(0, path.lastIndexOf('/')) + '/receipt';
      const newLine = receipt.trimEnd().split('\n').find(line => JSON.parse(line).file === path.split('/').at(-1));
      await writeFiles(dir, { [path]: bytes, [target]: (await read(dir, target)) + newLine + '\n' });
      assert.ok(items(dir).some(item => item.item === `change:${path}`));
    });
  }

  for (const state of ['changed', 'gone']) {
    // models.md §freeze and evidence.md §surprise-file: held includes this witness even
    // though the base question did not compose it. Matching receipts cannot
    // authorize a merge changing it, nor can its absence erase the freeze.
    test(`design.md §at-read: a held witness omitted from the base basis is discounted when ${state}`, async () => {
      const source = await withLifecycleModel({ surprise: true, slots: true });
      const files = await snapshot(source, { skip: ['work', 'runs'] });
      if (state === 'gone') delete files[witnessPath];
      else {
        files[witnessPath] = witnessBytes + '\n';
        const path = witnessPath.slice(0, witnessPath.lastIndexOf('/')) + '/receipt';
        files[path] = files[path].trimEnd().split('\n').map(text => {
          const line = JSON.parse(text);
          if (line.file === 'witness-active.md') line.sha256 = sha256(files[witnessPath]);
          return JSON.stringify(line);
        }).sort().join('\n') + '\n';
      }
      const dir = await project(null, files);
      assert.ok(items(dir).some(item => item.item === `change:${witnessPath}`));
    });
  }

  // models.md §freeze: a held file that is gone is changed; held survives the
  // missing page. A fresh project copy represents a merge deleting the page.
  test('design.md §at-read: a missing held lifecycle remains a freeze change', async () => {
    const source = await withLifecycleModel({ surprise: true });
    const files = await snapshot(source, { skip: ['work', 'runs'] });
    delete files[LIFE];
    const dir = await project(null, files);
    assert.ok(items(dir).some(item => item.item === `change:${LIFE}`));
  });

  // models.md §freeze and evidence.md §surprise-file: a matching receipt cannot override
  // held's frozen bytes, even after a merge discounts the page.
  // design.md §at-read; door.md §read-checks, §change.
  test('design.md §at-read: the freeze still discounts a lifecycle whose new bytes have a receipt', async () => {
    const dir = await withLifecycleModel({ surprise: true });
    const before = await read(dir, LIFE);
    const changed = before.replace('# Ticket state', '# Merged heading');
    await writeFiles(dir, { [LIFE]: changed });
    await receiptFiles(dir, { [LIFE]: changed });
    assert.ok(items(dir).some(item => item.item === `change:${LIFE}`));
    await writeFiles(dir, { [LIFE]: before });
    await receiptFiles(dir, { [LIFE]: before });
    assert.ok(!items(dir).some(item => item.item === `change:${LIFE}`));
  });

  // evidence.md §explain: the lifecycle explanation has no weaker form; the
  // verdict recommendation is not the developer's later decision.
  function explanationFor(surprise, name, verdict = 'model wrong') {
    return fields([['Question', surprise.question], ['Basis', name.split('.surprise-').at(-1)], ['Verdict', verdict], ['Level', 'specification'], ['Weaker', 'none']]) +
      '\n## Trace\n\nA client opens the ticket.\n\n## Failure shape\n\nOpening succeeds before permission.\n\n## Mechanism\n\nThe idle open cell admits the move.\n';
  }

  // models.md §lifecycle-model; door.md §receipts: every merged line of a confirmed lifecycle
  // page contributes its authors, including a line for older bytes.
  test('models.md §lifecycle-model / door.md §forma-answer: model authors from an older merged receipt line cannot explain its surprise', async () => {
    const dir = await withLifecycleModel({ surprise: true });
    const explainer = { provider: 'fixture', model: 'explainer', session: 'explanation-session' };
    const path = `${PART}lifecycles/ticket/receipt`;
    const older = { file: 'README.md', sha256: sha256('# Older lifecycle bytes\n'), at: '1999-01-01T00:00:00.000Z', session: explainer, authors: [explainer] };
    await writeFiles(dir, { [path]: (await read(dir, path)) + JSON.stringify(older) + '\n' });
    const explain = items(dir).find(item => item.item.startsWith('explain:'));
    assert.ok(explain);
    const name = explain.item.slice(8);
    const surprise = JSON.parse(await read(dir, `models/${name}.json`));
    const folder = await answerFolder({ 'explain.md': explanationFor(surprise, name) });
    const before = await snapshot(dir, { skip: ['work', 'runs'] });
    const result = forma(dir, ['answer', explain.item, folder, '--provider', explainer.provider, '--model', explainer.model, '--session', explainer.session, '--json']);
    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.equal(result.json?.accepted, false, result.stderr || result.stdout);
    assert.ok(result.json.reasons.length > 0);
    assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
  });

  // door.md §receipts limits lifecycle-model authors to confirmed lifecycle pages.
  // The changed Ends makes this new page's pin different from the confirmed
  // ticket lifecycle's, so decisions.md §in-force cannot confirm it by kind and pin.
  test('models.md §lifecycle-model / door.md §forma-answer: an author of only an unconfirmed lifecycle may explain the model surprise', async () => {
    const dir = await withLifecycleModel({ surprise: true });
    const path = `${PART}lifecycles/second/README.md`;
    const bytes = lifecycle({ Ends: 'active, closed' });
    const explainer = { provider: 'fixture', model: 'explainer', session: 'explanation-session' };
    const authored = await answerFolder({ [path]: bytes });
    accepted(forma(dir, ['answer', WORK, authored, '--provider', explainer.provider, '--model', explainer.model, '--session', explainer.session, '--json']));
    assert.ok(items(dir).some(item => item.item === 'confirm:alpha/lifecycles/second' && item.why === 'unconfirmed'));
    const explain = items(dir).find(item => item.item.startsWith('explain:'));
    assert.ok(explain);
    const name = explain.item.slice(8);
    const surprise = JSON.parse(await read(dir, `models/${name}.json`));
    const folder = await answerFolder({ 'explain.md': explanationFor(surprise, name) });
    accepted(forma(dir, ['answer', explain.item, folder, '--provider', explainer.provider, '--model', explainer.model, '--session', explainer.session, '--json']));
  });

  // door.md §gives: Explain gives evidence, models and decisions contracts;
  // evidence.md §sent-back and account.md §commands carry a sent-back reason as found,
  // without fixing the representation inside found.
  test('door.md §gives / evidence.md §sent-back: a guarded lifecycle surprise carries its sent-back reason and verdict contracts into Explain', async () => {
    const dir = await withLifecycleModel({ surprise: true, guarded: true });
    const explain = items(dir).find(item => item.item.startsWith('explain:') && item.item.includes('/base.'));
    assert.ok(explain);
    assert.ok(Object.hasOwn(explain, 'found'));
    assert.notEqual(explain.found, null);
    const folder = await answerFolder({});
    const packet = query(dir, ['give', explain.item, folder]);
    for (const name of ['door', 'account', 'evidence', 'models', 'decisions']) {
      assert.ok(packet.files.some(file => file.path === `forma/${name}.md`));
      assert.notEqual(await read(folder, `forma/${name}.md`), null);
    }
    assert.deepEqual(JSON.parse(await read(folder, 'item.json')).item.found, explain.found);
  });

  // design.md §removal; evidence.md §moved, §removed; models.md §slot-currency, §parts-change.
  test('design.md §removal: same-kind same-key ordinary edits keep slots, which may become stale', async () => {
    const dir = await withLifecycleModel();
    const before = await read(dir, slotPath);
    accepted(await submit(dir, { [claimPath]: claim({ Origin: 'added', Sentence: 'A ticket has exactly one owner.' }) }));
    assert.equal(await read(dir, slotPath), before);
    assert.ok(items(dir).some(item => item.item === slotItems.get(dir) && item.why === 'owed-again'));
  });

  // design.md §removal; evidence.md §moved, §removed; models.md §slot-currency, §parts-change.
  test('design.md §removal: removing and restoring the same kind, key and pin in one answer keeps slots and evidence', async () => {
    const dir = await withLifecycleModel({ run: true });
    const before = await snapshot(dir, { skip: ['work', 'runs', 'design'] });
    accepted(await submit(dir, { 'removed.md': `${PART}claims/safety\n`, [claimPath]: claim({ Origin: 'added' }) }));
    assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs', 'design'] }), before);
  });

  // design.md §removal; evidence.md §moved, §removed; models.md §slot-currency, §parts-change.
  test('design.md §removal: removing and restoring a different pin in one answer creates a new thing with no slots', async () => {
    const dir = await withLifecycleModel();
    accepted(await submit(dir, { 'removed.md': `${PART}claims/safety\n`, [claimPath]: claim({ Origin: 'added', Sentence: 'The ticket always has an owner.' }) }));
    assert.equal(await read(dir, slotPath), null);
  });

  // design.md §removal; evidence.md §moved, §removed; models.md §slot-currency, §parts-change.
  test('design.md §removal: a unique same-kind same-key same-pin re-file moves slots and evidence without moving decisions', async () => {
    const dir = await withLifecycleModel({ run: true });
    const confirmation = await decide(dir, 'confirm', 'alpha/claims/safety');
    const decisionBytes = await read(dir, confirmation.recorded[0]);
    const oldFiles = (await tree(dir)).filter(path => path.startsWith('models/lifecycles-alpha/parts/alpha/claims/safety/'));
    const oldSlot = await read(dir, slotPath);
    accepted(await submit(dir, { 'removed.md': `${PART}claims/safety\n`, 'design/spans/shared/README.md': spanPage, [movedClaim]: claim({ Origin: 'added' }) }));
    assert.equal(await read(dir, slotPath), null);
    assert.equal(await read(dir, movedSlot), oldSlot);
    for (const path of oldFiles) assert.notEqual(await read(dir, path.replace('/parts/alpha/claims/safety/', '/spans/shared/claims/safety/')), null);
    const receipt = (await read(dir, 'models/lifecycles-alpha/spans/shared/claims/safety/receipt')).trimEnd().split('\n').map(line => JSON.parse(line));
    assert.ok(receipt.flatMap(line => line.pins ?? []).some(pin => pin.entry === 'shared/claims/safety'));
    assert.equal(await read(dir, confirmation.recorded[0]), decisionBytes);
    assert.ok(!(await tree(dir)).some(path => path.startsWith('design/spans/shared/claims/safety/decisions/')));
    const reading = account(dir, 'shared/claims/safety');
    assert.ok(reading.thing.decisions.some(decision => decision.state === 'in force'));
    assert.ok(reading.thing.evidence.length > 0);
    assert.ok(reading.thing.evidence.every(evidence => evidence.current));
  });

  // design.md §removal; evidence.md §moved, §removed; models.md §slot-currency, §parts-change.
  test('design.md §removal: nonunique matching destinations are new things rather than a re-file', async () => {
    const dir = await withLifecycleModel();
    accepted(await submit(dir, {
      'removed.md': `${PART}claims/safety\n`,
      'design/spans/first/README.md': spanPage, 'design/spans/first/claims/safety/README.md': claim({ Origin: 'added' }),
      'design/spans/second/README.md': spanPage, 'design/spans/second/claims/safety/README.md': claim({ Origin: 'added' }),
    }));
    assert.equal(await read(dir, slotPath), null);
    assert.equal(await read(dir, 'models/lifecycles-alpha/spans/first/claims/safety/encoding.md'), null);
    assert.equal(await read(dir, 'models/lifecycles-alpha/spans/second/claims/safety/encoding.md'), null);
  });

  // design.md §removal; evidence.md §moved, §removed; models.md §slot-currency, §parts-change.
  test('design.md §removal: a removal keeps the thing’s decisions and removes its model folder', async () => {
    const dir = await withLifecycleModel({ run: true });
    const confirmation = await decide(dir, 'confirm', 'alpha/claims/safety');
    const decisionBytes = await read(dir, confirmation.recorded[0]);
    accepted(await submit(dir, { 'removed.md': `${PART}claims/safety\n` }));
    assert.equal(await read(dir, confirmation.recorded[0]), decisionBytes);
    assert.deepEqual((await tree(dir)).filter(path => path.startsWith(`${PART}claims/safety/`)), [confirmation.recorded[0]]);
    assert.ok(!(await tree(dir)).some(path => path.startsWith('models/lifecycles-alpha/parts/alpha/claims/safety/')));
    assert.equal(account(dir, 'alpha/claims/safety').thing.page, undefined);
  });

  // design.md §removal; evidence.md §moved, §removed; models.md §slot-currency, §parts-change.
  test('design.md §removal: a thing restored in a later answer has no old slots or evidence', async () => {
    const dir = await withLifecycleModel({ run: true });
    accepted(await submit(dir, { 'removed.md': `${PART}claims/safety\n` }));
    accepted(await submit(dir, { [claimPath]: claim({ Origin: 'added' }) }));
    assert.equal(await read(dir, slotPath), null);
    assert.deepEqual(account(dir, 'alpha/claims/safety').thing.evidence, []);
    assert.ok(items(dir).some(item => item.item === slotItems.get(dir) && item.why === 'unfilled'));
  });

  // design.md §removal; evidence.md §moved, §removed; models.md §slot-currency, §parts-change.
  test('design.md §removal: changing a key creates a new thing while kind-and-pin decisions remain in force', async () => {
    const dir = await withLifecycleModel();
    await decide(dir, 'confirm', 'alpha/claims/safety');
    const renamed = `${PART}claims/renamed/README.md`;
    accepted(await submit(dir, { 'removed.md': `${PART}claims/safety\n`, [renamed]: claim({ Origin: 'added' }) }));
    assert.equal(await read(dir, slotPath), null);
    assert.equal(await read(dir, 'models/lifecycles-alpha/parts/alpha/claims/renamed/encoding.md'), null);
    assert.ok(account(dir, 'alpha/claims/renamed').thing.decisions.some(decision => decision.state === 'in force'));
  });

  // design.md §removal; evidence.md §moved, §removed; models.md §slot-currency, §parts-change.
  test('design.md §removal: re-filing a stated claim lapses both affected stated units', async () => {
    const other = 'design/spans/shared/claims/other/README.md';
    const dir = await setup({ [claimPath]: claim(), 'design/spans/shared/README.md': spanPage, [other]: claim({ Sentence: 'Every ticket has a client.' }) });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/stated');
    await decide(dir, 'confirm', 'shared/stated');
    accepted(await submit(dir, { 'removed.md': `${PART}claims/safety\n`, [movedClaim]: claim() }));
    const missing = items(dir);
    assert.ok(missing.some(item => item.item === 'confirm:alpha/stated' && item.why === 'lapsed'));
    assert.ok(missing.some(item => item.item === 'confirm:shared/stated' && item.why === 'lapsed'));
  });

  for (const [name, files] of [
    ['the claim its question serves', { 'removed.md': `${PART}claims/safety\n` }],
    ['a lifecycle named in its basis', { 'removed.md': `${PART}lifecycles/ticket\n` }],
    ['a re-file of the claim', { 'removed.md': `${PART}claims/safety\n`, 'design/spans/shared/README.md': spanPage, [movedClaim]: claim({ Origin: 'added' }) }],
    ['the enclosing part', { 'removed.md': 'design/parts/alpha\n', 'design/README.md': '# Empty\n\n' + table(['Part', 'Purpose', 'Cites'], []) }],
  ]) {
    // design.md §removal; evidence.md §moved, §removed; models.md §slot-currency, §parts-change.
    test(`design.md §removal: an unruled surprise prevents removing or re-filing ${name}`, async () => {
      await rejected(await withLifecycleModel({ surprise: true }), files);
    });
  }

  // design.md §code-journeys, §removal; decisions.md §pick;
  // evidence.md §lifecycle-journeys: a pick adds two code journeys, whose lifecycle evidence
  // supplies concrete files for removal and move assertions without native tools.
  async function withPickedJourneyEvidence() {
    const dir = await setup({
      [`${PART}choices/method/README.md`]: choice(),
      'design/parts/beta/README.md': '# Other component\n',
      'design/README.md': '# Components\n\n' + table(['Part', 'Purpose', 'Cites'], [['alpha', 'Manages tickets.', CITE], ['beta', 'Presents ticket decisions.', CITE]]),
    });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    await decide(dir, 'pick', 'alpha/choices/method', ['--choice', 'a']);
    query(dir, ['run']);
    for (const key of ['method-a', 'method-not-b']) {
      assert.ok((await tree(dir)).some(path => path.startsWith(`models/lifecycles-alpha/parts/alpha/journeys/${key}/`) && path.endsWith('.json')));
    }
    return dir;
  }

  // design.md §removal; evidence.md §moved, §removed; models.md §slot-currency, §parts-change.
  test('design.md §removal: removing a choice removes its picked journeys’ evidence and keeps the pick decision', async () => {
    const dir = await withPickedJourneyEvidence();
    const decisionsBefore = Object.fromEntries(Object.entries(await snapshot(dir)).filter(([path]) => path.includes('/decisions/')));
    accepted(await submit(dir, { 'removed.md': `${PART}choices/method\n` }));
    const files = await tree(dir);
    for (const key of ['method-a', 'method-not-b']) assert.ok(!files.some(path => path.startsWith(`models/lifecycles-alpha/parts/alpha/journeys/${key}/`)));
    for (const [path, bytes] of Object.entries(decisionsBefore)) assert.equal(await read(dir, path), bytes);
  });

  // design.md §removal; evidence.md §moved, §removed; models.md §slot-currency, §parts-change.
  test('design.md §removal: re-filing a choice moves both picked journeys’ model folders to its new part', async () => {
    const dir = await withPickedJourneyEvidence();
    const before = (await tree(dir)).filter(path => /models\/lifecycles-alpha\/parts\/alpha\/journeys\/method-(a|not-b)\//.test(path));
    const movedChoice = choice({}, { steps: [[1, 'Client', 'alpha/open', '-', '-', '-']] }, { steps: [[1, 'Client', 'alpha/close', '-', '-', '-']] });
    accepted(await submit(dir, { 'removed.md': `${PART}choices/method\n`, 'design/parts/beta/choices/method/README.md': movedChoice }));
    for (const path of before) {
      assert.equal(await read(dir, path), null);
      assert.notEqual(await read(dir, path.replace('/parts/alpha/journeys/', '/parts/beta/journeys/')), null);
    }
    for (const key of ['method-a', 'method-not-b']) {
      const reading = account(dir, `beta/journeys/${key}`);
      assert.ok(reading.thing.evidence.length > 0);
      assert.ok(reading.thing.evidence.every(evidence => evidence.current));
    }
  });

  // design.md §removal; evidence.md §moved, §removed; models.md §slot-currency, §parts-change.
  test('design.md §removal: an open surprise on a picked journey also protects the choice it goes with', async () => {
    const dir = await withPickedJourneyEvidence();
    accepted(await submit(dir, { [LIFE]: lifecycle({}, [['idle', 'active', 'active'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']]) }));
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    query(dir, ['run']);
    assert.ok(items(dir).some(item => item.item.startsWith('rule:')));
    await rejected(dir, { 'removed.md': `${PART}choices/method\n` });
  });

  // design.md §repairs-redirects; models.md §model-repair; decisions.md §rulings,
  // decisions.md §expects; account.md §items: a non-claim surprise needs no planted fault.
  // design.md §repairs-redirects; door.md §repair-answer; decisions.md §expects.
  test('design.md §repairs-redirects: a real finding on a journey accepts a lifecycle Repair without a claim fault', async () => {
    const dir = await withPickedJourneyEvidence();
    const repaired = await read(dir, LIFE);
    accepted(await submit(dir, { [LIFE]: lifecycle({}, [['idle', 'active', 'active'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']]) }));
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    query(dir, ['run']);
    const explain = items(dir).find(item => item.item.startsWith('explain:') && item.item.includes('/journeys/method-not-b/'));
    assert.ok(explain);
    const name = explain.item.slice('explain:'.length);
    const surprise = JSON.parse(await read(dir, `models/${name}.json`));
    const digest = name.slice(name.lastIndexOf('.surprise-') + '.surprise-'.length);
    // evidence.md §explain fixes this explanation's fields and no weaker form.
    const explanation = fields([['Question', surprise.question], ['Basis', digest], ['Verdict', 'real finding'], ['Level', 'specification'], ['Weaker', 'none']]) +
      '\n## Trace\n\nA client closes an idle ticket and it becomes active.\n\n## Failure shape\n\nClosing is admitted before a ticket is opened.\n\n## Mechanism\n\nThe idle close cell admits the transition.\n';
    const folder = await answerFolder({ 'explain.md': explanation });
    accepted(forma(dir, ['answer', explain.item, folder, '--provider', 'fixture', '--model', 'explainer', '--session', 'explanation-session', '--json']));
    const waiting = items(dir).find(item => item.item.startsWith('rule:') && item.item.includes('/journeys/method-not-b/'));
    assert.ok(waiting);
    const ruling = await decide(dir, 'rule', waiting.item.slice(5), ['--verdict', 'real finding', '--level', 'specification', '--target', 'lifecycles-alpha', '--words', 'Refuse closing until a ticket has been opened.']);
    const decision = ruling.recorded[0].split('/').at(-1).slice(0, -3);
    const repair = `repair:${decision}/lifecycles-alpha`;
    assert.ok(items(dir).some(item => item.item === repair));
    accepted(await submit(dir, { [LIFE]: repaired, 'repair.md': fields([['Mechanism', 'Closing an idle ticket is refused.']]) }, repair));
    assert.ok(!items(dir).some(item => item.item === repair));
    assert.ok(!(await tree(dir)).some(path => /\/claims\/.*\/fault-/.test(path)));
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    query(dir, ['run']);
    // evidence.md §lifecycle-journeys, §keys: the original journey question
    // is the expectation, asked again after the lifecycle's repair.
    const evidence = JSON.parse(await read(dir, `models/${surprise.question}.json`));
    assert.equal(evidence.found.outcome, 'refused');
    assert.equal(evidence.matches, true);
  });

  // evidence.md §measures: lifecycle evidence has duration and combinations only;
  // evidence.md §runs keeps the scratch basis form separate from measures.
  test('lifecycle-tool.md §stepping: lifecycle evidence records exactly duration and combinations measures', async () => {
    const dir = await setup({ [journeyPath]: journey() });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    await decide(dir, 'confirm', 'alpha/journeys/opening');
    query(dir, ['run']);
    const reading = account(dir, 'alpha/journeys/opening');
    assert.equal(reading.thing.evidence.length, 1);
    const name = reading.thing.evidence[0].question;
    const evidence = JSON.parse(await read(dir, `models/${name}.json`));
    assert.deepEqual(Object.keys(evidence.measures).sort(), ['combinations', 'duration']);
    for (const value of Object.values(evidence.measures)) assert.ok(value === null || typeof value === 'number');
    // evidence.md §runs: basis.json has exactly name, basis and finished.
    const basis = JSON.parse(await read(dir, `runs/${name}/basis.json`));
    assert.deepEqual(Object.keys(basis).sort(), ['basis', 'finished', 'name']);
    assert.equal(basis.name, name);
  });

  // design.md §removal; evidence.md §moved, §removed; models.md §slot-currency, §parts-change.
  test('design.md §removal: a confirmed offered journey goes with its part after its lifecycle is removed', async () => {
    const dir = await setup();
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    await decide(dir, 'confirm', 'alpha/journeys/reach-ticket--active');
    query(dir, ['run']);
    const prefix = 'models/lifecycles-alpha/parts/alpha/journeys/reach-ticket--active/';
    const evidence = (await tree(dir)).filter(path => path.startsWith(prefix));
    assert.ok(evidence.length > 0);
    accepted(await submit(dir, { 'removed.md': `${PART}lifecycles/ticket\n` }));
    assert.ok(account(dir, 'alpha/journeys/reach-ticket--active').thing.page);
    for (const path of evidence) assert.notEqual(await read(dir, path), null);
    accepted(await submit(dir, { 'removed.md': 'design/parts/alpha\n', 'design/README.md': '# Empty\n\n' + table(['Part', 'Purpose', 'Cites'], []) }));
    assert.ok(!(await tree(dir)).some(path => path.startsWith(prefix)));
  });

  // evidence.md §explain; decisions.md §rulings, §kept-journeys;
  // account.md §items: explain a real lifecycle surprise
  // from a different author, then rule it, to exercise the Repair route.
  async function ruledLifecycleSurprise(verdict = 'model wrong') {
    const dir = await withLifecycleModel({ surprise: true });
    const explain = items(dir).find(item => item.item.startsWith('explain:'));
    assert.ok(explain);
    const surpriseName = explain.item.slice('explain:'.length);
    const surprise = JSON.parse(await read(dir, `models/${surpriseName}.json`));
    const digestPrefix = surpriseName.slice(surpriseName.lastIndexOf('.surprise-') + '.surprise-'.length);
    const explanation = fields([['Question', surprise.question], ['Basis', digestPrefix], ['Verdict', verdict], ['Level', 'specification'], ['Weaker', 'none']]) +
      '\n## Trace\n\nThe client opens the ticket and it becomes active.\n\n## Failure shape\n\nOpening succeeds before permission has been granted.\n\n## Mechanism\n\nThe lifecycle allows the opening transition without permission.\n';
    const folder = await answerFolder({ 'explain.md': explanation });
    accepted(forma(dir, ['answer', explain.item, folder, '--provider', 'fixture', '--model', 'explainer', '--session', 'explanation-session', '--json']));
    const waiting = items(dir).find(item => item.item.startsWith('rule:'));
    assert.ok(waiting);
    const ruling = await decide(dir, 'rule', waiting.item.slice('rule:'.length), ['--verdict', verdict, '--level', 'specification', '--words', 'Require permission before opening the ticket.']);
    const repair = items(dir).find(item => item.item.startsWith('repair:') && (verdict === 'property wrong' || item.item.endsWith('/lifecycles-alpha')));
    assert.ok(repair);
    const decision = ruling.recorded[0].split('/').at(-1).slice(0, -3);
    return { dir, repair: repair.item, decision, keptKey: `kept-${digestPrefix}` };
  }

  // design.md §removal; evidence.md §moved, §removed; models.md §slot-currency, §parts-change.
  test('design.md §removal: a kept journey survives claim removal and its evidence is removed with its part', async () => {
    const { dir, keptKey } = await ruledLifecycleSurprise();
    query(dir, ['run']);
    const prefix = `models/lifecycles-alpha/parts/alpha/journeys/${keptKey}/`;
    const before = (await tree(dir)).filter(path => path.startsWith(prefix));
    assert.ok(before.length > 0);
    accepted(await submit(dir, { 'removed.md': `${PART}claims/safety\n` }));
    assert.ok(account(dir, `alpha/journeys/${keptKey}`).thing.page);
    for (const path of before) assert.notEqual(await read(dir, path), null);
    accepted(await submit(dir, { 'removed.md': 'design/parts/alpha\n', 'design/README.md': '# Empty\n\n' + table(['Part', 'Purpose', 'Cites'], []) }));
    assert.ok(!(await tree(dir)).some(path => path.startsWith(prefix)));
  });

  // decisions.md §kept-journeys, §expects: a lifecycle trace can be kept; declining
  // that kept journey preserves its record and immediately meets the decline.
  test('design.md §removal: a declined kept lifecycle journey stays recorded and its decline owes no Repair', async () => {
    const { dir, keptKey } = await ruledLifecycleSurprise();
    const on = `alpha/journeys/${keptKey}`;
    const declined = await decide(dir, 'decline', on, ['--words', 'This trace is not an intended expectation.']);
    const decision = declined.recorded[0].split('/').at(-1).slice(0, -3);
    assert.ok(account(dir, on).thing.page);
    assert.ok(!items(dir).some(item => item.item === `repair:${decision}` || item.item.startsWith(`repair:${decision}/`)));
    assert.ok(!items(dir).some(item => item.item.startsWith('run:') && item.item.includes(`/journeys/${keptKey}/`)));
  });

  // design.md §repairs-redirects; door.md §repair-answer; decisions.md §expects.
  test('design.md §repairs-redirects: a lifecycle-model Repair applies lifecycle pages as a Restate answer', async () => {
    const { dir, repair } = await ruledLifecycleSurprise();
    // door.md §gives: the Repair packet adds decisions.md to its target contracts.
    const folder = await answerFolder({});
    const packet = query(dir, ['give', repair, folder]);
    assert.ok(packet.files.some(file => file.path === 'forma/decisions.md'));
    const bytes = lifecycle({}, [['idle', 'None.', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']]);
    accepted(await submit(dir, { [LIFE]: bytes, 'repair.md': fields([['Mechanism', 'Refuses opening until permission exists.']]) }, repair));
    assert.equal(await read(dir, LIFE), bytes);
    await checkReceipt(dir, LIFE, bytes);
    assert.ok(!items(dir).some(item => item.item === repair));
  });

  // design.md §repairs-redirects; door.md §repair-answer; decisions.md §expects.
  test('design.md §repairs-redirects: a lifecycle-model Repair is refused when its lifecycle page fails Restate resolution', async () => {
    const { dir, repair } = await ruledLifecycleSurprise();
    await rejected(dir, { [LIFE]: lifecycle({ Entity: 'absent' }), 'repair.md': fields([['Mechanism', 'Names the required entity.']]) }, { item: repair, file: LIFE, field: 'Entity' });
  });

  // models.md §model-repair requires every model Repair to change something a ruled
  // question read; adding a fresh witness alone cannot meet a model-wrong repair.
  test('design.md §repairs-redirects: a model Repair refuses a new slot that no ruled question read', async () => {
    const { dir, repair } = await ruledLifecycleSurprise();
    await rejected(dir, { [witnessPath]: witnessBytes, 'repair.md': fields([['Mechanism', 'Adds a witness of activity.']]) }, { item: repair });
  });

  // models.md §model-repair: a model-wrong Repair keeps the ruled claim's encoding.
  test('design.md §repairs-redirects: a model-wrong Repair refuses a change to the ruled claim encoding', async () => {
    const { dir, repair } = await ruledLifecycleSurprise();
    await rejected(dir, {
      [LIFE]: lifecycle({}, [['idle', 'None.', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']]),
      [slotPath]: table(['Lifecycle', 'From', 'Action', 'To'], [['ticket', 'closed', 'open', 'active']]),
      'repair.md': fields([['Mechanism', 'Refuses opening before permission.']]),
    }, { item: repair });
  });

  // decisions.md §rulings, §expects, models.md §model-repair, door.md §gives, §repair-answer: property wrong
  // accepts an encoding-only model Repair, leaving its lifecycle pages and the
  // claim page untouched. Its receipt identifies the decision and both hashes.
  test('design.md §repairs-redirects: a property-wrong Repair refills only the claim encoding and keeps its confirmation', async () => {
    const { dir, repair, decision } = await ruledLifecycleSurprise('property wrong');
    await decide(dir, 'confirm', 'alpha/claims/safety');
    const claimBefore = await read(dir, claimPath);
    const lifeBefore = await read(dir, LIFE);
    const before = await read(dir, slotPath);
    const bytes = table(['Lifecycle', 'From', 'Action', 'To'], [['ticket', 'closed', 'open', 'active']]);
    const mechanism = 'Forbids reopening a closed ticket.';
    const folder = await answerFolder({});
    const packet = query(dir, ['give', repair, folder]);
    for (const name of ['door', 'account', 'design', 'models', 'evidence', 'decisions']) assert.ok(packet.files.some(file => file.path === `forma/${name}.md`));
    accepted(await submit(dir, { [slotPath]: bytes, 'repair.md': fields([['Mechanism', mechanism]]) }, repair));
    assert.equal(await read(dir, slotPath), bytes);
    assert.equal(await read(dir, LIFE), lifeBefore);
    assert.equal(await read(dir, claimPath), claimBefore);
    const receipt = (await read(dir, slotPath.slice(0, slotPath.lastIndexOf('/')) + '/receipt')).trimEnd().split('\n').map(JSON.parse);
    const line = receipt.find(entry => entry.file === 'encoding.md');
    assert.equal(line.before, sha256(before));
    assert.equal(line.sha256, sha256(bytes));
    assert.deepEqual(line.mechanisms, [{ decision: decision, mechanism: mechanism }]);
    assert.ok(line.answers.includes(decision));
    assert.ok(!items(dir).some(item => item.item === repair || item.item === 'confirm:alpha/claims/safety'));
  });

  // decisions.md §rulings, §expects and door.md §gives: the same property-wrong repair
  // may instead restate the claim, causing its former confirmation to lapse.
  test('design.md §repairs-redirects: a property-wrong Repair may instead restate the claim', async () => {
    const { dir, repair } = await ruledLifecycleSurprise('property wrong');
    await decide(dir, 'confirm', 'alpha/claims/safety');
    const changed = claim({ Origin: 'added', Sentence: 'A closed ticket cannot be reopened.' });
    const encoding = await read(dir, slotPath);
    accepted(await submit(dir, { [claimPath]: changed, 'repair.md': fields([['Mechanism', 'States that reopening is forbidden.']]) }, repair));
    assert.equal(await read(dir, claimPath), changed);
    assert.equal(await read(dir, slotPath), encoding);
    assert.ok(!items(dir).some(item => item.item === repair));
    assert.ok(items(dir).some(item => item.item === 'confirm:alpha/claims/safety' && item.why === 'lapsed'));
  });

  for (const change of ['only a new witness', 'the model and encoding', 'unchanged encoding bytes']) {
    // models.md §model-repair and door.md §repair-answer: a property-wrong model Repair changes the
    // ruled claim encoding, changes no model file, and changes actual bytes.
    test(`design.md §repairs-redirects: a property-wrong Repair refuses ${change}`, async () => {
      const { dir, repair } = await ruledLifecycleSurprise('property wrong');
      const files = { 'repair.md': fields([['Mechanism', 'Forbids reopening a closed ticket.']]) };
      if (change === 'only a new witness') files[witnessPath] = witnessBytes;
      else files[slotPath] = change === 'unchanged encoding bytes' ? await read(dir, slotPath) : table(['Lifecycle', 'From', 'Action', 'To'], [['ticket', 'closed', 'open', 'active']]);
      if (change === 'the model and encoding') files[LIFE] = lifecycle({}, [['idle', 'None.', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']]);
      await rejected(dir, files, { item: repair });
    });
  }

  // design.md §at-read; door.md §read-checks, §change.
  test('design.md §at-read: a page’s own form failure becomes change:path and counts for nothing', async () => {
    const dir = await setup({ [claimPath]: '# Invalid claim\n' });
    const missing = items(dir);
    assert.ok(missing.some(item => item.item === `change:${claimPath}`));
    assert.ok(!missing.some(item => item.item === 'restate:alpha'));
  });

  for (const [name, path, bytes] of [
    ['an empty Phase cell', LIFE, lifecycle({}, [['', 'active', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.']])],
    ['a closed-list value outside its list', claimPath, claim({ Kind: 'unknown' })],
    ['a malformed list separator', claimPath, claim({ Parts: 'alpha,beta' })],
    ['journey numbering not beginning at one', journeyPath, journey({}, [[2, 'Client', 'open', '-', '-', '-']])],
    ['a refused step outside the steps', journeyPath, journey({ Polarity: 'must not', 'Refused step': '2' })],
    ['a should-happen journey with a refused step', journeyPath, journey({ 'Refused step': '1' })],
    ['identical choice alternatives', `${PART}choices/method/README.md`, choice({}, {}, { steps: [[1, 'Client', 'open', '-', '-', '-']] })],
  ]) {
    // design.md §at-read explicitly classifies these as own-form failures.
    // design.md §at-read; door.md §read-checks, §change.
    test(`design.md §at-read: ${name} becomes change:path rather than Restate`, async () => {
      const dir = await setup({ [path]: bytes });
      const missing = items(dir);
      assert.ok(missing.some(item => item.item === `change:${path}`));
      assert.ok(!missing.some(item => item.item === 'restate:alpha'));
    });
  }

  for (const [name, path, bytes] of [
    ['a malformed thing key', `${PART}premises/bad--key/README.md`, premise()],
    ['a duplicate phase key', LIFE, lifecycle({}, [['idle', 'active', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.'], ['closed', 'None.', 'None.']])],
    ['an unknown phase name', LIFE, lifecycle({ Ends: 'absent' })],
    ['a malformed phase key', LIFE, lifecycle({}, [['idle', 'active', 'None.'], ['active', 'active', 'closed'], ['closed', 'None.', 'None.'], ['bad--key', 'None.', 'None.']])],
    ['a premise sharing a boundary key', `${PART}premises/ticket/README.md`, premise()],
  ]) {
    // forms.md §page-rules, design.md §at-read: all naming rules are resolution
    // or placement, including names whose invalidity is visible on one page.
    // design.md §at-read; door.md §read-checks, §change.
    test(`design.md §at-read: ${name} owes Restate while its page still counts`, async () => {
      const dir = await setup({ [path]: bytes });
      const missing = items(dir);
      assert.ok(missing.some(item => item.item === 'restate:alpha' && item.why === 'unresolved'));
      assert.ok(!missing.some(item => item.item === `change:${path}`));
    });
  }

  for (const kind of ['parts', 'spans']) {
    // design.md §at-read explicitly handles a merge leaving no front page.
    // design.md §at-read; door.md §read-checks, §change.
    test(`design.md §at-read: a ${kind} folder without README owes its own Restate item`, async () => {
      const path = `design/${kind}/orphan/claims/safety/README.md`;
      const dir = await setup({ [path]: claim() });
      const missing = items(dir);
      assert.ok(missing.some(item => item.item === 'restate:orphan' && item.why === 'unresolved'));
      assert.ok(!missing.some(item => item.item === `change:${path}`));
    });
  }

  // door.md §receipts: the last receipt line needs a line feed too.
  // design.md §at-read; door.md §read-checks, §change.
  test('design.md §at-read: a receipt without its final line feed does not accept its page', async () => {
    const dir = await setup({ [claimPath]: claim() });
    const path = `${PART}claims/safety/receipt`;
    const receipt = await read(dir, path);
    await writeFiles(dir, { [path]: receipt.slice(0, -1) });
    const missing = items(dir);
    assert.ok(missing.some(item => item.item === `change:${path}`));
    assert.ok(missing.some(item => item.item === `change:${claimPath}`));
  });

  // door.md §read-checks, §change resolves the former ignored-file tension:
  // an unrelated file is not a design page and is shown as a change.
  // design.md §at-read; door.md §read-checks, §change.
  test('design.md §at-read: an unowned file is a change and contributes no design entry', async () => {
    const path = `${PART}notes.txt`;
    const dir = await setup({ [path]: 'Unowned notes.\n' });
    assert.ok(items(dir).some(item => item.item === `change:${path}`));
  });

  // door.md §change: attributes are required whenever design contains
  // anything outside the brief, regardless of which clone wrote it.
  // design.md §at-read; door.md §read-checks, §change.
  test('design.md §at-read: an existing restatement missing git attributes reports a change', async () => {
    const dir = await setup({ 'design/.gitattributes': null });
    assert.ok(items(dir).some(item => item.item === 'change:design/.gitattributes'));
  });

  // design.md §at-read; door.md §read-checks, §change.
  test('design.md §at-read: a missing reference owes Restate while the holding page still counts', async () => {
    const dir = await setup({ [claimPath]: claim({ 'Rests on': 'absent' }) });
    const missing = items(dir);
    assert.ok(missing.some(item => item.item === 'restate:alpha' && item.why === 'unresolved'));
    assert.ok(!missing.some(item => item.item === `change:${claimPath}`));
    assert.ok(account(dir, 'alpha/claims/safety').thing.page);
  });

  // design.md §at-read; door.md §read-checks, §change.
  test('design.md §at-read: a mismatched part list owes restate:parts, not a change', async () => {
    const dir = await setup({ 'design/README.md': '# Components\n\n' + table(['Part', 'Purpose', 'Cites'], []) });
    const missing = items(dir);
    assert.ok(missing.some(item => item.item === 'restate:parts'));
    assert.ok(!missing.some(item => item.item === 'change:design/README.md'));
  });

  // design.md §at-read; door.md §read-checks, §change.
  test('design.md §at-read: a colliding part/span key owes both front pages’ Restate items', async () => {
    const dir = await setup({ 'design/spans/alpha/README.md': '# Span\n\nGroups related work.\n' });
    const missing = items(dir);
    const restate = missing.find(item => item.item === 'restate:alpha');
    assert.ok(restate);
    // account.md §commands does not fix found's representation or path spelling.
    assert.ok(!missing.some(item => item.item.startsWith('change:')));
  });

  // design.md §at-read; door.md §read-checks, §change.
  test('design.md §at-read: an unresolved citation owes passage rather than Restate', async () => {
    const address = 'design/brief/overview.md#missing';
    const dir = await setup({ [claimPath]: claim({ Cites: address }) });
    const missing = items(dir);
    assert.ok(missing.some(item => item.item === `passage:${address}` && item.why === 'unresolved'));
    assert.ok(!missing.some(item => item.item === 'restate:alpha' || item.item === `change:${claimPath}`));
  });

  // design.md §at-read; door.md §read-checks, §change.
  test('design.md §at-read: dependents of a page that counts for nothing wait without a cascading change or Restate', async () => {
    const premisePath = `${PART}premises/reliable/README.md`;
    const dir = await setup({ [claimPath]: claim({ 'Rests on': 'reliable' }), [premisePath]: premise() });
    await writeFiles(dir, { [premisePath]: premise({ Statement: 'Edited directly, without a receipt.' }) });
    const missing = items(dir);
    assert.ok(missing.some(item => item.item === `change:${premisePath}`));
    assert.ok(!missing.some(item => item.item === `change:${claimPath}` || item.item === 'restate:alpha'));
  });

  // design.md §at-read; door.md §read-checks, §change.
  test('design.md §at-read: missing content lapses a dependent confirmation while the page itself remains accepted', async () => {
    const premisePath = `${PART}premises/reliable/README.md`;
    const dir = await setup({ [claimPath]: claim({ Origin: 'added', 'Rests on': 'reliable' }), [premisePath]: premise() });
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/claims/safety');
    await writeFiles(dir, { [premisePath]: premise({ Statement: 'An unaccepted edit.' }) });
    const missing = items(dir);
    assert.ok(missing.some(item => item.item === 'confirm:alpha/claims/safety' && item.why === 'lapsed'));
    assert.ok(!missing.some(item => item.item === `change:${claimPath}`));
  });

  // design.md §repairs-redirects; door.md §repair-answer; decisions.md §expects.
  test('design.md §repairs-redirects: a restatement Repair uses Restate forms and applies its pages with receipts', async () => {
    const dir = await setup({ [claimPath]: claim({ Origin: 'added' }) });
    await confirmParts(dir);
    await decide(dir, 'decline', 'alpha/claims/safety', ['--words', 'Require a ticket owner.']);
    const repair = items(dir).find(item => item.item.startsWith('repair:'));
    assert.ok(repair);
    const changed = claim({ Origin: 'added', Sentence: 'Every ticket has one owner.' });
    accepted(await submit(dir, { [claimPath]: changed, 'repair.md': fields([['Mechanism', 'Names the required ticket owner.']]) }, repair.item));
    assert.equal(await read(dir, claimPath), changed);
    await checkReceipt(dir, claimPath, changed);
    assert.equal(await read(dir, 'repair.md'), null);
    assert.ok(!items(dir).some(item => item.item === repair.item));
  });

  // design.md §repairs-redirects; door.md §repair-answer; decisions.md §expects.
  test('design.md §repairs-redirects: a restatement Repair refuses an unresolved reference as a Restate answer does', async () => {
    const dir = await setup({ [claimPath]: claim({ Origin: 'added' }) });
    await confirmParts(dir);
    await decide(dir, 'decline', 'alpha/claims/safety', ['--words', 'Add the missing premise.']);
    const repair = items(dir).find(item => item.item.startsWith('repair:'));
    assert.ok(repair);
    await rejected(dir, { [claimPath]: claim({ Origin: 'added', 'Rests on': 'absent' }), 'repair.md': fields([['Mechanism', 'Names the required premise.']]) }, { item: repair.item, file: claimPath, field: 'Rests on' });
  });

  // design.md §repairs-redirects; door.md §repair-answer; decisions.md §expects.
  test('design.md §repairs-redirects: a redirected claim is an ordinary accepted page with a receipt', async () => {
    const dir = await setup({ [claimPath]: claim({ Origin: 'added' }) });
    await confirmParts(dir);
    const words = 'Every ticket has one owner.';
    const showing = query(dir, ['show', 'redirect', 'alpha/claims/safety', '--words', words]);
    query(dir, ['decide', 'redirect', 'alpha/claims/safety', '--words', words, '--shown', showing.token, '--by', 'Test developer', '--provider', 'fixture', '--model', 'reviewer', '--session', 'developer-session']);
    const bytes = await read(dir, claimPath);
    assert.equal(fieldValue(bytes, 'Sentence'), words);
    await checkReceipt(dir, claimPath, bytes);
    assert.ok(!items(dir).some(item => item.item === `change:${claimPath}`));
  });

  // design.md §repairs-redirects; door.md §repair-answer; decisions.md §expects.
  test('design.md §repairs-redirects: a redirected new journey is refused when its references do not resolve', async () => {
    const dir = await setup();
    await confirmParts(dir);
    const folder = await answerFolder({ 'journey.md': journey({}, [[1, 'Client', 'absent', '-', '-', '-']]) });
    const before = await snapshot(dir, { skip: ['work', 'runs'] });
    const result = forma(dir, ['show', 'redirect', 'alpha/journeys/redirected', '--from', `${folder}/journey.md`, '--json']);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.ok(result.json.refused.length > 0);
    assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
  });
});

describe('design.md with the contracts it reads', () => {
  const claimPath = `${PART}claims/safety/README.md`;

  // design.md §paths; door.md §read-checks, §change: a symlink at an
  // otherwise owned page path counts for nothing, even with a matching receipt.
  test('design.md §paths: a symbolic-link page counts for nothing despite its matching receipt', async () => {
    const files = { ...BASE, ...intakeFiles(), 'design/.gitattributes': '* -text -ident -filter -working-tree-encoding\nreceipt merge=union\nbrief/** !text !ident !filter !working-tree-encoding !merge\n' };
    const dir = await project('design/nonregular', files);
    const bytes = await read(dir, claimPath);
    await receiptFiles(dir, { ...files, [claimPath]: bytes });
    assert.ok(items(dir).some(item => item.item === `change:${claimPath}`));
  });

  for (const command of ['missing', 'account', 'box', 'diff']) {
    // account.md §commands, door.md §lock: a read writes nothing in the project.
    // design.md §at-read; door.md §read-checks, §change.
    test(`design.md §at-read: ${command} reads the design and writes nothing`, async () => {
      const dir = await setup();
      const other = command === 'diff' ? await setup() : undefined;
      const before = await snapshot(dir);
      query(dir, [command, ...(other ? [other] : [])]);
      assert.deepEqual(await snapshot(dir), before);
    });
  }

  // design.md §paths; door.md §read-checks, §change item 8: folders are ordinary
  // containers of accepted pages, not nonregular files that owe change:.
  test('design.md §paths: ordinary design folders are not change items', async () => {
    const dir = await setup();
    assert.deepEqual(items(dir).filter(item => item.item.startsWith('change:')), []);
  });

  for (const scratch of ['work', 'runs']) {
    for (const altered of [false, true]) {
      // door.md §change item 7: scratch ignore files never owe change:, including
      // an existing folder whose ignore file is missing or has other bytes.
      test(`design.md §at-read: ${scratch} with ${altered ? 'altered' : 'missing'} gitignore never owes a change`, async () => {
        const dir = await setup({
          [`${scratch}/tmp/unused`]: '',
          ...(altered ? { [`${scratch}/.gitignore`]: 'unexpected\n' } : {}),
        });
        assert.ok(!items(dir).some(item => item.item === `change:${scratch}/.gitignore`));
      });
    }
  }

  // account.md §commands; door.md §lock: a read takes no lock, so it does not wait for
  // a writer that holds one, and writes nothing.
  test('design.md §at-read: a read under a live writer lock reads on and writes nothing', async () => {
    const lock = JSON.stringify({ pid: process.pid, at: AT });
    const dir = await setup({ 'work/lock': lock });
    const before = await snapshot(dir);
    ok(forma(dir, ['account', '--json'], { timeout: 10000 }));
    assert.deepEqual(await snapshot(dir), before);
  });

  // design.md §paths, §removal; door.md §receipts, §sessions: receipt lines are exactly
  // JSON.stringify, including escaping, key order, declared session and final LF.
  test('design.md §paths: an accepted page receipt uses exact JSON.stringify text', async () => {
    const dir = await setup();
    const text = claim({ Origin: 'added' });
    const folder = await answerFolder({ [claimPath]: text });
    const session = { provider: 'fixture/雪', model: 'author\\quoted"', session: 'line\nwith\ttabs\u2028' };
    accepted(forma(dir, ['answer', WORK, folder, '--provider', session.provider, '--model', session.model, '--session', session.session, '--json']));
    const receipt = await read(dir, `${PART}claims/safety/receipt`);
    assert.ok(receipt.endsWith('\n'));
    const lines = receipt.slice(0, -1).split('\n');
    assert.equal(lines.length, 1);
    const entry = JSON.parse(lines[0]);
    assert.deepEqual(Object.keys(entry), ['file', 'sha256', 'at', 'session', 'authors']);
    assert.equal(entry.file, 'README.md');
    assert.equal(entry.sha256, sha256(text));
    assert.deepEqual(entry.session, session);
    assert.deepEqual(entry.authors, [session]);
    assert.equal(lines[0], JSON.stringify(entry));
  });

  for (const [kind, options] of [['decline', []], ['accept', ['--choice', 'accept']]]) {
    // design.md §units; decisions.md §kinds, §forma-decide:
    // a decision's required words must contain something besides whitespace.
    test(`design.md §units: ${kind} refuses required words containing only whitespace`, async () => {
      const dir = await setup({ [claimPath]: claim({ Origin: 'added' }) });
      await confirmParts(dir);
      const showing = query(dir, ['show', kind, 'alpha/claims/safety']);
      const before = await snapshot(dir, { skip: ['work', 'runs'] });
      const result = forma(dir, ['decide', kind, 'alpha/claims/safety', '--shown', showing.token, '--by', 'Test developer', '--provider', 'fixture', '--model', 'reviewer', '--session', 'developer-session', ...options, '--words', ' \t\n\u2003', '--json']);
      assert.equal(result.status, 1, result.stderr || result.stdout);
      assert.ok(result.json?.refused.length > 0, result.stderr || result.stdout);
      assert.deepEqual(await snapshot(dir, { skip: ['work', 'runs'] }), before);
    });
  }

  // forms.md §claims; decisions.md §accept; account.md §standing, presentation.md §reading: Accepted is
  // its own heading between Open and Established, with acceptance attribution.
  test('forms.md §claims: an accepted claim is under Accepted and absent from Open and Established', async () => {
    const dir = await setup({ [claimPath]: claim({ Origin: 'added' }) });
    await decide(dir, 'accept', 'alpha/claims/safety', ['--choice', 'accept', '--words', 'The bounded pilot accepts this risk.']);
    // presentation.md §reading omits empty headings. A conforming journey fills Established
    // so the ordering assertion observes all three populated headings.
    await confirmParts(dir);
    await decide(dir, 'confirm', 'alpha/lifecycles/ticket');
    await decide(dir, 'confirm', 'alpha/journeys/reach-ticket--active');
    query(dir, ['run']);
    const part = account(dir).parts.find(part => part.ref === 'alpha');
    assert.ok(!part.open.some(entry => entry.ref === 'alpha/claims/safety'));
    assert.ok(!part.established.some(entry => entry.ref === 'alpha/claims/safety'));
    const acceptedClaim = part.accepted.find(entry => entry.ref === 'alpha/claims/safety');
    assert.ok(acceptedClaim);
    assert.equal(acceptedClaim.standing, 'accepted');
    assert.equal(acceptedClaim.acceptance.words, 'The bounded pilot accepts this risk.');
    assert.equal(acceptedClaim.acceptance.by, 'Test developer');
    assert.match(acceptedClaim.acceptance.at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    const reading = forma(dir, ['account', 'alpha']);
    assert.equal(reading.status, 0, reading.stderr);
    const headings = [...reading.stdout.matchAll(/^#{1,6} +(Open|Accepted|Established)\s*$/gm)].map(match => match[1]);
    assert.deepEqual(headings, ['Open', 'Accepted', 'Established']);
  });

  for (const currentSession of [false, true]) {
    // door.md §sessions discounts the accepting entry's session, not a
    // historical author; door.md §receipts distinguishes the entry from authors' union.
    test(`design.md §paths: a decision session in receipt ${currentSession ? 'session discounts' : 'authors alone does not discount'} a page`, async () => {
      const dir = await setup({ [claimPath]: claim() });
      await confirmParts(dir);
      const path = `${PART}claims/safety/receipt`;
      const entry = JSON.parse((await read(dir, path)).trim());
      const developer = { provider: 'fixture', model: 'reviewer', session: 'developer-session' };
      entry.authors.push(developer);
      if (currentSession) entry.session = developer;
      await writeFiles(dir, { [path]: JSON.stringify(entry) + '\n' });
      assert.equal(items(dir).some(item => item.item === `change:${claimPath}`), currentSession);
    });
  }
});

describe('design.md §removal TLC action and world-row cleanup', () => {
  const actionColumns = ['Action', 'Actor', 'Sentence', 'Cases', 'Guard', 'Origin', 'Cites'];
  const boundaryColumns = ['Row', 'Names', 'Kind', 'Side', 'Seam', 'Isolation', 'Reads', 'Writes', 'Origin', 'Cites'];
  const touch = ['touch', 'driver', 'Touches the machine.', 'none', 'none', 'stated', CITE];
  const inspect = ['inspect', 'driver', 'Inspects the machine.', 'none', 'none', 'stated', CITE];
  const driver = ['driver', 'Machine driver', 'actor', 'machine', '-', '-', '-', '-', 'stated', CITE];
  const remote = ['remote', 'Remote service', 'service', 'world', 'request-response', '-', '-', '-', 'stated', CITE];
  const menu = [
    ['drop', 'WorldDrop'], ['duplicate', 'WorldDuplicate'], ['delay', 'WorldDelay'],
    ['reorder', 'WorldReorder'], ['fail-forever', 'WorldFailForever'],
    ['fail-then-succeed', 'WorldFailThenSucceed'], ['crash', 'WorldCrash'], ['go-silent', 'WorldGoSilent'],
  ];
  const actions = rows => '# Actions\n\n' + table(actionColumns, rows);
  const boundary = rows => '# Boundary\n\n## Boundary\n\n' + table(boundaryColumns, rows);
  // engines.md §model-md, forms.md §menu: the smallest witness
  // distinguishes drop from no drop (two states).
  // Every required operator has its own name; the other operations stutter.
  const engine = String.raw`---- MODULE Machine ----
VARIABLE dropped
vars == <<dropped>>
Init == dropped = FALSE
TypeOK == dropped \in {FALSE, TRUE}
Touch == UNCHANGED dropped
Inspect == UNCHANGED dropped
WorldDrop == dropped' = TRUE
WorldDuplicate == UNCHANGED dropped
WorldDelay == UNCHANGED dropped
WorldReorder == UNCHANGED dropped
WorldFailForever == UNCHANGED dropped
WorldFailThenSucceed == UNCHANGED dropped
WorldCrash == UNCHANGED dropped
WorldGoSilent == UNCHANGED dropped
====
`;
  const model = page('Cleanup machine', [['Engine', 'tlc'], ['Parts', 'alpha'], ['Entry', 'Machine.tla'], ['Type invariant', 'TypeOK']],
    '## Bounds\n\n' + table(['Bound', 'Value', 'Meaning'], []) +
    '\n## Actions\n\n' + table(['Action', 'Operator', 'Parameters'], [['alpha/touch', 'Touch', 'none'], ['alpha/inspect', 'Inspect', 'none']]) +
    '\n## Misbehaviours\n\n' + table(['Row', 'Item', 'Operator', 'Parameters'], menu.map(([item, operator]) => ['alpha/remote', item, operator, 'none'])) +
    '\n## Phases\n\n' + table(['Lifecycle', 'Over', 'Expression'], []));
  // evidence.md §bounds: empty Bounds gives SHA-256 of empty text, truncated to 12 digits.
  const digest = sha256('').slice(0, 12);
  const touchEvidence = `models/cleanup/actions/alpha/touch.${digest}.json`;
  const inspectEvidence = `models/cleanup/actions/alpha/inspect.${digest}.json`;
  const worldFolder = 'models/cleanup/world/alpha/remote/';
  const dropSlot = `${worldFolder}drop.tla`;
  const dropEvidence = `${worldFolder}drop.${digest}.json`;

  async function examinedCleanupModel() {
    const dir = await setup({
      [LIFE]: null,
      [`${PART}actions.md`]: actions([touch, inspect]),
      [`${PART}boundary.md`]: boundary([driver, remote]),
    });
    accepted(await submit(dir, { 'models/cleanup/model.md': model, 'models/cleanup/Machine.tla': engine }, 'cover:alpha'));
    accepted(await submit(dir, { [dropSlot]: 'Target == dropped\n' }, 'slot:cleanup/world/alpha/remote/drop'));
    query(dir, ['run']);
    for (const path of [touchEvidence, inspectEvidence, dropEvidence, `${worldFolder}drop.enabled.${digest}.json`]) {
      const text = await read(dir, path);
      assert.ok(text, `expected the engine to write ${path}`);
      const evidence = JSON.parse(text);
      assert.equal(evidence.found.outcome, 'reached');
      // evidence.md §measures: duration and this engine's measures, each once, no other.
      assert.deepEqual(Object.keys(evidence.measures).sort(), ['depth', 'duration', 'states']);
    }
    assert.ok(!items(dir).some(item => item.item.startsWith('rule:')));
    return dir;
  }

  // design.md §at-read reads accepted model files through door.md §read-checks;
  // models.md §freeze discounts a new engine file even with a valid receipt.
  test('design.md §at-read: a new receipted engine file is discounted while a model surprise is open', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    const dir = await setup({ [LIFE]: null, [`${PART}actions.md`]: actions([touch, inspect]), [`${PART}boundary.md`]: boundary([driver]) });
    const withoutWorld = model.replace(table(['Row', 'Item', 'Operator', 'Parameters'], menu.map(([item, operator]) => ['alpha/remote', item, operator, 'none'])), table(['Row', 'Item', 'Operator', 'Parameters'], []));
    const disabled = engine.replace('Touch == UNCHANGED dropped', 'Touch == FALSE /\\ UNCHANGED dropped');
    accepted(await submit(dir, { 'models/cleanup/model.md': withoutWorld, 'models/cleanup/Machine.tla': disabled }, 'cover:alpha'));
    query(dir, ['run']);
    // evidence.md §questions, §surprise-file: the disabled action's enabled question opens
    // a surprise without needing a claim property or a confirmed journey.
    const explain = items(dir).find(item => item.item.startsWith('explain:cleanup/actions/alpha/touch.'));
    assert.ok(explain);
    const surprise = JSON.parse(await read(dir, `models/${explain.item.slice(8)}.json`));
    const path = 'models/cleanup/Extra.tla';
    assert.ok(!surprise.held.some(file => file.path === path));
    const bytes = `---- MODULE Extra ----
ExtraValue == TRUE
====
`;
    // door.md §receipts: hand-written merged accepting receipt from its exact bytes.
    const entry = { file: 'Extra.tla', sha256: sha256(bytes), at: AT, session: AUTHOR, authors: [AUTHOR] };
    await writeFiles(dir, { [path]: bytes, 'models/cleanup/receipt': (await read(dir, 'models/cleanup/receipt')) + JSON.stringify(entry) + '\n' });
    assert.ok(items(dir).some(item => item.item === `change:${path}`));
  });

  for (const use of ['unpicked alternative only', 'no pick', 'another journey', 'another alternative']) {
    // forms.md §choices, design.md §code-journeys; evidence.md §questions; account.md §journey-rules: enabled excludes
    // only an action used solely by an alternative a pick in force did not pick.
    test(`design.md §code-journeys: enabled questions for an action used by ${use}`, { skip: !hasToolchain && 'toolchain absent' }, async () => {
      // Different step counts do not add the unpicked alternative as a
      // must-not journey (design.md §code-journeys), leaving it solely an alternative.
      const operation = choice({}, { steps: [[1, 'Machine driver', 'touch', '-', '-', '-']] }, { steps: [[1, 'Machine driver', 'inspect', '-', '-', '-'], [2, 'Machine driver', 'inspect', '-', '-', '-']] });
      const dir = await setup({
        [LIFE]: null,
        [`${PART}actions.md`]: actions([touch, inspect]),
        [`${PART}boundary.md`]: boundary([driver]),
        [`${PART}choices/operation/README.md`]: operation,
        ...(use === 'another journey' ? { [`${PART}journeys/inspection/README.md`]: journey({}, [[1, 'Machine driver', 'inspect', '-', '-', '-']]) } : {}),
        // decisions.md §in-force: a distinct Question gives this choice its own pin,
        // so the first choice's pick does not also pick this one.
        ...(use === 'another alternative' ? { [`${PART}choices/second/README.md`]: operation.replace('Which operation should happen?', 'Which second operation should happen?') } : {}),
      });
      const withoutWorld = model.replace(table(['Row', 'Item', 'Operator', 'Parameters'], menu.map(([item, operator]) => ['alpha/remote', item, operator, 'none'])), table(['Row', 'Item', 'Operator', 'Parameters'], []));
      accepted(await submit(dir, { 'models/cleanup/model.md': withoutWorld, 'models/cleanup/Machine.tla': engine }, 'cover:alpha'));
      if (use !== 'no pick') await decide(dir, 'pick', 'alpha/choices/operation', ['--choice', 'a']);
      const missing = items(dir);
      assert.ok(missing.some(item => item.item === `run:cleanup/actions/alpha/touch.${digest}`));
      assert.equal(missing.some(item => item.item === `run:cleanup/actions/alpha/inspect.${digest}`), use !== 'unpicked alternative only');
    });
  }

  // design.md §removal; evidence.md §moved, §removed; models.md §slot-currency, §parts-change.
  test('design.md §removal: removing an action removes its enabled evidence and keeps another action evidence', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    const dir = await examinedCleanupModel();
    const kept = await read(dir, inspectEvidence);
    const world = await snapshot(`${dir}/${worldFolder}`);
    const result = accepted(await submit(dir, { [`${PART}actions.md`]: actions([inspect]) }));
    assert.ok(result.removed.includes(touchEvidence));
    assert.equal(await read(dir, touchEvidence), null);
    assert.ok(!(await tree(dir)).some(path => path.startsWith('models/cleanup/actions/alpha/touch.')));
    assert.equal(await read(dir, inspectEvidence), kept);
    assert.deepEqual(await snapshot(`${dir}/${worldFolder}`), world);
    assert.equal(await read(dir, 'models/cleanup/model.md'), model);
    assert.equal(await read(dir, 'models/cleanup/Machine.tla'), engine);
    assert.ok(items(dir).some(item => item.item === 'model:cleanup'));
  });

  // design.md §removal; evidence.md §moved, §removed; models.md §slot-currency, §parts-change.
  test('design.md §removal: removing a world row removes its witness slot, receipt and all its evidence', { skip: !hasToolchain && 'toolchain absent' }, async () => {
    const dir = await examinedCleanupModel();
    const kept = await read(dir, inspectEvidence);
    const world = await snapshot(`${dir}/${worldFolder}`);
    assert.ok(world['drop.tla']);
    assert.ok(world.receipt);
    const result = accepted(await submit(dir, { [`${PART}boundary.md`]: boundary([driver]) }));
    for (const path of Object.keys(world)) assert.ok(result.removed.includes(worldFolder + path));
    assert.ok(!(await tree(dir)).some(path => path.startsWith(worldFolder)));
    assert.equal(await read(dir, inspectEvidence), kept);
    assert.equal(await read(dir, 'models/cleanup/model.md'), model);
    assert.equal(await read(dir, 'models/cleanup/Machine.tla'), engine);
    assert.ok(items(dir).some(item => item.item === 'model:cleanup'));
  });
});
