# Models and slots

Spells out [SPEC.md](SPEC.md) for models and slots: which slots exist, with
their paths and checks and when each is owed again, the lifecycle model, the
Model and Fill-a-slot answers and a Repair on a model, the freeze while a
surprise is unruled, a model whose parts change, and one model first and a
smaller one. It owns `models/<model>/model.md`, each model's engine files, and
every slot: `encoding.<ext>`, `witness-<key>.md` and `fault-<key>.md` in
`models/<model>/<p>/claims/<claim>/`, `schedule.md` in
`models/<model>/<p>/journeys/<journey>/`, and
`models/<model>/world/<part>/<row>/<item>.<ext>`, where `<p>` is `parts/<part>`
or `spans/<span>`. `M<n>` is line n of [SPEC.md](SPEC.md). `model.md`'s tables,
engine text and each slot's native form are [engines.md](engines.md)'s; the
misbehaviour menu, [forms.md](forms.md)'s. The restatement's forms are
[forms.md](forms.md)'s; a thing's parts and pins, [design.md](design.md)'s;
decisions and which is in force, [decisions.md](decisions.md)'s; questions,
their composition and expected outcomes, evidence and surprises,
[evidence.md](evidence.md)'s; answers, receipts, changes that count for nothing
and the checks at every read, [door.md](door.md)'s; items and standing,
[account.md](account.md)'s.

<a id="paths"></a>

## Paths

| Path | Holds | Written by | Read by |
| --- | --- | --- | --- |
| `models/<model>/model.md` | a TLC or Alloy model's fields, bounds, action table and state projection ([engines.md §model-md](engines.md#model-md)) | an agent, through a Model answer or a Repair on the model ([§model-answer](models.md#model-answer), [§model-repair](models.md#model-repair)) | code, for this contract and for what evidence.md composes and account.md computes; agents, in what [door.md §gives](door.md#gives) gives; the developer, through each bound's Meaning, on the basis line and in a carry of the bounds |
| `models/<model>/<name>.tla`, `models/<model>/<name>.als` | the model's engine files ([engines.md §model-md](engines.md#model-md)) | the same | code, only through the engine's parser ([engines.md §engine-text](engines.md#engine-text)) and in composition; agents, in what [door.md §gives](door.md#gives) gives |
| `models/<model>/<p>/claims/<claim>/encoding.<ext>`, `witness-<key>.md`, `fault-<key>.md` | the claim's encoding, witnesses and faults on that model ([§slots](models.md#slots)) | an agent, through a Fill-a-slot answer or a Repair on the model ([§slot-answer](models.md#slot-answer), [§model-repair](models.md#model-repair)) | code, for this contract and in composition; agents, in what [door.md §gives](door.md#gives) gives; the developer, through a witness's Meaning and a fault's Mechanism wherever evidence.md, account.md and decisions.md show them |
| `models/<model>/<p>/journeys/<journey>/schedule.md` | the journey's schedule on that model ([§slots](models.md#slots)) | the same | code, for this contract and in composition; agents, in what [door.md §gives](door.md#gives) gives; the developer, through its end's Meaning, where [decisions.md §rulings](decisions.md#rulings) shows a surprise on its path question |
| `models/<model>/world/<part>/<row>/<item>.<ext>` | a misbehaviour witness: the target reached once the world row has done that item ([§slots](models.md#slots)) | the same | code, for this contract and in composition; agents, in what [door.md §gives](door.md#gives) gives; the developer, where [decisions.md §rulings](decisions.md#rulings) shows a surprise on it |

- A model's key follows [forms.md §page-rules](forms.md#page-rules)'s key rule.
  A key that begins `lifecycles-` is a lifecycle model's
  ([§lifecycle-model](models.md#lifecycle-model)) and no other model's (M117).
- A thing's slots on a model sit at the path its folder has under `design/`:
  `models/<model>/<p>/<kind>/<key>/` for the thing in `design/<p>/<kind>/<key>/`,
  so its slots on every model are found from its own path (M50, M107–108). Forma
  creates each folder under `models/` when it first writes there.
- Each of these folders also holds its receipt
  ([door.md §receipts](door.md#receipts)), and the evidence, surprises, reductions,
  weaker forms and explanations [evidence.md §names](evidence.md#names) places
  there; `actions/<part>/`,
  and the evidence of the model's phases and facts questions at the top of its
  folder, hold evidence only (M50–52).
- Only agents write the files this contract owns, as answers Forma checks and
  takes in with a receipt (M50, M59–60, M236, M240). Code moves or removes them
  only as [§parts-change](models.md#parts-change) says, and a Repair answer
  removes a slot only as [§model-repair](models.md#model-repair) lets it. A
  change no accepted answer made, a developer's direct edit included, counts for
  nothing (M238, M326–329; [door.md §change](door.md#change)).

<a id="slots"></a>

## Slots

A slot is a fixed place for one piece an agent writes, in a file of its own
beside the evidence it serves, so filling one slot never rewrites another
(M107–108). It is identified by its kind, its model and what it serves, which its
path fixes, so its entry and model are fixed fields (M158–160).

| Slot | Path under `models/<model>/` | Exists on a model |
| --- | --- | --- |
| Encoding | `<p>/claims/<claim>/encoding.<ext>` | for each claim whose parts the model covers (M112) |
| Witness | `<p>/claims/<claim>/witness-<key>.md` | for each claim whose encoding on the model is a property: any number, at least one owed ([§owed](models.md#owed); M113, M136–137) |
| Fault | `<p>/claims/<claim>/fault-<key>.md` | the same (M114, M136–137) |
| Schedule | `<p>/journeys/<journey>/schedule.md` | for each confirmed journey whose parts a TLC or Alloy model covers, on that model (M115, M118) |
| Misbehaviour witness | `world/<part>/<row>/<item>.<ext>` | for each item not struck of each world row with a seam in a part a TLC or Alloy model covers, on that model (M96–98, M113, M134–135) |

- `<p>/claims/<claim>` and `<p>/journeys/<journey>` are the thing's folder under
  `design/`. A journey code adds has no page; its schedule sits under its
  reserved key, in the part or span it belongs to
  ([design.md §code-journeys](design.md#code-journeys)) (M87–90).
- A model covers a thing's parts when its Parts names every one of them; a
  thing's parts are [design.md §filing](design.md#filing)'s (M84–87). A journey
  is confirmed while a confirmation of it is in force
  ([decisions.md §in-force](decisions.md#in-force)).
- `<ext>` is `tla` on a TLC model and `als` on an Alloy one. A lifecycle model's
  encoding is `encoding.md`, and so is an encoding on any model that gives a
  reason (below). A claim has one encoding on a model: the file accepted for it
  replaces one of another extension.
- A witness's or fault's `<key>` follows
  [forms.md §page-rules](forms.md#page-rules)'s key rule and is chosen by the
  agent who fills it; it tells that slot from the claim's others of its kind on
  the model.
- `<part>/<row>` is the world row's part and key, and `<item>` the item as
  [forms.md §menu](forms.md#menu) writes it.
- A claim's encoding on a model is a property when its slot is filled and does
  not give a reason.

Each slot serves the questions [evidence.md §questions](evidence.md#questions)
composes from it. Their expected
outcomes are fixed by the slot's kind before anything runs, and no one edits them
(M112–115, M127–128).

<a id="lifecycle-model"></a>

## The lifecycle model

The lifecycle engine needs no model files (M117). A part's lifecycle model, keyed
`lifecycles-<part>`, is the part's confirmed lifecycles, which the engine
examines directly (M117–118):

- It exists while its part has a lifecycle whose confirmation is in force, and
  covers that one part.
- It has no `model.md` and no engine files, so no Model answer writes it: a
  Model answer for a key that begins `lifecycles-` is refused
  ([§model-answer](models.md#model-answer)). Its folder holds only its slots, at
  [§slots](models.md#slots)'s paths, and what door.md and evidence.md place
  beside them.
- It has no bounds: its results carry phase level as their bound (M120–121).
- Its slots (M118–120): for each claim whose parts are its part, an encoding, a
  forbidden form or a reason; where that is a forbidden form, witnesses whose
  targets are a combination or a transition, and faults that overlay cells. It
  has no schedule, since it steps journeys with none (M118), and no misbehaviour
  witness.
- Its lifecycles are pages, which Restate answers write
  ([forms.md §lifecycles](forms.md#lifecycles)). The freeze holds them with it
  ([§freeze](models.md#freeze)); every slot on it is written for each lifecycle
  of its part too ([§slot-currency](models.md#slot-currency)); and its authors,
  whom an explanation of its surprises may not come from, are the sessions whose
  answers wrote those pages ([door.md §receipts](door.md#receipts); M237).
- [§one-model-first](models.md#one-model-first) does not count it.

<a id="model-answer"></a>

## Accepting a Model answer

A Model answer gives the whole text of one TLC or Alloy model, its `model.md`
and every engine file (M231); [door.md §answer-holds](door.md#answer-holds) says
how its folder holds them and what Forma gives for it. It may create the model.
Code accepts it only when all of these hold, and otherwise refuses it, naming
every check that fails (M231, M239):

1. **Form.** `model.md` parses into
   [engines.md §model-md](engines.md#model-md)'s form. The model's key follows
   [forms.md §page-rules](forms.md#page-rules)'s key rule and does not begin
   `lifecycles-`. Each part its Parts names is on the part list. Its entry is
   one of its engine files.
2. **Rows.** The Actions, Misbehaviours and Phases tables hold, each once, the
   rows [engines.md §model-md](engines.md#model-md) gives for the covered parts
   as they stand and the strikes in force ([forms.md §menu](forms.md#menu)), and
   no other but a row for a struck item, as
   [engines.md §model-misbehaviours](engines.md#model-misbehaviours) allows;
   every Action, Row, Item and Lifecycle in them names one that exists
   (M96–100).
3. **Constants and trades.** For TLC, the Bounds have exactly one `constant` row
   for each constant the entry and the modules it uses declare, and no other, and
   each `choose` row names an operator the model's files define.
4. **Parser.** The engine's parser accepts every engine file of the model, those
   the entry does not reach included, and every operator, predicate, constraint
   and expression `model.md` names exists with the parameters and domains it
   states (M103, M231):
   - for TLC, no file or definition has a name kept for code
     ([engines.md §model-fields](engines.md#model-fields)); the entry defines
     `Init`, a state predicate, and `vars`, the tuple of every variable the
     model declares, each once, in any order; the type invariant is a state
     predicate the model's files define, and the constraint, as its row writes
     it, a state predicate SANY accepts in a module that extends the entry; each
     operator of an Actions row, and of a Misbehaviours row of an item not
     struck, is an action defined in the model's files, and SANY accepts a
     module that extends the entry and applies each to its row's parameters over
     their domains; and each Phases expression is a state function of its Over,
     as SANY reads it in such a module;
   - for Alloy, no file or definition has a name kept for code or a slot
     ([engines.md §model-fields](engines.md#model-fields)); the language server
     lists each operator as the one predicate of its name in the model's files,
     and each phase's signature as the one signature of its name; and the names
     and the Bounds are put to the parser in one probe module that opens the
     entry, holding a function for each parameter's domain and each Over's, with
     it as its whole body; for each row, a function giving the set of bindings
     its operator holds for over those domains, as code observes it, or a
     predicate for a row with no parameter; a function for each Phases
     expression in its Over, and a predicate asking it of each phase's
     signature; and a command at the Bounds. The parser accepts the module, and
     the language server lists exactly those definitions, each over its whole
     line, so no cell ends its definition or adds to it. Alloy's parser accepts
     for a parameter any domain that can meet the one its predicate declares, so
     that a row's domains are its predicate's is not checked: code examines the
     predicate over the domains the row states.
5. **Freeze.** [§freeze](models.md#freeze) does not refuse it.
6. **One model first, a smaller model.**
   [§one-model-first](models.md#one-model-first) does not refuse it.
7. **Its item.** An answer for an item that owes a model covering certain parts
   ([§owed](models.md#owed)) covers every one of them.

Accepted, it makes the model's `model.md` and engine files exactly those it
gives: an engine file of the model that it does not give is removed. The receipt
line of `model.md` records the strikes in force
([forms.md §menu](forms.md#menu)) and the model's authors
([door.md §receipts](door.md#receipts)). A change to the engine files makes all
evidence on the model not current, and a changed bound makes new questions
(M128–130, M168–169; [evidence.md §currency](evidence.md#currency)). Checks 1 to
4 are asked again whenever the project is read
([§parts-change](models.md#parts-change); M247–249); checks 6 and 7 only when an
answer is checked.

<a id="slot-answer"></a>

## Accepting a Fill-a-slot answer

A Fill-a-slot answer gives the text of one slot file (M232);
[door.md §answer-holds](door.md#answer-holds) says how its folder holds it, and
[door.md §gives](door.md#gives) what Forma gives for it. Code accepts it only
when all of these hold, and otherwise refuses it, naming every check that fails
(M232, M239):

1. **The slot.** It exists by [§slots](models.md#slots), on a usable model
   ([§slot-currency](models.md#slot-currency)), and the file has the path and
   extension [§slots](models.md#slots) gives it.
2. **Form and references.** A Markdown slot parses into its form
   ([engines.md §slot-forms](engines.md#slot-forms)), and every reference in it
   resolves against the restatement and the model: a fault's Action is a row of
   the model's Actions table; a lifecycle form or overlay names only lifecycles
   of the model's part, their phases, and actions they have as columns; a
   schedule's tables and its end are as check 5 says.
3. **Native text.** Its native text, the file or its fenced block, added to the
   model, is accepted by the engine's parser, defines exactly the names
   [engines.md §slot-forms](engines.md#slot-forms) gives for its slot and
   nothing else, and declares no variable or constant and brings in no module
   (M112–113). On TLC it is added in a module that extends the entry, and SANY
   reads each name as what [engines.md §slot-forms](engines.md#slot-forms) says
   it is: a state predicate, a temporal formula or an action. On Alloy it is put
   to the parser in a probe module that opens the entry, and the range the
   language server gives its one definition covers the whole text, whitespace
   aside, so nothing, a fact or an `open` included, stands beside it; a modifier
   such as `private` stands before that range, so the definition is written
   without one. `Target`, `Fault`, `Claim` and `End` take the parameters
   [engines.md §slot-forms](engines.md#slot-forms) gives them and no others.
   Alloy's parser tells neither a state predicate from an action nor a
   constant-level value from one that varies, so those levels are not checked on
   Alloy.
4. **Fault and fairness.** A fault's `Fault` has the parameter count of its
   action's operator (M103, M114). Each term of a `Fairness` has
   [engines.md §slot-forms](engines.md#slot-forms)'s form: it is of one operator
   of the Actions table, applied to its row's parameters and ranging over its
   row's domains and no other set, and beside that operator the `Fairness` names
   only `vars` and constant-level definitions. Fairness on a step the model
   never takes, an operator applied outside its row's domain, is met by no
   behaviour that keeps that step enabled, and the claim's property would then
   hold of what is left. A parameter whose domain is not constant-level is bound
   by the `\E`, since TLC takes a fairness quantifier, the `\A`, only over a
   constant set. On Alloy, checks 3 and 4 put a fault to the parser in the probe
   module with a predicate applying `Fault` to its action's parameters' domains,
   and again where it is composed: in the copy of the file that defines its
   action's predicate, with the entry opening that copy, since a name the entry
   sees is not always one that file sees.
5. **Schedule.** It has one Steps row per step of its journey; each binds
   exactly the parameters of its step's operator, the one the Actions table
   gives the step's action; the entity table gives a value for every entity
   [engines.md §slot-forms](engines.md#slot-forms) requires; and it has a start
   table exactly when the journey has one (M115). On TLC, SANY accepts a module
   that extends the entry and holds the start, a state predicate, each value, a
   constant-level expression, and each step's operator applied to its bindings.
   On Alloy, the start, each value and each binding is one whole native formula
   or expression: a probe module that opens the entry holds each as the whole
   body of a definition of its own, a predicate for the start and a function for
   each value and each binding, with a predicate applying each step's operator
   to its bindings' functions; the parser accepts it, and the language server
   lists exactly those definitions, each over its whole line, so none ends its
   definition, holds a second formula or expression beside its own, or adds a
   definition or a fact. Its end is there exactly when its journey should
   happen, and `End`, whose block check 3 checks, is a state predicate, on TLC
   of level 1 or less as SANY reads it; like a witness's `Target`, it declares
   no variable or constant and brings in no module, so it speaks only of the
   model's variables and constants (M113, M115).
6. **Freeze.** [§freeze](models.md#freeze) does not refuse it.

Accepted, its receipt line records the pins of the entries it is written for
([§slot-currency](models.md#slot-currency);
[door.md §receipts](door.md#receipts)). Checks 1 to 5 are asked again whenever
the project is read ([§slot-currency](models.md#slot-currency); M247–249).

<a id="model-repair"></a>

## A Repair on a model

A Repair answer whose target is a model
([decisions.md §rulings](decisions.md#rulings)) writes the targeted model files
or slots, naming the mechanism added (M234);
[door.md §repair-answer](door.md#repair-answer) routes it and keeps its
mechanism. On a TLC or Alloy model it holds files of that model only: its model
files, any of its slots, or both, and at least one. Code checks the model files
as a Model answer's ([§model-answer](models.md#model-answer), check 7 aside) and
each slot as a Fill-a-slot answer's ([§slot-answer](models.md#slot-answer)),
against the model files as the answer leaves them, except that a slot need only
exist by [§slots](models.md#slots). A lifecycle model is its part's confirmed
lifecycles ([§lifecycle-model](models.md#lifecycle-model)), so a Repair on it
holds its slots, those lifecycle pages, or both, each page checked as a Restate
answer's ([design.md §repairs-redirects](design.md#repairs-redirects); M234).

**Removals.** A Repair on a TLC, Alloy or lifecycle model may also hold
`removed.md`, at its folder's top, naming the slots of the model it removes,
since a Repair writes the slots it targets (M234): one slot file a line, by its
path from the project folder, each once, each a filled slot of a claim, journey
or world row that a slot the answer holds serves, and none a file the answer
holds. It removes no slot the freeze holds ([§freeze](models.md#freeze)), and no
claim's last encoding, witness or fault there: after the answer, each such claim
keeps its encoding, and while that is a property, a witness and a fault. So a
repair that changes what a fault removes can give the fault a new key and retire
the old one. Accepted, each slot `removed.md` names is removed with its receipt
line, and the evidence of its questions with it
([evidence.md §removed](evidence.md#removed)).

It is checked against the freeze as any answer is ([§freeze](models.md#freeze)),
so one that changes the model's files waits for the ruling of every other
surprise still open on the model (M143–147).

What the verdict asks of it is checked too, and an answer
that fails it is refused:

- on a model a ruled surprise ran on, it changes at least one file it holds that
  the surprise's question read, as its basis names, so that question is asked
  again: a repair that changes nothing a surprise rested on repairs nothing. A
  real finding aimed at another model is held to the rules below alone;
- for *model wrong*, it changes no encoding of a claim the ruled surprises are
  on: the model is repaired and the property is untouched;
- for *property wrong*, answered on a model, it changes the encoding of a claim
  the ruled surprises are on, and none of the model's own files;
- for a *real finding* on a model, when a ruled surprise is on a claim, the
  mechanism it adds enters as an expectation with its planted defect: it holds,
  for a claim a ruled surprise is on, a fault whose `Mechanism` is the mechanism
  its `repair.md` names ([door.md §repair-answer](door.md#repair-answer)). When none is,
  no fault can hold it, and the question that surprised, asked again, is its
  expectation.

<a id="freeze"></a>

## The freeze

A surprise stays open until the developer rules
([evidence.md §surprises](evidence.md#surprises)). While a surprise on a model is
unruled, its model, the claim's slots and the bounds cannot change, and nothing
it rests on can be removed, so it cannot be hidden (M143–147). The freeze holds
these files:

- the model's: for a TLC or Alloy model, its `model.md`, which holds its bounds,
  and its engine files; for a lifecycle model, the pages of its part's
  lifecycles that were confirmed when the surprise opened, those its basis names
  ([§lifecycle-model](models.md#lifecycle-model));
- when the surprise is on one of a claim's questions on the model, the claim's
  slots on that model.

The surprise's file records them when it opens, each with its SHA-256, as `held`
([evidence.md §surprise-file](evidence.md#surprise-file)), so what is held
never rests on what the freeze itself discounts. The freeze is a matter of bytes:
a file `held` names is changed when its bytes are not those, or it is gone; and
an engine file of the model, or a slot of that claim on that model, that `held`
does not name is new:

- **at an answer**, one holding or removing a file `held` names, or holding a
  new one, is refused whatever its bytes, a Repair answer included;
  [§parts-change](models.md#parts-change) refuses a drop, and
  [design.md §removal](design.md#removal) a removal or re-filing, of anything an
  unruled surprise rests on (M147);
- **at every read**, a changed or new file counts for nothing until the surprise
  is ruled or the file is restored or removed, and it shows as a change with
  that reason
  ([door.md §read-checks](door.md#read-checks)); no clock is
  read, so a merge brings in no change the freeze forbids, whenever and wherever
  it was made (M247–249);
- **at a decision**, the data form of a lifecycle model
  ([engines.md §lifecycle-engine](engines.md#lifecycle-engine)) is frozen with
  its pages: while a surprise on one is open, no pick of a choice whose cells
  its lifecycles pose, and no confirmation or decline of one of its lifecycles,
  is made ([decisions.md §forma-show](decisions.md#forma-show)).

The freeze holds until the ruling; each surprise holds its own, so a model with
two open surprises is frozen until both are ruled (M143–147).

<a id="slot-currency"></a>

## When a slot is current, owed again or kept

A slot is written for these entries (M158–160, M176):

- **Encoding, witness**: the claim
- **Fault**: the claim and, on TLC and Alloy, its Action
- **Schedule**: the journey, each action its steps name, and each lifecycle that
  has a step's action with a case as a column
- **Misbehaviour witness**: the world row
- **any slot on a lifecycle model**: also each lifecycle of its part

Its receipt line records the pin of each (M52, M176;
[door.md §receipts](door.md#receipts) gives the line,
[design.md §pins](design.md#pins) the pins). A slot is filled when its file has
a receipt line that matches it (M240). A filled slot is current while all of
these hold:

1. it exists by [§slots](models.md#slots);
2. its model is usable: for a TLC or Alloy model, none of its files counts for
   nothing and it is not owed a Model answer ([§parts-change](models.md#parts-change));
3. each pin its receipt line records equals that entry's pin now (M176–177);
4. it passes [§slot-answer](models.md#slot-answer)'s checks 2 to 5 against the
   model and the restatement as they stand (M247–249).

Only a current slot is composed into a question.

A filled slot for which 1 and 2 hold and 3 or 4 fails is owed again, although
its file is unchanged (M176–177): [§owed](models.md#owed) owes it, and
[door.md §gives](door.md#gives) gives the agent the entries as they stand, the
old file and the checks it fails. The agent may return the same text; accepting
it records the pins as they are then.

A filled slot for which 1 or 2 fails is kept, not current and not owed again: a
schedule of a journey whose confirmation is not in force; a witness or fault of
a claim whose encoding there no longer is a property; a misbehaviour witness of
an item struck; a slot of a thing whose parts the model no longer covers; a slot
on a lifecycle model while its part has no confirmed lifecycle; a slot on a
model owed a Model answer. It is current again, with no new answer, once 1 to 4
hold, so a lapse costs no answer. Code removes a slot only as
[§parts-change](models.md#parts-change) says, and a Repair answer only as
[§model-repair](models.md#model-repair) lets it.

<a id="parts-change"></a>

## A model whose parts change, and things removed or moved

**A model owed a Model answer.** A TLC or Alloy model is owed a Model answer,
the item `model:<model>` ([account.md §items](account.md#items)), while it would
fail [§model-answer](models.md#model-answer)'s checks 1 to 4 as things stand: an
action, lifecycle or unstruck item of a part it covers has no row, a row names
one that no longer exists, a part it names is gone, or its engine files no
longer pass the parser; and, for TLC, while its `model.md`'s receipt line
records a strike no longer in force, since that row's operator was never checked
([forms.md §menu](forms.md#menu)) (M103, M247–249). Until one is accepted its
slots and evidence are kept and not current
([§slot-currency](models.md#slot-currency)), and it meets no journey rule
([account.md §journey-rules](account.md#journey-rules)).

**A part dropped.** A Model answer whose Parts no longer names a part the model
covered drops that part. Accepted, code removes from that model every slot of a
thing whose parts include the dropped part, and every misbehaviour witness under
`world/<dropped part>/`, with their receipt lines; the evidence that goes with
them is removed as [evidence.md §written-moved](evidence.md#written-moved) says.
The answer is refused while an unruled surprise on the model rests on what the
drop would remove: its own file is among the evidence that would go (M147).

**Things removed or added back.** When a Restate answer removes a thing, a world
row, a part or a span
([design.md §removal](design.md#removal)),
code removes in every model the slots of what was removed: those at the thing's
path, the misbehaviour witnesses of a removed world row, those of every thing a
removed part or span held, and those of each journey code adds that goes with
what was removed, with their receipt lines; the evidence goes as
[evidence.md §written-moved](evidence.md#written-moved) says (M87–90, M147,
M170–172). Which thing is the same thing afterwards, keeping its slots, and
which is new, its slots owed afresh, is
[design.md §removal](design.md#removal)'s.

**Things re-filed.** When one Restate answer re-files a thing to another part's
or span's folder with the same key and pin
([design.md §removal](design.md#removal)), its folder in every model moves with
its slots and its receipt; the slots stay as they were, since filing changes
neither a thing's parts nor its pin (M85–87). Each moved receipt line's
`pins` then names the moved entry by its new name, its pin unchanged, the line
rewritten with the same `sha256` ([door.md §receipts](door.md#receipts)), so no slot
is owed again for the move. What becomes of the evidence in those folders is
[evidence.md §moved](evidence.md#moved)'s.

<a id="one-model-first"></a>

## One model first, and a smaller model

Start with one model for the whole system; split only when an engine cannot
answer (M104–105). Both rules below count TLC and Alloy models only, never a
lifecycle model ([§lifecycle-model](models.md#lifecycle-model)):

- While no TLC or Alloy model exists, a Model answer is accepted only when its
  model covers every part on the part list.
- A Model answer that splits is accepted only while a question on a model it
  splits from has current evidence whose outcome is unanswered
  ([evidence.md §running](evidence.md#running)): an engine could not answer it
  there (M104–105); or, for a model on another engine than every model it splits
  from, while a claim whose parts it covers is owed another engine
  ([§owed](models.md#owed)): its encoding on every model covering it says why
  that engine cannot express it (M104–105, M112). An answer splits when, after
  it, its model covers fewer parts than it did before, or fewer than another TLC
  or Alloy model covers, where before it the model did not exist or covered no
  fewer; the models it splits from are that model as it was and every such other
  model. An answer for a model that already covered fewer parts than another,
  and drops nothing, is not put to this again. So a split resting on unanswered
  evidence that is answered before the split is submitted is refused.

Both are checked only when an answer is checked, never when the project is read
(M247–249 lists what is checked again).

<a id="owed"></a>

## What is owed

Each of these is owed until it holds.
[account.md §items](account.md#items) names each as an item, with who supplies it
and what it waits for, and [door.md §forma-answer](door.md#forma-answer)
refuses an answer for one that is not owed
(M264–267):

- **A slot** that exists by [§slots](models.md#slots) on a usable model
  ([§slot-currency](models.md#slot-currency)) and is not filled, or is owed
  again ([§slot-currency](models.md#slot-currency)): a Fill-a-slot answer. A
  claim on a model where its encoding is a current property is owed a witness
  while it has none filled there, and a fault while it has none filled there,
  each under a key the agent chooses (M113–114, M136–137). Beyond the first, a
  further witness or fault of such a claim may be answered at any time, under a
  key it has not yet used, for the item `slot:<the claim's folder>/witness` or
  `/fault`, though that item is listed as missing only while the claim has none;
  so a claim takes a witness for each antecedent it needs. A Repair of the model
  may remove others of the claim's witnesses or faults there, never its last
  ([§model-repair](models.md#model-repair)), so a fault whose mechanism a repair
  changed takes a new key and its old key goes; a slot removed is owed again
  only as any slot not filled is. A slot the freeze holds stays owed and waits
  for the ruling ([§freeze](models.md#freeze)).
- **A model** owed a Model answer ([§parts-change](models.md#parts-change)).
- **A model to cover.** A part, or the parts of a claim or of a confirmed journey,
  that no one model covers: a Model answer. While no TLC or Alloy model exists,
  what is owed is a TLC or Alloy model covering every part, whatever lifecycle
  models cover ([§one-model-first](models.md#one-model-first); M104–105, M112, M115).
- **Another engine.** A claim whose encoding gives a reason on every model that
  covers it: a model on another engine, or the developer's acceptance of its risk
  (M112, M218–219; [decisions.md §accept](decisions.md#accept)).
