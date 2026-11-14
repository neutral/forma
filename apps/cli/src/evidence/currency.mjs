// Currency: of each model, whether it exists, is usable and is owed a Model answer (models.md §lifecycle-model,
// models.md §slot-currency item 2, models.md §parts-change); of each slot, whether it is current, owed again or kept (models.md §slot-currency); and of
// each piece of evidence, whether it is current (evidence.md §currency). ../record/ reads the files and their
// forms; this module asks, as things stand, the checks that make a slot and a model current.

import { sha256, sortedBy } from '../record/json.mjs';
import { EXTENSION, isProperty, modelEngineReasons, modelRowReasons, slotReasons, slotsOf } from '../record/models.mjs';
import { isLifecycleModel } from '../record/tree.mjs';
import { ENGINE_VERSIONS } from '../toolchain.mjs';
import { compareVersions, FORMA } from '../version.mjs';

/** A reason the parser could not give, for want of a tool: it makes nothing owed (door.md §forma-answer step 4). */
const toolFailed = (reason) => reason.check === 'door.md §forma-answer';

/**
 * Every model's state (models.md §lifecycle-model, §slot-currency item 2, models.md §parts-change), by key: `{ key, engine, folder, exists, usable, owed, reasons,
 * discounted, unchecked, model, files, engineFiles, part, lifecycles }`. A TLC or Alloy model exists while its
 * model.md counts; it is usable while none of its files counts for nothing and it is not owed a Model answer, which it
 * is while it fails models.md §model-answer's checks 1 to 4 as things stand, or, for TLC, records a strike no longer in force. A
 * lifecycle model exists, and is usable, while its part has a lifecycle whose confirmation is in force.
 */
export async function modelStates(ctx) {
  const { project, restatement } = ctx;
  const out = new Map();
  for (const record of project.models.values()) {
    if (record.lifecycle) continue;
    const folder = record.folder;
    const modelMd = record.modelMd;
    const exists = Boolean(modelMd?.counts && record.model?.engine);
    const discounted = [modelMd, ...record.engineFiles.map((name) => project.files.get(`${folder}/${name}`))].filter((r) => r && !r.counts).map((r) => r.path);
    const state = { key: record.key, engine: record.model?.engine ?? null, folder, exists, usable: false, owed: false, reasons: [], discounted, unchecked: [], model: record.model, files: record.files, engineFiles: record.engineFiles, recorded: record.strikes ?? [] };
    if (exists && !discounted.length) {
      const reasons = [...record.reasons, ...modelRowReasons(record.model, restatement, record.engineFiles, ctx.strikes, record.strikes ?? [])];
      if (!record.reasons.length) reasons.push(...(await modelEngineReasons(record.model, record.files, restatement, ctx.strikes)));
      state.unchecked = reasons.filter(toolFailed);
      state.reasons = reasons.filter((r) => !toolFailed(r));
      state.owed = state.reasons.length > 0;
      state.usable = !state.owed;
    }
    out.set(record.key, state);
  }
  // Lifecycle models (models.md §lifecycle-model): `lifecycles-<part>` for each part with a confirmed lifecycle, and any folder of one.
  const parts = new Map();
  for (const lifecycle of ctx.lifecycles.values()) {
    const part = lifecycle.holder?.key ?? lifecycle.entry.split('/')[0];
    if (!parts.has(part)) parts.set(part, []);
    if (lifecycle.confirmed) parts.get(part).push(lifecycle.entry);
  }
  const keys = new Set([...project.models.keys()].filter(isLifecycleModel));
  for (const [part, confirmed] of parts) if (confirmed.length) keys.add(`lifecycles-${part}`);
  for (const key of keys) {
    const part = key.slice('lifecycles-'.length);
    const lifecycles = sortedBy(parts.get(part) ?? []);
    const exists = lifecycles.length > 0;
    out.set(key, { key, engine: 'lifecycle', folder: `models/${key}`, exists, usable: exists, owed: false, reasons: [], discounted: [], unchecked: [], model: { key, engine: 'lifecycle', parts: [part] }, files: {}, engineFiles: [], part, lifecycles });
  }
  return out;
}

/** The extensions a slot of `kind` may have on a model of `engine` (models.md §slots). */
function extensions(kind, engine) {
  if (kind === 'encoding') return engine === 'lifecycle' ? ['md'] : [EXTENSION[engine], 'md'];
  if (kind === 'misbehaviour') return engine === 'lifecycle' ? [] : [EXTENSION[engine]];
  return ['md'];
}

/** A slot file's folder and its name without extension, for matching models.md §slots's positions. */
const where = (path) => ({ folder: path.slice(0, path.lastIndexOf('/')), stem: path.slice(path.lastIndexOf('/') + 1).replace(/\.(tla|als|md)$/, '') });

/**
 * Every slot's state (models.md §slot-currency): `{ files, positions }`. `files` by path, each slot file with `{ kind, model,
 * filled, exists, usable, current, owedAgain, kept, property, reasons, pins, form }`: filled when it has an entry and
 * counts; current while it exists by models.md §slots, its model is usable, each pin its receipt line records is its entry's pin now,
 * and it passes models.md §slot-answer's checks 2 to 5 as things stand; owed again when it is filled and 1 and 2 hold but 3 or 4 fails;
 * kept when it is filled and 1 or 2 fails. `positions` each slot models.md §slots gives on a usable model, with the files
 * that fill it, `unfilled` when none does.
 */
export async function slotStates(ctx, models) {
  const { project, restatement } = ctx;
  const files = new Map();
  const positions = [];
  const claims = ctx.claims.map((c) => ({ entry: c.entry, key: c.key, holder: c.holder, parts: c.parts }));
  const encodingProperty = (state, claim) => {
    const folder = `models/${state.key}/${claim.holder.span ? 'spans' : 'parts'}/${claim.holder.key}/claims/${claim.key}`;
    const exts = extensions('encoding', state.engine);
    return [...project.slots.values()].some((s) => s.kind === 'encoding' && s.model === state.key && where(s.path).folder === folder && exts.includes(s.extension) && s.counts && s.entry && isProperty(s.form));
  };
  const journeys = [...ctx.journeys.values()].filter((j) => j.confirmed).map((j) => ({ entry: j.entry, key: j.key, holder: j.holder, parts: j.parts }));
  const byModel = new Map();
  for (const state of models.values()) {
    if (!state.exists) continue;
    const listed = slotsOf(state.model, restatement, { claims, journeys, property: (claim) => encodingProperty(state, claim), strikes: ctx.strikes });
    byModel.set(state.key, listed);
  }
  for (const slot of project.slots.values()) {
    const state = models.get(slot.model);
    const engine = state?.engine;
    const filled = Boolean(slot.counts && slot.entry);
    const { folder, stem } = where(slot.path);
    const listed = byModel.get(slot.model) ?? [];
    const position = state?.exists ? listed.find((p) => p.kind === slot.kind && (slot.kind === 'witness' || slot.kind === 'fault' ? where(`${p.path}.md`).folder === folder : p.path === `${folder}/${stem}`)) : null;
    const exists = Boolean(position) && extensions(slot.kind, engine).includes(slot.extension);
    const usable = Boolean(state?.usable);
    const record = { path: slot.path, kind: slot.kind, model: slot.model, holder: slot.holder ?? null, thing: slot.thing ?? null, key: slot.key ?? null, part: slot.part ?? null, row: slot.row ?? null, item: slot.item ?? null, extension: slot.extension, form: slot.form, filled, exists, usable, current: false, owedAgain: false, kept: false, property: isProperty(slot.form), reasons: [], unchecked: [], pins: slot.pins ?? [], serves: position?.serves ?? null };
    files.set(slot.path, record);
    if (!filled) continue;
    if (!exists || !usable) {
      record.kept = true;
      continue;
    }
    const pinned = (slot.pins ?? []).filter((p) => ctx.pinNow(p.entry) !== p.pin).map((p) => ({ check: 'models.md §slot-currency', file: slot.path, entry: p.entry, field: null, says: ctx.pinNow(p.entry) === null ? `it was written for ${p.entry}, which stands nowhere now` : `it was written for ${p.entry} at another pin than its pin now` }));
    const claim = slot.thing?.kind === 'claims' ? restatement.things.get(`${slot.holder.key}/claims/${slot.thing.key}`) ?? null : null;
    const journey = slot.thing?.kind === 'journeys' ? ctx.journeys.get(`${slot.holder.key}/journeys/${slot.thing.key}`) ?? null : null;
    const checked = await slotReasons(slot, project.files.get(slot.path).bytes.toString('utf8'), { model: state.model, files: state.files, restatement, claim, journey, from: slot.holder ?? null });
    record.unchecked = checked.filter(toolFailed);
    record.reasons = [...pinned, ...checked.filter((r) => !toolFailed(r))];
    record.current = record.reasons.length === 0;
    record.owedAgain = !record.current;
  }
  for (const [key, listed] of byModel) {
    const state = models.get(key);
    if (!state.usable) continue;
    for (const position of listed) {
      const fill = [...files.values()].filter((f) => f.model === key && f.filled && f.exists && f.kind === position.kind && (position.kind === 'witness' || position.kind === 'fault' ? where(f.path).folder === where(`${position.path}.md`).folder : `${where(f.path).folder}/${where(f.path).stem}` === position.path));
      positions.push({ ...position, model: key, files: fill.map((f) => f.path), state: fill.length ? (fill.some((f) => f.owedAgain) ? 'owed-again' : 'filled') : 'unfilled' });
    }
  }
  return { files, positions: sortedBy(positions, (p) => p.path) };
}

// --- Currency of evidence (evidence.md §currency) -----------------------------------------------------------------------

/** The versions this machine runs for an engine (evidence.md §toolchain, §basis): `{ engine, runtime, library?, forma }`. */
export const versionsHere = (engine) => ({ ...ENGINE_VERSIONS[engine], forma: { version: FORMA.version, source: FORMA.source } });

/**
 * Whether evidence is current (evidence.md §currency), its question being asked now: `{ current, reasons, versionsOnly }`.
 * Current while each project file its basis names has the SHA-256 it gives, each entry the pin, each generated file
 * composed again now the SHA-256, and the versions are this machine's. `composed` is compose()'s result now, null when
 * the question cannot be composed. `versionsOnly` says every file, generated file and entry is unchanged and only the
 * versions differ (evidence.md §versions).
 */
export function evidenceCurrency(ctx, value, composed) {
  const reasons = [];
  const basis = value.basis;
  const files = basis.files.filter((f) => f.path);
  const generated = basis.files.filter((f) => f.generated);
  for (const file of files) {
    const now = ctx.project.files.get(file.path);
    if (!now?.counts) reasons.push(`${file.path} is gone, or counts for nothing`);
    else if (now.sha256 !== file.sha256) reasons.push(`${file.path} changed`);
  }
  for (const item of basis.entries) {
    const pin = ctx.pinNow(item.entry);
    if (pin === null) reasons.push(`${item.entry} stands nowhere now`);
    else if (pin !== item.pin) reasons.push(`${item.entry} says something else now`);
  }
  if (!composed || composed.cannot) reasons.push(`it cannot be composed now${composed?.cannot ? `: ${composed.cannot}` : ''}`);
  else {
    const listed = new Set(files.map((f) => f.path));
    for (const file of composed.files) if (!listed.has(file.path)) reasons.push(`${file.path} is read now and was not when it ran`);
    const had = new Map(generated.map((f) => [f.generated, f.sha256]));
    for (const [name, text] of Object.entries(composed.generated)) {
      if (!had.has(name)) reasons.push(`${name} is composed now and was not when it ran`);
      else if (sha256(text) !== had.get(name)) reasons.push(`${name} composes differently now`);
    }
    for (const name of had.keys()) if (!(name in composed.generated)) reasons.push(`${name} is no longer composed`);
  }
  const here = versionsHere(basis.engine.name);
  const versions = [];
  const named = (what, a, b) => {
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) versions.push(`${what} is ${a?.version ?? 'none'} in its basis, and this machine runs ${b?.version ?? 'none'}`);
  };
  named(`${basis.engine.name}'s version`, basis.engine, here.engine);
  named(`the ${basis.runtime.name} runtime`, basis.runtime, here.runtime);
  if (basis.engine.name === 'lifecycle') named('XState', basis.library, here.library);
  if (basis.forma.version !== here.forma.version || basis.forma.source !== here.forma.source) versions.push(`Forma is ${basis.forma.version} (source ${basis.forma.source}) in its basis, and this machine runs ${here.forma.version} (source ${here.forma.source})`);
  return { current: reasons.length === 0 && versions.length === 0, reasons: [...reasons, ...versions], versionsOnly: reasons.length === 0 && versions.length > 0 };
}

/** Whether evidence, or an open surprise, names a later package version of Forma than this build's (evidence.md §versions). */
export const writtenLater = (value) => {
  const c = compareVersions(value?.basis?.forma?.version, FORMA.version);
  return c !== null && c > 0 ? value.basis.forma.version : null;
};
