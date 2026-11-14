// Standing (account.md §standing), computed at every read from the project, the design and the evidence as read: per claim and per
// model covering its parts, the seven conditions and what supplies each that fails; the premises a
// claim rests on there; the carries-with-basis fixpoint, so no claim supports itself; the labels; and
// each established line's basis (account.md §basis-line). The journey and span rules (account.md §journey-rules) are
// ../evidence/conformance.mjs's; this module reads them and never recomputes them.

import { basisDigest, compare, sortedBy } from '../record/json.mjs';
import { surpriseName } from '../record/evidence.mjs';
import { claimBounds, covers } from '../record/models.mjs';
import { resolveRef } from '../record/pages.mjs';
import { tidy } from '../record/pins.mjs';
import { renderEvidence, searchOf } from '../evidence/render.mjs';

/** The conditions of account.md §standing, in its table's order. */
const CONDITIONS = ['confirmed', 'examined', 'controlled', 'witnessed', 'conforming', 'carried', 'no open surprise'];

const under = (path) => path.replace(/^models\//, '');
const stemOf = (path) => under(path).replace(/\.(tla|als|md)$/, '');
const folderOf = (path) => path.slice(0, path.lastIndexOf('/'));

/** A thing's folder under a model (models.md §paths, §slots): `models/<model>/<parts or spans>/<holder>/<kind>/<key>`. */
const thingFolder = (model, holder, kind, key) => `models/${model}/${holder.span ? 'spans' : 'parts'}/${holder.key}/${kind}/${key}`;

/** Every claim of the restatement with its parts (design.md §filing), in name order. */
export function claimsOf(project) {
  const r = project.restatement;
  return sortedBy([...r.things.values()].filter((t) => t.kind === 'claims'), (t) => t.entry).map((claim) => ({ ...claim, parts: r.thingParts.get(claim.entry) ?? claim.parts }));
}

/** The models that exist and whose parts include all of `parts` (account.md §standing, models.md §slots), in key order. */
function modelsCovering(evidence, parts) {
  return sortedBy([...evidence.models.values()].filter((m) => m.exists && m.model && covers(m.model, parts)), (m) => m.key);
}

/**
 * The premises a claim's page names in `Rests on` (forms.md §claims), each by the name a carry's `On` gives it
 * (decisions.md §carry): a premise page `<part>/premises/<key>`, `store:<part>/<row>` and `choice:<part>/<choice>`. A
 * reference that names nothing is left out: check 2 fails for it and restate: owes it (design.md §at-read).
 */
export function restsOnPremises(restatement, claim) {
  const out = [];
  for (const item of claim.restsOn ?? []) {
    if (item.tag === 'store') {
      const ref = resolveRef(restatement, item.ref, claim.holder, 'boundary');
      if (ref.entry) out.push(`store:${ref.part}/${ref.key}`);
    } else if (item.tag === 'choice') {
      const ref = resolveRef(restatement, item.ref, claim.holder, 'choices');
      if (ref.entry) out.push(`choice:${ref.part}/${ref.key}`);
    } else {
      const ref = resolveRef(restatement, item.ref, claim.holder, 'premises');
      if (ref.entry) out.push(ref.entry.entry);
    }
  }
  return [...new Set(out)];
}

/** A choice premise's choice entry name, `<part>/choices/<choice>`, from `choice:<part>/<choice>` (forms.md §choice-premises). */
const choiceOfPremise = (name) => name.replace(/^choice:([^/]+)\//, '$1/choices/');

/**
 * What a premise says (forms.md §premises, §premise-says): `{ class, statement, falsifier, provider }`, as readDesign gives them, a
 * premise page's from its page and each premise code adds from forms.md §premise-says's table. `premise` is one of readDesign's premises.
 */
export function premiseSays(premise) {
  return { class: premise?.class ?? null, statement: premise?.statement ?? null, falsifier: premise?.falsifier ?? null, provider: premise?.provider ?? null };
}

/**
 * The state of each premise's carry (account.md §standing, decisions.md §carry, §in-force), before the fixpoint: `{ carried, by,
 * basis, revokedBy, lapsed }`, `carried` whether a carry (or, for a choice premise, a pick) is in force and not
 * revoked, `lapsed` whether its latest decision lapsed or was revoked.
 */
function carryStateOf(design, name) {
  const key = name.startsWith('choice:') ? choiceOfPremise(name) : name;
  const raw = design.force.carried(key);
  const record = design.force.subjects.get(key, name.startsWith('choice:') ? 'choice' : 'premise');
  const lapsedDecisions = (record?.lapsed ?? []).filter((d) => d.kind === 'carry' || d.kind === 'pick');
  return {
    carried: Boolean(raw.carried),
    by: raw.by ?? null,
    basis: raw.basis ?? null,
    revokedBy: raw.revokedBy ?? null,
    lapsed: !raw.carried && (Boolean(raw.revokedBy) || (lapsedDecisions.length > 0 && !(raw.by && raw.by.kind === 'carry'))),
  };
}

/**
 * Standing (account.md §standing): `{ claims, carries, premisesOf }`.
 *
 * - `claims`: Map by claim entry name of `{ claim, entry, parts, label, acceptance, cover, models }`; each model line
 *   `{ model, engine, established, conditions, fails, bounds, premises, basis }`, `conditions` each `{ condition, holds,
 *   needs, found }` in account.md §standing's order, `needs` the item names that would supply it (a surprise as `surprise:<name>`, for
 *   src/account/index.mjs to resolve to its explain:, run: or rule: item), `fails` the conditions that do not hold.
 * - `carries`: Map by premise name of its carry state after the fixpoint: `{ carried, counted, by, basis, revokedBy,
 *   lapsed }`, `counted` whether the carry counts (a carry with a basis counts only while its basis claim is
 *   established without it).
 * - `premisesOf(claim, model)`: the premises a claim rests on there.
 */
export function standingOf({ project, design, evidence, mechanismsOf = () => [] }) {
  const r = project.restatement;
  const claims = claimsOf(project);
  const force = design.force;

  // What supplies a question that does not match (account.md §journey-rules, §items): its open surprise, its owed run, or its unanswered evidence.
  const openByQuestion = new Map();
  for (const s of evidence.surprises.filter((x) => x.open)) {
    if (!openByQuestion.has(s.question)) openByQuestion.set(s.question, []);
    openByQuestion.get(s.question).push(s.name);
  }
  const owedByQuestion = new Map(evidence.owed.filter((o) => ['none', 'not-current', 'larger-limits', 'lost-surprise'].includes(o.why)).map((o) => [o.name, o.item]));
  const unanswered = new Set(evidence.unanswered.map((u) => u.question));
  const questionNeeds = (name) => [
    ...(openByQuestion.get(name) ?? []).map((s) => `surprise:${s}`),
    ...(owedByQuestion.has(name) ? [owedByQuestion.get(name)] : []),
    ...(unanswered.has(name) ? [`unanswered:${name}`] : []),
  ];
  const records = new Map(evidence.questions.map((rec) => [rec.question.name, rec]));
  const matched = (rec) => Boolean(rec?.current && rec.evidence?.matches === true);

  // What supplies each rule a model fails (account.md §journey-rules, presentation.md §reading): the items its questions and slots owe.
  const posedChoices = (part) => {
    const out = new Set();
    for (const l of design.lifecycles.values()) {
      if (l.part !== part) continue;
      for (const p of l.posed ?? []) {
        const name = String(p.choice).includes('/choices/') ? p.choice : resolveRef(r, p.choice, l.holder, 'choices').entry?.entry;
        if (name) out.add(name);
      }
    }
    return [...out].sort(compare);
  };
  const ruleNeeds = (state, failure) => {
    if (failure.rule === 'rows') return state.owed ? [`model:${state.key}`] : state.discounted.map((p) => `change:${p}`);
    const out = [];
    for (const q of failure.questions ?? []) out.push(...questionNeeds(q));
    for (const s of failure.slots ?? []) out.push(`slot:${stemOf(s)}`);
    if (failure.rule === 'progress' && String(failure.found).startsWith('none: no confirmed should-happen journey')) out.push(`journey:${failure.on}`);
    if (failure.rule === 'journeys' && !(failure.questions ?? []).length && state.engine === 'lifecycle') {
      const picks = posedChoices(state.part);
      out.push(...(picks.length ? picks.map((c) => `pick:${c}`) : [`restate:${state.part}`]));
    }
    if (failure.rule === 'explored') {
      // evidence.md §flags: `open-pair <lifecycle>/<phase>/<action>`, and `/<case>` after it for a case of a cell; a posed
      // cell's flag is owed by its choice's pick:, every other flag by restate: (account.md §items).
      const m = /^open-pair ([^/]+)\/([^/]+)\/([^/]+)(?:\/(.+))?$/.exec(failure.found);
      const lifecycle = m ? design.lifecycles.get(`${state.part}/lifecycles/${m[1]}`) : null;
      const posed = lifecycle?.posed?.find((p) => p.phase === m[2] && p.action === m[3] && (p.case ?? null) === (m[4] ?? null));
      const choice = posed ? (String(posed.choice).includes('/choices/') ? posed.choice : resolveRef(r, posed.choice, lifecycle.holder, 'choices').entry?.entry) : null;
      out.push(choice ? `pick:${choice}` : `restate:${state.part}`);
    }
    return [...new Set(out)];
  };
  const ruleFails = new Map();
  for (const state of evidence.models.values()) {
    if (!state.exists) continue;
    const rules = evidence.rules.get(state.key);
    ruleFails.set(state.key, (rules?.failures ?? []).map((f) => ({ ...f, needs: ruleNeeds(state, f) })));
  }

  // The premises a claim rests on, on a model (account.md §standing).
  const bounds = new Map((project.premises.bound ?? []).map((p) => [p.name, p]));
  const strikesInForce = (project.premises.strike ?? []).filter((p) => force.carried(p.name)?.carried);
  const premisesOf = (claim, state) => {
    const out = [...restsOnPremises(r, claim)];
    const bound = `bound:${state.key}/${claim.holder.key}/${claim.key}`;
    if (bounds.has(bound)) out.push(bound);
    if (state.engine !== 'lifecycle') for (const p of strikesInForce) if (state.model.parts.includes(p.part)) out.push(p.name);
    return out;
  };

  // The conditions that do not depend on carries, once per claim and covering model.
  const lines = new Map();
  for (const claim of claims) {
    const covering = modelsCovering(evidence, claim.parts);
    const unitName = project.unitOf(claim.entry);
    const unit = design.units.get(unitName);
    const out = [];
    for (const state of covering) {
      const m = state.key;
      const folder = thingFolder(m, claim.holder, 'claims', claim.key);
      const slotFiles = [...evidence.slots.files.values()].filter((s) => s.model === m && folderOf(s.path) === folder);
      const encodings = slotFiles.filter((s) => s.kind === 'encoding');
      const encoding = encodings.find((s) => s.filled) ?? null;
      const own = evidence.questions.filter((rec) => rec.question.model === m && rec.question.claim?.entry === claim.entry);
      const base = own.find((rec) => rec.question.kind === 'base') ?? null;
      const faults = own.filter((rec) => rec.question.kind === 'fault');
      const witnesses = own.filter((rec) => rec.question.kind === 'witness');
      const conformNeeds = (ruleFails.get(m) ?? []).flatMap((f) => f.needs);
      const unusable = !state.usable ? (state.owed ? [`model:${m}`] : state.discounted.map((p) => `change:${p}`)) : null;
      const c = {};

      // confirmed: the unit that holds the claim has a confirmation in force on its current pin.
      const decline = unit?.state === 'declined' ? force.subjects.get(unitName, 'unit')?.inForce : null;
      c.confirmed = { holds: unit?.state === 'confirmed', needs: decline ? [`repair:${decline.name}`] : [`confirm:${unitName}`], found: unit?.state ?? 'unconfirmed' };

      // examined: its encoding there is a property, and its base question's evidence is current and found no violation.
      const property = Boolean(encoding?.property);
      const cannot = encoding && !encoding.property ? encoding.form?.cannotExpress ?? '' : null;
      // On a model where its current encoding gives a reason the engine cannot express it, nothing is owed there: no item
      // supplies examined, controlled or witnessed, and each gives that reason (account.md §basis-line). The claim's express: item
      // is the claim's, owed while every covering model says so (account.md §items), and supplies no condition of one model.
      const cannotHere = cannot !== null && !unusable && !encoding.owedAgain;
      let ex;
      if (unusable) ex = { holds: false, needs: unusable, found: state.owed ? 'the model is owed a Model answer' : 'a file of the model counts for nothing' };
      else if (!encoding) ex = { holds: false, needs: [`slot:${under(folder)}/encoding`], found: 'no encoding is filled' };
      else if (encoding.owedAgain) ex = { holds: false, needs: [`slot:${stemOf(encoding.path)}`], found: 'its encoding is owed again' };
      else if (cannotHere) ex = { holds: false, needs: [], found: `its encoding says the engine cannot express it: ${cannot}` };
      else if (!base) ex = { holds: false, needs: conformNeeds, found: 'its base question is not asked while the model fails a journey rule' };
      else ex = { holds: matched(base) && base.evidence.found.outcome === 'no violation', needs: questionNeeds(base.question.name), found: foundOf(base) };
      // Where its base evidence there found a violation whose surprise a ruling in force names, no item supplies examined:
      // it gives that ruling as its reason (account.md §basis-line).
      if (base?.current && base.evidence?.found?.outcome === 'violation') {
        const ruling = force.rulings.get(surpriseName(base.question.name, basisDigest(base.evidence.basis)));
        if (ruling) ex.reason = `its base surprise is ruled: ${ruling.name}`;
      }
      // Whether its encoding there says the engine cannot express it, which the item express: reads (account.md §items).
      ex.cannotExpress = cannot !== null && !unusable;
      c.examined = ex;

      // controlled: the evidence of at least one fault there is current and was caught by its property.
      const faultSlots = slotFiles.filter((s) => s.kind === 'fault' && s.filled);
      const caught = faults.filter(matched);
      c.controlled = {
        holds: caught.length > 0,
        needs: unusable ?? (cannotHere ? [] : !faultSlots.length ? (property ? [`slot:${under(folder)}/fault`] : ex.needs) : [...faultSlots.filter((s) => s.owedAgain).map((s) => `slot:${stemOf(s.path)}`), ...faults.flatMap((f) => questionNeeds(f.question.name)), ...(faults.length ? [] : conformNeeds)]),
        found: caught.length ? `${caught.length} caught` : faults.length ? faults.map((f) => `${f.question.name}: ${foundOf(f)}`).join('; ') : 'none',
      };

      // witnessed: at least one witness there, and every witness's evidence current and reached.
      const witnessSlots = slotFiles.filter((s) => s.kind === 'witness' && s.filled);
      const recordOf = (slot) => witnesses.find((w) => w.question.slot === slot.key) ?? null;
      const allReached = witnessSlots.length > 0 && witnessSlots.every((s) => matched(recordOf(s)));
      c.witnessed = {
        holds: allReached,
        needs: unusable ?? (cannotHere ? [] : !witnessSlots.length ? (property ? [`slot:${under(folder)}/witness`] : ex.needs) : witnessSlots.flatMap((s) => {
          if (s.owedAgain) return [`slot:${stemOf(s.path)}`];
          const rec = recordOf(s);
          return rec ? questionNeeds(rec.question.name) : conformNeeds;
        })),
        found: witnessSlots.length ? witnessSlots.map((s) => `${stemOf(s.path)}: ${foundOf(recordOf(s))}`).join('; ') : 'none',
      };
      // On a model where its encoding gives a reason the engine cannot express it, no fault or witness is owed there, so
      // examined, controlled and witnessed each give that reason (account.md §basis-line).
      if (cannotHere) for (const k of ['examined', 'controlled', 'witnessed']) c[k].reason = `its encoding says why the engine cannot express it: ${tidy(cannot)}`;

      // conforming: the model meets the journey rules (account.md §journey-rules).
      const fails = ruleFails.get(m) ?? [];
      c.conforming = { holds: Boolean(evidence.rules.get(m)?.meets), needs: [...new Set(fails.flatMap((f) => f.needs))], found: `${fails.length} rule${fails.length === 1 ? '' : 's'} failed`, rules: fails.length };

      // no open surprise: on any question on the model, the claim's or another's.
      const open = evidence.surprises.filter((s) => s.open && s.model === m);
      c['no open surprise'] = { holds: open.length === 0, needs: open.map((s) => `surprise:${s.name}`), found: open.length ? open.map((s) => s.name).join(', ') : 'none' };

      out.push({ state, folder, encoding, property, base, faults, caught, witnesses, witnessSlots, premises: premisesOf(claim, state), c });
    }
    lines.set(claim.entry, { claim, unitName, covering, out });
  }

  // The carries-with-basis fixpoint (account.md §standing): carries naming no basis count; then each carry whose basis claim
  // is established with those counted, again until none is added.
  const allPremises = new Set();
  for (const { out } of lines.values()) for (const l of out) for (const p of l.premises) allPremises.add(p);
  for (const p of design.premises) allPremises.add(p.name);
  const carries = new Map();
  for (const name of allPremises) carries.set(name, { ...carryStateOf(design, name), counted: false });
  for (const s of carries.values()) s.counted = s.carried && !s.basis;
  const establishedOn = (entry) => {
    const record = lines.get(entry);
    if (!record) return false;
    return record.out.some((l) => CONDITIONS.filter((k) => k !== 'carried').every((k) => l.c[k].holds) && l.premises.every((p) => carries.get(p)?.counted));
  };
  for (;;) {
    const add = [...carries.values()].filter((s) => s.carried && s.basis && !s.counted && establishedOn(s.basis));
    if (!add.length) break;
    for (const s of add) s.counted = true;
  }
  for (const s of carries.values()) if (s.carried && !s.counted) s.lapsed = true;

  // Each claim's standing and label.
  const out = new Map();
  for (const [entry, { claim, unitName, covering, out: models }] of lines) {
    const acceptRecord = force.subjects.get(entry, 'risk')?.inForce;
    const acceptance = acceptRecord?.kind === 'accept' && acceptRecord.rows?.Choice === 'accept' ? { decision: acceptRecord.name, words: acceptRecord.words ?? '', by: acceptRecord.by, at: acceptRecord.at } : null;
    const modelLines = models.map((l) => {
      const premises = l.premises.map((name) => ({ name, ...carries.get(name) }));
      const notCarried = premises.filter((p) => !p.counted);
      const conditions = CONDITIONS.map((condition) => {
        if (condition === 'carried') {
          return { condition, holds: notCarried.length === 0, needs: notCarried.map((p) => (p.name.startsWith('choice:') ? `pick:${choiceOfPremise(p.name)}` : `carry:${p.name}`)), found: notCarried.length ? notCarried.map((p) => p.name).join(', ') : 'all carried' };
        }
        return { condition, ...l.c[condition] };
      });
      const established = conditions.every((x) => x.holds);
      return {
        model: l.state.key,
        engine: l.state.engine,
        established,
        conditions,
        fails: conditions.filter((x) => !x.holds),
        bounds: boundsOf(l.state, claim),
        premises,
        basis: established ? basisOf({ project, design, evidence }, claim, l, premises, mechanismsOf(l.state.key)) : null,
      };
    });
    const label = modelLines.some((m) => m.established) ? 'established' : acceptance ? 'accepted' : 'not established';
    out.set(entry, { claim, entry, parts: claim.parts, unit: unitName, label, acceptance, cover: covering.length ? null : `cover:${claim.parts.join('+')}`, models: modelLines });
  }
  return { claims: out, carries, premisesOf, ruleFails };
}

/** What a question's evidence found, in the account's words (account.md §journey-rules): its outcome, or `none`. */
export function foundOf(rec) {
  if (!rec?.evidence) return 'none';
  if (!rec.current) return 'none current';
  const f = rec.evidence.found;
  return f.outcome === 'violation' ? `violation of ${f.property}` : f.outcome === 'refused' ? `refused at step ${f.step}` : f.outcome === 'unanswered' ? `unanswered: ${f.reason}` : f.outcome;
}

/**
 * A claim's bounds on a model (account.md §basis-line): each row of the model's bounds that bounds the claim, by its meaning,
 * a `choose` row's trade among them; on a lifecycle model `phase level`.
 */
export function boundsOf(state, claim) {
  if (state.engine === 'lifecycle') return 'phase level';
  return claimBounds(state.model, claim.claimKind).map((b) => ({ bound: b.bound, value: String(b.value), meaning: b.meaning }));
}

/**
 * The basis line of an established line (account.md §basis-line), as data; the reading writes it out. Its premises are named,
 * their statements, falsifiers and carries shown once, under Assumed; its mechanisms are those met real-finding repairs
 * added to the model, as the box gives them (account.md §box).
 */
function basisOf({ project, design, evidence }, claim, line, premises, mechanisms) {
  const ctx = evidence.ctx;
  const faults = line.caught.map((f) => ({ question: f.question.name, mechanism: f.question.slots?.fault?.form?.mechanism ?? '' }));
  const witnesses = line.witnesses.filter((w) => w.current && w.evidence?.matches === true).map((w) => ({
    question: w.question.name,
    meaning: w.question.slots?.witness?.form?.meaning ?? '',
    journey: w.evidence.trace ? renderEvidence(ctx, w.evidence).lines : [],
  }));
  const clearing = [...faults.map((f) => f.question), ...witnesses.map((w) => w.question)];
  const evidenceOf = (rec) => {
    const v = rec.evidence;
    const lifecycleFlag = (flag) => /^(unreachable-phase|untaken-action|open-pair) /.test(flag);
    return {
      question: rec.question.name,
      engine: v.basis.engine,
      runtime: v.basis.runtime,
      ...(v.basis.library ? { library: v.basis.library } : {}),
      forma: v.basis.forma,
      search: searchOf(v.basis.engine.name),
      bounds: v.bounds,
      limits: v.limits,
      measures: v.measures,
      symmetry: 'none',
      flags: (v.flags ?? []).map((flag) => ({ flag, clearedBy: lifecycleFlag(flag) ? [] : clearing })),
    };
  };
  const questions = [line.base, ...line.caught, ...line.witnesses.filter((w) => w.current && w.evidence?.matches === true)];
  return {
    bounds: boundsOf(line.state, claim),
    faults,
    witnesses,
    premises: premises.map((p) => ({ premise: p.name })),
    mechanisms,
    evidence: questions.map(evidenceOf),
    fairness: claim.claimKind === 'liveness' ? fairnessOf(line.encoding, project) : null,
  };
}

/** A premise as the basis line and the reading give it (account.md §basis-line, presentation.md §reading): its words and the decision carrying it. */
export function premiseLine(p, { design }) {
  const says = premiseSays(design.premises.find((x) => x.name === p.name));
  const by = p.by ?? null;
  const out = { premise: p.name, statement: says.statement, falsifier: says.falsifier, class: says.class, provider: says.provider, carried: Boolean(p.counted), decision: by?.name ?? null, by: by?.by ?? null, at: by?.at ?? null };
  if (p.name.startsWith('choice:')) out.pick = by?.kind === 'pick' ? by.rows?.Choice ?? null : null;
  else if (p.basis) out.basis = p.basis;
  return out;
}

/** The kind of a premise from its name (decisions.md §carry). */
function kindOfPremise(name) {
  const m = /^(store|strike|span|bound|choice):/.exec(name);
  return m ? m[1] : 'page';
}

/** The fairness a liveness claim's encoding states (account.md §basis-line): each `WF_` or `SF_` term of its text, as written. */
function fairnessOf(encoding, project) {
  const bytes = encoding ? project.files.get(encoding.path)?.bytes : null;
  const text = bytes ? bytes.toString('utf8') : '';
  const terms = [...text.matchAll(/\b[WS]F_[A-Za-z0-9_<>]+\s*\([^)]*\)/g)].map((m) => m[0]);
  return terms.length ? terms : ['none stated'];
}
