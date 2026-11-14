// The reading (presentation.md §explorer) as data: what the page shows, already decided, in the page's words.
// The domain derives it from Forma's graph; the server stores and serves it; the client only draws it.
// These schemas are the one contract between the three. Types are inferred from them.
import { z } from 'zod';

export const Standing = z.enum(['recorded', 'here']);
export type Standing = z.infer<typeof Standing>;

/** A claim's standing mark: ● established, ◐ accepted, ○ not established. */
export const Mark = z.enum(['established', 'accepted', 'not']);
export type Mark = z.infer<typeof Mark>;

export const ThingKind = z.enum([
  'claim',
  'scenario',
  'action',
  'lifecycle',
  'question',
  'assumption',
  'actor',
  'ruling',
  'model',
  'section',
]);
export type ThingKind = z.infer<typeof ThingKind>;

/** A name that opens a thing in place. */
export const Ref = z.object({
  id: z.string(),
  kind: ThingKind,
  label: z.string(),
  /** A claim's standing mark. */
  mark: Mark.optional(),
  /** The numbers of the revisions on it, each drawn as a numbered triangle before the label. */
  revisions: z.array(z.number().int().positive()).optional(),
  /** First met in an earlier section: drawn grey. */
  again: z.boolean().optional(),
  /** `Origin` `added`: tagged `beyond the text`. */
  beyond: z.boolean().optional(),
  /** An assumption, or a bound, no carry of which is in force: tagged `not taken on`. */
  untaken: z.boolean().optional(),
  /** Secondary text after the label, drawn quieter: a ruling's `(expected …, found …)`. */
  detail: z.string().optional(),
});
export type Ref = z.infer<typeof Ref>;

/** A link to a passage on the page. */
export const PassageLink = z.object({ sectionId: z.string(), heading: z.string() });
export type PassageLink = z.infer<typeof PassageLink>;

/** What a failing condition waits on, in the page's words, with the account's own item name for whoever wants it. */
export const Wait = z.object({ says: z.string(), item: z.string() });
export type Wait = z.infer<typeof Wait>;

/** A mechanism a repair added, against the developer's document. */
export const BriefStatus = z.enum(['stated', 'accepted', 'absent']);
export type BriefStatus = z.infer<typeof BriefStatus>;

export const Added = z.object({
  mechanism: z.string(),
  brief: BriefStatus,
  /** For `stated`, the passages named; for `accepted`, why. */
  words: z.string().nullable(),
  by: z.string().nullable(),
  at: z.string().nullable(),
});
export type Added = z.infer<typeof Added>;

// ---------- checks ----------

const CheckMark = z.enum(['yes', 'no', 'unanswered', 'none', 'earlier']);
export const Check = z.object({
  mark: CheckMark,
  /** The question's kind in the page's words: `check`, `planted defect`, `reachable case`, … */
  what: z.string(),
  /** A fault's `Mechanism` or a witness's `Meaning`. */
  says: z.string().nullable(),
  /** `caught`, `did not finish: …`, `not run`, or the found outcome with the expected one where they differ. */
  result: z.string(),
  /** Measures, kind of search and when it ran, joined. */
  details: z.string(),
  flags: z.array(z.string()),
  /** For evidence asked now and not current: its currency reasons. */
  stale: z.string().nullable(),
  /** A kept trace's rendered lines, the start first. */
  path: z.array(z.string()).nullable(),
  /** The question's own name. */
  question: z.string(),
});
export type Check = z.infer<typeof Check>;

/** A thing's checks on one model: those asked now, run or not, and those not asked now that ran on an earlier model. */
export const Checks = z.object({ now: z.array(Check), earlier: z.array(Check) });
export type Checks = z.infer<typeof Checks>;

// ---------- decisions ----------

export const Decision = z.object({
  /** `confirmed`, `picked`, `taken on`, … */
  kind: z.string(),
  choice: z.string().nullable(),
  by: z.string(),
  at: z.string(),
  /** Null while in force; else `lapsed`, `replaced` or `revoked`. */
  state: z.string().nullable(),
  words: z.string().nullable(),
});
export type Decision = z.infer<typeof Decision>;
export const Decisions = z.object({ now: z.array(Decision), earlier: z.array(Decision) });
export type Decisions = z.infer<typeof Decisions>;

// ---------- a lifecycle, drawn and as a table ----------

export const MoveAction = z.object({
  label: z.string(),
  /** The step numbers of the lit scenario that take it. */
  steps: z.array(z.number().int()),
  /** The lit scenario's step that must be refused. */
  mustNot: z.boolean(),
});
export const LifecycleDrawing = z.object({
  id: z.string(),
  name: z.string(),
  /** Each phase, in the column of how many moves it is from the initial phase; a phase no move reaches stands after the last. */
  phases: z.array(z.object({ id: z.string(), column: z.number().int().nonnegative(), initial: z.boolean(), end: z.boolean(), visited: z.boolean() })),
  /** One arrow for each pair of phases some action moves between. */
  moves: z.array(z.object({ from: z.string(), to: z.string(), actions: z.array(MoveAction) })),
  /** The actions that leave a phase where it is. */
  stays: z.array(z.object({ phase: z.string(), actions: z.array(MoveAction) })),
  /** Cells a choice still poses. */
  open: z.array(z.object({ phase: z.string(), action: z.string() })),
  /** The lit scenario's step that must be refused, if any. */
  refusedAt: z.number().int().nullable(),
  /** Whether a scenario's walk is lit. */
  lit: z.boolean(),
});
export type LifecycleDrawing = z.infer<typeof LifecycleDrawing>;

const CellKind = z.enum(['move', 'refused', 'open', 'unspecified', 'cases']);
export const LifecycleTable = z.object({
  entity: z.string(),
  actions: z.array(z.string()),
  rows: z.array(
    z.object({
      phase: z.string(),
      initial: z.boolean(),
      end: z.boolean(),
      cells: z.array(z.object({ kind: CellKind, text: z.string() })),
    }),
  ),
  unaffected: z.array(z.string()),
});
export type LifecycleTable = z.infer<typeof LifecycleTable>;

// ---------- steps of a scenario ----------

export const Step = z.object({
  n: z.number().int(),
  action: z.union([Ref, z.string()]),
  case: z.string().nullable(),
  arguments: z.string(),
  refused: z.boolean(),
});
export type Step = z.infer<typeof Step>;

// ---------- things: what a name opens ----------

const base = {
  id: z.string(),
  title: z.string(),
  /** The upper-case kind line: `claim · Export ticket`, `revision 1 · fault in the design`. */
  kindLabel: z.string(),
  /** The passages it cites, each a link. Null: it cites only what is not on the page, shown as `not from the document`. Empty: it cites nothing, and no line is shown. */
  from: z.array(PassageLink).nullable(),
};

export const ClaimModel = z.object({
  model: Ref,
  established: z.boolean(),
  /** The model's bounds as its rows write them, or `phases only`. */
  bounds: z.string(),
  /** The encoding's reason the engine cannot express the claim; then nothing else is shown for the model. */
  cannotExpress: z.string().nullable(),
  /** The conditions in place, in the page's words. */
  inPlace: z.array(z.string()),
  /** The conditions not yet in place, grouped by what they wait on. `waits` is null where it is what the claim's line already says. */
  notYet: z.array(z.object({ conditions: z.array(z.string()), waits: z.array(Wait).nullable(), reason: z.string().nullable() })),
  encoding: z.string().nullable(),
  checks: Checks,
  premises: z.object({ refs: z.array(Ref), allTaken: z.boolean() }),
});
export type ClaimModel = z.infer<typeof ClaimModel>;

const ClaimThing = z.object({
  ...base,
  kind: z.literal('claim'),
  statement: z.string(),
  claimKind: z.string(),
  stake: z.string(),
  beyond: z.boolean(),
  standing: Mark,
  /** `Established on …, within bounds.`, `Accepted, unexamined.`, or `Not established · waits on ….` */
  standingLine: z.string(),
  acceptance: z.object({ words: z.string(), by: z.string(), at: z.string() }).nullable(),
  models: z.array(ClaimModel),
  rulings: z.array(z.string()),
  decisions: Decisions,
});

const ScenarioThing = z.object({
  ...base,
  kind: z.literal('scenario'),
  polarity: z.enum(['should happen', 'must not']),
  beyond: z.boolean(),
  steps: z.array(Step),
  expectedEnd: z.string().nullable(),
  /** The lifecycle tool's walk: `3 steps admitted · active-unclaimed → expired-unclaimed`. */
  walk: z.string().nullable(),
  drawings: z.array(LifecycleDrawing),
  models: z.array(z.object({ model: Ref, checks: Checks })),
  rulings: z.array(z.string()),
  decisions: Decisions,
});

const ActionThing = z.object({
  ...base,
  kind: z.literal('action'),
  statement: z.string(),
  actor: z.string(),
  guard: z.string().nullable(),
  cases: z.array(z.string()),
  beyond: z.boolean(),
  models: z.array(z.object({ model: Ref, operator: z.string(), checks: Checks })),
  faults: z.array(z.object({ mechanism: z.string(), claim: Ref })),
  scenarios: z.array(Ref),
  decisions: Decisions,
});

const LifecycleThing = z.object({
  ...base,
  kind: z.literal('lifecycle'),
  beyond: z.boolean(),
  drawing: LifecycleDrawing,
  table: LifecycleTable,
  expressions: z.array(z.object({ model: Ref, expression: z.string() })),
  scenarios: z.array(Ref),
  decisions: Decisions,
});

const QuestionThing = z.object({
  ...base,
  kind: z.literal('question'),
  question: z.string(),
  alternatives: z.array(
    z.object({
      key: z.string(),
      picked: z.boolean(),
      polarity: z.enum(['should happen', 'must not']),
      steps: z.array(Step),
      expectedEnd: z.string().nullable(),
    }),
  ),
  recommendation: z.object({ pick: z.string(), reason: z.string() }).nullable(),
  decisions: Decisions,
});

const AssumptionThing = z.object({
  ...base,
  kind: z.literal('assumption'),
  statement: z.string(),
  premiseClass: z.string().nullable(),
  /** Why it is not examined, or `assumed, not checked`. */
  why: z.string(),
  falsifier: z.string().nullable(),
  provider: z.string().nullable(),
  /** Null when no carry is in force. `words` only where they are not the falsifier. */
  taken: z.object({ by: z.string(), at: z.string(), words: z.string().nullable() }).nullable(),
  earlier: z.array(Decision),
  holds: z.array(Ref),
});

const ActorThing = z.object({
  ...base,
  kind: z.literal('actor'),
  names: z.string(),
  rowKind: z.string(),
  side: z.string(),
  seam: z.string().nullable(),
  isolation: z.string().nullable(),
  beyond: z.boolean(),
  models: z.array(z.object({ model: Ref, checks: Checks })),
  decisions: Decisions,
});

const RulingThing = z.object({
  ...base,
  kind: z.literal('ruling'),
  /** The revision number, for a real finding. */
  revision: z.number().int().positive().nullable(),
  verdict: z.string(),
  level: z.string(),
  /** `design at fault`, `model at fault`, … */
  says: z.string(),
  /** The title's quieter part: its first surprise's `(expected …, found …)`. */
  detail: z.string().nullable(),
  surprises: z.array(z.object({ expected: z.string(), found: z.string(), question: z.string() })),
  /** The developer's words, with the ruling's state where it is not in force: `lapsed`, `replaced` or `revoked`. */
  words: z.object({ text: z.string(), by: z.string(), at: z.string(), state: z.string().nullable() }).nullable(),
  /** Where its repair went: `model export-ticket-tlc`. */
  repairTo: z.string().nullable(),
  added: z.array(Added),
  shown: z.string().nullable(),
});

const ModelThing = z.object({
  ...base,
  kind: z.literal('model'),
  parts: z.array(z.string()),
  name: z.string().nullable(),
  engine: z.string(),
  /** Null for a lifecycle model: phases only, guards unevaluated. */
  bounds: z.array(z.object({ bound: z.string(), value: z.string(), meaning: z.string() })).nullable(),
  world: z.array(z.object({ row: z.union([Ref, z.string()]), items: z.array(z.string()) })),
  /** `58 asked · 57 as expected · 1 did not finish`. */
  checks: z.string().nullable(),
  failing: z.array(z.object({ rule: z.string(), found: z.string(), waits: z.array(Wait) })),
  changedBy: z.array(Ref),
});

/** A passage's restatement: what the section was restated as. */
const SectionThing = z.object({
  ...base,
  kind: z.literal('section'),
  happens: z.array(Ref),
  states: z.array(z.object({ ref: Ref, drawing: LifecycleDrawing, table: LifecycleTable })),
  should: z.array(Ref),
  mustNot: z.array(Ref),
  actors: z.array(z.object({ ref: Ref, side: z.string(), rowKind: z.string() })),
});

export const Thing = z.discriminatedUnion('kind', [
  ClaimThing,
  ScenarioThing,
  ActionThing,
  LifecycleThing,
  QuestionThing,
  AssumptionThing,
  ActorThing,
  RulingThing,
  ModelThing,
  SectionThing,
]);
export type Thing = z.infer<typeof Thing>;
export type ThingOf<K extends Thing['kind']> = Extract<Thing, { kind: K }>;

// ---------- the notes beside a section ----------

export const Note = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('found'),
    revisions: z.array(z.object({ number: z.number().int().positive(), ref: Ref, added: z.array(z.object({ mechanism: z.string(), brief: BriefStatus })) })),
  }),
  z.object({ kind: z.literal('corrected'), refs: z.array(Ref) }),
  z.object({ kind: z.literal('leftOpen'), ref: Ref, settled: z.string().nullable() }),
  z.object({ kind: z.literal('leftOut'), reason: z.string(), confirmation: z.string().nullable() }),
  z.object({ kind: z.literal('mustHold'), refs: z.array(Ref) }),
  z.object({ kind: z.literal('assumes'), refs: z.array(Ref) }),
  /** Opens the section's restatement (a `section` thing): its name counts what is met here, or what was restated above; `beyond` counts what goes beyond the text. */
  z.object({ kind: z.literal('restated'), ref: Ref, beyond: z.number().int() }),
  z.object({ kind: z.literal('alsoAbove'), label: z.string(), refs: z.array(Ref) }),
]);
export type Note = z.infer<typeof Note>;

export const Section = z.object({
  /** The section's id on the page. */
  id: z.string(),
  address: z.string(),
  heading: z.string(),
  /** The passage as written, rendered from Markdown with raw HTML disabled; links between the brief's documents point within the page. */
  html: z.string(),
  notes: z.array(Note),
});
export type Section = z.infer<typeof Section>;

export const Document = z.object({
  number: z.number().int().positive(),
  name: z.string(),
  path: z.string(),
  sections: z.array(Section),
});
export type Document = z.infer<typeof Document>;

// ---------- the top of the sheet ----------

const Run = z.object({ text: z.string(), tone: z.enum(['plain', 'revision']) });
export const TitleBlock = z.object({
  project: z.string(),
  computedAt: z.string(),
  /** Where the other standing differs: as recorded, the cause that accounts for most lines here. */
  differs: z.object({ label: z.string(), says: z.string() }).nullable(),
  build: z.string(),
  sheets: z.string(),
  revisions: z.array(z.object({ number: z.number().int().positive(), ref: Ref, sectionId: z.string().nullable(), date: z.string() })),
});
export type TitleBlock = z.infer<typeof TitleBlock>;

// ---------- the lists at the end ----------

const ClaimSchedule = z.array(
  z.object({
    title: z.string(),
    span: z.boolean(),
    /** What every claim of the group shares, said once. */
    shared: z.string().nullable(),
    rows: z.array(z.object({ ref: Ref, says: z.string().nullable(), section: PassageLink.nullable() })),
  }),
);
const AssumptionSchedule = z.object({
  rows: z.array(z.object({ ref: Ref, provider: z.string().nullable(), claims: z.number().int() })),
  bounds: z.array(
    z.object({
      model: Ref,
      bounds: z.string().nullable(),
      taken: z.number().int(),
      rows: z.array(z.object({ ref: Ref, provider: z.string().nullable() })),
    }),
  ),
});
const Examination = z.object({
  models: z.array(z.object({ ref: Ref, engine: z.string(), covers: z.string(), established: z.number().int() })),
  corrections: z.array(z.object({ kind: z.string(), ref: Ref })),
  decisions: z.array(z.object({ count: z.number().int(), by: z.string() })),
});

// ---------- the sheet and the reading ----------

export const Sheet = z.object({
  standing: Standing,
  generation: z.string(),
  /** The numbered general notes. */
  general: z.array(z.array(Run)),
  title: TitleBlock,
  documents: z.array(Document),
  lists: z.object({
    claims: ClaimSchedule,
    assumptions: AssumptionSchedule,
    examination: Examination,
    limits: z.array(z.string()),
  }),
});
export type Sheet = z.infer<typeof Sheet>;

/** One standing's reading: the sheet, and every thing a name on it can open, by id. */
export const Reading = z.object({ sheet: Sheet, things: z.record(z.string(), Thing) });
export type Reading = z.infer<typeof Reading>;

// ---------- the server's reads ----------

export const Status = z.object({
  generation: z.string().nullable(),
  computedAt: z.string().nullable(),
  refreshing: z.boolean(),
  error: z.string().nullable(),
});
export type Status = z.infer<typeof Status>;

/** What an export carries: both standings and the stamp of what was read. */
export const Snapshot = z.object({
  generation: z.string(),
  computedAt: z.string(),
  readings: z.object({ recorded: Reading, here: Reading }),
  inputs: z.array(z.object({ path: z.string(), sha256: z.string() })),
  versions: z.record(z.string(), z.unknown()),
});
export type Snapshot = z.infer<typeof Snapshot>;
