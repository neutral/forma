// The graph `forma explore --json` prints (account.md §explorer-graph). Every judgement in it is
// the account's; this module exposes the account's fields and the record's links.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readdir, readFile, readlink } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { basename, join, resolve } from 'node:path';
import { accountOf } from '../account/index.mjs';
import { readEvidenceForDiff } from '../account/diff.mjs';
import { readingOf, CANNOT_KNOW } from '../account/reading.mjs';
import { boxOf } from '../account/box.mjs';
import { lifecyclePicture, pictureBasis } from '../design/lifecycle-tool.mjs';
import { keptQuestion } from '../evidence/index.mjs';
import { renderEvidence } from '../evidence/render.mjs';
import { FORMA, PACKAGE, sourceDigest } from '../version.mjs';
import { dataForm } from '../evidence/lifecycle-engine.mjs';
import { repairOf, questionPlace } from '../door/repair.mjs';
import { statedAddresses } from '../record/decisions.mjs';
import { writtenPassages } from '../record/brief.mjs';
import { readProject } from '../record/project.mjs';
import { aheadOfClock } from '../record/json.mjs';
import { forTheDeveloper, readUnder } from '../account/items.mjs';
import { ENGINE_VERSIONS, installedVersion, toolchainDir } from '../toolchain.mjs';

export { cacheBase } from '../toolchain.mjs';

const digest = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value))
    .digest('hex');
const nodeId = (kind, key) => `${kind}:${encodeURIComponent(key)}`;
const versions = () => ({
  forma: FORMA,
  engines: ENGINE_VERSIONS,
  node: process.versions.node,
  graph: 1,
});

/** A data-only copy, excluding implementation objects and IO metadata. */
function plain(value, stack = new Set()) {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'function') return undefined;
  if (typeof value !== 'object') return value;
  if (Buffer.isBuffer(value)) return undefined;
  if (stack.has(value)) return undefined;
  stack.add(value);
  let result;
  if (value instanceof Map)
    result = Object.fromEntries([...value].map(([k, v]) => [k, plain(v, stack)]));
  else if (value instanceof Set) result = [...value].map((v) => plain(v, stack));
  else if (Array.isArray(value)) result = value.map((v) => plain(v, stack));
  else
    result = Object.fromEntries(
      Object.entries(value)
        .filter(
          ([k, v]) =>
            !['root', 'bytes', 'stat', 'ctx', 'rebuild'].includes(k) && typeof v !== 'function',
        )
        .map(([k, v]) => [k, plain(v, stack)])
        .filter(([, v]) => v !== undefined),
    );
  stack.delete(value);
  return result;
}

/** Content inventory, including names whose addition/removal changes a read. */
async function inputManifest(root) {
  const inputs = [];
  async function visit(folder) {
    const entries = await readdir(join(root, folder), { withFileTypes: true }).catch((e) => {
      if (e.code === 'ENOENT') return [];
      throw e;
    });
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const path = `${folder}/${e.name}`;
      if (e.isDirectory()) {
        inputs.push({ path: `${path}/`, sha256: digest('directory') });
        await visit(path);
      } else if (e.isFile())
        inputs.push({ path, sha256: digest(await readFile(join(root, path))) });
      // A symbolic link is included as an input; the record reader owns whether it counts.
      else if (e.isSymbolicLink()) {
        const target = await readlink(join(root, path));
        const bytes = path.startsWith('design/brief/')
          ? await readFile(join(root, path)).catch(() => null)
          : null;
        inputs.push({ path, sha256: digest([target, bytes ? digest(bytes) : null]) });
      }
    }
  }
  await visit('design');
  await visit('models');
  return inputs;
}

/** External inputs affect reuse but never introduce their absolute paths into a snapshot. */
export async function fingerprint(root) {
  const inputs = await inputManifest(root);
  const tools = [];
  async function inventory(folder, prefix = '') {
    for (const e of (await readdir(folder, { withFileTypes: true }).catch(() => [])).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const path = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) await inventory(join(folder, e.name), path);
      else if (e.isFile()) tools.push([path, digest(await readFile(join(folder, e.name)))]);
      else if (e.isSymbolicLink())
        tools.push([
          path,
          await readlink(join(folder, e.name)),
          digest(await readFile(join(folder, e.name)).catch(() => '')),
        ]);
    }
  }
  await inventory(toolchainDir());
  const run = promisify(execFile);
  const git = await Promise.all(
    ['HEAD', '--all'].map((rev) =>
      run('git', ['rev-parse', rev], { cwd: root, maxBuffer: 4 * 1024 * 1024 })
        .then((r) => r.stdout.trim())
        .catch(() => null),
    ),
  );
  // Forma's package.json and the version installed of each dependency it names: what a checkout and an
  // installed package both hold.
  const manifests = [
    digest(await readFile(new URL('../../package.json', import.meta.url))),
    digest(Object.keys(PACKAGE.dependencies ?? {}).sort().map((name) => [name, installedVersion(name)])),
  ];
  const computation = {
    ...versions(),
    forma: { ...FORMA, source: sourceDigest() },
    environment: digest(tools),
    manifests: digest(manifests),
    git: digest(git),
  };
  return { inputs, versions: computation, hash: digest({ inputs, versions: computation }) };
}

const scopeOf = (e) =>
  typeof e.holder === 'string' ? e.holder : (e.holder?.key ?? e.part ?? null);
const relationOf = (field) =>
  ({
    Action: 'names-action',
    Actions: 'names-action',
    Lifecycle: 'steps-through',
    Lifecycles: 'steps-through',
    'Rests on': 'rests-on',
    Premise: 'rests-on',
    Premises: 'rests-on',
  })[field] ?? 'reads';

function causesOf(a) {
  const items = new Map(a.items.map((x) => [x.item, x]));
  const questions = new Map(a.evidence.questions.map((x) => [`run:${x.question.name}`, x]));
  const causes = new Map();
  const terminal = (name, seen = new Set()) => {
    if (seen.has(name))
      return [{ id: `cycle:${name}`, says: `dependency cycle at ${name}`, item: name }];
    const item = items.get(name);
    if (!item)
      return [
        { id: `missing:${name}`, says: `dependency ${name} is not in this account`, item: name },
      ];
    if (item.waits?.length)
      return item.waits.flatMap((next) => terminal(next, new Set([...seen, name])));
    const q = questions.get(name);
    if (q?.evidence && !q.current && q.reasons?.length)
      return q.reasons.map((says) => ({
        id: `currency:${digest(says).slice(0, 20)}`,
        says,
        item: name,
      }));
    return [
      {
        id: name,
        says: item.found
          ? `${item.why}: ${typeof item.found === 'string' ? item.found : JSON.stringify(item.found)}`
          : (item.why ?? name),
        item: name,
      },
    ];
  };
  const addLine = (line, names, reason) => {
    const ends = names.length
      ? names.flatMap((name) => terminal(name))
      : [
          {
            id: `reason:${digest([line.model, reason]).slice(0, 20)}`,
            says: reason ?? 'the account gives no supplying item',
            item: null,
          },
        ];
    const ids = [...new Set(ends.map((x) => x.id))];
    for (const end of ends) {
      if (!causes.has(end.id))
        causes.set(end.id, { id: end.id, says: end.says, items: new Set(), lines: new Map() });
      const c = causes.get(end.id);
      if (end.item) c.items.add(end.item);
      c.lines.set(line.id, { ...line, causes: ids });
    }
  };
  for (const s of a.standing.claims.values()) {
    if (s.coverItems?.length)
      addLine(
        { id: `${s.entry}:coverage`, claim: s.entry, model: null, condition: 'coverage' },
        s.coverItems,
      );
    for (const m of s.models)
      for (const c of m.conditions)
        if (!c.holds)
          addLine(
            {
              id: `${s.entry}:${m.model}:${c.condition}`,
              claim: s.entry,
              model: m.model,
              condition: c.condition,
            },
            c.items ?? [],
            c.reason ?? c.why ?? c.found,
          );
  }
  for (const [model, failures] of a.standing.ruleFails)
    for (const [i, f] of failures.entries())
      addLine(
        { id: `rule:${model}:${i}`, claim: null, model, rule: f.rule, on: f.on },
        f.items ?? [],
        f.found,
      );
  return [...causes.values()]
    .map((c) => ({ ...c, items: [...c.items].sort(), lines: [...c.lines.values()] }))
    .sort((a, b) => b.lines.length - a.lines.length || a.id.localeCompare(b.id));
}

function retainedPictures(text) {
  const found = [];
  const re = /^[ \t]*```json forma-diagram\s*\n([\s\S]*?)^[ \t]*```/gm;
  for (const m of String(text ?? '').matchAll(re)) {
    try {
      const picture = JSON.parse(m[1]);
      if (picture.format === 1 && picture.lifecycle) found.push(picture);
    } catch {}
  }
  return found;
}

function modeGraph(a) {
  const r = a.project.restatement,
    nodes = new Map(),
    pending = [],
    diagrams = [];
  const add = (kind, key, name, data, scope = null) => {
    const id = nodeId(kind, key);
    nodes.set(id, {
      id,
      kind,
      key,
      name: name ?? key,
      scope,
      data: plain(data),
    });
    return id;
  };
  const edge = (source, relation, target, data = {}) =>
    pending.push({ source, relation, target, data: plain(data) });
  const entries = new Map();
  // A passage's text is its section as written; its canonical text is what its hash is of.
  const written = new Map();
  for (const path of new Set([...a.project.brief.passages.values()].map((p) => p.path))) {
    try {
      for (const [address, text] of writtenPassages(path, readFileSync(join(a.root, path), 'utf8'))) written.set(address, text);
    } catch {
      // An unreadable file keeps its passages' canonical text.
    }
  }
  for (const [key, p] of a.project.brief.passages)
    add('passage', key, p.heading ?? key, { ...p, text: written.get(key) ?? p.canonical, omissions: [] });
  for (let [key, p] of [...r.parts, ...r.spans]) {
    const row = r.partList?.rows?.find((row) => row.key === key) ?? {};
    p = { ...p, ...row };
    const kind = p.span ? 'span' : 'part';
    add(
      kind,
      key,
      p.readme?.page?.name ?? key,
      {
        key,
        span: p.span,
        purpose: p.purpose,
        cites: p.cites,
        actions: p.actions,
        boundary: p.boundary,
        surface: p.surface,
        omissions: p.omissions,
      },
      key,
    );
    for (const cite of p.cites ?? [])
      edge(nodeId(kind, key), 'cites', nodeId('passage', cite), { field: 'Cites' });
  }
  for (const [key, e] of r.entries) {
    const kind = e.kind === 'boundary' ? 'boundary' : 'entry';
    const scope = scopeOf(e);
    const unit = a.project.unitOf(key);
    const data = {
      ...e,
      pin: r.pins.entries.get(key)?.pin ?? null,
      unit,
      confirmation: a.design.units.get(unit)?.state ?? null,
      addition: a.project.isAdded(key),
      references: r.refs.get(key) ?? {},
    };
    if (e.kind === 'claims') data.standing = plain(a.standing.claims.get(key));
    if (e.kind === 'journeys') data.walk = plain(a.design.tool.stepped.get(key));
    add(kind, key, e.name ?? e.sentence ?? e.names ?? e.key, data, scope);
    entries.set(key, nodeId(kind, key));
    for (const cite of e.cites ?? [])
      edge(nodeId(kind, key), 'cites', nodeId('passage', cite), { field: 'Cites' });
    if (e.page) edge(nodeId(kind, key), 'reads', nodeId('file', e.page), { field: 'page' });
  }
  for (const [key, j] of a.design.journeys) {
    if (!entries.has(key)) {
      add(
        'entry',
        key,
        j.heading ?? key,
        { ...j, kind: 'journeys', walk: a.design.tool.stepped.get(key) },
        scopeOf(j),
      );
      entries.set(key, nodeId('entry', key));
    }
    for (const cite of j.cites ?? [])
      edge(entries.get(key), 'cites', nodeId('passage', cite), { field: 'Cites' });
    for (const [field, refs] of Object.entries(j.refs ?? {}))
      for (const ref of refs ?? [])
        if (ref.entry?.entry)
          edge(entries.get(key), relationOf(field), entries.get(ref.entry.entry), {
            field,
            written: ref.written,
          });
    for (const field of ['decision', 'ruling', 'readFrom'])
      if (j[field]) edge(entries.get(key), 'written-by', nodeId('decision', j[field]), { field });
    if (j.choice) edge(entries.get(key), 'reads', entries.get(j.choice), { field: 'choice' });
    if (j.surprise)
      edge(entries.get(key), 'reads', nodeId('surprise', j.surprise), { field: 'surprise' });
    if (j.reaches?.lifecycle)
      edge(entries.get(key), 'steps-through', entries.get(j.reaches.lifecycle), {
        field: 'reaches',
        phase: j.reaches.phase,
      });
  }
  for (const [key, fields] of r.refs)
    for (const [field, refs] of Object.entries(fields))
      for (const ref of refs ?? []) {
        if (ref.entry?.entry)
          edge(entries.get(key), relationOf(field), entries.get(ref.entry.entry), {
            field,
            written: ref.written,
          });
      }
  for (const [key, u] of a.design.units) {
    add('unit', key, key, u);
    for (const entry of u.entries ?? [])
      edge(
        nodeId('unit', key),
        'pins',
        entries.get(typeof entry === 'string' ? entry : entry.entry),
        { pin: u.pin },
      );
  }
  for (const p of a.design.premises) {
    const subject = r.entries.get(p.claim?.entry ?? p.claim ?? p.choice ?? p.name),
      id = add(
        'premise',
        p.name,
        p.statement ?? p.name,
        { ...p, counted: a.standing.carries.get(p.name)?.counted ?? false },
        p.part ?? (subject ? scopeOf(subject) : null),
      );
    if (p.carry?.basis) edge(id, 'carried-on', entries.get(p.carry.basis), { field: 'Basis' });
    if (p.carry?.by?.name)
      edge(id, 'written-by', nodeId('decision', p.carry.by.name), { field: 'carry.by' });
    if (subject)
      edge(id, 'reads', entries.get(subject.entry), {
        field: p.kind === 'page' ? 'name' : p.kind === 'choice' ? 'choice' : 'claim',
      });
    if (p.part && p.row)
      edge(id, 'reads', entries.get(`${p.part}/boundary/${p.row}`), { field: 'row' });
    if (p.model) edge(id, 'reads', nodeId('model', p.model), { field: 'model' });
    for (const part of p.span?.parts ?? [])
      edge(id, 'reads', nodeId('part', part), { field: 'span.parts' });
    for (const [part, rows] of Object.entries(p.span?.shared ?? {}))
      for (const row of rows)
        edge(id, 'reads', entries.get(row.entry), { field: 'span.shared', part });
  }
  for (const s of a.standing.claims.values())
    for (const m of s.models)
      for (const p of m.premises ?? [])
        edge(entries.get(s.entry), 'rests-on', nodeId('premise', p.name ?? p.premise), {
          field: 'standing.models.premises',
          model: m.model,
        });
  for (const [key, model] of a.project.models) {
    const id = add(
      'model',
      key,
      model.model?.name ?? key,
      {
        key,
        folder: model.folder,
        lifecycle: model.lifecycle,
        engine: model.engine,
        model: model.model,
        reasons: model.reasons,
        files: Object.keys(model.files ?? {}),
        rules: a.evidence.rules.get(key),
        failures: a.standing.ruleFails.get(key),
      },
      null,
    );
    const modelRef = (value, kind) => {
      const slash = value?.indexOf('/');
      return slash > 0
        ? entries.get(`${value.slice(0, slash)}/${kind}/${value.slice(slash + 1)}`)
        : undefined;
    };
    for (const part of model.model?.parts ?? [])
      edge(id, 'reads', nodeId('part', part), { field: 'model.parts' });
    for (const lifecycle of model.model?.lifecycles ?? [])
      edge(id, 'reads', entries.get(typeof lifecycle === 'string' ? lifecycle : lifecycle.entry), {
        field: 'model.lifecycles',
      });
    for (const row of model.model?.actions ?? [])
      edge(id, 'names-action', modelRef(row.action, 'actions'), {
        field: 'model.actions',
        action: row.action,
        operator: row.operator,
      });
    for (const row of model.model?.misbehaviours ?? [])
      edge(id, 'reads', modelRef(row.row, 'boundary'), {
        field: 'model.misbehaviours',
        row: row.row,
        item: row.item,
      });
    for (const row of model.model?.phases ?? [])
      edge(id, 'reads', modelRef(row.lifecycle, 'lifecycles'), {
        field: 'model.phases',
        lifecycle: row.lifecycle,
      });
    for (const file of [
      model.modelMd?.path,
      ...Object.keys(model.files ?? {}).map((p) => `${model.folder}/${p}`),
    ].filter(Boolean))
      edge(id, 'reads', nodeId('file', file), { field: 'model files' });
  }
  for (const [path, file] of a.project.files) {
    add('file', path, path, {
      path,
      sha256: file.sha256,
      text: file.bytes?.toString('utf8'),
      counts: file.counts,
      reasons: file.reasons,
      receipt: file.entry,
    });
    for (const answer of file.entry?.answers ?? [])
      edge(nodeId('file', path), 'written-by', nodeId('decision', answer), {
        field: 'receipt.answers',
      });
    for (const pin of file.entry?.pins ?? [])
      edge(nodeId('file', path), 'written-for', entries.get(pin.entry), pin);
  }
  for (const [key, slot] of a.project.slots) {
    const path = slot.path ?? key;
    add(
      'slot',
      path,
      slot.thing?.key ?? path,
      { ...slot, ...a.evidence.slots.files.get(key) },
      slot.holder?.key ?? null,
    );
    if (slot.model)
      edge(nodeId('slot', path), 'slot-of', nodeId('model', slot.model), { field: 'model' });
    if (slot.holder && slot.thing)
      edge(
        nodeId('slot', path),
        'written-for',
        entries.get(`${slot.holder.key}/${slot.thing.kind}/${slot.thing.key}`),
        { field: 'slot subject' },
      );
    for (const pin of slot.pins ?? [])
      edge(nodeId('slot', path), 'pins', entries.get(pin.entry), pin);
    if (slot.part && slot.row)
      edge(nodeId('slot', path), 'written-for', entries.get(`${slot.part}/boundary/${slot.row}`), {
        field: 'world row',
      });
    if (slot.form?.action)
      edge(
        nodeId('slot', path),
        'names-action',
        entries.get(slot.form.action.replace('/', '/actions/')),
        { field: 'form.action' },
      );
    for (const row of slot.form?.overlay ?? []) {
      edge(
        nodeId('slot', path),
        'names-action',
        entries.get(`${slot.holder.key}/actions/${row.action}`),
        { field: 'overlay.action', phase: row.phase },
      );
      edge(
        nodeId('slot', path),
        'reads',
        entries.get(`${slot.holder.key}/lifecycles/${row.lifecycle}`),
        { field: 'overlay.lifecycle', phase: row.phase },
      );
    }
  }
  const asked = new Set(a.evidence.questions.map((r) => r.question.name));
  const kept =
    a.evidence.kept ??
    [...a.project.evidence.values()]
      .filter((f) => f.counts && !asked.has(f.name))
      .map((f) => ({
        question: keptQuestion(a.evidence.ctx, f),
        evidence: f.value,
        current: false,
        reasons: ['its question is not asked now'],
      }));
  const questionRecords = [...a.evidence.questions, ...kept];
  for (const record of questionRecords) {
    const q = record.question;
    add(
      'question',
      q.name,
      q.name,
      {
        ...q,
        asked: asked.has(q.name),
        current: record.current,
        reasons: record.reasons,
        found: record.evidence?.found ?? null,
      },
      scopeOf(q),
    );
    edge(nodeId('question', q.name), 'examines', nodeId('model', q.model), { field: 'model' });
    for (const ref of q.reads ?? [])
      edge(
        nodeId('question', q.name),
        'reads',
        entries.get(typeof ref === 'string' ? ref : ref.entry),
        { field: 'reads' },
      );
    if (q.claim)
      edge(nodeId('question', q.name), 'examines', entries.get(q.claim.entry ?? q.claim), {
        field: 'claim',
      });
    if (q.serves)
      edge(nodeId('question', q.name), 'examines', entries.get(q.serves), { field: 'serves' });
    for (const [role, slot] of Object.entries(q.slots ?? {}))
      if (slot?.path)
        edge(nodeId('question', q.name), 'reads', nodeId('slot', slot.path), {
          field: `slots.${role}`,
        });
    if (record.evidence) {
      const e = record.evidence;
      let rendered = null;
      try {
        rendered = renderEvidence(a.evidence.ctx, e);
      } catch (error) {
        rendered = { error: error.message };
      }
      add(
        'evidence',
        q.name,
        q.name,
        {
          ...e,
          asked: asked.has(q.name),
          current: record.current,
          reasons: record.reasons,
          rendered,
        },
        scopeOf(q),
      );
      edge(nodeId('evidence', q.name), 'examines', nodeId('question', q.name), { field: 'name' });
      for (const f of e.basis?.files ?? [])
        if (f.path)
          edge(nodeId('evidence', q.name), 'reads', nodeId('file', f.path), {
            field: 'basis.files',
            ...f,
          });
      for (const p of e.basis?.entries ?? [])
        edge(nodeId('evidence', q.name), 'pins', entries.get(p.entry), {
          field: 'basis.entries',
          ...p,
        });
    }
  }
  for (const s of a.evidence.surprises) {
    add('surprise', s.name, s.name, s, s.where?.part ?? null);
    edge(nodeId('surprise', s.name), 'surprise-of', nodeId('question', s.question), {
      field: 'question',
    });
    for (const held of s.value?.held ?? [])
      edge(nodeId('file', held.path), 'held-by', nodeId('surprise', s.name), {
        field: 'held',
        ...held,
      });
  }
  for (const d of a.project.decisions) {
    const state =
      d.kind === 'brief' ? a.briefs.states.get(d.name) : a.design.force.states.get(d.name);
    const repairs = a.items.filter((i) => i.item.startsWith(`repair:${d.name}`));
    add('decision', d.name, `${d.kind} · ${d.on ?? d.name}`, { ...d, state, repairs });
    for (const on of Array.isArray(d.on) ? d.on : String(d.on ?? '').split(', '))
      edge(
        nodeId('decision', d.name),
        'decides',
        d.kind === 'rule'
          ? nodeId('surprise', on)
          : d.kind === 'brief'
            ? nodeId('mechanism', on)
            : (entries.get(on) ??
              (a.design.units.has(on) ? nodeId('unit', on) : nodeId('premise', on))),
        { field: 'On' },
      );
    for (const row of d.surprises?.surprises ?? [])
      edge(nodeId('decision', d.name), 'reads', nodeId('question', row.question), {
        field: 'Surprises.Question',
        surprise: row.surprise,
      });
    for (const row of d.surprises?.entries ?? [])
      edge(nodeId('decision', d.name), 'pins', entries.get(row.entry), {
        field: 'Surprises.Entry',
        pin: row.pin,
        surprise: row.surprise,
      });
    if (d.kind === 'brief' && d.rows.Choice === 'stated')
      for (const address of statedAddresses(d.words))
        edge(nodeId('decision', d.name), 'cites', nodeId('passage', address), { field: 'Words' });
    if (state?.supersededBy)
      edge(nodeId('decision', state.supersededBy), 'overrides', nodeId('decision', d.name), {
        field: 'supersededBy',
      });
    if (d.kind === 'rule' || d.kind === 'decline') {
      const route = repairOf(a.project, a.design, `repair:${d.name}`);
      nodes.get(nodeId('decision', d.name)).data.repairRoute = plain({
        verdict: route.verdict,
        kinds: route.kinds,
        reasons: route.reasons,
      });
      for (const target of route.kinds)
        if (target.kind === 'model')
          edge(nodeId('decision', d.name), 'repairs', nodeId('model', target.model), {
            field: 'resolved repair',
            verdict: route.verdict,
          });
        else if (target.kind === 'restate') {
          const journey = d.kind === 'decline' ? a.design.journeys.get(d.on) : null;
          const subjects =
            d.kind === 'decline'
              ? journey?.added === 'offered'
                ? [journey.reaches?.lifecycle ?? journey.goesWith]
                : ['pick', 'kept'].includes(journey?.added)
                  ? []
                  : [d.on]
              : route.verdict === 'property wrong'
                ? (d.surprises?.surprises ?? [])
                    .map((s) => questionPlace(s.question).entry)
                    .filter((e) => e?.includes('/claims/'))
                : [
                    ...new Set(
                      (d.surprises?.surprises ?? [])
                        .flatMap((s) => String(s.parts ?? '').split(', '))
                        .filter(Boolean),
                    ),
                  ];
          for (const subject of subjects)
            edge(
              nodeId('decision', d.name),
              'repairs',
              entries.get(subject) ??
                nodeId(a.design.units.has(subject) ? 'unit' : 'part', subject),
              { field: 'resolved repair', verdict: route.verdict },
            );
        }
      if (route.verdict === 'real finding' && d.rows.Target.startsWith('premise:'))
        edge(nodeId('decision', d.name), 'repairs', nodeId('premise', d.rows.Target.slice(8)), {
          field: 'Target',
          verdict: route.verdict,
        });
      if (route.verdict === 'real finding' && d.rows.Target.startsWith('choice:'))
        edge(nodeId('decision', d.name), 'repairs', nodeId('premise', d.rows.Target), {
          field: 'Target',
          verdict: route.verdict,
        });
      if (route.verdict === 'real finding' && d.rows.Target === 'brief')
        nodes.get(nodeId('decision', d.name)).data.repairRoute.developer = { target: 'brief' };
    }
    for (const repair of repairs)
      edge(nodeId('decision', d.name), 'repairs', nodeId('item', repair.item), { field: 'repair' });
    for (const file of a.project.files.values())
      if (file.entry?.answers?.includes(d.name))
        edge(nodeId('decision', d.name), 'repairs', nodeId('file', file.path), {
          field: 'receipt.answers',
        });
    if (d.kind === 'rule') {
      const pictures = retainedPictures(d.shown);
      const keptJourneys = [...a.design.journeys.values()]
        .filter((j) => j.added === 'kept' && j.ruling === d.name)
        .map((x) => plain(x));
      for (const p of pictures) {
        const variant = { kind: 'kept', ruling: d.name, source: p.source };
        diagrams.push({
          id: digest([p.lifecycle, variant]),
          lifecycle: p.lifecycle,
          variant,
          basis: p.basis,
          picture: p,
          journeys: keptJourneys,
          traces: [],
          showing: d.shown,
        });
      }
      if (!pictures.length)
        diagrams.push({
          id: `kept:${d.name}`,
          lifecycle: null,
          variant: { kind: 'kept', ruling: d.name },
          basis: null,
          picture: null,
          reason: 'What this ruling was shown keeps no structured picture.',
          showing: d.shown,
          journeys: keptJourneys,
          traces: [],
        });
    }
  }
  for (const item of a.items) {
    add('item', item.item, item.why ?? item.item, { ...item, under: readUnder(item, a) });
    for (const wait of item.waits ?? [])
      edge(nodeId('item', item.item), 'waits-for', nodeId('item', wait), { field: 'waits' });
    const on =
      entries.get(item.on) ??
      (a.project.models.has(item.on)
        ? nodeId('model', item.on)
        : a.design.units.has(item.on)
          ? nodeId('unit', item.on)
          : nodeId('question', item.on));
    edge(nodeId('item', item.item), 'reads', on, { field: 'on' });
  }
  for (const [key, l] of a.design.lifecycles) {
    const basis = pictureBasis(a.project, l);
    const picture = lifecyclePicture(l, [], { basis });
    const journeys = [...a.design.journeys.values()]
      .filter((j) => {
        const walk = a.design.tool.stepped.get(j.name);
        return (
          walk?.moves?.some((m) => m.lifecycle === key) ||
          walk?.steps?.some((s) =>
            [...(s.refusedBy ?? []), ...(s.unknown ?? [])].some((m) => m.lifecycle === key),
          ) ||
          Object.values(r.refs.get(j.name) ?? {})
            .flat()
            .some((ref) => ref.entry?.entry === key)
        );
      })
      .map((j) => {
        const walk = a.design.tool.stepped.get(j.name);
        const marks = [
          ...(walk?.initial ?? [])
            .filter((s) => s.lifecycle === key && s.phase !== null)
            .map((s) => ({ phase: s.phase, entity: s.entity, steps: [0] })),
          ...(walk?.moves ?? [])
            .filter((m) => m.lifecycle === key && !m.refusedStep)
            .map((m) => ({ ...m, steps: [m.step] })),
        ];
        return {
          id: j.name,
          name: j.heading ?? j.name,
          source: 'tool',
          confirmed: j.confirmed,
          polarity: j.polarity,
          steps: j.steps,
          start: j.start,
          initial: walk?.initial,
          walk: plain(walk),
          basis: { pin: j.pin },
          picture: lifecyclePicture(l, marks, {
            basis,
            source: { journey: j.name, digest: digest(walk) },
          }),
        };
      });
    const traces = [...nodes.values()]
      .filter(
        (n) => n.kind === 'evidence' && n.data.rendered?.pictures?.some((p) => p.lifecycle === key),
      )
      .map((n) => ({
        id: n.key,
        name: n.key,
        source: 'evidence',
        current: n.data.current,
        reasons: n.data.reasons,
        outcome: n.data.found,
        basis: n.data.basis,
        trace: n.data.trace,
        picture: n.data.rendered.pictures.find((p) => p.lifecycle === key).picture,
      }));
    diagrams.push({
      id: key,
      lifecycle: key,
      name: l.name,
      variant: { kind: 'as-read' },
      basis,
      picture,
      journeys,
      traces,
    });
    for (const j of journeys)
      edge(entries.get(j.id), 'steps-through', entries.get(key), { field: 'walk' });
  }
  for (const subject of a.briefs.subjects.values()) {
    const key = subject.name;
    add('mechanism', key, subject.mechanisms.join('; '), {
      ruling: subject.ruling.name,
      model: subject.model,
      mechanisms: subject.mechanisms,
      files: subject.files,
      brief: subject.inForce ?? null,
    });
    edge(nodeId('model', subject.model), 'names-mechanism', nodeId('mechanism', key), {
      field: 'repair',
    });
    edge(nodeId('mechanism', key), 'written-by', nodeId('decision', subject.ruling.name), {
      field: 'ruling',
    });
    if (subject.inForce)
      edge(nodeId('mechanism', key), 'written-by', nodeId('decision', subject.inForce.name), {
        field: 'brief decision',
      });
    for (const path of subject.files)
      edge(nodeId('mechanism', key), 'reads', nodeId('file', path), {
        field: 'receipt.mechanisms',
      });
  }
  for (const [path, slot] of a.evidence.slots.files)
    if (slot.form?.overlay?.length) {
      const model = a.project.models.get(slot.model);
      if (!model?.lifecycle) continue;
      const part = slot.holder?.key;
      const own = [...a.design.lifecycles.values()].filter((l) => l.part === part && l.confirmed);
      const data = dataForm(part, own, r.parts.get(part)?.actions ?? [], slot.form.overlay);
      for (const modified of data.lifecycles) {
        if (!slot.form.overlay.some((row) => row.lifecycle === modified.key)) continue;
        const base = own.find((l) => l.key === modified.key);
        const basis = {
          ...pictureBasis(a.project, base),
          slot: { path, sha256: slot.record?.sha256 ?? a.project.files.get(path)?.sha256 },
        };
        const variant = { kind: 'fault', model: slot.model, slot: path };
        const cells = structuredClone(base.asRead ?? base.cells);
        for (const row of slot.form.overlay.filter((row) => row.lifecycle === modified.key))
          if (cells[row.phase] && row.action in cells[row.phase])
            cells[row.phase][row.action] = structuredClone(row.outcome);
        diagrams.push({
          id: digest([base.entry, variant]),
          lifecycle: base.entry,
          variant,
          basis,
          picture: lifecyclePicture({ ...base, asRead: cells }, [], { basis }),
          overlay: slot.form.overlay,
          journeys: [],
          traces: [],
        });
      }
    }
  const edges = [];
  const edgeIds = new Set();
  for (const e of pending)
    if (nodes.has(e.source) && nodes.has(e.target)) {
      const id = digest([e.source, e.relation, e.target, e.data]);
      if (!edgeIds.has(id)) {
        edges.push({ id, ...e });
        edgeIds.add(id);
      }
    }
  for (const node of nodes.values())
    if (node.kind === 'decision' && node.data.repairRoute)
      node.data.repairRoute.targets = edges
        .filter((e) => e.source === node.id && e.relation === 'repairs')
        .map((e) => ({
          id: e.target,
          name: nodes.get(e.target).name,
          field: e.data.field,
        }));
  for (const [checkpointOrder, checkpoint] of forTheDeveloper(a.items, a, a.settings).entries())
    for (const [groupOrder, group] of checkpoint.groups.entries())
      for (const [position, item] of [...group.full, ...group.rest].entries()) {
        const node = nodes.get(nodeId('item', item.item));
        if (node)
          node.data.developerGroup = {
            checkpoint: checkpoint.checkpoint,
            checkpointOrder,
            groupOrder,
            under: group.under,
            position,
            full: position < group.full.length,
            cadence: a.settings.cadence ?? 'span',
          };
      }
  for (const p of nodes.values())
    if (p.kind === 'passage') {
      p.data.citations = edges
        .filter((e) => e.target === p.id && e.relation === 'cites')
        .map((e) => e.source);
      p.data.omissions = [...r.parts.values()].flatMap((part) =>
        part.omissions
          .filter((o) => o.passage === p.key)
          .map((o) => ({
            ...o,
            part: part.key,
            confirmation: a.design.units.get(a.project.unitOf(o.entry))?.state ?? null,
          })),
      );
    }
  return {
    reading: readingOf(a),
    box: boxOf(a),
    nodes: [...nodes.values()],
    edges,
    causes: causesOf(a),
    diagrams,
  };
}

/** Both readings share the exact checked project; recorded uses the diff's computation. */
export async function buildGraph(root) {
  root = resolve(root);
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = await fingerprint(root);
    const { inputs } = before;
    const here = await accountOf(root);
    const recorded = await accountOf(root, {
      machine: false,
      project: here.project,
      evidenceWith: readEvidenceForDiff,
    });
    const modes = { here: modeGraph(here), recorded: modeGraph(recorded) };
    const after = await fingerprint(root);
    const hashes = new Map(inputs.map((f) => [f.path, f.sha256]));
    if (
      before.hash !== after.hash ||
      [...here.project.files].some(([path, file]) => hashes.get(path) !== file.sha256)
    )
      continue;
    return {
      format: 1,
      generation: before.hash,
      computedAt: new Date().toISOString(),
      project: basename(root),
      versions: before.versions,
      inputs,
      local: here.hereJson,
      modes,
      cannotKnow: CANNOT_KNOW,
    };
  }
  throw new Error('The project changed during three reads; retry after its writer finishes.');
}

/**
 * `forma explore --json` (project.md §explore): prints the graph and exits. The graph is what the
 * explorer app reads; Forma serves no page of its own.
 */
export async function exploreCommand(root, { json = false } = {}) {
  const refuse = (says) => {
    const refused = [{ check: 'project.md §explore', file: null, entry: null, field: null, says }];
    return { status: 1, stdout: json ? `${JSON.stringify({ refused })}\n` : `${says}\n`, stderr: '' };
  };
  if (!json) return refuse('forma explore prints the graph as JSON: forma explore --json. The explorer app reads it.');
  try {
    return { status: 0, stdout: `${JSON.stringify(await buildGraph(root), null, 2)}\n`, stderr: '' };
  } catch (error) {
    return refuse(error.message);
  }
}

/** The clock rule (door.md §clock): the latest tracked time ahead of this machine's clock, `{ at, file }`, or null. */
export async function clockAhead(root) {
  return aheadOfClock((await readProject(resolve(root))).clock.latest);
}
