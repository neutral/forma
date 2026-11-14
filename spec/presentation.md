# What Forma shows

Spells out [SPEC.md](SPEC.md) for what Forma shows and prints: the showing a
decision is made on, the reading, a trace rendered as a journey, what each
command prints, as text and as JSON, and the explorer's page. What each command
does, reads and refuses is its own contract's; what the account, the basis line
and the box hold is [account.md](account.md)'s. Nothing here is pinned: a
decision pins canonical text, never a showing
([design.md §pins](design.md#pins)). `M<n>` is line n of [SPEC.md](SPEC.md).

<a id="showings"></a>

## Showings

- Forma shows what each decision is on before it is made (M189), and the decision
  pins the canonical text of what was shown (M161–162); `## Shown` keeps the
  showing as it was (M53).
  Nothing is preselected: each choice is given or asked explicitly, and an agent's
  recommendation is shown as one (M76, M204).
- A showing is plain text. Its first line names the decision: its kind and what it
  is on. Then come blocks, each a first line at the margin that names it, and
  further lines indented by two spaces:
  - the actions, the first block when the showing's entries name any, so each
    action's sentence and guard are shown once: `Actions:`, then one line per
    action they name, in the order of entry names,
    `<part>/<action> | <Sentence> | <Cases> | <Guard>`, as its row of
    `actions.md` writes them;
  - the premises, after the actions or first when there are none, when the
    `Rests on` of the showing's entries name a premise that has no block of its
    own in the showing, so each premise's statement is shown once: `Premises:`,
    then one line per such premise, in the order of their names,
    `<name> | <statement>`: a premise's
    page by its entry name, `<part>/premises/<key>`, and its Statement; a
    premise code adds by its name, `store:<part>/<row>` or
    `choice:<part>/<choice>`, and what the pins of
    [design.md §pins](design.md#pins) read it
    as, `store <the row's Names>` or `choice <the choice's Question>`;
  - an entry: its kind and name, then one line per field, `<Field>: <value>`, in
    the order of its form, and each row of a table as one line, its cells
    separated by ` | `; every reference replaced by what it names as
    [design.md §pins](design.md#pins)'s pins
    replace it, but an action, which a field, a cell or a step names by its key,
    or as `<part>/<action>` when it is another part's, its sentence and guard
    being in the actions block, and a premise, which `Rests on` names by its
    name, its statement being in its own block or the premises block
    (M161–162);
  - a lifecycle's block also holds its table and its picture as
    [lifecycle-tool.md §as-read](lifecycle-tool.md#as-read) draws
    it, so it is shown as one table and drawn (M193–194); a cell a pick in force
    fills shows as `choice <key>, picked <a or b>: <outcome>`, so the showing
    holds what the pin holds, the cell as posed, and what the pick makes of it;
  - a passage, a block of its own: `Cites <address>:`, then its text, each line
    indented by two spaces as every block's are; a passage cited again in one
    showing is named by its address alone (M193–194);
  - a slot, a block of its own: `Slot <path>:`, then the text of its file, each
    line indented by two spaces as every block's are
    ([decisions.md §rulings](decisions.md#rulings)).

  Each kind adds what [decisions.md §intake](decisions.md#intake) to
  [decisions.md §redirect](decisions.md#redirect) say. The intake and an
  allowance show only their own choices.
- **The change since a lapsed decision.** When what a decision is on has a
  lapsed decision ([decisions.md §in-force](decisions.md#in-force)), the showing
  ends with the change since it: that decision by name and `At`; each premise
  that reads otherwise than its `## Shown` held it, once, as one change: its
  line of the premises block as `<name>: <as it read> → <as it reads now>`, or
  its own block with the lines it lost and the lines it gained; and under it, by
  their first lines, the blocks whose `Rests on` names it, in which its change
  does not show, since they name it by its name; each other block that reads
  otherwise, with the lines it lost and the lines it gained, the premises block
  among them for a premise named now and not then, or then and not now; each new
  block, by its first line; each block that is gone, as it read; and the count
  of blocks that read as they did, which are not repeated. So a premise whose
  statement changed shows once, not under every claim resting on it. What the
  lapsed decision showed stays whole in its file, which the showing names
  (M224).
- **The token** is the SHA-256 of the showing, a line feed, and the pin of each
  decision it would record, one per line. `forma show` prints it
  ([decisions.md §forma-show](decisions.md#forma-show)) and `forma decide` takes
  it back ([decisions.md §forma-decide](decisions.md#forma-decide)).

<a id="reading"></a>

## The reading

`forma account` gives the reading: for the project, for one part or span, or for
one thing with its decisions wherever they sit (M272–274). It reads part by part
and by exception: what is not established comes first (M272–273). Every entry is
shown by its name in the developer's terms with its entry name beside it, an
addition marked as one (M81–82); a heading that holds nothing is absent.

**For the project,** in this order:

1. *On this machine*: for answers and for runs, how many are left, of how many
   allowed, and how many were spent here; for each engine, the time and memory one
   run may take (M219, M239–240).
2. *Models*: each model, its engine and its parts; each journey rule it fails
   ([account.md §journey-rules](account.md#journey-rules)); the items read under
   it, `model:` and those of its phases and facts questions; and each open
   surprise on those questions, rendered as
   [§rendering](presentation.md#rendering) renders it. A claim on a model that
   fails a rule names the condition `conforming` with the number of rules its
   model fails, which the model's entry lists, beside its other failing
   conditions (M131–135, M260, M264–265).
3. *The project*: coverage, as how many passages are covered of how many there are
   (M79–81); the decisions in force on the project as a whole, with each decision a
   later one overrides marked superseded (M224); and the items read under the
   project.
4. Each part and each span, in the reading order `design/README.md` gives
   ([forms.md §reading-order](forms.md#reading-order)), under the headings below
   (M272–273).
5. *What it cannot know* ([account.md §cannot-know](account.md#cannot-know)).

**Under each part or span,** in this order, and within each heading in the order
its `README.md` gives, each heading and what it holds:

- **Open**: each claim neither established nor accepted
  ([account.md §basis-line](account.md#basis-line)), with its standing on each
  model covering its parts ([account.md §standing](account.md#standing)), each
  condition that fails with the items that supply it, or its reason where none
  does ([account.md §basis-line](account.md#basis-line)); each journey that does
  not conform on a model covering its parts, with which of its questions fail;
  each open surprise on a question read here, shown as a journey as
  [§rendering](presentation.md#rendering) renders it, with what it waits for;
  every other item read here, as [account.md §waits](account.md#waits)'s
  settings group and show them, an item that a lapsed decision opened showing
  what changed since that decision was made, as
  [§showings](presentation.md#showings) shows a lapse (M264–267, M272–273)
- **Accepted**: each claim accepted
  ([account.md §basis-line](account.md#basis-line)), with the acceptance in
  force, who made it and when, and what fails on each model covering its parts
  (M218–219)
- **Established**: each claim established, with its basis line for each model it
  is established on, the mechanisms real-finding repairs added to that model
  under its basis ([account.md §basis-line](account.md#basis-line),
  [§box](account.md#box)), and what fails on each other model covering its
  parts; each journey that conforms on every model covering its parts (M269–272,
  M276–281)
- **Assumed**: each premise of the part or span (its premise pages, its store
  rows' premises, the strikes on its world rows, its choices' premises, and its
  claims' bounds on each model; a span's premise under each of its two parts):
  its statement, class, falsifier and provider, the claims that rest on it, and
  the carry or pick in force with who made it and when, or that none is, shown
  here once, the claims' lines naming it by its name
  ([account.md §basis-line](account.md#basis-line))
- **Decided**: each decision in force on what the part or span holds, wherever
  it is filed, by its kind and choice; each decision a later one overrides,
  marked superseded, with the one that overrode it (M224)
- **Left out**: each omission, with its reason and whether it is confirmed (M77)
- **Lifecycles**: each lifecycle with its table, its picture
  ([lifecycle-tool.md §as-read](lifecycle-tool.md#as-read)) and the tool's
  findings on it ([lifecycle-tool.md §findings](lifecycle-tool.md#findings)),
  each phase classed by those findings: `in conflict` where a lifecycle conflict
  ([lifecycle-tool.md §findings](lifecycle-tool.md#findings)) concerns it;
  otherwise `initial` for the lifecycle's initial phase, which needs no journey
  to reach it; otherwise `covered by a confirmed journey`, only where a
  confirmed journey reaches it
  ([lifecycle-tool.md §stepping](lifecycle-tool.md#stepping)); otherwise `open`;
  and as reached when a witness on the part's lifecycle model names it and its
  current evidence reached it; and each journey of the part stepped through the
  lifecycles, its moves lit (M70, M193–198)

**Where an item is read.** Under the part or span to which what it is about
belongs: a thing, unit, premise, row or action to its part or span; a slot, a
question or a surprise to the part or span of what it serves; a decision or another
file to the part or span whose folder, under `design/` or under a model, holds it.
`model:` and the items of a model's own questions (its phases and facts) are read
under the model; `span:` under the project and under each of its two parts; any
other item under the project (M178–180, M272–273).

**For one part or span** (`forma account <part or span>`): this machine's
allowance; the models covering it, with the rules they fail; that part or span
under the headings above, with the items read under it; and
[account.md §cannot-know](account.md#cannot-know).

**For one thing** (`forma account <part or span>/<kind>/<key>`, `<kind>` being
`lifecycles`, `journeys`, `claims`, `premises` or `choices`, a journey code adds
included under its reserved key): its page as design.md reads it; for a claim,
its standing on each model with its basis line or what fails, each premise it
rests on, once, with its statement, class, falsifier and carry, since one
thing's reading has no Assumed
([account.md §basis-line](account.md#basis-line)), and every carry that names it
as its basis; for a journey, its conformance on each model; for a lifecycle, its
table, picture and facts; for a premise, the claims that rest on it; the
evidence of each of its questions on each model, with its outcome and whether it
is current; every item about it; and every decision on it wherever it is filed,
as [decisions.md §in-force](decisions.md#in-force) finds a thing's decisions,
each marked in force, lapsed or superseded (M224, M272–274). A removed thing's
folder keeps its decisions, and its reading lists them.

**Text** is Markdown: a level-1 heading naming what is read, the project or a part,
span or thing by its name; a level-2 heading for each numbered section of the
project's reading and for each part and span, by its name, and a level-3 heading
for each of the seven headings above, as the list names them; for one thing, a
level-2 heading for each of its page, its standing or conformance, what rests on
it, its evidence, its items and its decisions, in that order; one list item per
entry (M272–274).

**JSON.** `forma account --json` gives the same content as one object (M54,
M272–274):

- **`scope`**: `project`, the part's or span's key, or the thing's
  `<part or span>/<kind>/<key>`
- **`here`**: this machine's allowance: `answers` and `runs`, each `allowed`,
  `spent` and `left`; `engines`, each engine's time and memory for one run
- **`models`**: each: `model`, `engine`, `parts`, `conforms` (`true` or
  `false`), `fails` (each `rule`, `on`, `found`, `items`, as
  [account.md §journey-rules](account.md#journey-rules) names them)
- **`project`**: `coverage` (`passages`, `covered`), `decided`, `items`
- **`parts`**: each part and span in reading order: `ref`, `name`, `span`
  (`true` or `false`), and `open`, `accepted`, `established`, `assumed`,
  `decided`, `leftOut`, `lifecycles`, each the list of entries its heading holds
- **`thing`**: for one thing: `page` (absent for a removed thing), its entry
  below as a claim, journey, lifecycle, premise or choice, `premises` (for a
  claim, each premise it rests on, as a premise's entry), `carries` (for a
  claim, those naming it as their basis), `evidence` (each `question`, `model`,
  `outcome`, `current`), `items`, `decisions`
- **`cannotKnow`**: [account.md §cannot-know](account.md#cannot-know)'s
  sentences

Each entry, and its keys:

- **claim**: `ref`, `name`, `sentence`, `kind`, `stake`, `standing`, `models`
  (each `model`, `standing`, `fails` (each `condition`, its `items`, but for
  `conforming` the number of rules the model fails, and its `reason` where
  [account.md §basis-line](account.md#basis-line) gives one), `bounds`,
  `premises` (each `premise`, by its name, and `carried`, `true` or `false`),
  and `basis` when established); `acceptance` (`decision`, `words`, `by`, `at`)
  when one is in force
- **basis**: `bounds` (each `bound`, `value`, `meaning`; or `phase level`),
  `faults` (each `question`, `mechanism`), `witnesses` (each `question`,
  `meaning`, `journey`), `premises` (each `premise`, by its name, as
  [account.md §basis-line](account.md#basis-line) gives it), `mechanisms` (as
  the box gives them, [account.md §box](account.md#box)), `evidence` (each
  question's `question` and, as evidence.md names them, its versions, kind of
  search, limits, measures and flags, with `clearedBy` naming the questions that
  cleared each flag), `fairness`
- **journey**: `ref`, `name`, `models` (each `model`, `conforms`, `fails`)
- **surprise**: `surprise`, `question`, `journey` (as
  [§rendering](presentation.md#rendering) renders it), `waits`
- **item**: as [account.md §commands](account.md#commands) gives it
- **premise**: `premise`, `statement`, `class`, `falsifier`, `claims` (those
  resting on it), and `carry` (`decision`, `by`, `at`) or `pick`, when one is in
  force
- **decision**: `decision`, `path`, its fields as
  [decisions.md §decision-file](decisions.md#decision-file) gives them,
  `state` (`in force`, `lapsed`, `superseded` or `revoked`), `supersededBy` when
  superseded, and `revokedBy` when revoked: for a pick, what is revoked is its
  carry, and its `state` for its journeys and cells stays `in force`
- **choice**: `ref`, `name`, `question`, `recommendation`, `alternatives` (each
  `a` and `b`, as a journey's entry with its `effects`), and `pick` (`decision`,
  `choice`, `by`, `at`) when one is in force
- **omission**: `passage`, `reason`, `confirmed`
- **lifecycle**: `ref`, `name`, `table`, `picture`, `facts` (the tool's findings
  on it), `phases` (each
  `phase`, `class`, `reached`), `journeys` (each journey's `ref` and the moves
  it lights)

<a id="rendering"></a>

## Rendering a trace as a journey

Code renders a trace as a journey in the developer's terms whenever it shows
one, from what the evidence or the surprise holds
([engines.md §trace](engines.md#trace)), so it shows what the trace meant when
it ran (M201–203). The account and the decisions show it
([§reading](presentation.md#reading), [§showings](presentation.md#showings)).

- **Taking a misbehaviour.** A trace takes a misbehaviour at each step whose row
  is that misbehaviour's: on TLC, the row the engine names; on Alloy, which
  shows every row whose predicate holds for a step, each Misbehaviours row that
  holds for a step no Actions row holds for. So both engines read a step alike:
  TLC, whose next-state relation lists the actions first, names a misbehaviour
  only for a step no action takes.
  [evidence.md §sent-back](evidence.md#sent-back) reads this, and
  [decisions.md §rulings](decisions.md#rulings) groups by it.
- **Steps.** Each step shows the row that took it, as `rendered` holds it: an
  action by its sentence, a world row by its names and the menu item; on Alloy,
  each row whose predicate holds for it, or that no row of the tables takes it. A
  fault's step of the faulted action shows the action's sentence and the mechanism
  the fault removes. A step the engine names outside the tables shows the
  operator's name. The first state shows every entity's phase; each later state
  shows the entities whose phase changed, or that none did. A trace without phases
  or bindings says why ([engines.md §replay](engines.md#replay)).
- **The refused step.** A `refusal` surprise is rendered through its refused
  step, shown as enabled where the journey says it must be refused. On TLC, whose
  trace ends in the state where that step is enabled, the step follows the
  trace's last state, as the journey's content in `rendered` gives it, its action
  by its sentence; on Alloy, whose run takes the step, the trace shows it as it
  shows every step (M201–203).
- **Lit on the lifecycles.** The journey is lit on the lifecycles the developer has
  confirmed when it is shown, since evidence keeps no picture: for each lifecycle
  confirmed then whose entity the trace holds, its picture
  ([lifecycle-tool.md §as-read](lifecycle-tool.md#as-read)) with
  each phase it holds `visited` and each move it takes followed by the numbers of
  its steps, and the step by which a trace loops back marked as that. A step of
  one of the lifecycle's actions that leaves its entity's phase as it was marks
  the move its cell gives in place when the trace holds one entity of the
  lifecycle; with several, which one it acted on is not told, and it marks none.
- **What it says.** The rendering says what the evidence is, in
  [evidence.md §result-says](evidence.md#result-says)'s words, with the bounds
  it ran at and the kind of search ([evidence.md §search](evidence.md#search)).
  A surprise is shown with its kept reductions' traces, ordered by their number
  of steps, fewest first, the surprise's own last among equals and a later
  reduction before an earlier one; with its weaker forms' outcomes and the
  weakest that fails ([evidence.md §weaker](evidence.md#weaker)); and with its
  accepted explanation beside it, as an aid (M148, M233).
- **A witness's journey.** A claim's witness question that reached its target
  keeps its trace ([engines.md §trace](engines.md#trace)); so rendered, it is
  the journey that reached the witness, by which the basis line names it
  ([account.md §basis-line](account.md#basis-line); M269–271).

<a id="outputs"></a>

## What each command prints

<a id="give-output"></a>

### `forma give`

**Prints** `gave <item> into <folder>`, then each file's path in the folder, one
a line, in byte order, then each path `item.json` names in `differ`
([door.md §gives](door.md#gives)), then, where the run an Explain item needs
cannot be made, `no run of <surprise> could be made on this machine: <why>`.
With `--json`:
`{"item", "folder", "files": [{"path", "sha256"}], "differ": [<path>]}`, with
`cannot`, the reason, where that run cannot be made; `folder` absolute, `files`
in byte order of path.

<a id="answer-output"></a>

### `forma answer`

**Prints** `accepted <item>` or `refused <item>`; then `wrote <path>` for each
file written and `removed <path>` for each file removed, by its project path and
in byte order as `--json` lists them, so an agent tells the two apart, as
`forma decide` and `forma run` print a removal
([decisions.md §forma-decide](decisions.md#forma-decide),
[evidence.md §forma-run](evidence.md#forma-run)), or each reason as
`<file> <entry> <field>: <says> (<check>)` without what is `null`; then
`answers: <spent> spent of <allowed>` (M236, M239–240). With
`--json`: `{"item", "kind", "accepted", "written": [{"path", "sha256"}],
"removed": [<path>], "reasons": [<reason>], "answers": {"spent", "allowed"}}`,
paths in byte order; refused before it counts (an argument, the clock rule, the
allowance), `{"refused": [<reason>, ...]}`.

<a id="show-output"></a>

### `forma show`

**Prints** the showing ([§showings](presentation.md#showings)), then
`This decision takes:` and one line for each option the kind takes with the
values it allows ([decisions.md §forma-decide](decisions.md#forma-decide)), then
`shown: <token>`; for the intake and an allowance, the options and no token.
With `--json`, one object: `kind`; `on`, a string, or a list when several;
`shown`, the showing's text; `takes`, the option lines; `pins`, the pin of each
decision it would record; and `token`, absent for the intake and an allowance.

<a id="decide-output"></a>

### `forma decide`

**Prints** the path of each decision recorded, then each page written, then
`removed <path>` for each file removed, as `forma run` prints a removal
([evidence.md §forma-run](evidence.md#forma-run)); with `--json`,
`{"recorded": [...], "written": [...], "removed": [...]}`.

<a id="run-output"></a>

### `forma run`

**Prints** each line as soon as what it says has happened, so a long run shows
its progress while it runs:

- one line per run, printed as the run ends, `<name>: <found>, <match>,
  <duration> ms, <written>`, where `<found>` is the outcome with its property or
  step, or with its reason where it has one
  ([evidence.md §keys](evidence.md#keys)); `<match>` is `as expected`,
  `not as expected` or `no expected outcome`; and `<written>` is `wrote` or
  `wrote nothing`, followed by `, spent nothing` for a run that spent nothing;
- `surprise <surprise name>` for each surprise opened, as it is written;
- `removed <path>` for each file removed, as it is removed;
- `not run <name>: <reason>` for each owed and not run, as Forma decides not to
  run it, the reason one of `no run left`, `in progress here`,
  `written by Forma <version>`, `<engine> toolchain: <why>`,
  `no limit for <engine>` and `it cannot be composed: <why>`;
- last, once nothing is left to run, `runs: <n> spent here, <n> left`.

With `--json`, one object, printed once the command has ended: `ran`, a list of
`{ "name", "found", "matches", "duration", "wrote", "spent" }`; `opened`, the
surprises' names; `removed`, the paths; `skipped`, a list of
`{ "name", "reason" }`; and `runs`, `{ "spent", "left" }`.

<a id="missing-output"></a>

### `forma missing`

**Prints** a level-2 heading for this machine's allowance and for each group,
and one list item per item: its name, who supplies it and what it waits for,
with this machine's reasons beneath. With `--json`: `here` (as
[§reading](presentation.md#reading)'s) and `items`.

<a id="account-output"></a>

### `forma account`

**Prints** the reading, as text or with `--json`
([§reading](presentation.md#reading)).

<a id="box-output"></a>

### `forma box`

**Prints** the box ([account.md §box](account.md#box)) as Markdown. With
`--json`: `claims` (each `ref`, `name`,
`sentence`, `standing`, and `models`, each `model`, `bounds`, `premises` and
`mechanisms`, each `mechanism`, `ruling`, `brief`, one of `stated`, `accepted` and
`not stated`, and `passages`, the addresses, for `stated`, or `words` for
`accepted`; or `acceptance` and `premises`), `premises` (each `premise`,
`statement`, `falsifier`, `decision`, `by`, `at`, or `pick`) and `cannotKnow`
(M276–281).

<a id="diff-output"></a>

### `forma diff`

**Prints** the five lists under level-2 headings in
[account.md §diff](account.md#diff)'s order, each group of the first four under
a level-3 heading naming its change. With
`--json`: `from` (`commit`, the commit's full name, or `folder`); `stale`,
`changedOutcome`, `opened` and `closed`, each a list of groups: `change`, with
`kind`, `ref`, `then` and `now`, and `lines`, each with `kind`, `ref`, `then` and
`now`, an item or surprise's `ref` being its name; `waiting` (items); and
`cannotKnow` (M181–185).

<a id="explore-output"></a>

### `forma explore`

**Prints** the graph, as JSON alone
([account.md §explorer-graph](account.md#explorer-graph)).

<a id="explorer"></a>

## The explorer

The explorer shows one page, its reading of the project, from
[account.md §explorer-graph](account.md#explorer-graph), served or exported as
[project.md §explore](project.md#explore) says. It decides no standing, cause,
link or summary: every fact it shows is the graph's, and it reads no project
file (M37–38, M54, M269–286).

**The document.** The brief's documents as written, one after another, each
under a title with its number and path: first the document named `overview`,
`readme` or `index`, or else the first by path; then each document that one
links to, in the order of its links; then the rest by path. A link from one of
the brief's documents to another moves to that document on the page. Supplied
sources and a document's front matter are not shown (M48, M79–82).

**Notes.** Beside each passage stand its notes, holding only what is first met
there. An entry or a boundary row is met at the first passage it cites, in that
reading order; a ruling, at the first passage cited by an entry that one of its
surprises' questions serves. In this order (M79–82, M193–222):

- **`found`**: each ruling of verdict *real finding* met here, by its revision
  mark and the entry it is on, with each mechanism its repair added and
  `the document states it`, `not in the document, accepted` or
  `not in the document`
- **`corrected`**: each ruling met here of verdict *property wrong* or
  *abstraction too coarse*
- **`left open`**: each choice met here, with the pick in force and the picked
  alternative's expected end, or `unsettled`
- **`left out`**: each omission of the passage, with its reason, and its
  confirmation unless it is confirmed
- **`must hold`**: each claim met here, with its standing mark
- **`assumes`**: each premise page met here, marked `not taken on` while no
  carry of it is in force
- **`restated`**: how many actions, lifecycles, scenarios, and actors and
  records are met here, and how many of them have `Origin` `added`, as
  `beyond the text`; where none is met here, how many were restated above. It
  opens the passage's restatement
- **`also above`**: how many claims, assumptions and open questions cite the
  passage and were met above, opening their names

A ruling of verdict *model wrong* is listed only under Examination.

**Revisions.** Each ruling of verdict *real finding* is a revision of the
design. Revisions are numbered from 1 in reading order of where each is met,
then by time. A revision's mark is a triangle holding its number; it stands
beside the ruling wherever the ruling is named, and the title block lists every
revision with a link to its passage and its date (M201–214, M276–281).

**Opening.** A name opens what it names, in place. From a passage's notes or
from a list at the end, it opens under that passage or list, one at a time.
From inside an opened thing, it opens under the line that names it. An opened
thing shows its kind, its name and the passages it cites, each a link, and has
a close of its own (M272–274).

Each thing, and what it shows:

- **a passage's restatement**: each action that cites the passage, by its
  sentence; each lifecycle, drawn, with its table behind a fold; the scenarios
  that should happen and those that must not, each with the mark of any revision
  on it; the actors and records. A thing met above is grey, and each with
  `Origin` `added` says `beyond the text`
- **claim**: sentence, kind and stake. Its standing in one line:
  `Established on <models>, within bounds`, `Accepted, unexamined`, or
  `Not established · waits on` each thing its failing conditions' items name,
  once. Then each model that covers it: the model's bounds as its rows write
  them, or `phases only`; `seven conditions hold`, or what is in place and what
  is not yet, with what that waits on where it differs from the claim's line; or
  `cannot express` with the encoding's reason and nothing more. Its encoding,
  behind a fold. Its checks. Its premises there, behind a fold, each marked
  `not taken on` while not carried. Then the rulings on it, and the decisions on
  it
- **scenario**: whether it should happen or must not; its steps, the refused one
  marked, and its expected end; the lifecycle tool's walk, labelled
  `lifecycle, phases only, no standing`; each lifecycle it moves, drawn with its
  path lit; its checks on each model; the rulings on it; the decisions on it
- **action**: sentence, actor, guard and cases; on each model its operator and
  its checks; each fault that names it, by its mechanism and its claim; the
  scenarios that use it; the decisions on it
- **lifecycle**: drawn, with its table behind a fold; each model's phase
  expression; the scenarios that walk it; the decisions on it
- **open question**: the question; its two alternatives as scenarios, the picked
  one marked; the recommendation; the decisions on it
- **assumption**: statement, class and why it is not examined; `falsified by`;
  `answered by`; `taken on`, by whom and when, with the carry's words where they
  are not its falsifier, and earlier decisions behind a fold; the claims it
  holds up
- **actor or record**: names, kind, side, seam and isolation; on each model that
  has misbehaviours of it, their checks; the decisions on it
- **ruling**: its revision mark, verdict, level and what the verdict says; each
  surprise's expected and found outcome; its words, behind a fold unless it is a
  real finding; where its repair went; each mechanism added, with its brief
  status and the words of an acceptance; what was shown, behind a fold
- **model**: parts and name; its engine; its bounds with their meanings, or
  `phases only; guards unevaluated`; each world row's misbehaviours; its checks
  counted by outcome; each journey rule it fails, with what that waits on; the
  revisions that changed it

A claim not established has a dashed line down its left; every other opened
thing a solid one, a revision's in red (M253–262, M269–281).

**Checks.** A check is one question with its evidence. It shows its mark, its
kind in the words below, a fault's `Mechanism` or a witness's `Meaning`, its
outcome, its engine's own measures, its kind of search, when it ran and its
flags; a kept trace is behind a fold, `path`, as its rendered lines. The outcome
is `caught` for a fault found as expected, `did not finish` with the reason for
an unanswered one, `not run` where there is no evidence, and otherwise the found
outcome, with the expected one where they differ. A check that is not asked now
and did run is listed under `earlier model`, with the mark `·` and never `✓`;
one asked now and not current gives its currency reasons (M127–142, M166–175).

**The lists.** After the documents come four lists, each thing once
(M253–286):

- **Claims**: a schedule by part or span: each claim with its standing mark,
  `established on <models>`, `accepted, unexamined` or what it waits on, and the
  passage where it is met. Where every claim of a part or span stands alike, the
  part's row says so once
- **Assumptions**: a schedule of every premise that is carried or counted: its
  statement, who answers for it, how many claims rest on it, most first, and
  `not taken on` where it is not carried. Bound premises come by model, under a
  row with the model's bounds and how many of them are taken on
- **Examination**: each model with its engine, its parts and how many claims are
  established on it; each ruling that is no real finding, by what it corrected;
  and how many decisions each declared maker made
- **Limits**: [account.md §cannot-know](account.md#cannot-know)'s sentences,
  always shown

**The top.** The project's name; the general notes; links to each document and
list; and the title block. The general notes are numbered and say, each once:
how many claims are established, `within bounds` where any is; for each set of
claims that wait on the same things, how many wait on what; how many are
accepted; how many revisions there are and how many mechanisms they added that
the document does not state; how many assumptions are taken on, `unchecked`; and
who made the decisions, `declared`. The title block has a cell each for the
project, the standing, when the reading was computed, the build (Forma's
version and source, and each engine's version), the sheets (how many documents,
parts, spans, actions, lifecycles and scenarios), and the revisions
(M269–286).

**Standing.** The standing cell switches the whole reading between
`as recorded`, which is shown first, and `here`
([account.md §explorer-graph](account.md#explorer-graph)). Where the two differ,
a cell says so: as recorded, it gives the cause that accounts for the most lines
here. A served page offers a later reading in the computed cell when one is
ready, and never replaces the one being read unasked (M166–185).

**Words.** Where the page names one of these, it uses these words:

- **entry kinds**: `claim`, `assumption`, `scenario`, `action`, `lifecycle`,
  `open question`, `left out`, `actor or record`
- **conditions**: `confirmation`, `check`, `planted defect caught`,
  `cases reachable`, `model passes its scenarios`, `assumptions taken on`,
  `no open surprise`
- **question kinds**, in the order a thing's checks are listed: `check`,
  `planted defect`, `reachable case`, `scenario runs`, `step refused`,
  `start reachable`, `lifecycle walk`, `can happen`, `world can do this`,
  `phases fit the model`, `facts admit an instance`, `weaker form`,
  `smaller rerun`
- **what an item is, after `waits on`**: `a run`, with why its evidence is not
  current where it is not; `an unfinished check` with the reason its evidence
  gives, `an unwritten piece of the model`,
  `the developer's confirmation`, `an assumption not taken on`,
  `an unsettled question`, `an unruled surprise`, `an unexplained surprise`,
  `an unmade repair`, `an engine that can express it`, `a model that covers it`,
  `a model answer`, `a confirmed scenario for a part`,
  `a mechanism unplaced against the document`, `two parts examined together`,
  `a restatement`, `a lifecycle finding`, `an unrestated section`,
  `a file that counts for nothing`, `the intake`, `an allowance`
- **decisions**: `confirmed`, `declined`, `picked`, `ruled`, `taken on`,
  `accepted without examination`, `placed against the document`, `allowed`,
  `intake`, `redirected`; a state other than in force as `lapsed`, `replaced` or
  `revoked`
- **verdicts**: `design at fault`, `model at fault`, `claim misstated`,
  `restatement too coarse`; a ruling's kind as `fault in the design`,
  `model corrected`, `claim corrected`, `restatement corrected`
- **journey rules**: `a confirmed scenario does not run as written`,
  `a part has no scenario that happens`,
  `an action or misbehaviour never happens`, `a misbehaviour not produced`,
  `phases-fit check`, `facts admit no instance`,
  `an unreached phase, action or cell`, `tables do not match the restatement`
- **engines**: `TLC · every order of events, within bounds`,
  `Alloy · every instance, within bounds`, `lifecycle engine · phases only`

**Marks.** `●` established, `◐` accepted, `○` not established or not yet; a
numbered triangle, a revision; `✓` a check as expected, `✗` one not, `·` one on
an earlier model, `×` an engine that cannot express a claim. Standing is told by
mark and word, never by colour alone. No `✓` stands beside a claim, a condition
or an assumption: a condition in place is named, and an assumption taken on is
said to be taken on (M253–262).

**No filler.** The page holds names, facts and short labels. What a mark, a
line or a word means, and how the page is read, is said only in one help
dialog, opened by `?` on the page or the `?` key (M269–274).

**The look.** A drawing sheet on white, in two inks and one red. Black is what
the developer wrote: the documents, and their words wherever a decision quotes
them. Blue is everything else: notes, names, marks, lines and pictures. Red is
only a revision, what is missing where something should be taken on, and a
scenario's walk lit on its lifecycle. Lines
carry the structure by weight: the sheet's border, with the title block ruled
into its corner; a rule drawn out from each document's title; a margin rule
between the document and its notes, ticked where each passage starts; the line
down the left of an opened thing; hairlines within; the lists as ruled
schedules. There is no pattern, texture or ornament. There are two faces: what
the developer wrote is set in a proportional sans, and everything Forma says in
a fixed-width one. The page loads no font, image or script from elsewhere
(M269–274).

**A lifecycle drawn.** Its phases stand in columns by how many moves they are
from the initial phase; one arrow joins each pair of phases some action moves
between, labelled with those actions; the actions that leave a phase where it
is are listed under it as `stays`; a cell a choice still poses is listed under
its phase as `left open`. Initial and end phases are marked. A scenario's walk
lights the moves it takes in red, each numbered by its step, and the phases it
reaches; the step it says must be refused is dashed and says so. A scenario's
picture can be stepped through: previous, next, play, pause and back to the
start, lighting the moves up to the current step. The picture is drawn from the
lifecycle as read and the walk the lifecycle tool gives; the page runs no
machine of the project's (M69–71, M193–202).

**Use.** Names, the standing switch, the help button and the folds are reached
and worked by keyboard, with focus shown. `Escape` closes the help dialog, or
else the thing opened last. A link within the page moves there and leaves the
page's address as it is. Movement is plain where the reader asks for reduced
motion (M193–202, M269–274).
