# The account

Spells out [SPEC.md](SPEC.md) for the account: standing
on each model and its labels (M253–262), the journey and span rules a model meets
before its claims count (M131–135, M178–180), the items of missing work and their
names (M264–267), what waits for the developer and at which checkpoint
(M191–222, M266–267), what the basis line holds (M269–272), the box,
with the mechanisms real-finding repairs added under its claims (M276–281), the
diff (M181–185) and what the account cannot know (M283–286); the commands
`forma missing`, `forma account`, `forma box` and `forma diff`; and the graph
`forma explore --json` prints (M37–38). The account is computed and is no file
(M54), so this contract owns no path. The reading's layout (M272–274), and what
each of these commands prints, are
[presentation.md §outputs](presentation.md#outputs)'s.
`M<n>` is line n of [SPEC.md](SPEC.md).

<a id="what-it-is"></a>

## What the account is

- **Computed, never stored.** Code computes the account from the project's
  tracked files each time a command reads it, and writes it nowhere in the tree
  (M54). No file holds a label, a standing or an item. No decision sets one:
  decisions change what is computed, through [§standing](account.md#standing)'s
  conditions, and nothing else does (M35–36).
- **What it reads.** `design/` and `models/`, each file checked as
  [door.md §read-checks](door.md#read-checks) checks every file whenever the
  project is read, against the freeze and the session rule too (M54, M240,
  M247–249). A file that counts for nothing, as
  [door.md §change](door.md#change) says which do, is the item `change:<path>`
  ([§items](account.md#items)), and the account is computed as if the file were
  absent, so what rests on it waits until the file is restored or answered again
  (M238); any other failure a read finds is what its owning contract makes of
  it, an item owed with the file read as it stands.
- **What it does not read.** Neither `runs/` nor `work/`: deleting either changes
  nothing the account says (M56–58). Beside the account, `forma missing` and the
  reading show what this machine keeps in `work/`, the reasons answers were
  refused here and the allowance spent here
  ([door.md §scratch](door.md#scratch)), marked as this machine's, with the item
  `allow` ([§items](account.md#items)), which rests on what is spent here and
  holds back no other item. None of that is part of the account: the box and the
  diff never show it (M238–240, M286).
- **Versions.** Evidence is current or not as
  [evidence.md §currency](evidence.md#currency) says, against the versions of the
  engines, their runtimes and Forma in use on this machine (M166–169), except in
  the diff ([§diff](account.md#diff)).
- **Lifecycle facts.** The lifecycle tool's facts
  ([lifecycle-tool.md](lifecycle-tool.md)) are computed at every read,
  before any engine runs, against every journey, confirmed or not, the journeys
  code adds included. They are never stored and count for no standing: they block
  confirmation as [decisions.md §confirm](decisions.md#confirm) says and show in
  the reading ([presentation.md §reading](presentation.md#reading)) (M69–71,
  M87–90).

<a id="standing"></a>

## Standing

A claim is **established on a model** whose parts include all of the claim's parts
([models.md §slots](models.md#slots)), at that model's bounds, when every condition
below holds (M253–262). The account names a condition that fails by its word.

| Condition | Holds when |
| --- | --- |
| `confirmed` | the unit that holds the claim ([design.md §units](design.md#units)) has a confirmation in force on its current pin ([decisions.md §in-force](decisions.md#in-force)) (M161–165, M193–195, M256) |
| `examined` | its encoding on the model is a property, not a reason the engine cannot express it, and the evidence of its base question there is current and found no violation (M112, M139–140, M257) |
| `controlled` | the evidence of at least one of its faults on the model is current and was caught by its property (M114, M258) |
| `witnessed` | it has at least one witness on the model, and the evidence of every witness it has there is current and reached (M113, M259) |
| `conforming` | the model meets the journey rules ([§journey-rules](account.md#journey-rules)) (M131–135, M260) |
| `carried` | every premise it rests on there (below) is carried (M261) |
| `no open surprise` | no surprise is open on any question on the model, the claim's or another's ([evidence.md §surprises](evidence.md#surprises)) (M143–147, M262) |

- **Same bytes, same bounds.** A fault or witness counts only when its evidence
  is on the same model bytes and bounds as the base evidence's
  ([evidence.md §basis](evidence.md#basis)) (M136–137). That is what clears the
  base evidence's flags `instant-pass`, `tiny-state-space`, `tiny-scope` and
  `tiny-trace` ([evidence.md §flags](evidence.md#flags)), so on an established
  line every such flag is cleared, by the faults and witnesses its basis line
  names (M136–138). The lifecycle engine's flags are cleared by nothing: they
  bear on the model, as [§journey-rules](account.md#journey-rules)'s rule
  `explored` says.
- **The premises a claim rests on, on a model:**
  - each premise its page names in `Rests on`
    ([forms.md §claims](forms.md#claims)): a choice premise carried by the
    pick in force on its choice (M199–201), any other by a carry in force
    ([decisions.md §carry](decisions.md#carry));
  - its bounds on the model, the premise `bound:<model>/<part or span>/<claim>`,
    of the claim's part or span, wherever its encoding there is a property; on a
    lifecycle model they are phase level (M117–121, M215–216);
  - every strike in force on a world row of the model's parts, since the model
    leaves struck misbehaviours out (M96–98, M215–216).
- **A carry with a basis** counts only while its basis claim is established
  without it. Code counts the carries that name no basis, computes the claims
  established with them, then counts each carry whose basis claim is established,
  and repeats until no carry is added. A carry not counted then does not count, so
  no claim is established through a carry resting on it (M216–218).
- **Labels.** A claim is `established` when it is established on at least one
  model; otherwise `accepted` while an acceptance of its risk is in force
  ([decisions.md §accept](decisions.md#accept)) (M218–219); otherwise
  `not established`. On each model whose parts include its parts, its standing
  there is `established`, or `not established` with every condition that fails
  and the items that supply them ([§items](account.md#items)), or its reason
  where none does ([§basis-line](account.md#basis-line)) (M264–265). A claim no
  model covers names its `cover:` item. There is no other label.

<a id="journey-rules"></a>

## The journey and span rules

A model's claims count only once the model meets these rules (M131–135).

A TLC or Alloy model meets them when it is not owed a Model answer
([models.md §parts-change](models.md#parts-change)), which is the rule `rows`,
and every question below has current evidence that matched its expected outcome.
A model owed a Model answer is `model:<model>` and meets none of the rules until
a Model answer is accepted.

| Rule | For | The question that matches |
| --- | --- | --- |
| `journeys` | each confirmed journey whose parts all lie within the model's parts, the journeys code adds included | its path; for a must-not journey its refusal too; for a journey with a start its start too (M115, M131–133) |
| `progress` | each part the model covers | the path of one of those journeys that should happen and whose parts include the part (M133) |
| `enabled` | each row of the action table for an action, but an action that only an alternative a pick in force did not pick takes as a step ([evidence.md §questions](evidence.md#questions)), and each for a misbehaviour not struck | its enabled question (M96–98, M133–134) |
| `misbehaviours` | each misbehaviour not struck of each world row in the model's parts | its misbehaviour question (M134–135) |
| `phases` | the state projection, when it has a row | its phases question (M99–100, M115) |
| `facts` | an Alloy model | its facts question (M115) |

A lifecycle model meets the rules `journeys` and `progress` over the confirmed
journeys whose parts are its one part, by their lifecycle path questions
(M117–121, M131–133), and the rule `explored`: no current base evidence on it
holds a flag of the lifecycle engine's own
([evidence.md §flags](evidence.md#flags)), since an unreachable phase, an untaken
action or an open pair is cleared by no corroboration, as an action never enabled
is not.

A span ([forms.md §surface](forms.md#surface)) owes a claim or journey of both
its parts examined on a model covering both, or the developer's carry of it
(M178–180): a claim whose parts include both is examined there when its base
evidence on such a model is current and answered; a journey whose parts include
both, when its path evidence there is, and for a must-not journey its refusal
evidence too. Until then it is the item `span:` ([§items](account.md#items)).

The account names each rule a model fails once, with the model, for each
journey, part, row, misbehaviour or flag it fails on: the rule, what was found
(for `rows` the reasons [models.md §parts-change](models.md#parts-change) gives,
for `explored` each flag, otherwise the outcome of the question's current
evidence, or `none` when it has none), and the items that supply it
([§items](account.md#items),
[presentation.md §reading](presentation.md#reading)).

<a id="items"></a>

## Items

The items are the missing work: one list, which agents read and through which
they submit every answer, and whose developer items wait at their checkpoint
([§waits](account.md#waits)) (M264–267). Each item has a name, who supplies it,
what it is about, and, while it cannot be supplied yet, what it waits for.

**Names.** A part or span is named by its key, several parts by their keys in
key order joined by `+`. An entry, unit or thing is named as
[design.md §units-and-pins](design.md#units-and-pins) names it; a question and a
surprise by their names ([evidence.md §names](evidence.md#names)); a decision by
its name ([decisions.md §decision-file](decisions.md#decision-file)); a file by
its path. A slot is named by its path from `models/`, that folder left out,
without its extension, as `slot:<model>/parts/<part>/claims/<claim>/encoding`; a
witness or a fault that a claim does not yet have on a model, and whose key its
answer gives, by the path of the claim's folder there followed by `/witness` or
`/fault` (M33–34, M107–108, M264–265).

| Item | Missing when (`why`) | Supplied by |
| --- | --- | --- |
| `intake` | no intake is in force ([decisions.md §intake](decisions.md#intake)) (M191–192) | developer: intake |
| `passage:<address>` | a passage design.md finds uncovered (`uncovered`); or an address an entry cites that names no citable passage, as after a heading is renamed (`unresolved`) ([design.md §coverage](design.md#coverage), [design.md §at-read](design.md#at-read)) (M79–81) | agent: restate |
| `restate:<part or span>` | a page of the part or span that fails a check of [design.md §restate-checks](design.md#restate-checks)'s checks 2 or 3 as things stand, other than an unresolved citation (`unresolved`); or, for a part, a lifecycle engine flag on its lifecycle model (`flagged`, [§journey-rules](account.md#journey-rules)), but a posed cell's flag, which the item `pick:` of its choice owes | agent: restate |
| `restate:parts` | `design/README.md` fails such a check, as when its part list does not match the part folders after a merge (`unresolved`) ([design.md §at-read](design.md#at-read)) | agent: restate |
| `findings:<part or span>` | the lifecycle tool reports a finding that blocks confirmation of a unit of the part or span not yet confirmed ([lifecycle-tool.md §findings](lifecycle-tool.md#findings)) (M69–71, M193–194) | agent: restate |
| `confirm:<unit>` | a unit whose current pin has no confirmation and no decline in force (`unconfirmed`), or whose confirmation lapsed (`lapsed`) ([decisions.md §confirm](decisions.md#confirm)) (M193–198, M224) | developer: confirm |
| `repair:<decision>` | a decline or a ruling in force whose repair is not met ([decisions.md §expects](decisions.md#expects)); `repair:<decision>/<model>` for each model a ruling sends a Repair answer to, even when there is only one (M198, M204–214) | agent: repair |
| `pick:<part>/choices/<choice>` | a choice with no pick in force (`unpicked`), or whose pick a ruling revoked (`revoked`) ([decisions.md §pick](decisions.md#pick)) (M199–201) | developer: pick |
| `cover:<parts>` | a part no model covers, or the parts of a claim or confirmed journey that no one model covers; while no TLC or Alloy model exists, one item naming every part ([models.md §owed](models.md#owed)) (M104–105) | agent: model |
| `model:<model>` | a model owed a Model answer, for the reasons [models.md §parts-change](models.md#parts-change) gives (M96–103, M247–249) | agent: model |
| `journey:<part>` | a part a model covers with no confirmed should-happen journey whose parts include it ([§journey-rules](account.md#journey-rules)) (M133) | agent: restate |
| `slot:<path>` | a slot that models.md says exists, not filled (`unfilled`) or owed again (`owed-again`) ([models.md §slot-currency](models.md#slot-currency)) (M107–115, M176–177) | agent: slot |
| `express:<part or span>/claims/<claim>` | a claim whose encoding on every model covering its parts says why the engine cannot express it, with no acceptance of its risk in force (M112, M218) | agent: model, or developer: accept |
| `run:<question>` | a question asked now whose evidence is absent (`none`) or not current (`not-current`), with no surprise open on it; whose current unanswered evidence ran at limits smaller than its engine's now (`larger-limits`); or whose evidence answered and does not match with neither a surprise file nor a ruling naming its surprise (`lost-surprise`) ([evidence.md §forma-run](evidence.md#forma-run)) (M51, M143–147, M166–173) | run |
| `run:<surprise>/reduction` | an open surprise with a reduction still to run ([evidence.md §reductions](evidence.md#reductions)) (M148) | run |
| `run:<surprise>/weaker-<key>` | a weaker form of an accepted explanation not yet run ([evidence.md §weaker](evidence.md#weaker)) (M233) | run |
| `unanswered:<question>` | a question whose current evidence is unanswered, at the limits its engine has now (M140–141) | developer: allow, or agent: model |
| `explain:<surprise>` | an open surprise with no accepted explanation (M148–151, M233) | agent: explain |
| `rule:<decision>` | a waiting decision: the open surprises one decision holds, by the name [decisions.md §rulings](decisions.md#rulings) gives it (M152, M201–204) | developer: rule |
| `brief:<ruling>/<model>` | a real finding's repair of a model, by a ruling in force, that is met ([decisions.md §expects](decisions.md#expects)), with no `brief` decision in force on it (`unstated`), or whose `brief` decision lapsed (`lapsed`) ([decisions.md §rulings](decisions.md#rulings)); before the repair is met there is no mechanism to name and no such item, and once it is, it waits for nothing (M208–211) | developer: brief |
| `carry:<premise>` | a premise a claim rests on ([§standing](account.md#standing)), other than a choice premise, which a pick carries and whose revocation is `pick:` (`revoked`), named as decisions.md names what a carry is on, with no carry in force (`uncarried`), or whose carry lapsed or was revoked (`lapsed`) (M215–218) | developer: carry |
| `span:<part>+<part>` | a span with no claim or journey of both its parts examined on a model covering both ([§journey-rules](account.md#journey-rules)) and no carry of it in force: no claim or journey of both parts (`no-entry`), no model covering both (`no-model`), or none of theirs examined (`unexamined`) (M178–180) | agent: restate or model, or developer: carry |
| `allow` | this machine's allowance cannot pay for what is missing: no answers left while an item an answer supplies is missing (`answers`), no runs left while a run is missing (`runs`), or no time or memory for the engine of a missing run (`engine`) ([door.md §spent](door.md#spent)); this machine's, shown beside the account with the allowance spent here ([§what-it-is](account.md#what-it-is)), never in the box or the diff, and no item waits for it (M219, M239–240) | developer: allow |
| `change:<path>` | a file that counts for nothing, for the reasons [door.md §change](door.md#change) gives (M238, M240) | agent: an answer of the kind that holds the file; or anyone, restoring the file from the project's history, or removing one no answer can hold |

- **Before the intake** the only items are `intake` and any `change:`: no answer or
  run is allowed until the intake gives the allowance (M191–192, M239–240).
- **Waiting.** An item that cannot be supplied yet names each item it waits for,
  in the order of the rules below, and under one rule in the table's order:
  - `confirm:` of any unit but `parts` waits for `confirm:parts` while the part
    list has no confirmation in force, since the parts are confirmed first
    (M193–195);
  - `confirm:` of a unit a finding blocks waits for its `findings:` (M193–198);
  - `confirm:` of an offered journey whose phase a written journey awaiting
    confirmation reaches waits for that journey's `confirm:`, so the developer is
    not asked to confirm a journey nothing needs (M196–198);
  - `journey:<part>`, while a should-happen journey whose parts include the part
    is written and not confirmed, waits for its `confirm:`, or for its `repair:`
    once it is declined (M133, M193–198);
  - `slot:` of a claim with a surprise open on one of its questions on that model,
    `model:` of a model with a surprise open on it, and a `repair:` whose files
    such a surprise freezes, wait for the `rule:` of each decision that holds such
    a surprise: an answer holding or removing a file the freeze holds, or holding
    a new one, is refused whatever its bytes until every one is ruled
    ([models.md §freeze](models.md#freeze); M145–147);
  - `rule:` waits for the `explain:` of each surprise in it, and for the
    `run:<surprise>/reduction` of each that still has a reduction to run
    ([decisions.md §rulings](decisions.md#rulings); M148–151,
    M201–204).
- **Refused here.** Beside each item `forma missing` shows the reasons this
  machine keeps for answers to it that were refused
  ([door.md §scratch](door.md#scratch)) (M238–239).

<a id="waits"></a>

## What waits for the developer

The developer's items wait at their checkpoint, and nothing else interrupts the
developer (M266–267):

| Checkpoint | Items |
| --- | --- |
| `intake`, once (M191–192) | `intake` |
| `confirm` (M193–198) | `confirm:` |
| `decide` (M199–214) | `pick:`, `rule:` |
| `carry or allow` (M208–211, M215–219) | `carry:`, `brief:`, `span:`, `express:`, `unanswered:`, `allow` |

- What waits for the developer is every item the developer may supply, at its
  checkpoint (M266–267).
- A redirect is never an item: the developer makes one at any time, through their
  own words (M220–222; [decisions.md §redirect](decisions.md#redirect)).
- **The settings** in force ([decisions.md §intake](decisions.md#intake)) change
  only how `forma missing` and the reading put the developer's items to them,
  never standing or the list of items, which every item stays in (M35–36,
  M264–267). One developer item is one decision to make:
  - **Cadence** groups them: `span`, the default, by the part or span each is
    read under ([presentation.md §reading](presentation.md#reading)), so one
    sitting covers one part or span, those read under the project first;
    `question`, each by itself, in [§commands](account.md#commands)'s order;
    `session`, by the session whose answer opened it: the `session` of the
    latest receipt line, by `at`, among the files its subject rests on, or under
    none.
  - **Inbox cap** n shows the first n of them in full, in the cadence's order, and
    the rest by name and count only; `0` shows none in full, so all wait.

<a id="basis-line"></a>

## The basis line

Every line on which a claim is established on a model carries its basis, in the
developer's terms (M269–272):

| It carries | As |
| --- | --- |
| bounds | each row of the model's bounds that its base question ran at, by its meaning, a `choose` row's trade among them ([engines.md §bounds](engines.md#bounds)); on a lifecycle model, phase level (M101, M117–121) |
| faults | each fault whose current evidence was caught, by the mechanism it removes (M114, M270) |
| witnesses | each witness by its meaning, and by the journey that reached it: the trace its evidence keeps, rendered as [presentation.md §rendering](presentation.md#rendering) renders a trace (M113, M173–175, M270–271) |
| premises in force | each premise of [§standing](account.md#standing) it rests on there, by its name, as [decisions.md §carry](decisions.md#carry) names what a carry is on, or a choice premise's `choice:<part>/<choice>`; its statement, falsifier and carry, a choice premise's pick and a carry's basis claim are shown once, under Assumed ([presentation.md §reading](presentation.md#reading)) (M271) |
| mechanisms | each mechanism a met real-finding repair added to the model, with its ruling and whether the brief states it, as the box gives them ([§box](account.md#box)) (M208–211, M276–281) |
| beneath, from the evidence | for the base question and each question above, by name: the engine and its version, the runtime and its version, Forma's version, the kind of search, the constants, depth or steps, and scope it ran at, the limits, the measures (states and duration among them), symmetry, which is always none since no question uses symmetry reduction ([engines.md §tlc](engines.md#tlc)), and the flags with the faults and witnesses that cleared them, as evidence.md records or derives them; for a liveness claim, the fairness its encoding states (M136–142, M271–272) |

- The line names each evidence file it rests on by its question, and is computed
  from that evidence as it stands at every read, so it is checked against it each
  time.
- Every claim the account shows, established or not, has beside it, on each
  model covering its parts, the model's bounds and the premises it rests on
  there, each by its name and marked carried or not, so no claim is read without
  what qualifies it. A premise's statement, class, falsifier and carry are shown
  once, under Assumed ([presentation.md §reading](presentation.md#reading)), and
  not again under each claim resting on it.
- A claim not established on a model names there each condition that fails, with
  the items that supply it ([§standing](account.md#standing)). A condition that
  fails with no item to supply it gives its reason, so the reader does not look
  for missing work: on a model where its encoding gives a reason, `examined`,
  `controlled` and `witnessed` each give `its encoding says why the engine
  cannot express it:
  <the reason>`, since no fault or witness is owed there; and `examined`, where
  its base evidence there found a violation whose surprise a ruling in force
  names, gives `its base surprise is ruled: <the ruling's name>` (M112, M257–259,
  M264–265).
- An accepted claim's line says it is accepted and not examined, with the words of
  the acceptance, who made it and when, and the premises its page names, each
  marked carried or not (M218–219).

<a id="box"></a>

## The box

The box is what leaves Forma, the list it hands over (M276–281). It holds:

- each claim established, with each model it is established on and the bounds
  and premises in force there ([§basis-line](account.md#basis-line)), and under
  it, for each such model, every mechanism that a met repair of a real finding
  in force on that model added ([decisions.md §rulings](decisions.md#rulings)),
  in order of its ruling's name, each with that name and one of:
  `the brief states it (<addresses>)`, while a `stated` decision is in force on
  it, its addresses separated by `, `; `not in the brief, accepted (<why>)`,
  while an `accepted` one is, with its words; or `not in the brief`, while none
  is. So no claim leaves Forma as if it held of the design the brief describes
  when it holds only with a mechanism the brief does not state (M276–281);
- each claim accepted and not established whose premises, those its page names,
  are all carried, marked accepted and not examined, with its acceptance and its
  premises as [§basis-line](account.md#basis-line) says (M218–219);
- every premise carried, the bounds, strikes, store premises and spans carried
  included, with its statement and falsifier, who carried it and when; each choice
  premise with its pick.

Nothing else enters it: nothing resting on a premise neither discharged nor
carried enters it, so an accepted claim with a premise not carried stays out
until it is carried, and a claim resting on a premise not carried is not
established ([§standing](account.md#standing)). No run discharges a premise
(M290), so every premise the box lists is carried and none discharged: those are
the undischarged premises the box makes visible. The box opens with the level-1
heading `What the software may be said to guarantee`, and nothing else Forma
prints uses the word guarantee; a developer's names and sentences are shown as
they wrote them. It ends with [§cannot-know](account.md#cannot-know)'s
sentences.

`forma box` prints it as
[presentation.md §box-output](presentation.md#box-output) gives (M276–281).

<a id="diff"></a>

## The diff

`forma diff [<commit or folder>]` compares the account of the project now with that
of an earlier copy, since nothing else keeps an earlier moment (M181–185).

- **The earlier copy.** When the argument names an existing folder, that folder,
  read as a project folder. Otherwise a commit, as git resolves the argument in the
  repository that holds the project folder; the copy is the files under the project
  folder's path in that commit's tree, as git stores them (M244). A commit whose
  tree has no such folder gives the account of an empty project. Forma reads git
  for this command alone (M243–244).
- **By default**, the commit that added the developer's latest decision: of the
  decisions in the project now, the last ordered by time and then by name
  ([decisions.md §decision-file](decisions.md#decision-file)), and the most
  recent commit, in the history of the commit checked out, that added its file
  (M183–184).
- **The two accounts.** This Forma computes each from its own files, as
  [§what-it-is](account.md#what-it-is) to [§items](account.md#items) say, but
  for three differences. Every evidence file's currency is judged with the
  versions of the engine, its runtime and Forma that its own basis names, and
  without composing its generated files again, by
  [evidence.md §currency](evidence.md#currency)'s items 1 and 2 alone
  (M181–183), so a change of version or of how Forma composes stales nothing in
  the diff, which `forma account` shows. Nothing is read of `work/` for either,
  so no item that rests on this machine's allowance or refusals is in the diff
  (M286). And the earlier copy's checks are those of its own files.
- **The lists** (M184–185):

  - **went stale**: each decision in force then and not now, with its state now,
    or absent; each slot current then and not now, and each slot or model file
    current then whose bytes now differ, rewritten since, or that is gone, so a
    property rewritten with the same outcome still shows; each evidence file
    current then and not now, or absent now; each claim established on a model
    then and not there now
  - **changed outcome**: each question whose evidence in both copies has a
    different outcome, with both outcomes
  - **opened**: each item and each surprise the account has now and did not have
    then
  - **closed**: each item and each surprise it had then and does not have now
  - **waits for the developer**: every item the developer may supply now, at its
    checkpoint ([§waits](account.md#waits))

- **Batches.** The first four lists are grouped by change, so the dependents of one
  change arrive together, whatever list they fall in (M184–185); what waits is as
  things stand now, and is not grouped. Each change, and what it is:

  - **passage**: a passage whose hash differs between the copies, or that one
    copy lacks
  - **entry**: an entry whose pin differs, or that one copy lacks
  - **file**: a model's file or a slot whose bytes differ, or that one copy
    lacks
  - **decision**: a decision one copy has and the other lacks
  - **surprise**: a surprise one copy has and the other lacks

  Each group holds every line that rests on its change: a decision on what its pin
  holds and on a decision that overrides it, a slot on its own bytes and on what its
  receipt pins, an evidence file on its basis; a claim on the changes its failing
  conditions rest on, and on a surprise opened on its model; an item or a surprise
  opened or closed on the change that opened or closed it, as what its `why` rests
  on. A line resting on several changes is in each of their groups; one resting on
  none, in a last group under no change.
- **What it cannot say.** Only what differs between the two copies, never when
  or in what order it happened between them; the diff says so, and ends with
  [§cannot-know](account.md#cannot-know)'s sentences (M283).
- **Output**, as [presentation.md §diff-output](presentation.md#diff-output)
  gives (M181–185).
- **Refusals.** A commit git cannot resolve; a project folder in no git repository,
  when a commit is named or taken by default; by default, no decision in the
  project, or a latest decision whose file no commit added, for which a folder is
  named instead (M181–184, M242–243).

<a id="cannot-know"></a>

## What the account cannot know

The reading, the box and the diff end with these sentences, always (M283–286):

1. "An engine checks the encoding, not its fidelity to the design; fidelity rests
   only on the journeys a model passes." (M283–285)
2. "A result holds within its stated bounds only, and a lifecycle engine result at
   phase level only." (M120–121, M139–142)
3. "A `CHOOSE` in a model that its bounds do not record as a trade is not seen."
   (M101)
4. "Staleness follows citations, so a dependence nobody cited is not tracked."
   (M285–286)
5. "An interaction nobody wrote down is not found." (M286)
6. "Who wrote a brief passage is not recorded." (M286)
7. "Who made a decision is as declared, and is not checked; so is the session an
   agent declares with an answer." (M189, M237, M286)
8. "What one machine spent or refused is not known to another, and a session known
   only by answers refused is known only where it submitted." (M189, M286)
9. "What an agent spends inside its own work is not seen: only the answers it
   submits count against the allowance." (M239–240)

<a id="commands"></a>

## Commands

Each command reads the project folder Forma is pointed at
([project.md §commands](project.md#commands)), writes nothing in it
([door.md §lock](door.md#lock)), and with `--json` prints the same content as
one JSON object (M54, M181–185, M264–267, M272–281).

- **`forma missing`**
  - Reads: [§what-it-is](account.md#what-it-is)'s files, and this machine's
    refusals and allowance
  - Prints: this machine's allowance, then every item
    ([§items](account.md#items)), each in the group of its first supplier: first
    those an agent's answer supplies, then those a run supplies, then the
    developer's, by checkpoint in [§waits](account.md#waits)'s order (`intake`,
    `confirm`, `decide`, then `carry or allow`, `brief:` among its items) and as
    [§waits](account.md#waits)'s settings group and show them; each group in
    order of item name, but that an item other items of its group wait for
    ([§items](account.md#items)) comes before them, so what the rest wait for is
    read first, as `confirm:parts` before every other `confirm:`
- **`forma account [<part, span or thing>]`**
  - Reads: [§what-it-is](account.md#what-it-is)'s files, and this machine's
    refusals and allowance
  - Prints: the reading ([presentation.md §reading](presentation.md#reading)): a
    part or span named by its key, a thing as `<part or span>/<kind>/<key>`
- **`forma box`**
  - Reads: [§what-it-is](account.md#what-it-is)'s files
  - Prints: the box ([§box](account.md#box))
- **`forma diff [<commit or folder>]`**
  - Reads: [§what-it-is](account.md#what-it-is)'s files now, and those of the
    earlier copy
  - Prints: the diff ([§diff](account.md#diff))
- **`forma explore --json`**
  - Reads: [§what-it-is](account.md#what-it-is)'s files, and this machine's
    refusals and allowance
  - Prints: the graph ([§explorer-graph](account.md#explorer-graph))

An item, wherever the account gives one in JSON:

- **`item`**: its name
- **`supply`**: who may supply it, in [§items](account.md#items)'s order: each
  `{"by": "agent", "answer": <kind>}`, `{"by": "run"}`,
  `{"by": "developer", "decision": <kind>, "checkpoint": <checkpoint>}`, the
  kind one of [decisions.md §kinds](decisions.md#kinds)'s, `brief` among them,
  and the checkpoint [§waits](account.md#waits)'s, or `{"by": "anyone"}`
- **`on`**: what it is about: the entry, unit, slot path, question, surprise,
  decision, decision and model for `repair:<decision>/<model>` and
  `brief:<ruling>/<model>`, or path its name holds
- **`why`**: its case from [§items](account.md#items)'s table, where the table
  gives cases; where several hold at once, each, in the table's order, separated
  by `, `
- **`found`**: for `model:`, `restate:`, `findings:` and `change:`, what was
  found, as the contract that owns what it is on words it; for
  `explain:` of a surprise sent back first, the reason
  ([evidence.md §sent-back](evidence.md#sent-back))
- **`waits`**: the items it waits for, in the order
  [§items](account.md#items) gives a waiting item's, or absent
- **`refused`**: this machine's reasons for refused answers to it
  ([door.md §scratch](door.md#scratch)), or absent

`forma missing` prints as
[presentation.md §missing-output](presentation.md#missing-output) gives.

**Refusals.** `forma account` with an argument that names no part, span or thing:
none whose folder is under `design/`, and no journey code adds under that key
([design.md §code-journeys](design.md#code-journeys)) (M272–274); `forma diff`
as [§diff](account.md#diff) says; and what every command refuses
([project.md §commands](project.md#commands)). A refused command prints each
reason, or with `--json` `{"refused": [<reason>, ...]}`, and writes nothing.

<a id="explorer-graph"></a>

## The explorer graph

`forma explore --json` prints the graph: the account, and the record it is
computed from, as one JSON object for the explorer to read
([project.md §explore](project.md#explore)).

- **What it holds.** Every standing, journey rule, currency reason, cause and
  repair route in it is the account's, computed as this contract and the
  contracts it reads say. The graph adds no reference, finding or judgement of
  its own, and whoever reads it adds none (M37–38, M54).
- **Two modes.** `here` judges evidence by this machine's versions, as the
  account does. `recorded` judges it as [§diff](account.md#diff) does, on the
  project as it is read: by the files and pins each evidence file names and by
  its own versions, composing no generated file again and reading nothing of
  `work/`. Both are computed at the read. `forma box` never uses `recorded`, and
  no decision is made on it. What this machine keeps, its allowance and its
  refusals, stands beside both modes as this machine's (M54, M166–185,
  M238–240, M286).
- **The object** holds `format`, which is 1; `generation`, which names the
  complete set of inputs and the versions it was computed with; `computedAt`;
  `project`, the folder's name; `versions`; `inputs`, each file's relative
  `path` and `sha256`; `local`, what the reading gives under its `here` key
  ([presentation.md §reading](presentation.md#reading)); `modes`, with `here`
  and `recorded`; and `cannotKnow`, [§cannot-know](account.md#cannot-know)'s
  sentences. Each mode holds `reading` and `box`, as `forma account --json` and
  `forma box --json` give them, and `nodes`, `edges`, `causes` and `diagrams`
  (M54, M269–286).
- **A node** has `id`, `kind`, `key`, `name`, `scope` and `data`. Its kind is
  `passage`, `unit`, `entry`, `part`, `span`, `boundary`, `model`, `slot`,
  `file`, `question`, `evidence`, `surprise`, `decision`, `item`, `premise` or
  `mechanism`. Its key is the name its owning contract gives the thing: a
  passage's address, a file's relative path, a mechanism's ruling and model. Its
  `id` is its kind, a colon and its percent-encoded key. `scope` is the part or
  span it belongs to, or null. `data` holds only the fields of its kind (M47–54,
  M65–74):
  - a passage: its text as written, its canonical text and hash, the entries and
    part-list rows that cite it, and each omission of it, with the omitted
    portion, the reason and the confirmation;
  - an entry: its fields, citations, origin, pin and confirmation, and for a
    journey code adds, where it comes from; a unit: its pin and its
    confirmations;
  - a model: its engine, parts, Actions and Misbehaviours tables, bounds, state
    projection and the journey rules it meets or fails; a slot: its form, its
    receipt's pins, whether it is current and why not; a file: its text where it
    is text, its hash and its receipt line;
  - a question: its kind, its expected outcome where it has one, its inputs and
    its slots; evidence: its basis, bounds, limits, what it found, measures,
    flags, whether it is current and why not, and the trace it keeps. Evidence
    whose question is not asked now says so and gives no current outcome;
  - a decision: its kind, rows, words, what was shown, its state, and for a
    ruling where its repair goes; an item: its suppliers, `on`, `why`, `found`
    and `waits`; a premise, those code adds included: its falsifier and its
    carries; a mechanism: its ruling, model, receipt lines and brief decision.
- **An edge** has `id`, `source`, `target`, `relation` and `data`, which names
  the field or pin the edge comes from. Its relation is `cites`, `names-action`,
  `steps-through`, `rests-on`, `slot-of`, `written-for`, `reads`, `examines`,
  `surprise-of`, `held-by`, `repairs`, `names-mechanism`, `written-by`,
  `decides`, `pins`, `overrides`, `waits-for` or `carried-on`. Both its ends are
  nodes of its mode; a reference that resolves to nothing stays in its source's
  `data` with the reason. No edge is inferred: each is a field or a pin of the
  record (M33–34, M156–185).
- **`diagrams`** holds each lifecycle picture
  ([lifecycle-tool.md §as-read](lifecycle-tool.md#as-read)) the mode has, each
  with `id`, `lifecycle`, `variant`, `basis`, `picture`, `journeys` and
  `traces`. `variant` names its `kind`: `as-read`, the lifecycle as it reads,
  with its `name`; `fault`, the lifecycle with one fault slot's cells laid over
  it on its lifecycle model, with the `model`, the `slot` and the `overlay`; or
  `kept`, the picture a ruling's showing keeps, with the `ruling` and the
  journey or question it was drawn for. `basis` holds the lifecycle's and its
  actions' pins, the picks, the source files' hashes and the versions the
  picture was made from. Each journey and trace keeps its own source, basis,
  outcome, currency and marks. A ruling whose showing keeps no structured
  picture has one record with `picture` null, the `reason`, and its `showing`
  as it was shown; no picture is drawn for it from the lifecycle as it reads
  (M69–71, M114, M166–175, M193–202).
- **`causes`** holds one line for each claim that is not established on a
  model, by the condition that fails, and for each journey rule a model fails.
  Each line names the items that would supply it, followed through their
  `waits` to the items that wait for nothing; such an item gives its `why`, and
  a run owed because its evidence is not current gives each currency reason. A
  line with several causes stands under each, counted once. A condition no item
  supplies keeps the account's reason, and a dependency that is missing or
  circular is shown as that. Each cause has `id`, `says`, `items` and `lines`
  (M166–185, M264–267).
