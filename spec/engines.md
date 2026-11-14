# The engines

Spells out [SPEC.md](SPEC.md) for how each engine is
driven: the engine text a model's files hold; `model.md` and its tables; what
each slot holds on each engine; how code composes each question for TLC, Alloy
and the lifecycle engine, and the replay; and the form of a kept trace. Which
questions are asked, what their evidence holds and when it is current are
[evidence.md](evidence.md)'s; which slots exist and when they are owed,
[models.md](models.md)'s. `M<n>` is line n of [SPEC.md](SPEC.md).

<a id="engine-text"></a>

## Engine text

Code reads engine text only through the engine's own parser, from the toolchain
[evidence.md §toolchain](evidence.md#toolchain) pins: SANY for TLA+, Alloy's own parser
for Alloy. Where a check needs a question the files do not ask, code generates a
module that asks it, such as one applying each operator to its parameters, and
has the parser read that (M33–34, M103).

Alloy's parser is used two ways. Its command line's `commands` parses and
type-checks a file with every module it opens, and reports an error by line and
column. Its language server lists each signature, field, predicate, function,
assertion and command a file defines, with its source range, but never a fact or
an `open`. A range counts lines and characters from zero, and Alloy ends a line
at a line feed, a carriage return or the two together, so code counts a file's
lines the same way wherever it reads a range (M103).

**What a parser gave may be kept**, in the operating system's temporary folder
and nowhere in the project, under the SHA-256 of every file the parser read,
the pinned tool and the code that reads its output. A kept result is used only
under that key, so it gives exactly what parsing again gives, and deleting it
changes nothing (M54).

<a id="model-md"></a>

## `model.md`

A model is a set of engine files covering a set of parts, and carries an action
table, a state projection and its bounds (M94–101). A TLC or Alloy model writes
them in `model.md`; a lifecycle model has none
([models.md §lifecycle-model](models.md#lifecycle-model)).

```markdown
# Tenant documents, whole system

| Field | Value |
| --- | --- |
| Engine | tlc |
| Parts | directory, documents |
| Entry | Tenant.tla |
| Type invariant | TypeOK |

## Bounds

| Bound | Value | Meaning |
| --- | --- | --- |
| constant People | {p1, p2} | two people |
| constant Docs | {d1} | one document |
| choose PickOwner | - | the first owner in order is taken; other owners are not explored |

## Actions

| Action | Operator | Parameters |
| --- | --- | --- |
| documents/share | Share | p \in People, d \in Docs |

## Misbehaviours

| Row | Item | Operator | Parameters |
| --- | --- | --- | --- |
| directory/mailer | drop | DropMail | p \in People |

## Phases

| Lifecycle | Over | Expression |
| --- | --- | --- |
| documents/document | d \in Docs | DocPhase(d) |
```

`model.md` is a level-1 heading, the model's name; the field table; and the four
sections `## Bounds`, `## Actions`, `## Misbehaviours` and `## Phases`, each
once, in any order, each holding only its table. Nothing else stands in it. Its
tables follow [forms.md §page-rules](forms.md#page-rules)'s rules for tables and
cells, and every reference in it is written `<part>/<key>` (M59–60, M94–101).

<a id="model-fields"></a>

### Fields (M94–101)

| Field | Value |
| --- | --- |
| Engine | `tlc` or `alloy` |
| Parts | the parts the model covers: keys of parts on the part list, each once |
| Entry | the root engine file, by its name. For `tlc`, a `.tla` file that defines `Init`, a state predicate, and `vars`, the tuple of every variable the model declares, each once; code composes the next-state relation from the Actions and Misbehaviours tables ([§composition](engines.md#composition)), so an own `Next` is not used. For `alloy`, an `.als` file, the root module, whose own facts give the initial state and the transitions |
| Type invariant | for `tlc`, the name of a state predicate the model's files define, which every question on the model checks; for `alloy`, `-` |

A model's engine files are the files at the top of its folder with its engine's
extension, `.tla` for `tlc` and `.als` for `alloy`, so a module is opened or
extended by its name alone and never by a path (M50, M94).

Code composes files and definitions of its own beside a model's, each named from
`Forma` or `forma`, and a slot defines `Claim`, `Target`, `Fault` or `End`
([models.md §slots](models.md#slots)). Those names are kept for them on every
engine: no engine file of a model has a name beginning `Forma` or `forma`; none
defines a name beginning so; on TLC none defines `Invariant`, `Property`,
`Fairness`, `Target`, `Fault` or `End`, and on Alloy none defines anything the
language server lists ([§engine-text](engines.md#engine-text)) named `Claim`,
`Target`, `Fault` or `End`, since a slot defines those; and no parameter or Over
the tables below name begins so, since code binds a row's parameters and an Over
around its own names (M103, M112–115).

<a id="bounds"></a>

### Bounds (M101)

`| Bound | Value | Meaning |`. **Meaning** says what the row bounds, in the
developer's terms, such as "two people, two tenants, one document"; the basis
line shows it (M269–271; [account.md §basis-line](account.md#basis-line)). An agent
writes the bounds; the developer carries them
([decisions.md §carry](decisions.md#carry)), and a changed bound makes
new questions ([evidence.md §names](evidence.md#names)) (M127–130,
M215–216, M237–238).

Each engine, and its rows:

- **`tlc`**: `constant <Name>`, exactly one for each constant the entry and the
  modules it uses declare, and none for any other name; optionally one
  `constraint`, whose Value is a state predicate written in the cell as native
  text, which may use what the model's files define, so that the bound is in the
  row and a change to it is a changed bound; it bounds every question on the
  model but a liveness claim's, and the evidence of every question it bounds
  carries it as a bound; and one `choose <Operator>` for each operator of the
  model's files whose definition uses `CHOOSE`, its Value `-`
- **`alloy`**: `scope`, once: what follows `for` in a command, in the scope form
  below, such as `3 but exactly 1 Doc`; optionally `steps`, a number of steps or
  a range `m..n` of them, such as `5` or `1..10`, and `int`, the integer
  bitwidth, a number of at least 1; each at most once

A `choose` row records a trade: `\E` in `Init` explores every choice while
`CHOOSE` picks one, so what the pick leaves unexplored is a bound the result
carries, and its Meaning says what is not explored, in the developer's terms.
Code checks that the operator it names is defined in the model's files
([models.md §model-answer](models.md#model-answer)); that the agent recorded
every `CHOOSE` is not checked, since code reads no engine text but through the
parser, and so it stands with the encoding's fidelity among what the account
cannot know ([account.md §cannot-know](account.md#cannot-know)).

A constant's Value is written in a small form, which code reads itself because it
is Forma's, not the engine's: an integer; a string in double quotes; `TRUE` or
`FALSE`; a range `m..n` of integers; or a set `{…}` of such values or of
model-value names, a model-value name being letters, digits and underscores.
Reduction shrinks values in this form (M101, M148;
[evidence.md §surprises](evidence.md#surprises)).

An Alloy scope is written in a small form too, read by code for the same reason:
a default number; or a default number, ` but ` and one or more signature bounds
separated by `, `; or signature bounds alone. A signature bound is a number,
after `exactly ` or not, then a space and the signature's name, as in
`exactly 1 Doc`; a name is letters, digits and underscores, with `/` after each
module it is qualified by. Steps and the bitwidth have their own rows and never
stand in the scope (M101).

Code writes a configuration's constants and a command's bounds from these values,
so a value not in its form is refused, and nothing but a bound can stand in one
(M101, M127–128).

A claim's bounds on a model are every row of its Bounds, but for a liveness claim
on a TLC model the `constraint` row, which does not bound it (M101, M139–140,
M215–216).

<a id="model-actions"></a>

### Actions (M96–98)

`| Action | Operator | Parameters |`. One row for each action of each part the
model covers, and no other. **Action** names the action, `<part>/<action>`.
**Operator** is an operator (TLC) or predicate (Alloy) defined in the model's
files that performs it; for TLC it is an action. No two rows of the Actions and
Misbehaviours tables name one operator, so a fault composed in place of one
action's operator changes that action alone (M114). **Parameters** lists its
parameters in order, each with its native domain, `p \in People` for TLC or
`p: Person` for Alloy; or `none`, which an empty cell is not. A parameter's name
is letters, digits and underscores, given once in its row. The parameters are
separated by the commas that stand outside every bracket of a domain and every
string, so a domain such as `eligible[A, B]` is one (M103).

For Alloy, **Operator** is the predicate's name alone, without its module, and
the model's files define exactly one predicate of that name. A parameter ranges
over atoms: its domain is one whole native expression giving a set of them,
which may speak of the parameters before it, with no multiplicity such as `set`
or `lone` and no arrow, since code observes a row's bindings as tuples of atoms
(M103).

<a id="model-misbehaviours"></a>

### Misbehaviours (M96–98)

`| Row | Item | Operator | Parameters |`. One row for each item not struck of
the menu of each world row with a seam in the parts the model covers
([forms.md §menu](forms.md#menu)), and no other but a row for a struck item of
such a row. **Row** names the world row, `<part>/<row>`; **Item** is the item as
[forms.md §menu](forms.md#menu) writes it; **Operator** and **Parameters** are
as for Actions.

<a id="model-phases"></a>

### Phases (M99–100)

`| Lifecycle | Over | Expression |`. One row for each lifecycle of each part the
model covers, and no other. **Lifecycle** names it, `<part>/<lifecycle>`.
**Over** names one parameter and its native domain, as a Parameters item does.
**Expression**, in that parameter, gives the entity's phase: for TLC, a state
function whose value is a string equal to a phase as its lifecycle writes it;
for Alloy, an atom of the signature named by the phase, each hyphen written as an
underscore. For Alloy, the model's files define exactly one signature of that
name for each phase, an atom of two of them is in no one phase, and an Over's
domain and its Expression are each one whole native expression giving a set of
atoms.

The tables also serve questions with no slot: whether each row's operator is
enabled, whether each Phases expression gives one of its lifecycle's phases,
and, for Alloy, whether the model's facts admit an instance (M99–103, M131–135;
[evidence.md §questions](evidence.md#questions)).

<a id="slot-forms"></a>

## What each slot holds

Every Markdown form below follows [forms.md §page-rules](forms.md#page-rules)'s
rules for tables and cells. A field
table is `| Field | Value |` with the rows given, each once. A fenced block is one
fenced code block with the info string `tla` or `alloy`. A slot holds what its
form gives and nothing else (M59–60, M107–108).

**Encoding** (M112): the native property, or why this engine cannot express it.

Each engine, and what the file holds:

- **TLC, `encoding.tla`**: exactly one of `Invariant`, a state predicate, and
  `Property`, a temporal formula; for a claim of kind liveness, `Property` and
  `Fairness` (below)
- **Alloy, `encoding.als`**: exactly one assertion, `assert Claim`
- **lifecycle, `encoding.md`**: a forbidden form (below), for a claim of kind
  safety or structure; a claim of kind liveness gives a reason, since a
  forbidden form is no liveness property
- **any, `encoding.md`**: a field table with the one row `Cannot express`: why
  this engine cannot express the claim

`Fairness` is a conjunction of terms. Each term is `WF_vars` or `SF_vars` of one
operator of the Actions table, applied to its row's parameters by their names in
the row's order, to which constant-level conditions on those parameters may be
conjoined. Each of the row's parameters is bound once, over the domain its row
gives, written as the row writes it: either by the one `\A` the term stands
under, which asks fairness of each binding by itself, or by one `\E` at the head
of the action inside `WF_vars` or `SF_vars`, which asks it of the row whatever
the binding. A term of a row with no parameter stands alone (M72, M112).

**Witness** (M113), `witness-<key>.md`: a field table with the one row `Meaning`,
what is reached, in the developer's terms; then, on TLC, one fenced `tla` block
defining exactly `Target`, a state predicate; on Alloy, one fenced `alloy` block
defining exactly `pred Target`; on a lifecycle model, a combination or a
transition to reach (below).

**Misbehaviour witness** (M113, M134–135), `<item>.tla` or `<item>.als`: native
text only. On TLC, exactly one definition, `Target`, a state predicate that holds
once the misbehaviour has happened; on Alloy, exactly one predicate,
`pred Target`.

**Fault** (M114, M297–300), `fault-<key>.md`: a field table

| Field | Value |
| --- | --- |
| Action | on TLC and Alloy, an action of the model's Actions table, as its row writes it; on a lifecycle model, `-` |
| Mechanism | the mechanism removed, in the developer's terms |

then, on TLC, one fenced `tla` block defining `Fault`, an action taking the
parameters of the action's operator; on Alloy, one fenced `alloy` block defining
`pred Fault` with the parameters of the action's predicate; on a lifecycle
model, an overlay `| Lifecycle | Phase | Action | Outcome |`, whose rows replace
cells of the part's lifecycles: Lifecycle one of them by its key, Phase one of
its phases, Action an action it has as a column, at least one row and each cell
at most once, and Outcome written as [forms.md §lifecycles](forms.md#lifecycles)
writes a lifecycle cell, empty as a lifecycle cell may be. Code composes a fault
in its action's row alone on TLC, and on Alloy in place of the action's
predicate, wherever the model's files use it; with its overlay over the
lifecycles on a lifecycle model; so only that action, or those cells, differ,
and the claim's encoding and the type invariant are unchanged by construction
(M114; [§composition](engines.md#composition)).

**Schedule** (M115, M304–306), `schedule.md`: these tables, each once and told by
its columns, and for a journey that should happen its end.

1. An entity table `| Entity | Value |` giving, each once, the native value, a
   constant-level expression, of every entity the journey names and of every
   entity a step with a case moves, the entity a step acts on being the one
   [lifecycle-tool.md §stepping](lifecycle-tool.md#stepping) gives. On Alloy a value
   is an expression giving one atom, the entity's: the atom it gives in the first
   state.
2. When the journey has a start table, a start table `| Start |` with one row: a
   native state predicate for the state the journey starts from.
3. A steps table `| Step | Bindings |`, one row per step of the journey, numbered
   as the journey numbers them, in order. Bindings gives each parameter of the
   step action's operator as `<parameter> = <native expression>`, the pairs
   separated by `; ` where it stands outside every bracket of an expression and
   every string; or `none` when the operator has no parameters.
4. For a journey that should happen, its end, which the journey's path question
   asks of the state after its last step
   ([evidence.md §questions](evidence.md#questions)): a field table with the one row
   `Meaning`, how `End` reads the journey's `Expected end`, in the developer's
   terms; then, on TLC, one fenced `tla` block defining exactly `End`, a state
   predicate over the model's variables and constants; on Alloy, one fenced
   `alloy` block defining exactly `pred End`, with no parameters, a predicate
   over the last state. A must-not journey's schedule has no end and defines no
   `End` (M115).

**Lifecycle forms** (M119–120). A forbidden form, and a lifecycle witness's
target, is one of two tables, naming lifecycles of the model's part by key, whose
questions are asked once each lifecycle they name is confirmed:
`| Lifecycle | Phase |`, phases that must never hold together (for a witness,
must be reached together), at least one row and at most one per lifecycle; or
`| Lifecycle | From | Action | To |` with one row, a move that must never be
taken (for a witness, must be taken), its Action one the lifecycle has as a
column and From and To phases of it.

<a id="composition"></a>

## Composing a question

Code composes every question of a claim, and every question of a model, on the
same model bytes and the same bounds, except that on TLC a liveness claim's
questions leave the model's constraint out ([§tlc](engines.md#tlc)) (M136–138).
A slot's native text, the file itself or its fenced block
([§slot-forms](engines.md#slot-forms)), enters the generated files as written;
only current slots are composed, so a slot owed again composes nothing until it
is accepted again. A question on a TLC or Alloy model reads its model's
`model.md` and every engine file of the model, and every question its slots'
files (M168–169). The generated files are, on TLC, `FormaExam.tla` and
`FormaExam.cfg`; on Alloy, `FormaExam.als` and, for a fault, the copy of the
model file it rewrites under that file's name; on the lifecycle engine,
`lifecycles.json`, the data form, and `question.json`, what it asks. The same
inputs compose the same bytes, so composing again tells currency
([evidence.md §currency](evidence.md#currency); M166–167).

A step with a case is taken only as its case: in each lifecycle of the action's
part that has the action as a column, the entity the schedule gives for it moves
from its phase, as the Phases read it before the step, to the outcome the
lifecycle's cell gives the case in that phase, as they read it after; a phase
whose cell refuses the case gives no move. A step with a case whose action no
lifecycle of its part has as a column is asked as its operator alone, and the
evidence's `cases` lists it (M115, M304–306).

<a id="tlc"></a>

### TLC

The wrapper is a module that extends the model's entry and holds the slots' text
and code's definitions, among them `FormaConstraint`, the constraint row's
predicate as the row writes it. The configuration gives each constant of the
Bounds its value, `FormaConstraint` as the constraint unless it is left out, and
the question as an invariant or a property. A fault is composed in its action's
row alone: that row's `FormaRow<n>` applies `Fault` in place of the row's
operator, and nothing of the model's files is overridden, so a definition of the
model's own that uses the action's operator, as a misbehaviour defined through the
action may, is unchanged (M114). A
value the configuration cannot hold, a range, a negative integer or a string with
an escape, at any depth, is given by a definition in the wrapper that the
configuration substitutes for the constant (M101, M114).

The next-state relation is code's: each row of the Actions table, and each
Misbehaviours row of an item not struck ([forms.md §menu](forms.md#menu)), is a
definition of its own, `FormaRow<n>`, the row's operator over its parameters'
domains, so TLC names the row of every step; the relation is their disjunction,
and the entry's own `Next`, if any, is not used. A path or start adds one step
variable. Without a start the journey begins at `Init`, in a state where the
Phases give each entity of the schedule its lifecycle's initial phase, with its
first step; with one, the model takes the next-state relation until the start
holds in a state where the Phases give the journey's start phases, every entity
the start table does not list being in its lifecycle's initial phase, and then
the scheduled steps, each free step before the start being a row's own
definition with the step variable's frame inside it, so TLC still names the row.
A path with no step to take, a must-not journey refused at its first step with
no start, takes none: its relation never holds, and it is answered in the first
state (M96–100, M115). A should-happen journey's path asks the schedule's `End`,
which the wrapper holds as the slot writes it, of the state after the last step
(M115). Without a start, every state of a path's search follows from `Init` by
the scheduled steps alone, the k-th step leading to depth k + 1 of the
breadth-first search, so the depth the search reached
([evidence.md §measures](evidence.md#measures)) tells whether a behaviour took
every step: a should-happen journey's path of n steps that found `not reached`
at depth n + 1 took them all, and `End` held after the last in none of its
behaviours ([evidence.md §outcomes](evidence.md#outcomes)). With a start, free
steps come before the scheduled ones, and the depth does not tell.

Each kind, and what TLC is asked:

- **`base`, `weaker`, a reduction of a base**: the encoding's `Invariant` as an
  invariant, or its `Property` as a temporal property, a liveness claim's under
  its `Fairness`
- **`fault`, a reduction of a fault**: the same, with the faulted row's
  `FormaRow<n>` applying `Fault`
- **`witness`, `misbehaviour`**: an invariant that `Target` does not hold:
  violated, it is `reached`
- **`enabled`**: an invariant that the row's operator is enabled for no binding
  of its parameters over their domains: violated, it is `reached`
- **`path`**: an invariant that the steps asked have not all been taken, for a
  should-happen journey with `End` holding in the state after the last:
  violated, it is `reached`
- **`start`**: an invariant that the start has not held where the Phases give
  the start phases: violated, it is `reached`
- **`refusal`**: after the steps before the refused one, an invariant that the
  refused step's operator, with its bindings and as its case, is not enabled:
  violated, it is `enabled`
- **`phases`**: an invariant that each Phases expression gives one of its
  lifecycle's phases

A search that ends without violating the question's own invariant or property is
`no violation`, `not reached` or `not enabled`, as its kind asks (M110–115,
M131–135). Every question checks the model's type invariant first
([§model-fields](engines.md#model-fields)): a state that breaks it ends the
search with `violation` of the type invariant, whatever the question, since a
state outside the model's own types answers no question faithfully. When TLC
names a conjunct by its place in a module, code names the invariant that place
belongs to: the question's when it is in the wrapper, the
type invariant when it is in a model file (M114).

The search is TLC's breadth-first model checking with one worker, so a violated
invariant's trace is a shortest one; a violated temporal property's is the
behaviour TLC's check finds, which need not be. Simulation, symmetry reduction
and deadlock checking are never used. A liveness claim's questions, its base,
faults and witnesses, its reductions and its weaker forms, leave the model's
constraint out: TLC drops every behaviour that passes beyond a constraint, so
under one a temporal property could hold only because the behaviour that breaks
it was cut; without it, a run whose behaviours are too many to search is
unanswered (M136–142).

<a id="alloy"></a>

### Alloy

The wrapper, `FormaExam`, opens the model's entry and holds the slots' text,
code's observers and one command at the question's bounds: `for <scope>`, then
`<steps> steps` and `<int> Int` for those the Bounds give, after ` but ` when the
scope is its default number alone and after `, ` when it holds signature bounds.
The model's own facts give its behaviour. An instance answers the command: a
`run` that finds one has reached, or found enabled, what it asks; a `check` that
finds one, a counterexample, has found a violation (M101, M110–115, M131–135).

Each kind, and its command:

- **`base`, `weaker`, `fault`, a reduction**: `check Claim`, for a fault on the
  faulted copy
- **`witness`, `misbehaviour`**: `run { eventually Target }`
- **`enabled`**:
  `run { eventually (some <parameters> | <predicate>[<parameters>]) }`
- **`phases`**:
  `check { always (all <Over> | one <expression> and <expression> in <exactly one of the lifecycle's phase signatures>) }`,
  since an expression can give no atom or several and an atom can be of two
  signatures
- **`path`**: a `run` of the steps asked, joined by Alloy's sequence operator
  `;`, then, for a should-happen journey, `; End`, so that the run conjoins
  `End` on the state after the last step
- **`refusal`**: the same of the steps before the refused one, then the refused
  step: found, it is `enabled`
- **`start`**:
  `run { eventually (<start> and <the Phases give the start phases>) }`
- **`facts`**: `run {}`

A path or refusal of a journey with a start stands under
`eventually (<start> and <the Phases give the start phases> and …)`. A path, a
refusal and a start each also ask that every entity of the schedule is exactly
one atom, so a value that gives none or several is found by the path or start not
being reached, and no case or start phase holds for want of an entity (M115).

The observers are one signature, `FormaSteps`, a subset of Alloy's integers
holding one of them, so the wrapper adds no atom to the model's universe and its
facts mean what they mean alone. It has a variable field for each row of the
Actions table and each Misbehaviours row, a struck item's too since the model's
facts may still take it, equal in every state to the bindings for which the row's
predicate holds from that state to the next; for each Phases row, one equal to
its entities, the Over's domain, and one for each phase of its lifecycle, equal
to the entities whose expression gives an atom of that phase's signature, so a
trace's phases read as `phases` asks them and an entity in no phase is still
listed; and, for a schedule, one for each entity it gives a value, not variable
and equal in the first state to that value, so the engine names that entity's
atom and a case or start phase is asked of that atom whatever the value gives
later. The observers are written from the phase keys of the Phases rows'
lifecycles. The wrapper also holds a fact that no step takes a struck
misbehaviour: where a struck item's row holds for a step, an Actions row holds
for it too; so every Alloy question asks of the behaviours that take none, and a
model whose facts cannot go on without one is found by what it no longer reaches
(M96–98, M148–151).

An observer is part of the state the solver searches: a row's predicate or a
Phases expression that a state and its step do not settle, as one with a
past-time operator, can make a behaviour need more steps observed than alone, and
one that then needs more than the Bounds give is not found; code does not check
for it. A row of k parameters is observed by a relation of k columns over the
universe, which the solver cannot hold once the universe's size to the power k
passes what it can count; every run on such a model then ends unanswered, with
the engine's reason (M139–141). A schedule's start, entity values and bindings
enter the wrapper as the definitions
[models.md §slot-answer](models.md#slot-answer) checks, each the whole
body of its own, a step is its action's predicate applied to its bindings'
functions, and its `pred End` enters as the slot writes it (M115). A fault copies
the model file that defines the action's predicate, the entry or a module it
opens, with the range Alloy's language server
gives that predicate replaced by the slot's `pred Fault` and a predicate of the
action's name and parameters that applies `Fault` to them, so only that action
differs (M114). The solver is the one Alloy uses by default, on the pinned Java
runtime, and each run has a temporary folder of its own.

<a id="lifecycle-engine"></a>

### The lifecycle engine

The data form holds the model's part's confirmed lifecycles, each lifecycle of
the part whose confirmation is in force
([models.md §lifecycle-model](models.md#lifecycle-model)), each with its initial phase
and the action that enters it, if any, and its cells as the picks in force fill
them ([lifecycle-tool.md §as-read](lifecycle-tool.md#as-read);
M199–201); and the part's actions, with their guards and cases. A fault's
overlay replaces the cells it lists, an empty outcome being an unspecified
transition. `question.json` holds what is asked. Each kind, and what the
lifecycle engine is asked:

- **`base`**: that no reachable combination of phases holds the forbidden form,
  or that no move the form forbids is taken: found, it is a `violation`
- **`witness`**: the combination or the transition to reach: `reached`
- **`fault`**: the base question with the fault's overlay laid over the cells:
  the `violation` is `caught`
- **`lifecycle-path`**: the journey, stepped as
  [evidence.md §lifecycle-journeys](evidence.md#lifecycle-journeys) says

The engine holds one entity of each lifecycle, every case possible and guards
unevaluated, and enumerates every reachable combination of phases breadth first.
An entity starts in its lifecycle's initial phase, but one whose lifecycle is
`entered by` an action starts absent: that action makes it present in the
initial phase, and is refused while it is present already; any other action of
its lifecycle is refused while it is absent. An action with a case moves every
lifecycle that has it as a column as that case's cell says, and is refused in a
combination where one of them refuses it; a lifecycle that lists it as unaffected
stays. A cell that is empty, or that a choice poses with no pick in force, after
the overlay of a fault, admits its action to every phase of its lifecycle, since
what is unspecified may do anything and the abstraction keeps safety only by
admitting more; the exploration flags each such cell it
meets ([evidence.md §flags](evidence.md#flags)). A
combination is reached when it holds every row of a combination form; a
transition is taken when, in a reachable combination, the action moves that
lifecycle from the row's phase to its other. The shortest journey to what was
asked is the trace. It runs inside Forma within the lifecycle engine's time
limit, its memory Forma's own (M117–121).

<a id="replay"></a>

### The replay

The engine's own evaluator computes every value code shows from a trace. TLC
prints a trace's states and not the values of other expressions in them, so when
the model has Phases rows code replays each trace the evidence keeps
([§trace](engines.md#trace),
[evidence.md §surprise-file](evidence.md#surprise-file)) through the engine: a
second run whose initial state and steps are the trace's states as the engine
printed them, with the Phases expressions, each step's bindings and the
schedule's entity values added as variables, so the engine prints each entity's
phase in every state, the bindings of each step's operator and each entity's
value. The replay is part of its run, at its bounds and within the time the run
has left, and answers no question. Every name it adds begins `Forma`, so none
clashes with a name the model's files define or bind, a model value's included.
When the model has no Phases rows no replay is made, and the trace is kept
without phases or bindings. When the engine refuses or fails the replay, the
trace is kept without phases or bindings, with the engine's reason. Alloy needs
no replay: its observers give the rows, bindings and phases in the run itself.
The lifecycle engine's trace is in phases already (M166–167, M173–175).

<a id="trace"></a>

## The trace

Only a surprise, its reductions and weaker forms, a `start` question and a
claim's `witness` question that reached its target keep a trace, since nothing
else reads one: an agent explaining a path surprise is handed its journey's
start trace ([evidence.md §rerun](evidence.md#rerun);
[door.md §gives](door.md#gives)), and the basis line names each witness by the
journey that reached it ([account.md §basis-line](account.md#basis-line))
(M173–175, M269–271). Evidence keeps one, so, only in a `start` or `witness`
question that found `reached`, a reduction or weaker form that found a
violation, and a surprise whose run gave one
([evidence.md §surprise-file](evidence.md#surprise-file)). A trace holds no
state's values: those are in `runs/` only.

Each key of `trace`, and what it holds:

- **`states`**: the trace's states in order, the first numbered 0, each with
  `rows`, absent in the first, the rows that took the step into it, and
  `phases`, each entity's phase there
- **`loop`**: for an Alloy trace and for a TLC trace of a temporal property that
  loops back, `{ "to", "rows" }`: the number of the state the last state's step
  loops back to, and the rows that take that step, as a state's `rows` are;
  `"stutter"` for one that ends stuttering
- **`replay`**: on TLC, the replay's reason when it gave no phases or bindings
  ([§replay](engines.md#replay))

A row is `{ "action": <part>/<action> }`, `{ "misbehaviour": <part>/<row>/<item> }`
or `{ "operator": <name> }` for a step the engine names outside the tables. On TLC
and Alloy each row has its `bindings`, from each parameter to its value as the
engine printed it; on the lifecycle engine an action's row has its `case`
instead, or `-`. On TLC a step has one row; on Alloy, every row whose predicate
holds for it, none where none does. An Alloy atom is named without its module
and, when its signature is declared `one`, without its number, unless two atoms
of the trace would then be named alike, which keep the engine's own labels; an
entity the schedule gives a value is named by it, by each name when it gives one
atom several; on the lifecycle engine an entity is named as the journey names it,
or by its lifecycle's key (M166–167, M173–175).

A trace kept without phases or bindings has no `phases` key in any state and no
`bindings` key in any row, and its `replay` says why.

`rendered` lists, in byte order of `entry`, for each action and world row the
trace's rows name, and for a `refusal` its journey, whose refused step the
rendering shows ([presentation.md §rendering](presentation.md#rendering)), its
`entry`, `pin` and `content`, its canonical content as
[design.md §pins](design.md#pins) gives it; and for a fault, `fault`, the fault
slot's path, with its `mechanism`. So a trace shows what it meant when it ran
([presentation.md §rendering](presentation.md#rendering); M166–167, M201–203).
