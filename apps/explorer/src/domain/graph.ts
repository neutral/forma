// Forma's graph (account.md §explorer-graph) at the boundary: what `forma explore --json` gives and the
// domain reads. The envelope is checked strictly; each node's `data` is checked for the fields the
// derivation reads, and passes the rest through.
import { z } from 'zod';

export const NodeKind = z.enum([
  'passage',
  'unit',
  'entry',
  'part',
  'span',
  'boundary',
  'model',
  'slot',
  'file',
  'question',
  'evidence',
  'surprise',
  'decision',
  'item',
  'premise',
  'mechanism',
]);
export type NodeKind = z.infer<typeof NodeKind>;

export const Relation = z.enum([
  'cites',
  'names-action',
  'steps-through',
  'rests-on',
  'slot-of',
  'written-for',
  'reads',
  'examines',
  'surprise-of',
  'held-by',
  'repairs',
  'names-mechanism',
  'written-by',
  'decides',
  'pins',
  'overrides',
  'waits-for',
  'carried-on',
]);
export type Relation = z.infer<typeof Relation>;

// ---------- the data of each kind, as far as the derivation reads it ----------

const Holder = z.looseObject({ key: z.string(), span: z.boolean() });
const Cites = z.array(z.string());
const Origin = z.string().nullish();

const Omission = z.looseObject({ reason: z.string(), confirmation: z.string().nullable().optional() });

const PassageData = z.looseObject({
  address: z.string(),
  heading: z.string().nullable(),
  path: z.string(),
  source: z.boolean(),
  citable: z.boolean(),
  text: z.string(),
  citations: z.array(z.string()),
  omissions: z.array(Omission),
});

/** A condition of a claim on a model (account.md §standing). */
const Condition = z.looseObject({
  condition: z.string(),
  holds: z.boolean(),
  items: z.array(z.string()).optional(),
  reason: z.string().optional(),
  found: z.string().optional(),
  cannotExpress: z.boolean().optional(),
});
type Condition = z.infer<typeof Condition>;

export const StandingModel = z.looseObject({
  model: z.string(),
  engine: z.string(),
  established: z.boolean(),
  conditions: z.array(Condition),
  premises: z.array(z.looseObject({ name: z.string(), carried: z.boolean().optional() })),
});
export type StandingModel = z.infer<typeof StandingModel>;

export const StandingLabel = z.enum(['established', 'accepted', 'not established']);
export type StandingLabel = z.infer<typeof StandingLabel>;

const ClaimStanding = z.looseObject({
  label: StandingLabel,
  acceptance: z.looseObject({ words: z.string().nullish(), by: z.string().nullish(), at: z.string().nullish() }).nullable(),
  models: z.array(StandingModel),
});

const JourneyStep = z.looseObject({
  step: z.number(),
  action: z.string(),
  case: z.string().nullable().optional(),
  arguments: z.string().nullable().optional(),
});
export type JourneyStep = z.infer<typeof JourneyStep>;

/** The lifecycle tool's walk of a scenario (lifecycle-tool.md). */
export const Walk = z.looseObject({
  admitted: z.number().nullable().optional(),
  refusedAt: z.number().nullable(),
  reached: z.array(z.looseObject({ lifecycle: z.string(), phase: z.string() })),
  moves: z.array(
    z.looseObject({
      step: z.number(),
      lifecycle: z.string(),
      // Null where the step's action enters the lifecycle: the entity held no phase before it.
      from: z.string().nullable(),
      to: z.string(),
      action: z.string(),
      case: z.string().nullable(),
      refusedStep: z.boolean(),
    }),
  ),
});
export type Walk = z.infer<typeof Walk>;

const Polarity = z.string();

/** What an action does in a phase: a move to a phase, a refusal, a choice that still poses it, or nothing written. */
const outcomes = [
  z.looseObject({ kind: z.literal('phase'), phase: z.string() }),
  z.looseObject({ kind: z.literal('refused') }),
  z.looseObject({ kind: z.literal('choice'), choice: z.string() }),
  z.looseObject({ kind: z.literal('empty') }),
] as const;
export const Outcome = z.discriminatedUnion('kind', [...outcomes]);
export type Outcome = z.infer<typeof Outcome>;

/** A lifecycle's cell (forms.md §lifecycles): an outcome, or one outcome for each case of its action. */
export const Cell = z.discriminatedUnion('kind', [
  ...outcomes,
  z.looseObject({ kind: z.literal('cases'), cases: z.array(z.looseObject({ case: z.string(), outcome: Outcome })) }),
]);
export type Cell = z.infer<typeof Cell>;

/** A lifecycle's picture (lifecycle-tool.md §as-read), as far as the page draws it: the lifecycle as read. */
export const Picture = z.looseObject({
  lifecycle: z.string(),
  entity: z.string().nullable(),
  initial: z.looseObject({ phase: z.string() }).nullable(),
  ends: z.array(z.string()),
  phases: z.array(z.looseObject({ key: z.string() })),
  actions: z.array(z.string()),
  unaffected: z.array(z.string()),
  cells: z.record(z.string(), z.record(z.string(), Cell)),
  moves: z.array(z.looseObject({ from: z.string(), to: z.string(), action: z.string(), case: z.string().nullable() })),
});
export type Picture = z.infer<typeof Picture>;

/** One record of the graph's `diagrams`; a ruling whose showing keeps no structured picture has none. */
const Diagram = z.looseObject({
  lifecycle: z.string().nullable(),
  variant: z.looseObject({ kind: z.string() }),
  picture: Picture.nullable(),
});

const entry = { key: z.string(), holder: Holder, cites: Cites, origin: Origin };

const ClaimData = z.looseObject({
  ...entry,
  kind: z.literal('claims'),
  sentence: z.string(),
  claimKind: z.string(),
  stake: z.string(),
  standing: ClaimStanding,
});

const JourneyData = z.looseObject({
  ...entry,
  kind: z.literal('journeys'),
  // A scenario a pick adds names its holder by key alone.
  holder: z.union([Holder, z.string()]),
  polarity: Polarity,
  steps: z.array(JourneyStep),
  refusedStep: z.number().nullable(),
  expectedEnd: z.string().nullable(),
  walk: Walk.nullable().optional(),
});

const ActionData = z.looseObject({
  ...entry,
  kind: z.literal('actions'),
  sentence: z.string(),
  actor: z.string(),
  guard: z.string().nullable(),
  cases: z.array(z.union([z.string(), z.looseObject({ case: z.string() })])),
});

/** A lifecycle's entry. What it is drawn and tabled from is its picture, among the mode's `diagrams`. */
const LifecycleData = z.looseObject({ ...entry, kind: z.literal('lifecycles') });

const Alternative = z.looseObject({
  polarity: Polarity,
  steps: z.array(JourneyStep),
  refusedStep: z.number().nullable().optional(),
  expectedEnd: z.string().nullable(),
});

const ChoiceData = z.looseObject({
  ...entry,
  kind: z.literal('choices'),
  question: z.string(),
  alternatives: z.looseObject({ a: Alternative.optional(), b: Alternative.optional() }),
  recommendation: z.looseObject({ pick: z.string(), reason: z.string() }).nullable(),
});

const premise = {
  statement: z.string(),
  class: z.string().nullish(),
  whyNotExamined: z.string().nullish(),
  falsifier: z.string().nullish(),
  provider: z.string().nullish(),
};

const PremiseEntryData = z.looseObject({ ...entry, ...premise, kind: z.literal('premises') });

const OmissionData = z.looseObject({ kind: z.literal('omissions'), holder: Holder, cites: Cites.optional() });

const SurfaceData = z.looseObject({ kind: z.literal('surface'), holder: Holder, cites: Cites.optional() });

export const EntryData = z.discriminatedUnion('kind', [
  ClaimData,
  JourneyData,
  ActionData,
  LifecycleData,
  ChoiceData,
  PremiseEntryData,
  OmissionData,
  SurfaceData,
]);
export type EntryData = z.infer<typeof EntryData>;

const BoundaryData = z.looseObject({
  ...entry,
  names: z.string(),
  rowKind: z.string(),
  side: z.string(),
  seam: z.string().nullable(),
  isolation: z.string().nullable(),
});

const Bound = z.looseObject({ bound: z.string(), value: z.string(), meaning: z.string() });

const ModelData = z.looseObject({
  engine: z.string(),
  lifecycle: z.boolean(),
  model: z.looseObject({
    parts: z.array(z.string()),
    name: z.string().optional(),
    bounds: z.array(Bound).optional(),
    actions: z.array(
      z.looseObject({ action: z.string(), operator: z.string(), parameters: z.array(z.looseObject({ name: z.string() })) }),
    ).optional(),
    misbehaviours: z.array(z.looseObject({ row: z.string(), item: z.string() })).optional(),
    phases: z.array(z.looseObject({ lifecycle: z.string(), expression: z.string() })).optional(),
  }),
});

const SlotData = z.looseObject({
  slot: z.string(),
  model: z.string(),
  path: z.string(),
  key: z.string().nullable(),
  holder: Holder.nullable(),
  thing: z.looseObject({ key: z.string() }).nullable(),
  form: z.looseObject({ mechanism: z.string().optional(), meaning: z.string().optional() }),
});

const FileData = z.looseObject({ text: z.string().nullable() });

const QuestionData = z.looseObject({
  kind: z.string(),
  model: z.string(),
  serves: z.string().nullable(),
  expected: z.looseObject({ outcome: z.string().optional() }).nullable().optional(),
});

const EvidenceData = z.looseObject({
  found: z.looseObject({ outcome: z.string(), reason: z.string().optional() }).nullable().optional(),
  matches: z.boolean().optional(),
  measures: z.record(z.string(), z.unknown()).nullable().optional(),
  rendered: z.looseObject({ search: z.string().optional(), lines: z.array(z.string()).optional() }).nullable().optional(),
  established: z.string().nullable().optional(),
  flags: z.array(z.union([z.string(), z.looseObject({ flag: z.string().optional() })])).optional(),
  current: z.boolean().optional(),
  asked: z.boolean().optional(),
  reasons: z.array(z.string()).optional(),
});

const DecisionState = z.looseObject({ state: z.string() });

const Surprise = z.looseObject({ question: z.string(), expected: z.string(), found: z.string() });

const DecisionData = z.looseObject({
  kind: z.string(),
  name: z.string(),
  rows: z.record(z.string(), z.string()),
  by: z.string().nullable(),
  at: z.string().nullable(),
  words: z.string().nullish(),
  state: DecisionState.nullish(),
  surprises: z.looseObject({ surprises: z.array(Surprise) }).nullish(),
  repairRoute: z.looseObject({ kinds: z.array(z.looseObject({ kind: z.string(), model: z.string().optional() })) }).nullish(),
  shown: z.string().nullish(),
});

const Carry = z.looseObject({
  carried: z.boolean(),
  by: z.looseObject({ name: z.string(), by: z.string().nullish(), at: z.string().nullish(), words: z.string().nullish() }).nullable(),
});

const PremiseData = z.looseObject({
  ...premise,
  kind: z.string(),
  model: z.string().optional(),
  claim: z.string().optional(),
  carry: Carry.nullish(),
  counted: z.boolean().optional(),
});

const MechanismData = z.looseObject({
  ruling: z.string(),
  model: z.string(),
  mechanisms: z.array(z.string()),
  brief: z.looseObject({ rows: z.record(z.string(), z.string()), words: z.string().nullish(), by: z.string().nullish(), at: z.string().nullish() }).nullable(),
});

// ---------- nodes and edges ----------

const node = {
  id: z.string(),
  key: z.string(),
  name: z.string(),
  scope: z.string().nullable(),
};
const Untyped = z.looseObject({});

export const GraphNode = z.discriminatedUnion('kind', [
  z.object({ ...node, kind: z.literal('passage'), data: PassageData }),
  z.object({ ...node, kind: z.literal('entry'), data: EntryData }),
  z.object({ ...node, kind: z.literal('boundary'), data: BoundaryData }),
  z.object({ ...node, kind: z.literal('model'), data: ModelData }),
  z.object({ ...node, kind: z.literal('slot'), data: SlotData }),
  z.object({ ...node, kind: z.literal('file'), data: FileData }),
  z.object({ ...node, kind: z.literal('question'), data: QuestionData }),
  z.object({ ...node, kind: z.literal('evidence'), data: EvidenceData }),
  z.object({ ...node, kind: z.literal('decision'), data: DecisionData }),
  z.object({ ...node, kind: z.literal('premise'), data: PremiseData }),
  z.object({ ...node, kind: z.literal('mechanism'), data: MechanismData }),
  z.object({ ...node, kind: z.enum(['unit', 'part', 'span', 'surprise', 'item']), data: Untyped }),
]);
export type GraphNode = z.infer<typeof GraphNode>;
export type NodeOf<K extends NodeKind> = Extract<GraphNode, { kind: K }>;
export type EntryOf<K extends EntryData['kind']> = NodeOf<'entry'> & { data: Extract<EntryData, { kind: K }> };

export const GraphEdge = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  relation: Relation,
  data: z.looseObject({}).optional(),
});
export type GraphEdge = z.infer<typeof GraphEdge>;

const Cause = z.looseObject({
  id: z.string().optional(),
  says: z.string(),
  items: z.array(z.string()).optional(),
  lines: z.array(z.unknown()).optional(),
});

/** A journey rule a model fails, with the items it waits on. */
const RuleFailure = z.looseObject({ rule: z.string(), found: z.string(), items: z.array(z.string()).optional() });

export const Mode = z.looseObject({
  reading: z.looseObject({
    cannotKnow: z.array(z.string()).optional(),
    models: z.array(z.looseObject({ model: z.string(), fails: z.array(RuleFailure) })).optional(),
  }),
  box: z.looseObject({}),
  nodes: z.array(GraphNode),
  edges: z.array(GraphEdge),
  causes: z.array(Cause),
  diagrams: z.array(Diagram),
});
export type Mode = z.infer<typeof Mode>;

export const Graph = z.object({
  format: z.literal(1),
  generation: z.string(),
  computedAt: z.string(),
  project: z.string(),
  versions: z.looseObject({
    forma: z.looseObject({ version: z.string(), source: z.string().optional() }),
    engines: z.record(z.string(), z.looseObject({ engine: z.looseObject({ name: z.string(), version: z.string() }) })).optional(),
  }),
  inputs: z.array(z.object({ path: z.string(), sha256: z.string() })),
  local: z.unknown().optional(),
  modes: z.object({ here: Mode, recorded: Mode }),
  cannotKnow: z.array(z.string()),
});
export type Graph = z.infer<typeof Graph>;
