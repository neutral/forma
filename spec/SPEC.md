# Forma

Forma examines the claims of a software design with formal methods. It does
four things. It runs the **ceremony** that makes a formal result trustworthy.
It **tracks** where everything came from. It carries the developer's
**prose to checked results**. And it keeps the **account**: what holds, within
which bounds and on which premises, what went stale and what is missing.

This document owns what Forma is and does. The contracts beside it spell it out
exactly enough for code to implement without deciding anything, and each rule
of theirs cites the lines of this document it comes from, as `M<n>`:

| Contract | Owns |
| --- | --- |
| [project.md](project.md) | the project tree and the contract that owns each path, the words, the rules every command follows, and the explorer: `forma explore --json`, serving, the read index and export |
| [design.md](design.md) | `design/` but its decisions and receipts: the brief, passages and coverage; parts, spans and where a thing is filed; the journeys code adds; units and pins; the Restate answer, removal and re-filing |
| [decisions.md](decisions.md) | every `decisions/` folder: who decides, the decision file and where it is filed, every kind, which decision is in force, waiting decisions and rulings, the brief decision a real finding on a model owes, kept journeys, what a ruling or decline expects; what `forma show` and `forma decide` do and refuse |
| [models.md](models.md) | `models/<model>/model.md`, engine files and slots: which slots exist and when they are owed, the lifecycle model, the Model and Fill-a-slot answers, a Repair on a model, the freeze, a model whose parts change, one model first |
| [evidence.md](evidence.md) | evidence, surprises and their stems under `models/`, and `runs/`: questions, their names and bounds, running and outcomes, the evidence file, currency, surprises, reductions, weaker forms, the Explain answer; what `forma run` runs and writes |
| [door.md](door.md) | every `receipt`, `work/`, the `.gitignore` and `.gitattributes` Forma writes: `forma give` and its packets, `forma answer` and what an answer holds, the Repair answer, receipts, sessions, the allowance spent, the writer's lock, the checks at every read, `change:<path>`, two copies, the clock rule |
| [account.md](account.md) | the account, which is no file: standing, the journey and span rules, items, what waits for the developer, what the basis line and the box hold, what the diff compares, what the account cannot know; what `forma missing`, `forma account`, `forma box` and `forma diff` read and refuse; the graph `forma explore --json` prints |
| [forms.md](forms.md) | the form of every page under `design/` outside `design/brief/`: the rules every page shares, the front pages, a part's tables, the thing pages, the premises code adds, the misbehaviour menu |
| [engines.md](engines.md) | how each engine is driven: engine text, `model.md` and its tables, each slot's native form, how a question is composed for TLC, Alloy and the lifecycle engine, the replay, a kept trace's form |
| [lifecycle-tool.md](lifecycle-tool.md) | the lifecycle tool: a lifecycle as read and its picture, stepping, shortest journeys, findings |
| [presentation.md](presentation.md) | what Forma shows and prints: showings, the reading, a trace rendered as a journey, each command's printed output as text and JSON, and the explorer's page |

Agent output varies from run to run, and always will. So one rule governs
everything below: **Forma fixes the shape of what it tracks; agents fill it in;
code checks what they fill in; engines and the developer decide.** Variance
changes what is filled in, never the shape Forma tracks or the rules it
applies.

- Code never infers a dependency or a relevance. Every link is a fixed field,
  checked to resolve.
- No agent's judgment gates anything. Agents propose, explain and recommend.
  Standing comes only from engine runs and the developer's decisions.
- What holds is read from one computation: Forma's commands and its explorer
  show the account and add no judgement, decision or run of their own.

## The record

The record is the project's tracked files, each beside what it is about, so
no one reads all over the project for one fact and Forma keeps what was
learned, not the exhaust.

| Record | Holds | Written by |
| --- | --- | --- |
| Brief, `design/brief/` | The developer's documents, and supplied sources with their provenance | The developer, or agents for the developer to review; never Forma |
| Restatement, `design/` | The brief restated part by part in fixed forms: the part list; each part's tables of actions, of boundary and surface rows, and of omissions; a page in a folder of its own for each lifecycle, journey, claim, premise and choice, under its part, or a span's for a claim or journey | Agents; code accepts an answer only when every page parses and every reference resolves |
| Models, `models/<model>/` | Engine files; `model.md` with the action table, state projection and bounds; each thing's slots, and each explanation beside its surprise, under the thing's path in `design/` | Agents, accepted on the same terms |
| Evidence, in `models/<model>/` beside what it examines | One file per question: what its runs found, within which limits, on which basis; an open surprise in a file of its own | Code |
| Receipts, in each folder of accepted files | One line per accepted file: its hash, when, and the session or decision that wrote it; for a slot, the pins of its entries | Code |
| Decisions, in `decisions/` beside what each is on | The intake, confirmations, declines, picks, rulings, brief decisions, carries, acceptances, allowances and redirects, one file each with what was shown | The developer, through Forma's command for decisions |
| Account | Standing, coverage, what is missing, the box and the diff, computed from the records above | Code; never stored, at most cached |

`runs/` and `work/` are scratch, ignored by git: deleting them changes nothing
the account says. `runs/` holds each run's inputs and engine output, which the
record does not keep, since the evidence holds what the account reads of a run;
`work/` holds what one machine alone keeps. Agents write Markdown in fixed
forms and native engine files. Code writes every JSON file.

## The restatement

A part is one component of the system. The agent proposes the parts and the
developer confirms them. Each part holds entries of these kinds:

| Entry | Says | Checked by |
| --- | --- | --- |
| Action | One thing an actor does, in one sentence in the developer's terms, with its cases | The lifecycle tool: each action is placed in every lifecycle of its part or listed there as unaffected |
| Lifecycle | One entity's phases, its initial and end phases, and for every phase and action the next phase, a refusal, or a choice that poses it | The lifecycle tool: a conflict, an unreachable phase or an empty cell blocks confirmation |
| Journey | One that should happen or must not: the phases it starts from, numbered steps naming actor, action, arguments and case, and its expected end or the step that must be refused | The lifecycle tool steps it through the part's lifecycles |
| Claim | A property the software must have, in the developer's terms: its stake, its kind (safety, liveness, structure) and the premises it rests on | Code: a liveness claim names its fairness premise |
| Premise | An assumption: its statement, class, why it is not examined, its falsifier and its provider | Code: the class is one of world, promise of another part, store phenomena, fairness, atomicity, bound, omission, choice, span |
| Boundary row | An actor, service, store, queue, clock or entity: machine or world, its kind of seam, and for shared state who reads and who writes | Code: every world row with a seam gets the whole misbehaviour menu; a store names its isolation as the store calls it, and code lists the anomalies it permits as premises |
| Surface | The events the part emits and consumes, the stores it reads and writes, the third parties it calls | Code: names resolve |
| Choice | An interpretation the brief leaves open, as two journeys that differ only on it, with the agent's recommendation | The developer picks |
| Omission | A brief passage deliberately not restated, with its reason | The developer confirms |

Every entry cites the brief passages it restates. Every passage is cited by
some entry or listed in an omission; that is coverage, and an uncovered
passage is missing work. An entry that cites only supplied sources, not the
developer's own documents, is an addition.

A claim's parts are those its `Parts` names and a journey's those of the
actions its steps name; a claim or journey of several parts belongs to their
span, and filing it in a span's folder or a part's changes neither its parts
nor its pin, so filing never changes what it is judged by. The journeys code
adds are not pages, so no agent can change or remove them: code reads a pick's
from the choice, a kept trace from its ruling, and an offered one from the
lifecycles or, once confirmed, from what was shown.

## Models and slots

A model is a set of engine files covering a set of parts. It carries:

- an **action table**: for each action of its parts, the one native operator
  that performs it, and for each unstruck misbehaviour of a world seam, the
  operator that performs that;
- a **state projection**: for each lifecycle of its parts, the native
  expression that gives its phase;
- its **bounds**: constants, depth or scope.

Code checks that every operator and expression exists with the right arity.
Start with one model for the whole system; split only when an engine cannot
answer.

A **slot** is a fixed place for one piece an agent writes, in a file of its
own beside the evidence it serves, so filling one slot never rewrites another:

| Slot | Exists for | The agent writes | Code checks | Expected outcome, fixed in advance |
| --- | --- | --- | --- | --- |
| Encoding | each claim, on a model covering its parts | the native property, or why this engine cannot express it | it defines exactly the expected name and nothing else | no violation |
| Witness | each claim, at least one; each unstruck misbehaviour | a target state | it adds no variable, constant or import | reached |
| Fault | each claim on its model, at least one | the one action changed with one mechanism removed, named in the developer's terms | only that action differs; the property and the type invariant are byte for byte unchanged | caught by this claim's property and not by the type invariant |
| Schedule | each confirmed journey, on each model covering its parts | the native arguments of each step, the entity each step with a case moves, and for a journey that should happen its expected end as a state predicate | one per step; the operators come from the action table, and a step's case is read from its lifecycles' phases after it | should happen: reached, with its expected end holding after the last step; must not: refused at its refused step, after the steps before it are reached |

The lifecycle engine needs no model files. It examines a part's confirmed
lifecycles directly, steps every journey through them with no schedule, and
takes phase-level claims whose slots are a forbidden form, a fault that
overlays cells, and a combination of phases or a transition to reach. Its
results carry *phase level* as their bound.

## The ceremony

Code enforces all of it.

- **Expected outcomes come first.** Each is fixed by its slot's kind before
  anything runs, and no one edits it. A changed bound or expected outcome is a
  new question and the old one keeps its evidence, so a shrunk bound stays
  visible and never answers the original.
- **A model matches the developer's journeys before its claims count.** Every
  confirmed journey whose steps lie within the model's parts runs on it and
  conforms. Every part it covers has a should-happen journey reached. Every
  action in its table is enabled in some reachable state. Every unstruck
  misbehaviour is produced.
- **Every claim has a fault its own property catches**, and every witness it
  declares reached, at the same bounds and on the same model bytes. An instant
  pass or a tiny state space is flagged and cleared only by those.
- **Results say what they are.** No violation within the stated bounds; reached
  in at least one behaviour; refused at a step. An engine that ran out is
  unanswered. Sampled search establishes nothing. The kind of search travels
  with every result.
- **A surprise stays open until the developer rules.** It is a file of its
  own, its question's failure on one basis, removed only when the ruling is
  recorded, so no rerun or merge drops it. While it is open its question is
  not asked again, its model, the claim's slots and the bounds cannot change,
  and nothing it rests on can be removed, so it cannot be hidden.
  Code reruns it at smaller constants and shows the shortest first. A surprise
  that crosses a guarded transition at phase level, uses a misbehaviour the
  developer struck, or starts from an unreachable phase goes back to the agent
  first.
- **Surprises resting on one premise or one boundary row are one decision.**

## Tracking

Code does all of it, by citation and hash, with no inference.

- Code addresses and hashes every brief passage. The only links are fixed
  fields: an entry's citations, the actions a journey or lifecycle names, a
  claim's premises, a slot's entry and model.
- A confirmation pins what was shown, with every reference replaced by what it
  names: the entry, the actions it uses, the passages it cites. It stays current
  while all of those are unchanged. It attaches to content, not to a key or a
  file's bytes, so an entry rewritten with the same meaning-carrying text keeps
  it.
- A question's evidence pins its basis, every input's bytes, generated ones
  included, every entry it read or its trace names, and the versions of the
  engine, its runtime and Forma, and stays current while all are unchanged. A
  change to a model's engine files stales all evidence on that model.
- Evidence changes only when its basis or what it found does, keeping the first
  run's measures, so a rerun changes no tracked byte. It goes only with what
  it examines; a question not asked now keeps it, not current, so a lapse
  costs no rerun. Only a surprise, its reductions and weaker forms, a start
  question and a claim's reached witness keep a trace, since nothing else
  reads one.
- A slot's receipt records the pins of the entries it was written for; when one
  of them changes, the slot is owed again, even if its file is unchanged.
- Two parts whose surfaces share an event, a store or a third party form a
  span. The span owes a claim or journey examined on a model covering both
  parts, or the developer's carry.
- The diff compares the account now with that of an earlier commit or a named
  folder, each judged by the versions its evidence names, since nothing else
  keeps an earlier moment; by default, the commit of the developer's latest
  decision. It lists what went stale, what changed outcome, what opened, what
  closed, and what waits for the developer.

## The developer

The developer is a role: whoever answers for the project's owner, a person or an agent given the role. Forma shows what each decision is on before it is made. An agent holding the role declares its session with each decision, and no session both makes decisions and submits answers. That holds across clones once decisions are merged, but answers refused are known only where they were made.

- **Intake, once:** the situation, what is out of scope and why, and the
  allowances for agents' answers and for engine runs.
- **Confirm:** the parts, then each part's entries beside the passages they
  cite, each lifecycle as one table and drawn. Entries that restate the brief
  outright are confirmed together, in one decision per part or span. The
  lifecycle tool also offers the shortest
  journey to each phase no confirmed journey reaches, judged like any other
  journey. Declining an entry takes a reason, and the reason becomes a repair.
- **Decide:** each choice, by picking one of its two journeys. The pick is
  confirmed as written; when the two differ at one step, the other becomes a
  must-not journey refused at that step. A choice premise binds every claim that rests on it. Each surprise, shown as a journey in the
  developer's terms and lit on the lifecycles they confirmed, by one of four
  verdicts and its level (implementation, specification or requirement), with
  the agent's recommendation shown and never preselected. Each verdict sends a
  repair to its target: *model wrong* to the model, keeping the trace as a
  journey; *property wrong* to the claim; *abstraction too coarse* to the
  restatement; *real finding* to the brief, a model or a premise, as the
  developer directs. A real finding sent to a model leaves the brief
  describing a design without the mechanism the repair adds, so it also owes
  the developer a decision: that the brief now states the mechanism, or that
  the difference is accepted. The ruling keeps what each surprise found and showed, as
  the surprise's file then goes; the receipt of the answer that repairs it
  names the ruling and the mechanism, with each file's hash before and after,
  as a decision never changes.
- **Carry or allow:** each premise with its falsifier, including each claim's
  bounds, each struck misbehaviour and each span. A carry may cite another part's
  established claim as its basis and lapses when that claim stops being
  established. A claim's risk may be accepted without examination; it enters
  the box marked as accepted. Each allowance.
- **Redirect at any time** through the developer's own words: the brief, a
  claim's sentence, a new journey. Forma writes the page, its receipt naming
  the decision, so the page counts as accepted.

Only the developer's decisions confirm, decline, pick, rule, carry, accept, allow or redirect. Each is one file, in the `decisions/` of what it is on or of its part, span or the project, never changed, moved or removed, so no agent erases a decline, a carry or an accepted risk by removing a thing and adding it back. The latest on a unit by its pin is in force; one it overrides from another copy shows as superseded, so no override is silent.

## Agents

| Answer | Forma gives | Writes | Accepted when |
| --- | --- | --- | --- |
| Restate | brief passages and the current restatement | the pages of one or more parts or spans, and those it removes | the forms parse, the references resolve, the lifecycle tool runs |
| Model | the confirmed entries of a set of parts | engine files, action table, state projection, bounds | the files parse, the table and the projection resolve |
| Fill a slot | the entry, the model and the slot's rules | that one slot's file | the slot's checks pass |
| Explain | a surprise: its evidence, its reductions and weaker forms, the entries, and the engine's output, run again where this machine lacks it | the trace in the developer's terms, its failure shape, the mechanism that failed, weaker forms of the claim for code to run, a recommended verdict | it names the surprise it explains; shown beside code's own rendering, as an aid |
| Repair | what a ruling or decline says, and its target | the targeted pages, model files or slots, naming the mechanism added | as for the answer it repeats |

Agents choose what to work on; Forma checks every answer and takes in what it accepts with a receipt.
An explanation is accepted only from a session that wrote none of the model, as its receipt names them. No agent can weaken a claim, lower a bound or change an expected outcome: claims are the
developer's, bounds are carried by the developer, outcomes are code's. A change to Forma's files that no accepted answer or redirect made counts for nothing: what rests on it waits until the file is restored or answered again, since Forma keeps no copy. Only the developer makes decisions, and no answer holds one or any evidence. A
refused answer leaves its item missing with the reasons, which that machine keeps, and the agent may answer again. Each answer counts against the
allowance, which each machine counts; when it is spent, the item goes to the developer. Agents may write the brief directly. Otherwise they work outside the project: they cannot write the rest of its folder or Forma itself, and reach the record only through Forma's commands, asking what is missing, taking an item's inputs and submitting answers from folders of their own. Code checks each file it reads, a page, model or slot by its receipt, a decision by its name, evidence by its own digest, and shows anything else as a change that counts for nothing. Those checks catch accidents; the boundary keeps out forgery, since a well-formed file written inside the project would read as Forma's.

Two copies meet through git. Whoever runs Forma commits what it wrote, and
what nobody commits exists on one machine only; Forma itself reads git only
for the diff. The `.gitattributes` it writes have git convert no bytes, merge
no evidence by line and keep both sides' receipt lines. A conflict in a file
Forma wrote is settled by taking one side whole, never by editing it.
Whenever the project is read, its files are checked again as an answer's are,
and against the freeze and the session rule, so a merge brings in nothing
those forbid.

## The account

A claim is **established** on a model, at that model's bounds, when all of
these hold:

- its confirmation is current;
- its base evidence is current and found no violation;
- a fault is current and was caught by its property;
- every witness it declares is current and reached;
- the model meets the ceremony's journey rules for its parts;
- every premise it rests on is carried;
- no surprise on it or on its model is unruled.

Otherwise the account names exactly what is missing, from the fixed list of
entries and slots. That list is the work. Agents read it from Forma, choose
what to do, and submit every answer through it; developer items wait at their
checkpoint. There is no other flow.

Every established line carries its basis in the developer's terms: the bounds,
the fault it caught named by its mechanism, the witnesses, each by the journey
that reached it, the premises in force, and beneath them, from the evidence,
the engine, its version and the kind of search. The account reads part by part
and by exception: what is not established comes first. It is read for the
project, a part or span, or one thing with its decisions wherever they sit.

The **box** holds only established and accepted claims with their bounds and
premises, and the carried premises with their falsifiers. Under each claim it
names every mechanism a real-finding repair added to the model it is
established on, and whether the brief states it, so nothing leaves Forma as
established of a design the brief does not describe. It is what leaves
Forma.

The account always says what it cannot know. An engine checks the encoding,
not its fidelity to the design; fidelity rests only on the journeys a model
passes. Staleness follows citations, so a dependence nobody cited is not
tracked. An interaction nobody wrote down is not found. Who wrote a brief passage is not recorded. Who made a decision is as declared, and is not checked. What one machine spent or refused is not known to another.

## What Forma does not do

Forma discharges no premise by a refinement run, drives no engine beyond TLC,
Alloy and the lifecycle engine, checks no promise at a seam, searches for no
interaction nobody wrote down, and does not check who holds the developer's role.

## Why

Entries that restate the brief outright are confirmed in one decision per
part or span, because otherwise the agent's label "stated outright" is checked
by no one. An agent writes each fault while code checks it, because code that
rewrote engine files would lose the mechanism's name in the developer's
terms.

One Restate answer may write several parts, because parts that refer to one
another could otherwise enter only through extra answers, each spending the
allowance. A step's case is read from its lifecycles' phases after it, because
an engine sees only whether an operator is taken or enabled, and a case the
developer named is otherwise not examined.

Agents may write the brief directly, because the developer reviews it and what
follows from it checks it: coverage, citations, staleness, and every
confirmation shown beside the passages it cites. Agents stay outside the rest of
the project, writing it only through Forma's commands, because code can tell its
own records from accidents but not from a well-formed record written by anything
that can write the project folder.

Decisions are made through Forma's command from any shell, because the
developer is a role an agent may be given, and an agent runs commands without a
terminal. What keeps the decisions apart from the work is the declared session:
no session both makes decisions and submits answers. Forma cannot check who
holds the role: who made a decision is as declared, and the account says so
among the things it cannot know.

The explorer is a separate app that reads the account Forma computes, because
a second place that judged would be a second account, and Forma's commands
stay whole for an agent with no browser.

A developer's direct edit of a page or a model file counts for nothing, as any
change no accepted answer or redirect made, because every page then passed the
door's checks or came from a decision, and the agent who restates stays apart
from the developer who judges.
