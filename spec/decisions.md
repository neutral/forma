# Decisions

Spells out [SPEC.md](SPEC.md) for the developer's decisions: who makes them and
through which command (M189, M315–320); the file each decision is and where it
is filed (M53, M224); every kind, with what it is on, what it chooses and what
it pins (M191–222); which decision is in force, and which are superseded, lapsed
or revoked (M224); how open surprises wait as decisions, how a waiting decision
is named, and the rulings on them, with their verdicts, levels, targets and kept
journeys (M143–152, M199–214); the brief decision a real finding sent to a model
owes (M208–211); what a ruling or decline expects of later answers and how that
is found to be met; and the commands `forma show` and `forma decide`. It owns
`design/decisions/`, `design/parts/<part>/decisions/`,
`design/spans/<span>/decisions/` and the `decisions/` of every thing's folder,
one file per decision. What Forma shows before each is made (M161–165, M189),
and what `forma show` and `forma decide` print, are
[presentation.md](presentation.md)'s. `M<n>` is line n of [SPEC.md](SPEC.md).

<a id="who-decides"></a>

## Who decides

- The developer is a role: whoever answers for the project's owner, a person or
  an agent given the role (M189). Decisions are made only through
  `forma decide` ([§forma-decide](decisions.md#forma-decide)), from any shell
  (M53, M315–320). Only decisions confirm, decline, pick, rule, carry, accept,
  allow or redirect (M224), and no answer holds one (M238).
- Each decision records the name its maker gives, and the session its maker
  declares: provider, model and session (M189). A decision made where standard
  input or output is not a terminal, which is how an agent runs commands,
  declares its session; one made at a terminal may (M189). Forma records both as
  given and checks neither (M286, M292).
- **The session rule, decision side** (M189). `forma decide` refuses a decision
  whose declared session has submitted an answer: a session a receipt line
  anywhere in the project names, or one this machine has seen submit
  ([door.md §sessions](door.md#sessions), which says when two sessions are one,
  and how far the rule reaches across clones). The sessions that made decisions,
  which [door.md §sessions](door.md#sessions) refuses as answerers, are those in
  the `Provider`, `Model` and `Session` rows of every decision
  ([§decision-file](decisions.md#decision-file)). When the project is read,
  the rule discounts the answer, never the decision (M247–249).
- A decision's file is never handed to an agent. What a decision says, which a
  packet may hold, is every row and section of its file but `Provider`, `Model`,
  `Session` and `By` ([door.md §gives](door.md#gives); M233–234).

<a id="decision-file"></a>

## The decision file

Each folder, and what it holds the decisions on:

- **`design/decisions/`**: the project ([§filing](decisions.md#filing))
- **`design/parts/<part>/decisions/`, `design/spans/<span>/decisions/`**: the
  part or span ([§filing](decisions.md#filing))
- **`design/parts/<part>/<kind>/<key>/decisions/`, `<kind>` one of `lifecycles`,
  `journeys`, `claims`, `premises`, `choices`;
  `design/spans/<span>/<kind>/<key>/decisions/`, `<kind>` one of `journeys`,
  `claims`**: the thing ([§filing](decisions.md#filing))

Written by Forma, through `forma decide` alone, recording the developer's
choices (M53). Read by code wherever it computes what a decision does
([§in-force](decisions.md#in-force)), and by anyone reading the project
(M42–44).

- **Never changed, moved or removed** (M224), so no agent erases a decline, a
  carry or an accepted risk by removing a thing and adding it back. Forma creates
  a folder when it first writes there. A removed thing's, part's or span's folder
  stays, holding only `decisions/`
  ([design.md §removal](design.md#removal)).
- **Name**: `<YYYYMMDDTHHMMSSZ>-<kind>-<hex>.md`: its `At` in UTC to the second,
  its `Kind`, and the first twelve lowercase hexadecimal digits of the SHA-256 of
  its bytes. A decision's name is its file name without `.md`; so the kind is in
  the name, and a ruling is told from the other decisions in a folder by it.
- **Read by its name** (M240). A file in one of these folders that does not parse
  in the form below, or whose name is not its own, is no decision: it counts for
  nothing and shows as `change:<path>` ([door.md §change](door.md#change)), as
  does a folder inside one of them. Code reads every decision in every one of
  these folders; what each does is [§in-force](decisions.md#in-force)'s.
- **`At`** is when it is recorded, in UTC to the millisecond,
  `YYYY-MM-DDTHH:MM:SS.sssZ`, and later than every time tracked in the project
  ([door.md §clock](door.md#clock)): when the clock is not past the latest, one
  millisecond after it. Decisions are ordered by `At`, and
  two of one `At` by name; the developer's latest decision, from whose commit the
  diff counts by default, is the last so ordered (M183–184).

The form, in UTF-8 with line feeds, ending in a line feed:

```markdown
# <kind> <on>

| Field | Value |
| --- | --- |
| Kind | <kind> |
| On | <what it is on> |
| Pin | <64 lowercase hexadecimal digits> |
| <each row its kind takes, §kinds> | <value> |
| Provider | <provider, or -> |
| Model | <model name, or -> |
| Session | <session, or -> |
| By | <name> |
| At | <time> |

## Words

## Surprises

## Shown

## Journey

## Kept
```

- The rows are exactly those shown and those its kind takes, in this order; every
  cell follows [forms.md §page-rules](forms.md#page-rules)'s table
  rules, and `-` marks one that does not apply.
- The sections come in this order, each only where [§kinds](decisions.md#kinds)
  says; every decision has `## Shown` (M53).
- `## Words` and `## Shown` each hold one fenced block, info string `text`, whose
  fence is a run of backticks one longer than the longest run in its content, and
  at least three. Between the fences is exactly the words or the showing,
  followed by one line feed.

<a id="kinds"></a>

## The kinds

The ten kinds (M53, M208–211):

| Kind | On | Its rows | `## Words` | Pin |
| --- | --- | --- | --- | --- |
| `intake` | `intake` | `Situation`, then the allowance's rows, then the settings' rows ([§intake](decisions.md#intake)) | what is out of scope and why; required | the SHA-256 of what `## Shown`'s fence holds, its last line feed included |
| `allow` | `allow` | the allowance's rows, then any of the settings' rows ([§intake](decisions.md#intake)) | none | the SHA-256 of what `## Shown`'s fence holds, its last line feed included |
| `confirm` | a unit ([§confirm](decisions.md#confirm)) | none | none | the unit's pin |
| `decline` | a unit ([§confirm](decisions.md#confirm)) | none | the reason; required | the unit's pin |
| `pick` | a choice, by its entry name `<part>/choices/<choice>` | `Choice`: `a` or `b` | none | the choice's pin |
| `rule` | the waiting decisions it rules, by name in name order, separated by `, ` ([§rulings](decisions.md#rulings)) | `Verdict`, `Level`, `Target`, `Target pin`, `Basis` ([§rulings](decisions.md#rulings)) | the direction its repairs are given; required | the SHA-256 of what `## Shown`'s fence holds, its last line feed included |
| `carry` | a premise ([§carry](decisions.md#carry)) | `Choice`: `carry` or `withdraw`; `Basis` ([§carry](decisions.md#carry)) | for a carry, the falsifier ([§carry](decisions.md#carry)); none for a withdrawal | the premise's pin ([§carry](decisions.md#carry)) |
| `accept` | a claim, by its entry name `<part or span>/claims/<claim>` | `Choice`: `accept` or `withdraw` | for an acceptance, why its risk is accepted without examination, required; none for a withdrawal | the claim's pin |
| `redirect` | a claim, `<part or span>/claims/<claim>`, or a new journey, `<part or span>/journeys/<key>` ([§redirect](decisions.md#redirect)) | none | the claim's new sentence, or the new journey's page; required | the pin of the unit that holds the change, as it reads after it ([§redirect](decisions.md#redirect)) |
| `brief` | a real finding's met repair on a model, `<ruling>/<model>`: the ruling by its name and the model it targets ([§rulings](decisions.md#rulings)) | `Choice`: `stated` or `accepted` | for `stated`, the address of each brief passage that states the mechanism, one a line, each of a citable passage ([design.md §passages](design.md#passages)); for `accepted`, why the difference is accepted; required | the SHA-256 of the line `Mechanism: <the mechanism>`, then, for `stated`, a line `Passage: <address> <hash>` for each passage its words name, in their order ([§rulings](decisions.md#rulings)) |

Units with their names and pins, and the pins of choices, claims and premises'
pages, are [design.md §units-and-pins](design.md#units-and-pins)'s (M161–165).
An intake, allowance or ruling whose `Pin` is not the SHA-256 of what its
`## Shown`'s fence holds is out of its kind's form, so the file is no decision
([§decision-file](decisions.md#decision-file)). A ruling also holds
`## Surprises` ([§rulings](decisions.md#rulings)) and, for `model wrong`,
`## Kept` ([§kept-journeys](decisions.md#kept-journeys)). A confirmation of an
offered journey also holds `## Journey` ([§confirm](decisions.md#confirm)).

<a id="filing"></a>

## Where each decision is filed

In the `decisions/` of what it is on; failing a folder of its own, in its part's
or span's; failing that, in `design/decisions/` (M224). What it is on, and
where it is filed:

- **a lifecycle, journey, claim, premise or choice that has a page; a claim's
  bounds on a model (`bound:`); the new journey a redirect adds, whose folder
  Forma writes with its page**: that thing's `decisions/`
- **a part's or span's stated entries; one of a part's actions, boundary rows,
  surface rows or omissions; a store premise or a strike of a part's row; a
  journey code adds (picked, offered or kept), in the part or span it belongs to
  ([design.md §code-journeys](design.md#code-journeys))**: the part's or span's
  `decisions/`
- **the part list; the intake; an allowance; a span's carry (`span:`), since no
  folder belongs to a pair of parts**: `design/decisions/`

A ruling is filed once, where this list files its first surprise's subject: the
subject of the smallest-named of its surprises
([§rulings](decisions.md#rulings)) (M152, M224). A surprise's subject is what
its question serves ([evidence.md §questions](evidence.md#questions)): a claim's
question is filed with the claim, a journey's with the journey, an action's
enabled question with the action's part, a world row's misbehaviour or enabled
question with the row's part, and a phases or facts question with the project. A
`brief` decision is filed where its ruling is
([§rulings](decisions.md#rulings)).

<a id="intake"></a>

## The intake and allowances

- **The intake** is made once, before any other decision (M191–192).
  `Situation` is one of `document a known system`, `showcase a fixed bug`,
  `localize a live bug`, `understand an unfamiliar system`,
  `change against a new requirement` and `design new`.
  `## Words` says what is out of scope and why, so statements that fail the fit
  are recorded with their reasons (M191–192). It gives the
  first allowance and the project's settings.
- **The allowance's rows** are `Answers`, `Runs`, `TLC seconds`, `TLC megabytes`,
  `Alloy seconds`, `Alloy megabytes` and `Lifecycle seconds`: whole numbers, 0 or
  more, one not given being 0. They give the answers agents may submit, the engine
  runs, and for each engine the time and memory one run may take; the lifecycle
  engine's memory is Forma's own, so it is given none (M191–192).
- **An allowance** (`allow`) adds to it: the allowance is the intake's in force
  plus every allowance's, row by row (M215–219). What is spent is counted on each
  machine, and when it is spent the items go to the developer
  ([door.md §spent](door.md#spent);
  [account.md §waits](account.md#waits); M239–240).
- **The settings' rows** are `Cadence`, one of `span`, `question` and `session`,
  and `Inbox cap`, a whole number, 0 or more. The intake gives both, `span` and
  `7` when the developer gives none; an allowance may give either again, and the
  latest intake or allowance giving one is in force.
  What they change, only how the reading groups and shows the developer's waiting
  items, is [account.md §waits](account.md#waits)'s.

<a id="confirm"></a>

## Confirm and decline

- A confirmation or decline is on one unit: the part list, a part's or span's
  stated entries together, one added entry, one lifecycle, one journey, written or
  added by code, or one omission ([design.md §units](design.md#units);
  M193–198). The entries that restate the brief outright are confirmed in one
  decision per part or span (M194–195, M296–297).
- A unit is confirmed only when no lifecycle tool finding blocks it
  ([lifecycle-tool.md §findings](lifecycle-tool.md#findings); M70): the
  developer is never asked to confirm a contradiction or a gap. It may be
  declined at any time, so a decline can clear a confirmed offered journey a
  lifecycle edit broke (M87–90, M196–198). Forma shows each entry of the unit
  beside the passages it cites, and each lifecycle as one table and drawn
  (M193–194).
- A decline's reason becomes a repair (M198; [§expects](decisions.md#expects)).
- **Offered journeys.** The lifecycle tool offers the shortest journey to each
  phase no confirmed journey reaches, judged like any other journey
  ([design.md §code-journeys](design.md#code-journeys); M195–198). A decision on
  one names it by its key, `reach-<lifecycle>--<phase>`, in `On`, a key that
  never depends on what is confirmed, and holds its pin
  ([§in-force](decisions.md#in-force)). A confirmation of one also holds it
  under `## Journey`: a heading `### <part>/journeys/<key>`, then the tables of
  a journey's page ([forms.md §journeys](forms.md#journeys)), so that once
  confirmed it is read from there (M87–90).

<a id="pick"></a>

## Pick

- A pick is on one choice, shown with its question, both alternatives, each as a
  journey with the cells it fills, the agent's recommendation and the passages it
  cites (M76, M199–204); and, for each of `a` and `b`, the journeys a pick of it
  would add, each as a journey's block under its name: `<choice>-<pick>` and,
  where the alternatives differ at one step, `<choice>-not-<other>`
  ([design.md §code-journeys](design.md#code-journeys)), so the developer reads what
  each pick confirms before making it (M199–201). `Choice` is `a` or `b`.
- While in force, a pick confirms the journeys it adds, as written
  ([design.md §code-journeys](design.md#code-journeys) gives them) (M199–201); it
  fills the cells the choice poses
  ([lifecycle-tool.md §as-read](lifecycle-tool.md#as-read)); and it
  carries the premise `choice:<part>/<choice>`, which binds the claims that rest on
  it (M201), unless a real finding revoked it ([§in-force](decisions.md#in-force)).
- A pick is refused when, with it in force, a finding that is not there without
  it would block a journey it adds or a lifecycle whose cells it fills
  ([lifecycle-tool.md §findings](lifecycle-tool.md#findings)): a finding that
  stands with or without the pick is the lifecycle's to mend, not the pick's,
  since a pick confirms what it adds, and the developer is never asked to
  confirm a contradiction.

<a id="rulings"></a>

## Waiting decisions and rulings

- **Grouping.** Two open surprises
  ([evidence.md §surprises](evidence.md#surprises)) wait for one decision when
  their claims' `Rests on` name a premise, store premise or choice premise in
  common ([forms.md §claims](forms.md#claims)), or when their traces take
  misbehaviours of one world row
  ([presentation.md §rendering](presentation.md#rendering)); grouping is closed
  under both (M152).
- **Name.** A waiting decision is named by the smallest of its surprises' names
  ([evidence.md §stems](evidence.md#stems)), compared by
  question and then by basis digest, so it is named alike on every clone and no
  two tie. [account.md §items](account.md#items) names its item from it.
- **Offered.** Forma offers a waiting decision for a ruling once each of its
  surprises is ready to be shown as M201–204 shows it: it has an accepted
  explanation, so the agent's recommendation stands beside it, and no reduction
  still to run ([evidence.md §reductions](evidence.md#reductions)), so the shortest is
  shown first (M148); a surprise that goes back to the agent first
  ([evidence.md §sent-back](evidence.md#sent-back); M148–151) is explained
  first for that reason too.
- **One ruling.** A ruling rules one waiting decision, or several the developer
  judges one matter, with one verdict, level and direction: one file, filed once
  ([§filing](decisions.md#filing)), with no copy and no link elsewhere.
- **Its rows** (M201–214):

  - **`Verdict`**: `model wrong`, `property wrong`, `abstraction too coarse` or
    `real finding`
  - **`Level`**: `implementation`, `specification` or `requirement`
  - **`Target`**: for a real finding, `brief`, a model's key, or `premise:` and
    a premise as a carry names it ([§carry](decisions.md#carry)) or
    `choice:<part>/<choice>`; `-` otherwise
  - **`Target pin`**: for a premise target, its pin when the ruling is made, a
    choice premise's being the choice's, so a revocation follows it by pin
    ([§in-force](decisions.md#in-force); M224); `-` otherwise
  - **`Basis`**: where the ruling rests on something outside Forma, a pointer to
    it with one line of premise; `-` otherwise

- A real finding at level `requirement` targets the brief.
  `property wrong` is refused for a ruling none of whose surprises is on a claim,
  since it has no claim to send its repair to (M205–206).
- **What each verdict sends** (M204–214); [§expects](decisions.md#expects) says
  when each is met:

  - **model wrong**: a Repair of each model the ruled surprises ran on, naming
    the mechanism it adds (M234), and keeps traces as journeys
    ([§kept-journeys](decisions.md#kept-journeys))
  - **property wrong**: a repair of each claim the ruled surprises are on: its
    page restated, or its encoding on each model they ran on refilled by a
    Repair answer of that model, since the encoding is the claim's slot
  - **abstraction too coarse**: a Restate repair of the parts `## Surprises`
    records
  - **real finding on `brief`**: nothing to an agent: the developer edits the
    brief, and coverage and staleness follow
    ([design.md §coverage](design.md#coverage))
  - **real finding on a model**: a Repair of that model, naming the mechanism it
    adds; once that repair is met, a `brief` decision of the developer's (below)
  - **real finding on a premise**: the revocation of its carry, or of the pick's
    carry for a choice premise ([§in-force](decisions.md#in-force)); the premise
    is owed a carry again, or the choice a pick

- **What it closes.** A ruling closes exactly the surprises it names, each a
  question's failure on one basis, and lifts their freeze (M143–147;
  [models.md §freeze](models.md#freeze)). Forma then removes each one's own
  files ([evidence.md §at-ruling](evidence.md#at-ruling)), so the ruling keeps
  what each found and showed (M211–212).
- **`## Surprises`** holds two tables:
  - `| Surprise | Question | Basis | Parts | Expected | Found |`, one row per
    surprise in name order: its name; its question; its whole basis digest; the
    parts of what its question serves, its claim's or journey's (M84–86), an
    action's or row's part, or for a phases or facts question the model's; and
    what was expected and what was found, as its evidence says;
  - `| Surprise | Entry | Pin |`, one row for each entry its basis names, with its
    pin.
- **What it shows**: each surprise as a journey in the developer's terms, lit on
  the lifecycles they confirmed, with its reductions the shortest first, its
  accepted explanation in full with the recommended verdict and level, and its
  weaker forms' outcomes
  ([presentation.md §rendering](presentation.md#rendering); M148–149, M201–204,
  M233); for a surprise on a witness, misbehaviour or path question, whether or
  not it has a trace, the slot its question asks, as a slot block
  ([presentation.md §showings](presentation.md#showings)), so what was asked is
  read in the developer's terms and not only in the explanation: a witness with
  its `Meaning` and `Target`; a misbehaviour witness with its `Target`, under
  the world row by its names and the item as the menu names it, which say what
  it asks; or the journey's schedule on that model, with its `End` and that
  end's `Meaning` ([engines.md §slot-forms](engines.md#slot-forms)); the block's
  first line followed by ` (changed since the run)` where the file's SHA-256 is
  not the one the surprise's basis names, and by ` (gone)`, with no text, where
  there is no file; then each verdict with what it sends, and the journey
  `model wrong` would keep of each surprise, or why it would keep none, since
  the ruling confirms it ([§kept-journeys](decisions.md#kept-journeys);
  M161–162, M189).
- **The brief decision** (M208–211). A real finding sent to a model leaves the
  brief describing a design without the mechanism the repair adds, so once the
  ruling's repair of that model is met ([§expects](decisions.md#expects)), and
  while the ruling is in force, it owes the developer a `brief` decision on
  `<ruling>/<model>`: that the brief now states the mechanism, `stated`, or that
  the difference is accepted, `accepted`. Before the repair is met there is no
  mechanism to name. The mechanism is the one that the receipt lines meeting the
  repair give for the ruling in their `mechanisms`
  ([door.md §receipts](door.md#receipts); M211–214).
  - `## Words`: for `stated`, the address of each brief passage that states the
    mechanism, one a line, each of a citable passage
    ([design.md §passages](design.md#passages)); for `accepted`, why the difference
    is accepted.
  - Its showing gives the ruling by its name, with its verdict, level and target
    and each of its surprises by name, question, and what was expected and what
    was found, as its `## Surprises` records them; the mechanism; each passage
    cited by an entry its `## Surprises` names, as the restatement reads now; and,
    for `stated`, each passage its words name; each passage as a passage block
    ([presentation.md §showings](presentation.md#showings)).
  - Its `Pin` hashes the line `Mechanism: <the mechanism>` and, for `stated`, a
    line `Passage: <address> <hash>` for each passage its words name, in their
    order, the hash being the passage's
    ([design.md §passages](design.md#passages)), or `missing` for an address
    that is no citable passage now; the lines are joined and hashed as
    [§carry](decisions.md#carry)'s pins are. So a changed stating passage lapses
    it ([§in-force](decisions.md#in-force)), and while none is in force the box
    says the mechanism is not in the brief ([account.md §box](account.md#box);
    M276–281).
  - It is filed where its ruling is ([§filing](decisions.md#filing)).

<a id="kept-journeys"></a>

## Kept journeys

- A `model wrong` ruling keeps, as a must-not journey, the trace of each of its
  surprises that is a claim's base question, on any engine, that found a violation
  of the claim's property or of the type invariant (M205–206),
  when the trace tells one:
  - it has at least one step: a violation in the first state is told by no
    journey, which has one step or more;
  - its steps are those between the states it holds; the step by which a trace
    loops back is not one of them;
  - each step is an action of the model's action table, and exactly one row of that
    table takes it, or on a lifecycle model an action of its part, which the trace
    names ([models.md §lifecycle-model](models.md#lifecycle-model));
  - each entity a state holds is in exactly one phase there; an entity a state
    does not hold is one whose lifecycle is `entered by` an action, held by no
    state before a step taking that action and by every state from that step on;
  - in each lifecycle having a step's action as a column, the step moves at most
    one entity, and when it moves none, the trace holds one entity of that
    lifecycle;
  - for an action with cases, exactly one case's cell moves each such entity that
    the state before the step holds from its phase there to its phase after it;
    an entity the step's action enters is in its lifecycle's initial phase after
    it ([lifecycle-tool.md §stepping](lifecycle-tool.md#stepping));
  - no entity of a lifecycle of which the steps act on several is missing from the
    first state;
  - the claim is not a liveness claim, whose violation is a behaviour without end
    that no journey refused at a step tells.
- The journey is keyed `kept-<the first twelve hexadecimal digits of the
  surprise's basis digest>`, a key reserved to code
  ([design.md §code-journeys](design.md#code-journeys)), and filed in the claim's part
  or span. Its `Polarity` is `must not`, its `Refused step` its last, its
  `Expected end` `-`, its `Origin` `added`, and its `Cites` the claim's. Each
  step's `Actor` is its action's actor's names; `Action` the action; `Arguments`
  `-`; `Entity` `-` when the steps act on one entity of each lifecycle having the
  step's action as a column, and otherwise that entity as the trace names it;
  `Case` the case found above, or `-`. Its start table gives, at its phase in the
  first state, each entity a step acts on that is not in its lifecycle's initial
  phase, and every entity of a lifecycle the steps act on several of; an entity the
  first state does not hold has no row and enters as its lifecycle says.
- **`## Kept`** holds, for each surprise of the ruling in name order, a heading
  `### <surprise name>`, then either a field table with `Journey`, the journey's
  name, and `Pin`, its pin then, followed by the tables of a journey's page; or a
  field table with `Not kept` and why: that the surprise is no such question, or
  which condition above its trace fails, so the account can say why.
- A kept journey is confirmed by its ruling while the ruling is in force for its
  surprise and its pin is the one `## Kept` records
  ([§in-force](decisions.md#in-force)); once a later ruling names that surprise,
  its ruling keeps it no longer, and the journey is gone, so the developer is
  not asked to confirm a trace they have since ruled on otherwise. It is judged
  like any other journey (M131–135, M196–198), and code reads it only from its
  ruling (M87–90). It goes with the part or span it is filed in, and its ruling
  keeps the record.

<a id="carry"></a>

## Carry and strike

- A carry is on one premise (M215–216). Each pin pins what is shown of the
  premise, every reference replaced by what it names (M161–165). Each `On`, the
  premise it names, and its pin:

  - **`<part>/premises/<premise>`**
    - The premise: a premise's page
    - Pin: the premise's pin ([design.md §pins](design.md#pins))
  - **`store:<part>/<row>`**
    - The premise: the premise code adds for a store row
      ([forms.md §store-premises](forms.md#store-premises); M74)
    - Pin: the SHA-256 of the lines `Statement: <statement>`,
      `Falsifier: <falsifier>` and `Provider: <provider>`
  - **`bound:<model>/<part or span>/<claim>`**
    - The premise: the claim's bounds on a model covering its parts
      ([engines.md §bounds](engines.md#bounds))
    - Pin: the SHA-256 of the lines `Model: <model>`,
      `Claim: <the claim's pin>`, then `Bound: <bound> | <value> | <meaning>`
      for each bounds row that bounds the claim on that model, in the model's
      order, or `Bound: phase level` on a lifecycle model
  - **`strike:<part>/<row>/<item>`**
    - The premise: that a world row never does an item of its misbehaviour menu
      ([forms.md §menu](forms.md#menu); M215–216)
    - Pin: the SHA-256 of `Strike: <item> at <the row's names>`, the item as
      [forms.md §menu](forms.md#menu) writes it in paths, such as `go-silent`
  - **`span:<part>+<part>`**
    - The premise: that two distinct parts forming a span, in key order, are not
      examined together ([forms.md §surface](forms.md#surface); M178–180)
    - Pin: the SHA-256 of, for each part in key order, `Part: <its purpose>`,
      then `Surface: <direction> <name>` for each of its surface rows that names
      what the two share, sorted

  Each pin's lines are joined by one line feed, with none after the last, as
  [design.md §pins](design.md#pins) joins a
  canonical text's lines, and hashed in UTF-8.

- `Choice` is `carry` or `withdraw`. A strike in force strikes its item, and one
  withdrawn restores it, as [forms.md §menu](forms.md#menu)
  says this bears on a model (M215–216).
- `## Words` holds the falsifier (M215). For a strike, Forma pre-writes
  `an observed <item> at <the row's names>`, the item named as the menu names it,
  for the developer to keep or edit; a strike carried with no words keeps it, and
  `## Words` holds it.
- **Basis.** `Basis` is `-`, or a claim, `<part or span>/claims/<claim>`, as the
  carry's basis. No part of that claim may be a part the premise belongs to: a
  premise's own part, its row's part, for bounds the claim's parts, for a span
  both parts (M216–218). The carry counts only while that claim is established
  without it ([§in-force](decisions.md#in-force)).
- A choice premise is carried by its pick, and no carry is made of it
  ([§pick](decisions.md#pick)). No run discharges a premise
  ([account.md §box](account.md#box); M290).
- **Several at once.** One command may name several premises, separated by commas,
  when one falsifier answers for them all, or when they are strikes each keeping
  the falsifier Forma wrote; `bound:<model>` alone names the bounds on that model
  of every claim whose bounds wait for a carry
  ([account.md §items](account.md#items)). Forma shows them in one showing under one
  token, each passage and each model's bounds once, and records one decision for
  each premise, each holding its own showing whole as if carried alone, with the
  options given. When any of them cannot be carried, none is.
- It shows a premise in the developer's terms with the passages it cites; a store
  premise with its row; bounds with the claim and the meaning of each bounds row,
  a `choose` row's trade among them, a TLC model's constraint row left out for a
  liveness claim, which it does not bound; a strike with its row, its item and the
  falsifier Forma wrote; a span with its two parts and what they share.

<a id="accept"></a>

## Accept

An acceptance is on one claim, and shows the claim with the passages it cites.
`Choice` is `accept` or `withdraw`. While an acceptance is in force, the claim's
risk is accepted without examination, and the claim enters the box marked as
accepted, as [account.md §box](account.md#box) admits it (M218–219).

<a id="redirect"></a>

## Redirect

- The developer redirects at any time through their own artifacts: the brief,
  edited directly with no decision ([design.md §brief](design.md#brief)); a
  claim's sentence; a new journey (M220–222).
- **A claim's sentence**: `On` is an existing claim, and `## Words` its new
  sentence. Forma writes the claim's page with that sentence and its other fields
  as they stand. No redirect adds a claim: M220–222 names the developer's own
  artifacts as the brief, a claim's sentence and a new journey, so a new claim
  enters through the brief, which a Restate answer then restates.
- **A new journey**: `On` is `<part or span>/journeys/<key>`, a key no journey
  there has and that is not reserved
  ([forms.md §journeys](forms.md#journeys)), and `## Words` is its page in
  that section's form, citations included. Forma writes those words as the page, in
  that folder.
- Forma writes the page with a receipt line naming the decision, so the page
  counts as accepted (M221–222, M238; [door.md §receipts](door.md#receipts)).
  Afterwards it is an ordinary page.
- It shows, and pins, the unit that holds the change as it reads after it, with
  the new words, so the redirect confirms that unit.
- It is refused when the restatement would then fail the checks a Restate
  answer's pages pass
  ([design.md §repairs-redirects](design.md#repairs-redirects)); when the unit
  it would confirm then has a finding that blocks confirmation
  ([lifecycle-tool.md §findings](lifecycle-tool.md#findings)), since the
  developer is never asked to confirm a contradiction; or when the page's file
  holds a change no accepted answer or redirect made
  ([door.md §change](door.md#change)), which writing would lose (M220–222,
  M238).

<a id="in-force"></a>

## Which decision is in force

- **What a decision is on.** A decision is on the subject its kind and `Pin` give,
  never a name or a folder: a subject removed and another added with the same kind
  and pin has the same decisions (M161–165, M224). The decisions on one subject:

  - **a unit**: its confirmations and declines; the redirect that confirms it;
    for a picked journey, its pick, whose pin for it is current while the pick
    is in force; for a kept journey, its ruling, at the pin `## Kept` records
  - **a choice**: its picks
  - **a premise**: its carries and withdrawals
  - **a claim's risk**: its acceptances and withdrawals
  - **a surprise, by its question and basis digest**: the rulings that name it
  - **a real finding's met repair on a model, by the ruling's name and the
    model**: its `brief` decisions

- **In force**: of the decisions on a subject whose pin is the subject's pin
  now, the last ordered by `At` and then by name
  ([§decision-file](decisions.md#decision-file)) (M224). So a unit is confirmed
  while a confirmation, a confirming redirect, a pick or a ruling is in force on
  it, and declined while a decline is; a premise is carried while a carry is in
  force on it and is not revoked, and, with a basis, only while its basis claim
  is established without it, as [account.md §standing](account.md#standing)
  computes, so no claim supports itself through carries (M216–218); and a
  claim's risk is accepted while an acceptance is. The intake, an allowance and
  a ruling pin what they showed and never lapse: the latest intake is in force,
  every allowance counts ([§intake](decisions.md#intake)), and a ruling is in
  force for each surprise it names that no later ruling names. What its verdict
  revokes or proposes again follows from it while it is in force for any of
  them; a journey it keeps, while it is in force for that journey's surprise
  ([§kept-journeys](decisions.md#kept-journeys)). A `brief` decision pins its
  own words, so of the `brief` decisions on a repair only the last, by `At` and
  then by name, can be in force: it is in force while the lines its `Pin`
  hashes, read again now from the repair's mechanism and, for `stated`, the
  passages its words name, give its pin, and has lapsed otherwise; each earlier
  one is superseded by it ([§rulings](decisions.md#rulings)).
- **Superseded**: a decision on a subject and pin with a later one on the same
  subject and pin. Code cannot tell which copy made a decision, so every override
  shows as superseded and none is silent
  ([presentation.md §reading](presentation.md#reading); M224).
- **Lapsed**: a decision on a subject that still stands under the name its `On`
  records, or for a redirect under the name of the unit that holds its `On` now
  ([§redirect](decisions.md#redirect)), at another pin; the latest such is the
  one the next showing compares with
  ([presentation.md §showings](presentation.md#showings)) (M224). A carry whose
  basis claim is not established has lapsed too (M216–218). A subject whose
  decision lapsed is owed a new one ([account.md §items](account.md#items)). No
  decision is undone: a later one overrides an earlier one, and both stay
  readable.
- **Revoked**: a real finding in force on a premise target revokes every carry
  made before it, by `At`, on that premise at its `Target pin`; on
  `choice:<part>/<choice>`, it revokes the pick's carry of the choice premise, and
  the pick stays in force for its journeys and cells. Only a later carry, or pick,
  carries it again (M206–208). Nothing is written beside a
  revoked decision: code finds the revocation by reading every decision, and the
  account shows it revoked, with the ruling that revoked it.
- **Proposed again**: an *abstraction too coarse* ruling in force lapses every
  confirmation made before it, by `At`, of a unit holding a claim whose `Parts`
  include a part the `Parts` column of its `## Surprises` names, so the claims
  over that part are proposed to the developer again once the restatement has
  changed.
- A decision whose subject stands neither at its pin nor under its name decides
  nothing. It stays where it was filed, and is in force again when a subject of its
  kind and pin is added (M224).
- **A thing's decisions**, which `forma account <thing>` lists wherever they sit
  ([presentation.md §reading](presentation.md#reading); M272–274): those on its unit,
  choice, premise, risk or bounds, by kind and pin; those whose `On` names it; the
  rulings naming a surprise whose subject it is; and the rulings revoking its
  carry.

<a id="expects"></a>

## What a ruling or decline expects

A repair is owed while the decision that sends it is in force, a ruling's over
the surprises it is in force for, and [account.md §items](account.md#items)
names its item by the decision's name. The receipt line of each file the answer
that meets it wrote names the decision in its `answers`, with the mechanism a
Repair answer adds in its `mechanisms` and each file's hash before and after,
since a decision never changes ([door.md §repair-answer](door.md#repair-answer);
M212–214). A repair is met by what the answer changed, never by the mark alone:
a line names the decision only when its `before` differs from its `sha256`, or
it records files `removed`. Once met, a repair stays met: a decision never
changes, so a later version of the file does not undo that it was repaired, and
the new line keeps the `answers` and `mechanisms` of the one it replaces
([door.md §receipts](door.md#receipts); M224). A real finding's repair on a
model, once met, owes the developer a `brief` decision on it
([§rulings](decisions.md#rulings); M208–211).

- **a decline**
  - Expects: a Repair answer of the restatement, given the reason as its
    direction (M198, M234)
  - Met when: the decline is no longer in force: its unit was rewritten or
    removed, by whichever answer; a unit still standing is then owed a
    confirmation ([§in-force](decisions.md#in-force)). A decline of a pick's or
    a kept journey is met at once, since no answer writes one: a pick's journeys
    follow the pick, and a kept journey stays, declined, so it counts nowhere,
    its ruling kept. A decline of an offered journey expects a Repair answer of
    its lifecycle's part, given the reason as its direction, and is met when a
    receipt line of that lifecycle's page names it, or when the decline is no
    longer in force, as when it declined a confirmed offered journey a lifecycle
    edit broke: that journey is then offered afresh, as
    [design.md §code-journeys](design.md#code-journeys) says
- **model wrong, and a real finding on a model**
  - Expects: for each such model, a Repair answer naming the mechanism it adds,
    which the verdict's rules of
    [models.md §model-repair](models.md#model-repair) check (M205–214, M234)
  - Met when: a receipt line under `models/<model>/`, or for a lifecycle model
    on one of its part's lifecycle pages, names the ruling in its `answers`, or
    the line [door.md §repair-answer](door.md#repair-answer) records the
    repair's removals on does, a line that a Repair answer for it wrote, with
    its mechanism in `mechanisms`; an answer for another item does not meet it,
    since only a Repair answer names the mechanism it adds
- **property wrong**
  - Expects: each claim the ruled surprises are on, restated, or its encoding
    refilled on each model they ran on (M206)
  - Met when: no claim reads at the pin a ruled surprise read for it in
    `## Surprises`, whichever answer or redirect changed or removed it, the
    changed claim being then owed a confirmation as any changed unit is, so the
    property is revised by the developer's decision; or, on each model the ruled
    surprises ran on, a receipt line of the claim's encoding names the ruling in
    its `answers`
- **abstraction too coarse**
  - Expects: a Repair answer of the restatement over the parts `## Surprises`
    records (M206–207)
  - Met when: a receipt line under `design/` names the ruling in its `answers`;
    or no part or span `## Surprises` records stands, since nothing it targets
    is left
- **a real finding on the brief or a premise**
  - Expects: nothing of an agent ([§rulings](decisions.md#rulings)), so it is
    met when it is made

<a id="forma-show"></a>

## `forma show`

`forma show <kind> [<on>] [--words <text> | --from <file>] [--json]`

- `<on>` is what the decision would be on ([§kinds](decisions.md#kinds)); a
  carry may name several premises and a ruling several waiting decisions,
  separated by commas ([§rulings](decisions.md#rulings),
  [§carry](decisions.md#carry)). A redirect is shown with its new words: a
  claim's sentence by `--words`, a new journey's page by `--from`
  ([§redirect](decisions.md#redirect)). A `brief` decision, on
  `<ruling>/<model>`, is shown with no words for `accepted`, and for `stated`
  with the addresses it names, one a line, by `--words`, since its showing and
  its pin hold the passages named ([§rulings](decisions.md#rulings)).
- **Reads** the project as the account reads it, with the checks of every read
  ([door.md §read-checks](door.md#read-checks)). **Writes** nothing.
- **Prints** as [presentation.md §show-output](presentation.md#show-output) gives.
- **Refuses**, printing each reason and writing nothing, with exit status 1, or
  with `--json` printing `{"refused": [<reason>, ...]}`: no kind, or an unknown
  one; `--words` and `--from` together, `--from` for any kind but a redirect,
  `--words` for any kind but a redirect or a `brief` decision, or a `--from`
  file that cannot be read; any kind but the intake before the intake
  ([§intake](decisions.md#intake)); a subject that does not stand or is not one
  its kind takes, a choice premise for a carry among them
  ([§carry](decisions.md#carry)); a confirmation of a unit a lifecycle finding
  blocks ([§confirm](decisions.md#confirm)); a confirmation of any unit but
  `parts` while the part list has no confirmation in force, since the parts are
  confirmed first, then each part's entries (M193–195); a pick
  [§pick](decisions.md#pick) refuses; while a surprise on a lifecycle model is
  open, a pick of a choice whose cells its lifecycles pose, or a confirmation or
  decline of one of its lifecycles, which the freeze holds
  ([models.md §freeze](models.md#freeze)); a name that is no waiting decision,
  or one not yet offered ([§rulings](decisions.md#rulings)); a redirect
  [§redirect](decisions.md#redirect) refuses; for a `brief` decision, an `<on>`
  that is no real finding's met repair on that model by a ruling in force, or
  words naming an address that is no citable passage
  ([§rulings](decisions.md#rulings)); and what every command refuses
  ([project.md §commands](project.md#commands)).

<a id="forma-decide"></a>

## `forma decide`

`forma decide <kind> [<on>] [<option> ...]`

| Option | Holds |
| --- | --- |
| `--shown <token>` | the token `forma show` printed; every decision given its choices takes it but the intake and an allowance, which show only their own choices ([presentation.md §showings](presentation.md#showings)) |
| `--by <name>` | the name it records |
| `--provider <name> --model <name> --session <id>` | the declared session ([§who-decides](decisions.md#who-decides)) |
| `--choice <choice>` | a pick's `a` or `b`; a carry's `carry` or `withdraw`; an acceptance's `accept` or `withdraw`; a `brief` decision's `stated` or `accepted` |
| `--words <text>` | the words its kind takes ([§kinds](decisions.md#kinds)) |
| `--from <file>` | for a redirect adding a journey, the file holding its page |
| `--basis <basis>` | a carry's basis claim, or a ruling's pointer and line ([§rulings](decisions.md#rulings), [§carry](decisions.md#carry)) |
| `--situation <situation>` | the intake's ([§intake](decisions.md#intake)) |
| `--answers <n> --runs <n> --tlc-seconds <n> --tlc-megabytes <n> --alloy-seconds <n> --alloy-megabytes <n> --lifecycle-seconds <n>` | the allowance of the intake or of an allowance ([§intake](decisions.md#intake)) |
| `--cadence <cadence> --inbox-cap <n>` | the settings of the intake or of an allowance ([§intake](decisions.md#intake)) |
| `--verdict <verdict> --level <level> [--target <target>]` | a ruling's ([§rulings](decisions.md#rulings)) |
| `--json` | output as JSON |

- **Given or asked.** Given `--shown`, or for the intake or an allowance any of
  their own options, it asks nothing, and every option its kind requires is
  given. Given none of those, where standard input and output are a terminal, it
  shows the decision and asks for each choice, the words and the name, as
  [presentation.md §showings](presentation.md#showings) says, a `brief` decision
  being shown again with the passages named once `stated` and its addresses are
  given ([§forma-show](decisions.md#forma-show)); elsewhere it refuses (M189).
- **Reads** the project as `forma show` does, the sessions this machine has seen
  ([door.md §sessions](door.md#sessions)) and the clock. **Writes**, holding
  [door.md §lock](door.md#lock)'s writer's lock, the decision, or one per
  premise, in the folder [§filing](decisions.md#filing) gives: the intake or an
  allowance given its options, as given, its showing being its own choices
  ([presentation.md §showings](presentation.md#showings)); any other decision
  only when the showing it computes then gives the token given or, at a
  terminal, reads as it was just shown; otherwise nothing. For a redirect it
  also writes the page and its receipt line
  ([§redirect](decisions.md#redirect)); for a ruling, once it is written, it
  removes what [§rulings](decisions.md#rulings) says.
- **Prints** as [presentation.md §decide-output](presentation.md#decide-output)
  gives. Exit status 0.
- **Refuses**, printing each reason and writing nothing, with exit status 1, or
  with `--json` printing `{"refused": [<reason>, ...]}`:
  - what `forma show` refuses for its kind and subject
    ([§forma-show](decisions.md#forma-show));
  - a second intake ([§intake](decisions.md#intake));
  - an option its kind does not take, words with a withdrawal among them; a
    missing or malformed one: no name, a
    session given in part, no session where standard input or output is not a
    terminal, no token where one is taken, a choice, situation, cadence, verdict
    or level not of its list, an allowance row or inbox cap that is not a whole
    number of 0 or more, or words its kind requires not given or holding only
    whitespace ([§kinds](decisions.md#kinds), [§intake](decisions.md#intake));
  - a declared session that has submitted an answer
    ([§who-decides](decisions.md#who-decides));
  - a token that is not the one the showing now gives;
  - a tracked time more than a minute ahead of the clock
    ([door.md §clock](door.md#clock));
  - for a ruling: a real finding with no target, with a target that does not
    stand, or at level `requirement` with any target but `brief`;
    `property wrong` on surprises none of which is on a claim
    ([§rulings](decisions.md#rulings));
  - for a carry: a basis that is not a claim, or is a claim of a part the
    premise belongs to ([§carry](decisions.md#carry)); with several premises,
    any of them refused;
  - for an acceptance: a subject that is not a claim;
  - for a `brief` decision: `stated` with words that are not one or more
    addresses, one a line, each once and each of a citable passage
    ([§rulings](decisions.md#rulings)).
