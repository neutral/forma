# Evidence

Spells out [SPEC.md](SPEC.md) for questions and what their runs found: the
questions code composes, with their kinds, names, bounds and expected outcomes;
how they run, within which limits and on which toolchain; the evidence file each
question keeps, and when it is written, rewritten, moved, removed and current;
surprises, with their own files, reductions, weaker forms and classification;
the Explain answer and explanations; running again where a machine lacks a run;
and the command `forma run`, with the runs' side of the allowance. It owns every
evidence file under `models/<model>/` (one per question, beside what it
examines, and under `actions/` and `world/`, and as `phases` and `facts`), each
surprise's file and every file that shares its stem (its reductions' evidence,
its weaker forms and their evidence, its explanation), and everything under
`runs/`. Paths are relative to the project folder. `M<n>` is line n of
[SPEC.md](SPEC.md). How a question is composed for each engine, and a kept
trace's form, are [engines.md](engines.md)'s; a trace rendered as a journey and
what `forma run` prints, [presentation.md](presentation.md)'s; the lifecycle
tool, [lifecycle-tool.md](lifecycle-tool.md)'s. Things, entries, references and
pins are [design.md](design.md)'s; keys and the pages' forms,
[forms.md](forms.md)'s; models, slots and the freeze, [models.md](models.md)'s;
decisions, rulings, strikes and which is in force,
[decisions.md](decisions.md)'s; answers, packets, receipts, `work/`, the
allowance spent, the writer's lock, the clock rule and the checks at every read,
[door.md](door.md)'s; items, standing, the basis line and the diff,
[account.md](account.md)'s.

<a id="questions"></a>

## Questions

A question is one thing asked of one engine about one model. Code composes it
from the model's files, its current slots and the restatement
([engines.md §composition](engines.md#composition)), and no agent writes any
part of it (M27–31, M125, M238). Its expected outcome is fixed by its kind, and
for a journey by the journey's polarity and refused step, before anything runs,
and no one edits it (M112–115, M127–128, M237–238).

A question is **asked now** while its row below holds and its model is usable:
none of the model's files counts for nothing
([door.md §read-checks](door.md#read-checks)) and it is not owed a Model answer
([models.md §parts-change](models.md#parts-change)). A slot a row names is one
[models.md §slots](models.md#slots) gives, filled and current
([models.md §slot-currency](models.md#slot-currency)); a journey or a lifecycle
is confirmed as [decisions.md §in-force](decisions.md#in-force) says. A question
not asked now keeps its evidence, not current
([§currency](evidence.md#currency); M171–173).

| Kind | Engines | Asked now on a model for | Asks | Expected | Reads |
| --- | --- | --- | --- | --- | --- |
| `base` | TLC, Alloy, lifecycle | each claim whose encoding slot on the model holds a property, not a reason | the encoding, within the question's bounds | `no violation` | the claim |
| `witness` | TLC, Alloy, lifecycle | each witness slot of such a claim | the witness's target reached | `reached` | the claim |
| `fault` | TLC, Alloy, lifecycle | each fault slot of such a claim | the encoding, with the fault in place of its action or its overlay applied ([engines.md §composition](engines.md#composition)) | `caught`: the encoding violated, and on TLC the type invariant not violated in any state up to it | the claim and, on TLC and Alloy, the fault's action |
| `misbehaviour` | TLC, Alloy | each misbehaviour witness slot | its `Target` reached | `reached` | the world row |
| `enabled` | TLC, Alloy | each row of the Actions table, but an action that only an alternative a pick in force did not pick takes as a step, no other journey or alternative taking it, since the developer chose the other grain; and each Misbehaviours row of an item not struck | the row's operator enabled, for some binding of its parameters over their domains, in a reachable state | `reached` | the action or the world row |
| `path` | TLC, Alloy | each confirmed journey with a schedule slot on the model | should happen: every step taken, in order, from its start, and `End` holding in the state after the last ([engines.md §slot-forms](engines.md#slot-forms)); must not: every step before the refused one | `reached` | the journey, each action its steps name, each lifecycle that has a step's action with a case as a column, and each lifecycle its start names |
| `refusal` | TLC, Alloy | each confirmed must-not journey with a schedule slot on the model | after the steps before it, the refused step's operator, with its bindings and as its case, enabled | `not enabled` | as `path` |
| `start` | TLC, Alloy | each confirmed journey with a start and a schedule slot on the model | the start holding in a reachable state where the Phases give the journey's start phases | `reached` | the journey and each lifecycle its start names |
| `phases` | TLC, Alloy | each model with a Phases row | each Phases expression giving one of its lifecycle's phases in every reachable state | `no violation` | each lifecycle the Phases rows name |
| `facts` | Alloy | each Alloy model | the model's facts admitting an instance within its bounds | `reached` | nothing |
| `lifecycle-path` | lifecycle | each confirmed journey whose parts are the model's part | [§lifecycle-journeys](evidence.md#lifecycle-journeys) | [§lifecycle-journeys](evidence.md#lifecycle-journeys) | the journey |
| `reduction` | TLC, Alloy | [§reductions](evidence.md#reductions) | its surprise's question at smaller bounds | none | as that question |
| `weaker` | TLC, Alloy | [§weaker](evidence.md#weaker) | as `base`, with a weaker form in place of the encoding | none | the claim |

Every Alloy question also reads each lifecycle the model's Phases rows name, and
every lifecycle engine question each lifecycle and action of the model's part,
since the observers and the data form are written from them
([engines.md §composition](engines.md#composition)). On a lifecycle model a
claim's question is asked only while every lifecycle its slots name is
confirmed. These rows spell out M110–121 and M131–138; what a question reads is
its links, all fixed fields (M33–34, M158–160).

A claim's questions on a model, its `base`, `witness` and `fault` questions and
their reductions and weaker forms, are asked only while the model meets the
journey rules of [account.md §journey-rules](account.md#journey-rules) but
`explored`, which rests on base evidence itself: the journeys the developer
confirmed that should happen are reached, and those that must not are refused,
before any property is asked, so no run is spent on a property of a model that
does not yet conform (M131–135).

<a id="lifecycle-journeys"></a>

### A journey on the lifecycle engine

On a lifecycle model a confirmed journey is stepped through the data form
([engines.md §lifecycle-engine](engines.md#lifecycle-engine)) with no schedule,
as the lifecycle tool steps a journey
([lifecycle-tool.md §stepping](lifecycle-tool.md#stepping)), its entities by the
names the journey gives them (M117–119), except that a step entering a lifecycle
whose entity the journey already holds is refused, as the data form refuses it
([engines.md §lifecycle-engine](engines.md#lifecycle-engine)). While that
stepping meets a cell that is empty, or posed by a choice with no pick in force,
which ends the tool's stepping as `unchecked`, the journey has no question on
the lifecycle model and its evidence is kept, not current
([§currency](evidence.md#currency)): the pick is owed first
([account.md §items](account.md#items)). A should-happen journey's question is
`lifecycle-path`: every step admitted, expected `admitted`. Its `Expected end`
is not asked there: the lifecycle engine steps a journey with no schedule, so
with no `End` (M115, M117–121). A must-not journey refused at step n has one of
two questions:

- `lifecycle-path-refused-at-<n>`: the steps before n admitted and step n
  refused; expected `refused` at step n;
- `lifecycle-path-to-<m>`, where m is n − 1: the steps before n admitted;
  expected `admitted`. The refusal of step n is then left to a guard or another
  part, which a TLC or Alloy model's `refusal` question shows.

The one asked is fixed when one is first asked and kept with the journey across
lifecycle edits (M127–130):
`lifecycle-path-refused-at-<n>` is asked when the model holds its evidence, or
when stepping the journey through the data form as it now stands admits every
step before n and refuses step n; otherwise `lifecycle-path-to-<m>`. So a
refusal once asked stays asked, and a lifecycle edit that admits step n comes
back as an outcome that does not match; a prefix asked first whose lifecycles
come to refuse step n is followed by the refusal question, a new question, while
the prefix keeps its evidence, not current. A start the data form cannot hold is
`refused` at step 0.

<a id="never-counts"></a>

### What never counts for standing

A reduction's or weaker form's evidence never counts for standing and is never a
surprise; it is shown with its surprise (M148, M233).

<a id="names"></a>

## Names and paths

<a id="bounds"></a>

### Bounds

A question's bounds are those it runs at (M101, M120–121): on a TLC model, each
`constant` and `choose` row of the model's Bounds and its `constraint` row,
which a liveness claim's questions leave out
([engines.md §tlc](engines.md#tlc)); on an Alloy model, its `scope`, `steps` and
`int` rows; on the lifecycle engine, phase level; for a reduction, its own
([§reductions](evidence.md#reductions)). The rows and their forms are
[engines.md §bounds](engines.md#bounds)'s. Each TLC or Alloy bound is written as
one line, `<Bound> = <Value>`, from the row's two cells, each normalised so:
outside double-quoted strings, every run of whitespace, as
[design.md §passages](design.md#passages) reads it, becomes one space; then no
space is left at either end, after `{`, before `}` or `,`, or beside `..`; and
one space follows each `,`. So `{p1,p2}` and `{ p1, p2 }` are one bound. A
question's **bounds digest** is the first twelve lowercase hexadecimal digits of
the SHA-256 of its bounds' lines, sorted in byte order, each ending in a line
feed.

<a id="question-names"></a>

### A question's name and its evidence's path

A question's **name** is the path of its evidence file under `models/`, without
`.json`. The name holds the model, what the question examines, its kind, its
expected outcome where the kind alone does not fix it, and on TLC and Alloy its
bounds digest. So a changed bound or expected outcome is another name and
another question, and the old question keeps its evidence, not current: a shrunk
bound stays visible and never answers the original (M127–130). A lifecycle
engine question has no bounds digest, since its bound is always phase level.

Each kind, and its evidence file, under `models/<model>/`, with `<d>` the
bounds digest:

- **`base`**: `<p>/claims/<claim>/base.<d>.json`
- **`witness`, `fault`**: `<p>/claims/<claim>/witness-<key>.<d>.json` and
  `fault-<key>.<d>.json`, `<key>` its slot's
- **`path`**: `<p>/journeys/<journey>/path.<d>.json` for a should-happen
  journey; `path-to-<m>.<d>.json` for a must-not journey refused at step m + 1
- **`refusal`**: `<p>/journeys/<journey>/refusal-at-<n>.<d>.json`, n the refused
  step
- **`start`**: `<p>/journeys/<journey>/start.<d>.json`
- **`enabled`**: `actions/<part>/<action>.<d>.json` for an Actions row;
  `world/<part>/<row>/<item>.enabled.<d>.json` for a Misbehaviours row
- **`misbehaviour`**: `world/<part>/<row>/<item>.<d>.json`
- **`phases`, `facts`**: `phases.<d>.json`, `facts.<d>.json`
- **`base`, `witness`, `fault` on a lifecycle model**: as above, without `.<d>`
- **`lifecycle-path`**: `<p>/journeys/<journey>/lifecycle-path.json`,
  `lifecycle-path-to-<m>.json` or `lifecycle-path-refused-at-<n>.json`
  ([§lifecycle-journeys](evidence.md#lifecycle-journeys))
- **`reduction`, `weaker`**: beside their surprise, under its stem
  ([§stems](evidence.md#stems))

`<p>` is `parts/<part>` or `spans/<span>`, the folder the thing has under
`design/`; a journey code adds has no page, and its questions sit under its
reserved key in the part or span it belongs to
([design.md §code-journeys](design.md#code-journeys); M87–90). A thing's slots sit
in the same folder ([models.md §paths](models.md#paths)), so evidence sits beside
the slots it serves and mirrors what it examines (M50–51, M107–108). On the TLC
model `core`, the base question of the claim `charge-once` of the part
`billing`, at bounds whose digest is `4c1d2e3f4a5b`, is named
`core/parts/billing/claims/charge-once/base.4c1d2e3f4a5b`, and its evidence is
`models/core/parts/billing/claims/charge-once/base.4c1d2e3f4a5b.json`.

<a id="stems"></a>

### A surprise and its stem

A surprise's **name** is its question's name, then `.surprise-` and the first
twelve hexadecimal digits of its basis digest ([§basis](evidence.md#basis)); its
file is `models/<name>.json`, beside its question's evidence (M143–144). Its
**stem** is that file's name without `.json`. These files share the stem and go
with the surprise ([§at-ruling](evidence.md#at-ruling)):

| File | Holds | Written by |
| --- | --- | --- |
| `<stem>.json` | the surprise ([§surprise-file](evidence.md#surprise-file)) | code |
| `<stem>.reduction-<n>.json` | the evidence of its n-th reduction, n counting each one run from 1 ([§reductions](evidence.md#reductions)) | code |
| `<stem>.weaker-<key>.<ext>` | a weaker form of the claim, `<ext>` that of the claim's encoding on the model ([§weaker](evidence.md#weaker)) | an agent, through an Explain answer Forma accepts ([§explain](evidence.md#explain)) |
| `<stem>.weaker-<key>.json` | that weaker form's evidence ([§weaker](evidence.md#weaker)) | code |
| `<stem>.explained.md` | the accepted explanation ([§explain](evidence.md#explain)) | an agent, through an Explain answer Forma accepts |

A reduction's name is the surprise's name and `.reduction-<n>`; a weaker form's
evidence's is the surprise's name and `.weaker-<key>` (M143–144, M148, M233).

<a id="writers"></a>

### Who writes and reads them

Code writes every JSON file of [§question-names](evidence.md#question-names),
[§stems](evidence.md#stems) (M51, M59–60). Agents write only an explanation and
its weaker forms, through an Explain answer (M233, M238); those two have lines
in their folder's receipt ([door.md §receipts](door.md#receipts)), and evidence
has none, since it is checked by its own digest
([§own-check](evidence.md#own-check); M240). No answer holds evidence (M238).
Each file is read by `forma run` ([§forma-run](evidence.md#forma-run)); by the
account, for standing, items, the basis line and the diff
([account.md §what-it-is](account.md#what-it-is)); by `forma show` and
`forma decide`, which show and rule surprises
([decisions.md §rulings](decisions.md#rulings)); by `forma give`, whose packets
hand surprises, their evidence and explanations to agents
([door.md §gives](door.md#gives)); and by anyone reading the project (M42–44).
Forma creates each folder when it first writes there.

<a id="runs"></a>

### `runs/`

`runs/` is scratch on one machine, ignored by git: deleting it changes nothing
the account says, since evidence holds what the account reads of a run (M56–59).
Only code writes there. For each name of a question, reduction or weaker form
that has run on this machine, `runs/<name>/` holds its latest run:

- **`runs/<name>/basis.json`**: `name`, the run's `basis`
  ([§basis](evidence.md#basis)), and `finished`, when it ended, in UTC
- **`runs/<name>/inputs/`**: each file the basis names
  ([§basis](evidence.md#basis)): each generated file under its name
  ([engines.md §composition](engines.md#composition)), each project file the
  composition read or the engine was given under its project path
- **`runs/<name>/output/`**: the engine's own output, unaltered, each state's
  values among it
- **`runs/<name>/replay/`**: for a TLC trace the evidence keeps, the replay's
  generated files and output ([engines.md §replay](engines.md#replay))
- **`runs/<name>/running.json`**: while the run is in progress, its marker
  ([§in-progress](evidence.md#in-progress))

A surprise's run is its question's, in `runs/<question's name>/`. A run replaces
its name's folder, and Forma may remove any folder here. Nothing here is checked
as the record's files are: `forma run` and `forma give` read it, and a file here
that does not parse, or a folder without `basis.json`, is read as no run. Its
`.gitignore` is [door.md §copies](door.md#copies)'s (M56–59).

<a id="running"></a>

## Running

<a id="toolchain"></a>

### The toolchain and its versions

TLC and Alloy run from the toolchain Forma pins: TLC's `tla2tools`, Alloy, and
the Java runtime both run on. `toolchain.json`, beside Forma's code, names each
file with its version, its address, its size and its SHA-256, for one platform.
`forma-toolchain` fetches each into the toolchain's folder, checks its size and
SHA-256, and unpacks the runtime; on any other platform it refuses, naming both.
The folder is the one `FORMA_TOOLCHAIN` names, an absolute path, or else
`forma/toolchain` in the user's cache folder, so neither a checkout nor an
installed Forma holds it. Before an engine runs, each of its files is checked
against its pinned SHA-256, and the runtime as unpacked against its archive,
file by file. The lifecycle engine runs inside Forma on Node, stepping with the
XState Forma's `package.json` pins, on a Node within the versions `package.json`
names as its engine; Forma refuses to run it on any other Node or XState, and
records Node's exact version in every lifecycle basis. The lifecycle engine and
the lifecycle tool are Forma's own code, so their version is Forma's. Every
basis names the versions of the engine, its runtime, XState for the lifecycle
engine, and Forma ([§basis](evidence.md#basis); M166–168). An engine whose
pinned files are missing, or do not match their SHA-256, runs nothing, since a
result without its versions has no basis: `forma run` names it with the reason
and writes and spends nothing for its questions
([§forma-run](evidence.md#forma-run); M166–168). Forma drives no other engine
(M290–291).

<a id="limits"></a>

### Limits

A run's **limits** are the time, and on TLC and Alloy the memory, that one run
of its engine may take, as the allowances in force give them
([decisions.md §intake](decisions.md#intake); M191–192, M219); the lifecycle
engine's memory is Forma's own. They are **larger** than a run's when either is
larger. A run whose engine is allowed no time, or on TLC and Alloy no memory, is
not started. Forma may run several questions at once, each within its own
limits, a TLC or Alloy run in a process of its own: at most half the machine's
processors, and no more than half its memory holds at the largest memory limit
allowed. What a run finds does not depend on what ran beside it, but its time
does: a run that ran out of time while another ran beside it writes nothing, and
is run again at once by itself, within the runs left
([§forma-run](evidence.md#forma-run)), so only a run by itself writes
`unanswered` for time ([§written](evidence.md#written)) (M139–142).

<a id="outcomes"></a>

### Outcomes

A run's `found` is one of `no violation`; `violation`, with the property
violated; `reached`; `not reached`; `enabled`; `not enabled`; `admitted`;
`refused`, with its step; or `unanswered`, with its reason (M139–142). The
property violated is the one composed: the encoding's `Invariant`, `Property` or
`Claim`, a weaker form's own, the type invariant by its name, `phases` for the
phases question, and on the lifecycle engine `forbidden form`. A fault's run is
`caught` when it found `violation` of the encoding's property; on TLC, which
checks the type invariant first, a type invariant violated by then is found
instead, and is not caught (M114).

A should-happen journey's path whose steps are all taken but in no behaviour
with `End` holding after the last is `not reached`, a surprise like any path not
reached ([§surprise-file](evidence.md#surprise-file)). Where the run tells it
apart from a path whose steps are not all taken, as
[engines.md §tlc](engines.md#tlc) says TLC does for a path without a start,
`not reached` has the reason `the expected end does not hold after step <n>`, n
the journey's last step (M115). Elsewhere it has no reason: an Alloy run, and a
TLC path with a start, say only that no behaviour takes every step with `End`
after the last.

An engine that runs out of time or memory, is stopped or fails has not answered:
`unanswered` (M139–141). Alloy's answer is read from the command summary its
command line writes, the file Alloy names `receipt.json`, from its entry for the
wrapper's one command, and only when that entry is of the kind the question asks,
`check` or `run`. It has not answered when the summary does not parse or holds no
such command, when an instance lacks its states, or when it lacks the loop that
closes its trace, given as a state the trace holds. The reason says which, with
the engine's own words where it gave any (M139–141).

<a id="result-says"></a>

### What a result says

`no violation` says no violation within the stated bounds. `reached` says
reached in at least one behaviour, never always reachable. `not reached` from a
should-happen journey's path, with its reason, says that some behaviour takes
every step and in none does `End`, the schedule's reading of the journey's
`Expected end`, hold after the last ([§outcomes](evidence.md#outcomes)).
`not enabled`, from a refusal question, says refused at this step in every
behaviour that takes the steps before it; alone it does not show that any
behaviour takes them, so that the step is reached and refused there is the
journey's `path` question's to show, on the same model bytes and bounds.
`admitted` and `refused` from the lifecycle engine say so at phase level.
`unanswered` says nothing about the question. A path's evidence is journey
evidence and never a safety result (M139–142).

<a id="search"></a>

### The kind of search

The kind of search travels with every result and is not written: it is derived
from the engine the basis names, since each engine runs in one mode only. TLC's
model checking is bounded exhaustive, within its constants; Alloy is scoped; the
lifecycle engine is bounded exhaustive, at phase level. No question is run by
sampling, so no evidence is sampled, and sampled search establishes nothing
(M139–142).

<a id="in-progress"></a>

### A run in progress

While a run is in progress, `runs/<name>/running.json` holds its `name`,
`started`, and `ends`, the time by which its limits end it. Until that time Forma
starts no second run of that name on this machine; after it the marker is
ignored. Code removes the marker when the run ends. It marks the run on this
machine only, so two machines can run one question at once, each spending
(M56–59).

<a id="evidence-file"></a>

## The evidence file

<a id="keys"></a>

### Its keys

Each question's evidence is one JSON file at its path
([§question-names](evidence.md#question-names)), holding these keys in this
order, those marked so only where they apply (M51, M166–175):

- **`name`**: the question's name
  ([§question-names](evidence.md#question-names))
- **`kind`**: its kind ([§questions](evidence.md#questions))
- **`expected`**: `outcome`, its expected outcome
  ([§questions](evidence.md#questions)); and `step`, for a must-not `path` the
  last step asked, for a `refusal` the refused step, for `lifecycle-path-to-<m>`
  m, for `lifecycle-path-refused-at-<n>` n
- **`bounds`**: the bounds it ran at: an object from each bound to its value,
  both as [§bounds](evidence.md#bounds) writes them, in byte order; or
  `"phase level"`
- **`limits`**: `seconds`, and on TLC and Alloy `megabytes`: the limits it ran
  within ([§limits](evidence.md#limits))
- **`basis`**: [§basis](evidence.md#basis)
- **`found`**: `outcome` ([§outcomes](evidence.md#outcomes)); `property`, for
  `violation`; `step`, for `refused`; `reason`, for `unanswered`, and for a
  path's `not reached` where [§outcomes](evidence.md#outcomes) gives one
- **`matches`**: `true` when `found` is what `expected` asks, else `false`; only
  where it answered. `no violation`, `reached`, `not enabled` and `admitted`
  match themselves; `caught` matches a `violation` of the encoding's own
  property; `refused` matches when its step is the expected step
- **`measures`**: [§measures](evidence.md#measures)
- **`flags`**: [§flags](evidence.md#flags), a list, empty when none
- **`cases`**: for `path` and `refusal`, the numbers of the steps asked as their
  operator alone ([engines.md §composition](engines.md#composition)), a list
- **`trace`, `rendered`**: [engines.md §trace](engines.md#trace), only where the
  evidence keeps a trace
- **`established`**: when the run that first found what this evidence says, on
  its basis, ended: UTC to the millisecond, `YYYY-MM-DDTHH:MM:SS.sssZ`
- **`previous`**: `null`, or the last `found` before this one that differed from
  it in outcome, property or step, with `until`, the `established` of the
  evidence that replaced it
- **`digest`**: [§own-check](evidence.md#own-check)

A reduction's evidence holds `name`, `kind`, `reduces` (the surprise's name),
`bounds`, `limits`, `basis`, `found`, `measures`, `trace` and `rendered` where it
found a violation, `established` and `digest`. A weaker form's evidence holds the
same with `weakens` (the surprise's name) for `reduces` (M148, M173–175, M233).

```json
{
  "name": "core/parts/billing/claims/charge-once/base.4c1d2e3f4a5b",
  "kind": "base",
  "expected": { "outcome": "no violation" },
  "bounds": { "constant Customers": "{c1, c2}", "constant Retries": "2" },
  "limits": { "seconds": 300, "megabytes": 2048 },
  "basis": {
    "files": [
      { "path": "models/core/Billing.tla", "sha256": "…" },
      { "path": "models/core/model.md", "sha256": "…" },
      { "path": "models/core/parts/billing/claims/charge-once/encoding.tla", "sha256": "…" },
      { "generated": "FormaExam.cfg", "sha256": "…" },
      { "generated": "FormaExam.tla", "sha256": "…" }
    ],
    "entries": [ { "entry": "billing/claims/charge-once", "pin": "…" } ],
    "engine": { "name": "tlc", "version": "2.19 of 08 August 2024" },
    "runtime": { "name": "java", "version": "21.0.13+9" },
    "forma": { "version": "0.1.0", "source": "1ca8f993c585" }
  },
  "found": { "outcome": "no violation" },
  "matches": true,
  "measures": { "duration": 4210, "states": 25987, "depth": 35 },
  "flags": [],
  "established": "2026-11-11T09:30:12.418Z",
  "previous": null,
  "digest": "…"
}
```

<a id="basis"></a>

### The basis

A question's evidence pins its basis (M166–169):

- **`files`**: each project file the composition read or the engine was given,
  `{ "path", "sha256" }`, in byte order of path; then each generated file,
  `{ "generated", "sha256" }`, in byte order of name
- **`entries`**: each entry the question reads
  ([§questions](evidence.md#questions)) and each its trace names
  ([engines.md §trace](engines.md#trace)), `{ "entry", "pin" }`, whether or not
  the trace is kept: `entry` is its name and `pin` its pin
  ([design.md §pins](design.md#pins)); in byte order of `entry`
- **`engine`**: `name`, `tlc`, `alloy` or `lifecycle`, and `version`: TLC's own
  version string, Alloy's release, or Forma's version for the lifecycle engine
  ([§toolchain](evidence.md#toolchain))
- **`runtime`**: `name`, `java` or `node`, and its `version`
- **`library`**: for the lifecycle engine only: `name`, `xstate`, and its
  `version`
- **`forma`**: `version`, its package version, and `source`, the first twelve
  hexadecimal digits of a SHA-256 over its source files in path order

Every SHA-256 is written as 64 lowercase hexadecimal digits. The **basis
digest** is the SHA-256 of the `basis` value written alone as
[§own-check](evidence.md#own-check) writes JSON, ending in a line feed. Two
pieces of evidence are **on the same model bytes and bounds** when their bases
give one SHA-256 for `model.md` and for each engine file of the model, and their
`bounds` are equal; it is so for a claim's base, faults and witnesses whenever
each is current, since [engines.md §composition](engines.md#composition)
composes them alike (M136–138). Fairness is in the encoding's file, in `files`;
TLC's symmetry reduction is never used ([engines.md §tlc](engines.md#tlc)); so
every item the basis line shows beneath an established claim is in the evidence
or in the model files its basis pins
([account.md §basis-line](account.md#basis-line); M269–272).

<a id="measures"></a>

### Measures

Each key, and what it holds:

- **`duration`**: the run's wall-clock milliseconds, engine startup included,
  its replay not
- **`states`, `depth`**: on TLC, the distinct states found and the depth reached
- **`scope`, `steps`, `bitwidth`**: on Alloy, the scope's default number, the
  steps from least to most as `[least, most]`, and the bitwidth, each as the
  command summary gives it; `null` where the command leaves it to Alloy's own
  default
- **`combinations`**: on the lifecycle engine, the combinations of phases
  enumerated

Evidence holds `duration` and its engine's own measures, each once and no
other; a measure the engine does not report for a run is `null`.

<a id="flags"></a>

### Flags

Suspicion flags apply to a `base` question that found `no violation` (M136–138):

- on TLC, `instant-pass` when its duration is under 1,000 ms, and
  `tiny-state-space` when it found fewer than 100 distinct states;
- on Alloy, `tiny-scope` when the scope allows fewer than two atoms of a
  signature declared without `one`, `lone` or `abstract`, an abstract signature's
  atoms being its children's, and `tiny-trace` when it allows fewer than two
  steps. What the scope allows a signature is the bound the scope gives it by
  name or, for a top-level signature without one, the scope's default number,
  and never more than the top-level signatures it extends or is a subset of are
  allowed together, as the command summary names them. Which signatures are
  `one` or `lone` is as the language server lists them, a subset and a private
  signature included; a private signature, which no summary lists and no scope
  can name, is counted at the default number. A bound given to a signature
  between a signature and its top-level one is not seen for the lower one, since
  the summary names only the top-level one;
- on the lifecycle engine, no time or size flag, since its space is the whole
  abstraction rather than a cut of it; but what the exploration meets:
  `unreachable-phase <lifecycle>/<phase>` for each phase of a lifecycle of the
  part that no reachable combination holds; `untaken-action <action>` for each
  action of the part, with its case where it has cases, that no reachable
  combination takes; and `open-pair <lifecycle>/<phase>/<action>` for each cell,
  or case of one, that a reachable combination meets empty or posed. Each item of
  `flags` is then the flag's name, a space and what it names.

Which flags a current caught fault and every declared witness reached on the same
model bytes and bounds clear (`instant-pass`, `tiny-state-space`, `tiny-scope`,
`tiny-trace`), and that the lifecycle engine's three are cleared by nothing and
block establishment as an action never enabled does, as does a facts question not
reached, are [account.md §standing](account.md#standing)'s (M136–138).

<a id="own-check"></a>

### Its own check

Code writes evidence, a surprise and the evidence of a reduction or a weaker
form as JSON in UTF-8 with line feeds, two-space indentation and its keys in the
order [§keys](evidence.md#keys) lists, ending in a line feed: each member on a
line of its own as `"<key>": <value>`, an empty object `{}` and an empty array
`[]` on one line, every character but `"`, `\` and the control characters
written as itself, and those escaped as JSON's shortest escape, `\u00XX` for a
control character without one; the form `JSON.stringify(value, null, 2)` gives.
`digest` is the SHA-256 of those bytes with its own value written as an empty
string. A file at one of their paths is one only when it parses so, its digest
holds, and its `name` and `kind` are those its path gives; any other file there
counts for nothing and shows as a change ([door.md §change](door.md#change);
M240). A file a merge mixed from two sides' lines fails its digest.

<a id="written-moved"></a>

## When evidence is written, rewritten, moved or removed

<a id="written"></a>

### Written

A run of a question writes its evidence only (M170–171):

1. when the question has none: no file at its path, or one that is not evidence
   ([§own-check](evidence.md#own-check));
2. when the run's basis digest differs from the evidence's;
3. when, on the same basis, its `found` differs from the evidence's in outcome,
   property or step;
4. when the evidence is `unanswered`, and the run, on the same basis at larger
   limits, again does not answer: an unanswered finding is a finding within its
   limits (M51), so it is another finding, written with those limits, and the
   evidence says why and the largest limits tried.

Otherwise it writes nothing. So a run at the same limits that again does not
answer writes nothing, and evidence keeps the measures, flags and `established`
of the run that first found what it says: a rerun changes no tracked byte, and
an `instant-pass` survives a later run (M170–171). When written, `established`
is when this run ended, and `previous` is kept when the new `found` has the old
one's outcome, property and step, and otherwise becomes the old `found` with
`until` the new `established`. A reduction's and a weaker form's evidence is
written once, by its one run ([§reductions](evidence.md#reductions),
[§weaker](evidence.md#weaker)). Evidence that answered and does not match opens
a surprise as [§surprise-file](evidence.md#surprise-file) says. Forma writes
nothing while a tracked time is more than a minute ahead of its clock
([door.md §clock](door.md#clock)).

<a id="versions"></a>

### Builds and versions

Versions are in every basis, so a change of the engine's, the runtime's, XState's
or Forma's version makes evidence not current until its question runs again
(M166–169). A run owed only because the versions in its basis are not this
machine's, every file, generated file and entry being unchanged, spends nothing.
Machines on different Node versions, and builds of Forma with one package version
and different sources, so rewrite each other's lifecycle and other evidence: a
cost the record accepts. A build of Forma does not run a question whose evidence,
or whose open surprise, names a later package version of Forma than its own,
compared as semantic versions: an older build refuses to rewrite what a newer one
wrote, and `forma run` names each such question.

<a id="moved"></a>

### Moved

When an accepted Restate answer re-files a thing, the same kind, key and pin in
another part's or span's folder, code moves its folder in every model with all
it holds, and for a choice the folders of its pick's journeys
([design.md §removal](design.md#removal);
[models.md §parts-change](models.md#parts-change)). Each evidence file so moved
is written again at its new path with only its `name`, the paths in its basis
under the moved folder, and the moved thing's `entry` in its basis changed to
the new, its digest following ([§own-check](evidence.md#own-check)). The bytes
and pins it rests on are unchanged, so evidence current before the move is
current after it, with no run (M84–87, M170–172). design.md refuses to re-file a
thing on which an unruled surprise rests (M146–147), so no surprise's files
move.

<a id="removed"></a>

### Removed

Evidence goes only with what it examines (M170–173):

1. When an accepted Restate answer removes a thing, an action, a world row, a
   part or a span
   ([design.md §removal](design.md#removal)),
   code removes from every model the evidence of each question that serves it,
   and of each journey code adds that goes with it
   ([design.md §code-journeys](design.md#code-journeys)): for a part, every
   question of its things, actions and world rows; for a span, every question of
   its things. A thing removed and added back in the same answer, with the same
   key and pin, keeps its evidence; one added back in a later answer has none,
   and its questions are owed afresh.
2. When an accepted Model answer drops a part
   ([models.md §parts-change](models.md#parts-change)),
   code removes from that model the evidence of each question that serves an
   action or world row of the part, or a thing one of whose parts it is.
3. When an accepted Repair answer of a model removes a slot
   ([models.md §model-repair](models.md#model-repair)), code removes from that
   model the evidence of each question that slot served, at every bounds digest.
4. A later run of its question writes it again ([§written](evidence.md#written)).
5. A surprise's files go at its ruling ([§at-ruling](evidence.md#at-ruling)).

Nothing else removes evidence: a question not asked now keeps it, not current, so
a lapse costs no rerun (M171–173). A removal or a drop on which an unruled
surprise rests is refused by
[design.md §removal](design.md#removal)
and [models.md §parts-change](models.md#parts-change),
and a slot's removal by the freeze ([models.md §freeze](models.md#freeze))
(M146–147), so none ever removes a surprise's files.

<a id="currency"></a>

## Currency

Evidence is **current** while its question is asked now
([§questions](evidence.md#questions)) and all of these are unchanged (M166–169):

1. each project file in its basis has the SHA-256 the basis gives;
2. each entry in its basis has the pin the basis gives
   ([design.md §pins](design.md#pins));
3. each generated file, composed again now, has the SHA-256 the basis gives;
4. the engine's, runtime's and XState's versions, and Forma's version and source,
   are those this machine runs.

A change to a model's `model.md` or to any of its engine files therefore makes
all evidence on the model not current (M168–169). Evidence that is not current is
kept and shown not current; once its question is asked again with all four
unchanged it is current again, with no run, so confirming a journey's same pin
again makes its schedule's evidence current without a new answer (M171–173). A
reduction's or weaker form's evidence is current while 1 to 4 hold of its own
basis. The diff judges an earlier copy's evidence by the
versions that evidence names ([account.md §diff](account.md#diff); M181–183).

<a id="surprises"></a>

## Surprises

<a id="surprise-file"></a>

### A surprise and its file

A surprise is a question's failure on one basis: evidence that answered and does
not match its expected outcome (M143–144). Unanswered evidence is no surprise but
missing work ([account.md §items](account.md#items)), and reduction and weaker
evidence makes none ([§never-counts](evidence.md#never-counts)).

When a run finds an answer that does not match, whether or not it writes
evidence ([§written](evidence.md#written)), code writes the surprise's file
([§stems](evidence.md#stems)), unless it exists or a ruling names a surprise of
that question and basis digest ([decisions.md §rulings](decisions.md#rulings)):
found again on the same basis it opens nothing, and a failure on another basis
is another surprise. The file is written once and never rewritten. It holds the
keys of [§keys](evidence.md#keys) as the run wrote the evidence, but `name` is
the surprise's, `question` follows it with the question's name, `trace` and
`rendered` stand wherever the run gave a trace, `previous` is left out, and
`held` follows `basis`: a list of `{ "path", "sha256" }` in byte order of path,
each file the freeze holds as the surprise opens
([models.md §freeze](models.md#freeze)). Its `established` is when the surprise
was found. So it keeps what it found whatever later becomes of its question's
evidence, and a merge that takes one side of that evidence cannot drop it
(M143–145, M173–175).

A surprise is **open** while its file is one
([§own-check](evidence.md#own-check)) and no ruling names it. While it is open
its question is not asked again, even when its evidence is not current, and its
reductions and weaker forms run (M145–147). Its model, the claim's slots and the
bounds are frozen ([models.md §freeze](models.md#freeze)), and nothing it rests
on can be removed ([design.md §removal](design.md#removal),
[models.md §parts-change](models.md#parts-change)). Evidence that answered and
does not match, whose surprise has neither a file nor a ruling naming it, is
owed a run, which writes the surprise's file again: so a surprise cannot be
hidden by losing its file (M147). Every open surprise is owed an Explain answer
until one is accepted, so the agent's recommendation stands beside it (M204,
M233; [account.md §items](account.md#items)).

<a id="reductions"></a>

### Reductions

Code reruns a surprise at smaller bounds and shows the shortest first (M148). A
surprise is reduced when it is on a TLC or Alloy `base` or `fault` question that
found a violation; a lifecycle engine surprise is not, its bound being phase
level.

A reduction is the surprise's question at smaller bounds, every other input as
it is now ([engines.md §composition](engines.md#composition)), and its evidence
names the surprise and holds its own bounds and basis (M148). It is **kept**
when it found the same property violated as its surprise. Code runs them one at
a time, the next composed only once the one before it has ended, from the bounds
last kept, starting with the surprise's own:

- on TLC, it tries the constants in the order of the model's Bounds, each reduced
  by one step alone: a set loses the last half of its elements and a range the
  last half of its values, rounded down and at least one, down to the empty set
  and to one value; an integer falls by one, down to zero; a string or a truth
  value is not reduced, nor the constraint, nor a `choose` row. A kept reduction
  becomes the bounds last kept, and the tries start again at its first constant;
- on Alloy, the scope's default number falls by one, down to one, its signature
  bounds, steps and bitwidth unchanged; a scope with no default number is not
  reduced.

It stops when no reduction of the bounds last kept is kept, when none is left, or
when six have run, kept or not. The cap of six counts the surprise's own reduction
files, which share its stem, so one surprise's reductions never take another's
(M148). The next reduction follows from the surprise's bounds and the outcomes of
its reductions so far, in order, so it is found again after any interruption.
Each is run once and spends one run ([§forma-run](evidence.md#forma-run)).

<a id="weaker"></a>

### Weaker forms

When a surprise is on a claim's `base` question on a TLC or Alloy model, and
found a violation of the encoding's own property, the Explain answer accepted
for it gives one or more weaker forms of the claim, in an order from the
strongest to the weakest ([§explain](evidence.md#explain)). Code runs each once
as a `weaker` question: the base question with the weaker form in place of the
encoding, on the same model and bounds, every other input as it is now
([engines.md §composition](engines.md#composition); M233). It has no expected
outcome and never counts for standing
([§never-counts](evidence.md#never-counts)). The surprise is shown with each
weaker form, in that order, by its key with what it found, and with **the
weakest that fails**: the last in the order whose run found a violation, or that
none does. Each spends one run ([§forma-run](evidence.md#forma-run)).

<a id="sent-back"></a>

### Sent back first

A surprise goes back to the agent first, before its decision is offered, when any
of these holds of it as it is read (M148–151):

- it is a lifecycle engine `base` or `lifecycle-path` surprise whose trace takes a
  guarded transition: a step of an action with a guard
  ([forms.md §actions](forms.md#actions)) that a lifecycle having the
  action as a column takes, to another phase or back to the same one; not a
  refused step, nor a step of an action every lifecycle of the part lists as
  unaffected;
- its trace takes a misbehaviour struck now
  ([presentation.md §rendering](presentation.md#rendering);
  [forms.md §menu](forms.md#menu));
- it is a `path` surprise whose journey's `start` question, on the same model at
  the same bounds, has current evidence that found `not reached`; or a
  `lifecycle-path` surprise refused at step 0.

Nothing records this: it is read from the surprise's file, the strikes in force
and the evidence as they stand, since the account is computed and never stored
(M54, M148–151). The reason says which, naming the step. The surprise's Explain
item carries the reason as its `found`
([account.md §commands](account.md#commands)), so its packet's `item.json` holds it
([door.md §gives](door.md#gives)), and its
decision is offered only once an explanation of it is accepted
([decisions.md §rulings](decisions.md#rulings)).

<a id="at-ruling"></a>

### At the ruling

A ruling closes exactly the surprises it names. When `forma decide` records it
([decisions.md §forma-decide](decisions.md#forma-decide)), it removes each named
surprise's file and every file that shares its stem: its reductions' evidence,
its weaker forms and their evidence, and its explanation, the explanation's and
the weaker forms' receipt lines with them
([door.md §receipts](door.md#receipts)); the ruling keeps what each found and
showed (M211–212). A surprise file a ruling names that is read later, as after a
merge, is closed, and `forma run` removes it and the files sharing its stem
([§forma-run](evidence.md#forma-run)). A file that shares a stem no surprise
file has belongs to no surprise and counts for nothing. The question's evidence
stays as it is until a run writes it again ([§written](evidence.md#written)).

<a id="explain"></a>

## The Explain answer and explanations

An Explain answer explains one open surprise, from a session that wrote none of
its model; it is shown beside code's own rendering as an aid, and decides nothing
(M233, M237). Its folder holds `explain.md` and, for a surprise on a `base`
question of a TLC or Alloy model, one or more weaker forms, each
`weaker/<key>.<ext>`, since a strong property that fails is followed by its weaker
forms, as
[door.md §answer-holds](door.md#answer-holds) lays the folder out. `explain.md` is
a field table, then three level-2 sections in this order, each holding text,
deeper headings included, and nothing else at level 2; its table follows
[forms.md §page-rules](forms.md#page-rules):

| Field | Value |
| --- | --- |
| `Question` | the name of the surprise's question ([§question-names](evidence.md#question-names)) |
| `Basis` | the first twelve hexadecimal digits of the surprise's basis digest |
| `Verdict` | the verdict it recommends: `model wrong`, `property wrong`, `abstraction too coarse` or `real finding` ([decisions.md §rulings](decisions.md#rulings)) |
| `Level` | `implementation`, `specification` or `requirement` |
| `Weaker` | the keys of its weaker forms, from the strongest to the weakest, separated by `, `; or `none` |

- `## Trace`: the trace in the developer's terms, a few sentences in the brief's words,
  naming no operator, file or line of a model, since the developer reads it at
  Decide beside code's rendering;
- `## Failure shape`: its failure shape, written the same way;
- `## Mechanism`: the mechanism that failed: what the engine did and where in the
  model, briefly.

A weaker form holds what the claim's encoding slot on that model holds
([engines.md §slot-forms](engines.md#slot-forms)); its `<key>` follows
[forms.md §page-rules](forms.md#page-rules)'s key rule, and its `<ext>` is the
encoding's. After the door's own checks, which refuse an answer from one of the
authors of the surprise's model ([door.md §forma-answer](door.md#forma-answer);
M237), code accepts it only when all of these hold, and otherwise refuses it,
naming every check that fails (M233, M239):

1. `explain.md` parses into this form, the folder holds nothing else but weaker
   forms, and `Weaker` names each of them once and nothing else;
2. `Question` and `Basis` name an open surprise
   ([§surprise-file](evidence.md#surprise-file)) that has no accepted
   explanation;
3. it gives weaker forms for a surprise on a `base` question of a TLC or Alloy
   model that found a violation of the encoding's own property, at least one, and
   for no other, since a type invariant violated first fails every weaker form
   alike, and each passes the checks
   [models.md §slot-answer](models.md#slot-answer) makes of an
   encoding's text for that claim on that model.

Accepted, code writes `explain.md` as `<stem>.explained.md` and each weaker form
as `<stem>.weaker-<key>.<ext>` beside the surprise
([§stems](evidence.md#stems)), each with its receipt line
([door.md §receipts](door.md#receipts)), and runs each weaker form
([§weaker](evidence.md#weaker)). The explanation goes with its surprise; the
ruling's showing keeps it ([§at-ruling](evidence.md#at-ruling);
[decisions.md §rulings](decisions.md#rulings); M50, M211–212, M233).

<a id="rerun"></a>

## Running again where a machine lacks a run

The tracked files keep no engine output and no state's values (M56–59). When
[door.md §gives](door.md#gives)'s packet for an Explain item needs the engine's
output of the surprise or of one of its reductions, and `runs/` on this machine
holds no run of it, in its question's folder for the surprise and in its own for
a reduction, whose basis digest is the one its file holds, Forma runs it again
first, within the limits its file names, writing only that folder in `runs/`. It
is composed as [engines.md §composition](engines.md#composition) composes its
question from the files as they stand, which the freeze keeps as they were
([models.md §freeze](models.md#freeze)), a slot owed again included and whether
or not the model is usable now; when it cannot be composed at all, as when a
file it needs counts for nothing, the packet holds no engine output and
`forma give` prints why ([door.md §gives](door.md#gives)). That run regenerates
what `runs/` would hold, examines nothing new, spends nothing, changes no
tracked file and opens nothing (M56–59, M233). When a generated file composed
now differs from the one its file's basis names, as after a lifecycle it read
changed, the run still happens, and the packet names each such file, so the
agent knows it may be explaining inputs that differ from those that ran.

<a id="forma-run"></a>

## `forma run`

`forma run [--json]`, on the project folder as every command is
([project.md §commands](project.md#commands)). It runs, on this machine, what is
owed a run, within the runs left, until nothing is owed or no run is left
(M191–192, M239–240). Agents and the developer run it; it declares no session,
since it is neither an answer nor a decision (M189).

**Owed a run**, each an item [account.md §items](account.md#items) names
(M264–267):

- a question asked now ([§questions](evidence.md#questions)) whose evidence is
  missing or not current ([§currency](evidence.md#currency));
- a question whose current evidence is `unanswered` at limits smaller than its
  engine's now ([§limits](evidence.md#limits));
- a question whose evidence answered and does not match, whose surprise has
  neither a file nor a ruling naming it ([§surprise-file](evidence.md#surprise-file));
- the next reduction of each open surprise, while
  [§reductions](evidence.md#reductions) gives one;
- each weaker form of an accepted explanation not yet run
  ([§weaker](evidence.md#weaker));

but never a question whose surprise is open
([§surprise-file](evidence.md#surprise-file)), one in progress here
([§in-progress](evidence.md#in-progress)), one whose evidence or open surprise a
later Forma wrote ([§versions](evidence.md#versions)), one on an engine whose
toolchain is missing or does not match ([§toolchain](evidence.md#toolchain)),
one whose engine is allowed no time or memory ([§limits](evidence.md#limits)),
or one that cannot be composed, as when a file it needs counts for nothing
(M145–147, M166–168).

**What it does.**

1. Holding [door.md §lock](door.md#lock)'s writer's lock, it reads the project
   as every read does, with the checks of every read
   ([door.md §read-checks](door.md#read-checks)), and the decisions in force;
   removes each closed surprise's file and the files sharing its stem
   ([§at-ruling](evidence.md#at-ruling)); composes what is owed, in byte order
   of names; and lets the lock go while the engines run.
2. It runs them as [§running](evidence.md#running) says, several at once where
   [§limits](evidence.md#limits) lets it, a run alone by itself. A run that
   spends counts one against the runs allowed here as it starts, and starts only
   while a run is left ([door.md §spent](door.md#spent); M239–240); a run owed
   only by a change of version ([§versions](evidence.md#versions)) spends
   nothing, and starts whether or not a run is left.
3. When each ends, holding the lock again, it writes what
   [§written](evidence.md#written), [§surprise-file](evidence.md#surprise-file)
   say, when the question is still owed and its inputs are those it ran on, and
   the run did not run out of time beside another
   ([§limits](evidence.md#limits)); otherwise it writes nothing for it.
4. It composes what that leaves owed, a reduction after a surprise, the next
   reduction, a retry alone ([§limits](evidence.md#limits)), and goes on.

When no run is left, what is still owed waits for the developer, who allows more
([account.md §waits](account.md#waits);
[decisions.md §intake](decisions.md#intake); M239–240). Before the
intake none is allowed.

**Reads** the project's tracked files, `runs/`, the allowance spent and the
writer's lock in `work/`, and the clock. **Writes** under `models/` the
evidence, surprises and reductions' and weaker forms' evidence
[§written-moved](evidence.md#written-moved), [§surprises](evidence.md#surprises)
write, and removes closed surprises' files; `runs/<name>/` for each run; and the
runs spent here (M51, M56–60).

**Output** as [presentation.md §run-output](presentation.md#run-output) gives.
Exit status 0 (M59–60, M264–267).

**Refuses**, running and writing nothing, printing each reason, with exit status
1, or with `--json` printing `{"refused": [<reason>, ...]}`: a tracked time more
than a minute ahead of this machine's clock
([door.md §clock](door.md#clock); M52); and what
[project.md §commands](project.md#commands) says every command refuses.
