// The words of the reading (presentation.md §explorer, "Words"): each table maps the account's own name for a
// thing to what the page calls it, and `LABEL` holds the labels the derivation writes into a reading. The
// headings a view sets around what a reading gives are in that view.

/** Entry kinds, by the folder an entry is filed under; a boundary row is an actor or record. */
export const ENTRY_KIND = {
  claims: 'claim',
  premises: 'assumption',
  journeys: 'scenario',
  actions: 'action',
  lifecycles: 'lifecycle',
  choices: 'open question',
  omissions: 'left out',
  boundary: 'actor or record',
} as const;

/** The seven conditions of a claim on a model. */
export const CONDITION = {
  confirmed: 'confirmation',
  examined: 'check',
  controlled: 'planted defect caught',
  witnessed: 'cases reachable',
  conforming: 'model passes its scenarios',
  carried: 'assumptions taken on',
  'no open surprise': 'no open surprise',
} as const;

/** Question kinds, in the order a thing's checks are listed. */
export const QUESTION_KIND = {
  base: 'check',
  fault: 'planted defect',
  witness: 'reachable case',
  path: 'scenario runs',
  refusal: 'step refused',
  start: 'start reachable',
  'lifecycle-path': 'lifecycle walk',
  enabled: 'can happen',
  misbehaviour: 'world can do this',
  phases: 'phases fit the model',
  facts: 'facts admit an instance',
  weaker: 'weaker form',
  reduction: 'smaller rerun',
} as const;

/** What an item is, after `waits on`, by the item's kind (the part of its name before the colon). */
export const ITEM = {
  run: 'a run',
  unanswered: 'an unfinished check',
  slot: 'an unwritten piece of the model',
  confirm: "the developer's confirmation",
  carry: 'an assumption not taken on',
  pick: 'an unsettled question',
  rule: 'an unruled surprise',
  explain: 'an unexplained surprise',
  repair: 'an unmade repair',
  express: 'an engine that can express it',
  cover: 'a model that covers it',
  model: 'a model answer',
  journey: 'a confirmed scenario for a part',
  brief: 'a mechanism unplaced against the document',
  span: 'two parts examined together',
  restate: 'a restatement',
  findings: 'a lifecycle finding',
  passage: 'an unrestated section',
  change: 'a file that counts for nothing',
  intake: 'the intake',
  allow: 'an allowance',
} as const;

/** Decisions, by their kind. */
export const DECISION = {
  confirm: 'confirmed',
  decline: 'declined',
  pick: 'picked',
  rule: 'ruled',
  carry: 'taken on',
  accept: 'accepted without examination',
  brief: 'placed against the document',
  allow: 'allowed',
  intake: 'intake',
  redirect: 'redirected',
} as const;

/** A decision's state other than in force. */
export const DECISION_STATE = {
  lapsed: 'lapsed',
  superseded: 'replaced',
  revoked: 'revoked',
} as const;

/** What a ruling's verdict says. */
export const VERDICT = {
  'real finding': 'design at fault',
  'model wrong': 'model at fault',
  'property wrong': 'claim misstated',
  'abstraction too coarse': 'restatement too coarse',
} as const;

/** A ruling's kind, by its verdict. */
export const RULING_KIND = {
  'real finding': 'fault in the design',
  'model wrong': 'model corrected',
  'property wrong': 'claim corrected',
  'abstraction too coarse': 'restatement corrected',
} as const;

/** The journey rules a model can fail. */
export const JOURNEY_RULE = {
  journeys: 'a confirmed scenario does not run as written',
  progress: 'a part has no scenario that happens',
  enabled: 'an action or misbehaviour never happens',
  misbehaviours: 'a misbehaviour not produced',
  phases: 'phases-fit check',
  facts: 'facts admit no instance',
  explored: 'an unreached phase, action or cell',
  rows: 'tables do not match the restatement',
} as const;

/** Engines. */
export const ENGINE = {
  tlc: 'TLC · every order of events, within bounds',
  alloy: 'Alloy · every instance, within bounds',
  lifecycle: 'lifecycle engine · phases only',
} as const;

/** The words for a thing's name in a table; where the table has none, the account's own name or the fallback given. */
export const say = (table: Readonly<Record<string, string>>, name: string, fallback = name): string => table[name] ?? fallback;

/** `1 claim`, `3 claims`. */
export const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** `a`, `a and b`, `a, b and c`. */
export const list = (xs: readonly string[]): string =>
  xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

/** Counts joined as a list, leaving out the kinds there are none of: `2 claims and 1 assumption`. */
export const counts = (rows: readonly (readonly [number, string, string?])[]): string =>
  list(rows.filter(([n]) => n > 0).map(([n, one, many]) => plural(n, one, many)));

/**
 * The reading's other words: labels its contract names (presentation.md §explorer: Notes, Opening, Checks,
 * The lists, The top, Standing, A lifecycle drawn), and the few that join them into its lines.
 */
export const LABEL = {
  // standing
  established: 'established',
  establishedOn: 'established on',
  notEstablished: 'not established',
  acceptedUnexamined: 'accepted, unexamined',
  withinBounds: 'within bounds',
  phasesOnly: 'phases only',
  waitsOn: 'waits on',
  waitOn: 'wait on',
  // checks
  caught: 'caught',
  didNotFinish: 'did not finish',
  notRun: 'not run',
  expected: 'expected',
  found: 'found',
  run: 'run',
  states: 'states',
  earlierModel: 'earlier model',
  notCurrent: 'not current',
  // a model's checks, counted by outcome
  asked: 'asked',
  asExpected: 'as expected',
  asExpectedNotCurrent: 'as expected, not current',
  notAsExpected: 'not as expected',
  // things
  restated: 'restated',
  restatedAbove: 'restated above',
  model: 'model',
  revision: 'revision',
  assumedNotChecked: 'assumed, not checked',
  beyondTheBoundsOf: 'beyond the bounds of',
  asPicked: 'As picked',
  actorsAndRecords: 'actors and records',
  withdrawn: 'withdrawn',
  // a lifecycle
  phase: 'phase',
  unspecified: 'unspecified',
  refused: 'refused',
  leftOpen: 'left open',
  stepsAdmitted: 'steps admitted',
  refusedAtStep: 'refused at step',
  // the top
  noClaimYet: 'No claim yet.',
  of: 'of',
  aFault: 'a fault',
  faults: 'faults',
  foundInTheDesign: 'found in the design',
  mechanism: 'mechanism',
  addedNotInTheDocument: 'added, not in the document',
  takenOnUnchecked: 'taken on, unchecked',
  decisions: 'Decisions',
  declared: 'declared',
  unnamed: 'unnamed',
  hereDiffers: 'here differs',
  asRecorded: 'as recorded',
  differs: 'differs',
  forma: 'Forma',
  document: 'document',
  part: 'part',
  span: 'span',
} as const;
