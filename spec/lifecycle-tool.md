# The lifecycle tool

Spells out [SPEC.md](SPEC.md) for the lifecycle tool:
a lifecycle as read and its picture, stepping a journey, shortest journeys, and
the findings that block confirmation. The lifecycle page's form is
[forms.md](forms.md)'s; the journeys the tool offers, and what they pin, are
[design.md](design.md)'s. `M<n>` is line n of [SPEC.md](SPEC.md).

The lifecycle tool reads each part's lifecycles, steps every journey through
them, finds the shortest journeys, and reports what blocks confirmation (M69–71,
M195–198). It runs inside Forma whenever the project is read and on every
Restate answer ([design.md §restate](design.md#restate)), over every lifecycle
and every journey, confirmed or not, those code adds included, before any engine
runs. What it computes, the lifecycle facts, is never stored and never counts
for standing, which comes only from engine runs and the developer's decisions
(M35–36, M54). The lifecycle engine, which examines confirmed lifecycles for
evidence, is [engines.md §lifecycle-engine](engines.md#lifecycle-engine)'s
(M117–121).

<a id="as-read"></a>

## A lifecycle as read, and its picture

**A lifecycle as read** is its page, but where a choice poses a cell or a case
outcome: while a pick of the choice is in force
([decisions.md §pick](decisions.md#pick)), the tool reads there the outcome the
picked alternative's effects table gives; otherwise the cell stays posed. So a
pick fills its cells without changing the lifecycle's pin
([design.md §pins](design.md#pins)). A phase is **reachable** when moves lead to
it from the initial phase (M69–71).

**The picture** is the lifecycle as read, as data: wherever a lifecycle is
shown, it is drawn from its picture (M193–194). It holds, in this order,
`format`, which is 1; `lifecycle`, the entry's name; `basis`; `source`;
`entity`; `initial`, the initial phase and the action that enters it, where one
does; `ends`; `phases`; `actions`; `unaffected`, the actions that leave it as it
is; `cells`, the matrix as read; `moves`; `machine` and `mapping`; `marks`; and
`facts`, each phase that has a class, with its classes. No layout is in it:
whoever draws it lays it out
([presentation.md §explorer](presentation.md#explorer)), and no layout enters a
pin.

- **In a showing** the picture is written as text: the initial phase, each
  phase with its classes, each move, each cell that is refused, posed or empty,
  and a line saying that the explorer draws it; then the picture itself as JSON,
  indented by two spaces, between a fence that opens with three backticks and
  `json forma-diagram` and a closing fence. So a ruling's showing keeps the
  picture it was made on, which is read later as it was, and never drawn again
  from the lifecycle as it then reads. JSON output holds the object itself
  (M166–175, M193–202, M224).
- **`basis`** holds the pins of the lifecycle and its actions, the picks that
  filled cells, the hashes of their pages, and the versions of Forma and XState
  the picture was made with. It is the picture's own, apart from the basis of
  evidence ([evidence.md §basis](evidence.md#basis)).
- **`source`** is null where nothing is marked; for a picture with marks it
  names the journey or question they come from and a digest of them.
- **A phase** has `id`, `key` and `classes`. The classes hold of a phase by
  itself; a finding ([§findings](lifecycle-tool.md#findings)) adds conditions of
  its own (M69–71). Each class, and where it holds:
  - **`unreachable`**: no move leads from the initial phase to this phase
  - **`stuck`**: a phase outside the ends refuses every action, as every phase
    does with no action column
  - **`posed`**: a cell or case outcome in this phase is posed by a choice with
    no pick in force
  - **`empty`**: a cell or case outcome in this phase is empty
  - **`visited`**: a mark holds this phase
- **A move** has `id`, `from`, `to`, `action`, `case`, `cell` and `steps`, each
  step with its number and whether it loops back. A phase's `id` is made from
  its lifecycle and its key, a move's and a cell's from the lifecycle, the phase
  it leaves, the action and the case, so none depends on the order of rows.
  Moves come in the matrix's order of rows, columns and cases.
- **`machine`** is the moves as an XState configuration, with a state for each
  phase and an event for each action and case, and `mapping` gives the phase,
  action and cell each of its names stands for. The lifecycle engine steps the
  same moves ([engines.md §lifecycle-engine](engines.md#lifecycle-engine)). A
  refusal, an empty cell, a posed cell, a guard, an entering action and an
  unaffected action are in `cells` and the fields beside it, and nothing is read
  from a transition the machine lacks. An end phase ends no machine. Nothing
  that reads a picture runs it (M69–71, M117–121).
- **`marks`** holds each move taken and each phase held that a journey's walk
  ([§stepping](lifecycle-tool.md#stepping)) or a trace supplies, with its step
  numbers, its entity where known, and whether it loops back, placed as
  [presentation.md §rendering](presentation.md#rendering) places a step. No
  move is marked where a trace does not tell which entity moved, and a refused
  or unplaced step stays in its journey or trace.
- **One picture.** The same lifecycle as read, the same marks and the same
  versions give the same picture, byte for byte, so a showing that holds it has
  one token (M161–165).

<a id="stepping"></a>

## Stepping a journey

An action **moves** a lifecycle of its own part that has it as a column or is
entered by it, and no other lifecycle (M71, M117–119).

- **Entities.** The entities a journey names, of a lifecycle, are those its
  start table lists for it and each name a step's Entity gives in a step whose
  action moves it, unless the start table lists that name for another lifecycle
  the same step moves. In each lifecycle a step moves, the step acts on the
  entity its Entity names where the journey names more than one entity of that
  lifecycle; otherwise on the one it names, or, where it names none, on one
  entity named by the lifecycle's key. The journey holds an entity from its
  start when its start table lists it, and otherwise from the first step that
  acts on it. An entity starts in its start row's phase, or else in its
  lifecycle's initial phase. An entity of a lifecycle `entered by` an action that
  the start table does not list is absent until a step taking that action enters
  it: a step that acts on it with another action while it is absent is refused
  there, as the lifecycle engine refuses it
  ([engines.md §lifecycle-engine](engines.md#lifecycle-engine)).
- **Steps**, in order. In a lifecycle the step's action enters, the entity
  enters the initial phase, whether or not the journey holds it already. Any
  other lifecycle the step moves admits it when the entity's phase has a move
  for the action, and for the step's case when the action has cases, and the
  entity takes that move. A lifecycle that lists the action as unaffected
  neither admits nor refuses it. A step that a lifecycle it moves refuses is
  refused, whatever the others' cells, and a refused step ends the stepping. A
  step none refuses, where some lifecycle's cell for its entity's phase, for the
  action or its case, is empty, or is posed by a choice with no pick in force,
  does what is not known: the stepping ends there, and the tool reports
  `unchecked` on the journey, naming that cell
  ([§findings](lifecycle-tool.md#findings)). Any other step is admitted, and its
  entities move. A should-happen journey is stepped through its last step, a
  must-not journey through its refused step.
- **What it reaches.** A journey reaches each phase an entity of it holds at its
  start or after a step the tool admits, a must-not journey's refused step
  excluded. The steps taken, with the moves each makes and the phases it
  reaches, are the journey's **walk**.

<a id="shortest"></a>

## Shortest journeys

For each lifecycle, the tool finds the shortest journey from the part's initial
phases to each of its phases but the initial one (M195–198). It steps one entity
of each lifecycle of the part, each starting in its initial phase, or absent
where its lifecycle is `entered by` an action
([§stepping](lifecycle-tool.md#stepping)), and not yet held; each step is one of
the part's actions, with one of its cases when it has them, and is taken only
when every lifecycle it moves admits it as
[§stepping](lifecycle-tool.md#stepping) says and it moves at least one; a step
that enters a lifecycle whose entity the journey already holds is not taken. Of
the shortest journeys to a phase, the tool takes the one whose steps come first,
compared step by step by action key and then by case key, in code-point order.
The search stops once every phase of the part has its shortest journey. It steps
at most 250,000 combinations of phases for a part, each counted when the search
reaches it, the start included; past that it reports `unchecked` on each of the
part's lifecycles, naming the limit, so no read runs without bound.

<a id="findings"></a>

## Findings

The tool reports these findings, each with its code, the lifecycle or journey it
is on, and the phase, cell, step or start row it concerns. A finding bears on
the units its last column names, which are not offered for confirmation while
it stands ([decisions.md §confirm](decisions.md#confirm)): the developer is
never asked to confirm a contradiction or a silent gap (M70). A finding that
bears on a unit is the item `findings:<part or span>`
([account.md §items](account.md#items)).

| Code | Finding | Bears on |
| --- | --- | --- |
| `unreachable-phase` | a phase that neither moves nor the outcomes posed cells may take lead to from the initial phase, in a lifecycle with no empty cell or case outcome in a phase so reached | the lifecycle |
| `no-way-out` | a phase outside the ends that refuses every action, as every phase does in a lifecycle with no action column | the lifecycle |
| `end-way-out` | an end phase with a move to another phase | the lifecycle |
| `empty-cell` | an empty cell, or an empty outcome of one case | the lifecycle |
| `posed-cell` | a cell or case outcome a choice poses with no pick in force; the choice's pick fills it without another confirmation | nothing: it waits on its choice |
| `start-phase` | a start row whose phase is not reachable in its lifecycle | the journey, and that lifecycle |
| `step-refused` | a step refused that is not a must-not journey's refused step | the journey, and each lifecycle that refused it |
| `creates-existing-entity` | a step that enters a lifecycle whose entity the journey already holds | the journey |
| `step-entity` | a step whose Entity names no entity of a lifecycle it moves of which the journey names more than one, which ends the stepping; or a step whose Entity is not `-` where no lifecycle it moves has more than one named | the journey |
| `unchecked` | the tool could not check the lifecycle or journey, because a page it needs counts for nothing, check 2 or 3 fails for it ([design.md §at-read](design.md#at-read)) other than by a citation, which the item `passage:` owes, a step meets an empty or posed cell ([§stepping](lifecycle-tool.md#stepping)), [§shortest](lifecycle-tool.md#shortest)'s limit is passed, or the tool failed; it names which, or why | that lifecycle or journey |

`empty-cell` is an unspecified transition; the rest but `posed-cell` and
`unchecked` are lifecycle conflicts. A posed cell is neither: it is a choice put
to the developer, so a lifecycle holding one may be confirmed, and its pick
fills the cell without another confirmation. A journey need not be confirmed for
its conflict to bear on a lifecycle: an unconfirmed contradiction is the same
contradiction. A must-not journey whose refused step the lifecycles admit has no
finding: its refusal is left to a model, since a guard or another part may
refuse it. Findings never refuse an answer
([design.md §restate-checks](design.md#restate-checks)).
