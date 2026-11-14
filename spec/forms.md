# The page forms

Spells out [SPEC.md](SPEC.md) for the forms agents
write under `design/`: the rules every page shares; the part list and the front
pages; a part's tables (actions, boundary, surface, omissions); the thing pages
(lifecycles, journeys, claims, premises, choices); the premises code adds, with
the store isolation table and what each says; and the misbehaviour menu with its
strikes. Where a page is filed, how the restatement is checked and changed, and
what it pins are [design.md](design.md)'s. `M<n>` is line n of [SPEC.md](SPEC.md).

<a id="page-rules"></a>

## Shared rules of the pages

Agents write the pages in these fixed forms, and code checks what they fill in
(M27–31, M59–60). Every page is a Markdown file read as CommonMark with tables; it
holds no front matter, begins on its first line with its one level-1 heading,
and holds exactly the blocks its form gives, in that order, and nothing else.

- **Keys** are lowercase letters, digits and hyphens, beginning with a letter,
  with no hyphen at the end or two together: `[a-z][a-z0-9]*(-[a-z0-9]+)*`. A
  thing's key is its folder's name; a row's is its key cell. Keys are unique
  within their kind in their part or span, premises and boundary rows counting
  as one kind, since `Rests on` names both by key ([§claims](forms.md#claims));
  a part and a span never share a key; and no action is keyed `phase`, which
  names a lifecycle matrix's Phase column.
- **A reference** names an entry of the kind its field expects: by its key alone
  when the entry is of the part the page is in, and as `<part>/<key>` when it is
  of another part, and only then (M33–34, M158–160). A span holds no entry a
  field names, so every reference in a span's pages is `<part>/<key>`. Outside
  the pages an entry is named as [design.md §pins](design.md#pins) says.
- **A list cell** holds items separated by `, ` exactly, with no comma inside an
  item; `none` is the empty list. A free-text cell may hold commas.
- **Every cell holds text**: an empty cell is a form error, but in a lifecycle
  matrix's action columns ([§lifecycles](forms.md#lifecycles)). A cell written
  as one code span is read without its backticks. `-` marks a field that does
  not apply.
- **A `|` inside a cell** is written `\|`, in a code span too, and read as `|`. A
  row holding more or fewer cells than its table has columns is a form error
  naming the row, so a cell cut short at an unescaped `|` is never read whole.
- **A table** has exactly the columns its form gives, in any order, their names
  matched case-insensitively after trimming; a missing, extra or repeated column
  is a form error. A lifecycle matrix's action columns are keys, matched
  exactly; one named twice is check 2's, as every key's uniqueness is
  ([design.md §at-read](design.md#at-read)). **A field table** is
  `| Field | Value |` with one row for each field its form gives, each once,
  field names matched as column names are.
- **`Cites`** lists one or more passage addresses
  ([design.md §passages](design.md#passages)); every entry has it but an omission,
  which names its passage (M79).
- **`Origin`** is `stated` when the entry restates its cited documents outright,
  and `added` when it goes beyond them (M81–82, M194–195).

<a id="front-pages"></a>

## The part list and the front pages

A part is one component of the system; the agent proposes the parts and the
developer confirms them (M64–65). A front page is `design/README.md`, or a
part's or span's `README.md`. Its reading order is an order to read in, never
an inventory, and it is written only by agents, never by code.

<a id="part-list"></a>

### `design/README.md`

A level-1 heading, whose text code does not read; then the part list,
`| Part | Purpose | Cites |`; then the reading order of the parts and spans
([§reading-order](forms.md#reading-order)):

```markdown
# Export ticket

| Part | Purpose | Cites |
| --- | --- | --- |
| export-ticket | Examines how a ticket grants one durable receipt while keeping expiry, overlapping request keys and receipt retrieval distinct. | design/brief/overview.md#purpose, design/brief/overview.md#claim-design |

1. [Export ticket](parts/export-ticket/)
```

One row per part: its key, one sentence of its purpose in the developer's terms,
and its citations. A part's purpose is written here and nowhere else. Every row
has a part folder, `design/parts/<part>/` holding a `README.md`, and every such
folder has a row. The table is the unit `parts`
([design.md §units](design.md#units)); the reading order is not in its pin.

<a id="part-readme"></a>

### A part's `README.md`

The part's name in the developer's terms as its level-1 heading, then the
reading order of its things ([§reading-order](forms.md#reading-order)). A part's
folder holds its `README.md`, its tables ([§part-tables](forms.md#part-tables)),
its things' folders ([§thing-pages](forms.md#thing-pages)), its receipt
([door.md §receipts](door.md#receipts)) and `decisions/`
([decisions.md §filing](decisions.md#filing)), and nothing else.

<a id="spans"></a>

### Spans, and a span's `README.md`

A span folder, `design/spans/<span>/`, files claims and journeys that are about
several parts, and nothing more (M49, M84–87): no rule refuses such a thing
filed in a part, the span folders are not in the unit `parts`, and a span's
purpose is not confirmed. Its `README.md` is its name as its level-1 heading,
one paragraph that is a sentence of its purpose, then the reading order of its
things ([§reading-order](forms.md#reading-order)). A span's folder holds its
`README.md`, `journeys/` and `claims/` ([§thing-pages](forms.md#thing-pages)),
its receipt and `decisions/`, and nothing else. What a thing's parts are, and
which parts form a span, are computed from the pages and never from a span
folder ([§surface](forms.md#surface), [design.md §filing](design.md#filing)).

<a id="reading-order"></a>

### The reading order

The reading order is an ordered list whose every item is one link and nothing
else, the link's destination a folder's path relative to the page, ending in
`/`: in `design/README.md`, `parts/<part>/` or `spans/<span>/`; in a part's or
span's `README.md`, `<kind>/<key>/` of one of its things. Code reads only the
destinations, not the link text or the numbers. The list is left out when it
names nothing.

A front page may name every part, span or thing, in the order to read them; it
names only parts, spans and things whose pages exist, never a journey code adds
([design.md §code-journeys](design.md#code-journeys)), since those appear and
disappear as lifecycles, choices and rulings change. What a front page does not
name is read after what it names: parts and spans by key; things, those code
adds included, by key and, for one key, in the order lifecycles, journeys,
claims, premises, choices. Keys are compared in code-point order. Code never
writes a front page, so a journey Forma writes for a redirect is read after the
named things until an answer names it.

<a id="part-tables"></a>

## A part's tables

Each table file is a page: a level-1 heading, whose text code does not read,
then its table, which may have no rows, or for `boundary.md` its two sections
([§boundary](forms.md#boundary)). A table file may be absent, and then
holds no rows.

<a id="actions"></a>

### `actions.md` (M69)

`| Action | Actor | Sentence | Cases | Guard | Origin | Cites |`

- **Action**: its key.
- **Actor**: a reference to a boundary row of kind actor, service, queue or
  clock, of any part.
- **Sentence**: what the action does, in one sentence in the developer's terms.
- **Cases**: `none`, or two or more distinct case names, each a key, when the
  action leads to different phases on different inputs.
- **Guard**: the condition on data, beyond the entity's phase, that the action
  needs, in the developer's terms; or `none`. A move
  ([§lifecycles](forms.md#lifecycles)) of an action with a guard is a guarded
  transition (M148–151).

Every action is placed in each lifecycle of its part
([§lifecycles](forms.md#lifecycles),
[design.md §restate-checks](design.md#restate-checks)) (M69).

<a id="boundary"></a>

### `boundary.md` (M74)

The heading, then `## Boundary` with the boundary table, then `## Surface` with
the surface table ([§surface](forms.md#surface)); either section may be left
out, and then holds no rows.

`| Row | Names | Kind | Side | Seam | Isolation | Reads | Writes | Origin | Cites |`

- **Row**: its key. Rows keep their keys, and what rests on a row records the
  row's pin ([design.md §pins](design.md#pins)), so a premise the world later
  refutes stales everything resting on it at once.
- **Names**: what the row is, in the developer's terms.
- **Kind**: `actor`, `service`, `store`, `queue`, `clock` or `entity`.
- **Side**: `machine` or `world`.
- **Seam**: for a world row of kind actor, service, queue or clock, one of
  `request-response`, `webhook`, `queue`, `clock` or `person`; otherwise `-`.
  Each such world row has the misbehaviour menu ([§menu](forms.md#menu)).
- **Isolation**: for a store, one of
  [§store-premises](forms.md#store-premises)'s names, as the store calls its
  level; a store whose level the brief does not name is `unknown`, and the
  developer names it by saying so in the brief (M74); otherwise `-`.
- **Reads**, **Writes**: for a store or an entity, references to the rows of kind
  actor, service, queue or clock, of any part, that read and that write it, or
  `none`; otherwise `-`.

<a id="surface"></a>

### Surface, and the span of two parts (M75, M178–180)

`| Direction | Name | Cites |`

| Direction | Name |
| --- | --- |
| `emits` | a new event's key, of this part |
| `consumes` | an event some part emits: its key when this part emits it, otherwise `<part>/<event>` |
| `reads`, `writes` | a reference to a boundary row of kind store or entity |
| `calls` | a reference to a world row of kind actor or service |

A surface row has no key and no `Origin`: it is known by its direction and name,
each pair once in a part, and it is stated unless it cites only sources
([design.md §coverage](design.md#coverage)).

Two parts form the span `<part>+<part>`, its keys in code-point order, when one
emits an event the other consumes, when both read or write the same row, or when
both call the same row. Nothing else forms one: spans come from declared
surfaces, never from words, and no span folder makes or changes one (M178–180).
What a span owes is [account.md §journey-rules](account.md#journey-rules)'s.

<a id="omissions"></a>

### `omissions.md` (M77)

`| Passage | Reason |`

One row per passage deliberately not restated: its address, which may be of a
source without provenance, and why it, or which part of it, is not restated. A
passage is named at most once in a part's omissions. An omission is not the
place for what the brief leaves unsaid about something restated: an open
question that changes what the software does is a choice
([§choices](forms.md#choices)), and an assumption that something unsaid does not
matter is a premise of class `omission` ([§premises](forms.md#premises)).

<a id="thing-pages"></a>

## Thing pages

A lifecycle, journey, claim, premise or choice is a thing: a page of its own,
`README.md` in the folder `<kind>/<key>/` of its part, the kind being
`lifecycles`, `journeys`, `claims`, `premises` or `choices`; a span holds only
`journeys/` and `claims/` (M49). Its key is its folder's name, and its level-1
heading is its name in the developer's terms. A thing's folder holds its page,
its receipt and `decisions/`, and nothing else. A folder there without a page is
no thing: a removed thing's folder keeps its `decisions/`
([design.md §removal](design.md#removal)).

<a id="lifecycles"></a>

### Lifecycles (M70)

```markdown
# Ticket state

| Field | Value |
| --- | --- |
| Entity | ticket |
| Initial | active-unclaimed |
| Ends | none |
| Unaffected | none |
| Origin | stated |
| Cites | design/brief/overview.md#claim-design |

| Phase | check | complete | return-receipt | fetch-receipt | expire |
| --- | --- | --- | --- | --- | --- |
| active-unclaimed | active-unclaimed | active-claimed | None. | None. | expired-unclaimed |
| active-claimed | None. | active-claimed | active-claimed | active-claimed | expired-claimed |
| expired-unclaimed | None. | expired-claimed | None. | None. | None. |
| expired-claimed | None. | expired-claimed | expired-claimed | choice:fetch-after-expiry | None. |
```

The heading, then this field table, then the matrix:

| Field | Value |
| --- | --- |
| Entity | a reference to a boundary row of kind entity, of any part |
| Initial | a phase; or `<phase>, entered by <action>`, the action one of this part's, by its key, that creates the entity |
| Ends | a list of phases, or `none` |
| Unaffected | a list of this part's actions, by key, that neither depend on nor change the phase; or `none` |
| Origin | `stated` or `added` |
| Cites | passage addresses |

The matrix is `| Phase | <action> | … |`: a `Phase` column and one column for
each action of the part not listed as unaffected, each once, in any order
([§page-rules](forms.md#page-rules)); one row per phase, each once, its name a
key. `Initial` and `Ends` name its phases. A cell holds what the action does at
that phase:

- a phase: admitted, leading to that phase;
- `None.`: refused;
- `choice:<key>`, with no space after the colon: posed by that choice of this
  part;
- for an action with cases, one `<case>: <outcome>` for each of its cases, each
  once, separated by `<br>`, each outcome one of the three above;
- nothing: an unspecified transition, as is an empty outcome of one case.

An action with cases has a cell of cases, or an empty one, wherever it is a
column; an action without has none. A **move** is an admitted pair, a phase and
an action with, for an action with cases, a case, together with the phase it
leads to. A lifecycle names this part's actions only: another part's effect
enters through the action here that receives it.

<a id="journeys"></a>

### Journeys (M71)

The heading, then this field table:

| Field | Value |
| --- | --- |
| Polarity | `should happen` or `must not` |
| Expected end | for should happen, the end in the developer's terms; for must not, `-` |
| Refused step | for must not, the number of the step that must be refused; for should happen, `-` |
| Origin | `stated` or `added` |
| Cites | passage addresses |

then, when the journey starts away from an initial phase, the start table
`| Lifecycle | Entity | Phase |`: each row a lifecycle, a reference of any part;
the name of an entity of the journey that starts there, each entity once per
lifecycle; and its phase. An entity not listed starts in its lifecycle's initial
phase. Then the steps, one or more,
`| Step | Actor | Action | Arguments | Entity | Case |`:

- **Step**: `1`, `2` and so on, without gaps.
- **Actor**: who acts, in the developer's terms.
- **Action**: a reference to an action, of any part.
- **Arguments**: in the developer's terms.
- **Entity**: the name of the entity the step acts on, where the lifecycle tool
  asks one ([lifecycle-tool.md §stepping](lifecycle-tool.md#stepping)); otherwise `-`.
- **Case**: one of the action's cases when it has them; otherwise `-`.

A journey's key does not begin `reach-` or `kept-`, and in a part it is not
`<choice>-a`, `<choice>-b`, `<choice>-not-a` or `<choice>-not-b` for a choice of
that part: those keys are code's ([design.md §code-journeys](design.md#code-journeys)).

<a id="claims"></a>

### Claims (M72)

```markdown
# At most one receipt

| Field | Value |
| --- | --- |
| Sentence | At most one distinct receipt is ever created for a ticket across all request keys, including overlapping checks and lost replies. |
| Kind | safety |
| Stake | A ticket intended for one successful claim could grant multiple durable receipts. |
| Rests on | atomic-completion, stable-identities, store:records |
| Parts | export-ticket |
| Origin | stated |
| Cites | design/brief/overview.md#purpose, design/brief/overview.md#required-behavior |
```

| Field | Value |
| --- | --- |
| Sentence | the property, in the developer's terms |
| Kind | `safety`, `liveness` or `structure` |
| Stake | what someone outside the machine loses if it breaks |
| Rests on | a list of references to premises and to boundary rows, of any part, and of `store:` or `choice:` followed by a reference to a store row or a choice ([§code-premises](forms.md#code-premises)); or `none`. A claim names each row it rests on, so a change to the row stales it |
| Parts | the keys of every part the claim is about, one or more, wherever it is filed (M84) |
| Origin | `stated` or `added` |
| Cites | passage addresses |

A liveness claim rests on at least one premise of class `fairness` (M72). A
claim that depends on a choice, or on what a store permits, names it in
`Rests on`; code matches nothing by words (M33–34, M201).

<a id="premises"></a>

### Premises (M73)

| Field | Value |
| --- | --- |
| Statement | the assumption, in the developer's terms |
| Class | `world`, `promise` (a promise of another part), `fairness`, `atomicity`, `bound` or `omission` |
| Why not examined | `impossible`, `not worth the cost` or `not verifiable here`, alone or followed by `: ` and a reason |
| Falsifier | the observation that would break it |
| Provider | for `promise`, the key of the part that promises it, not this part's; otherwise who outside the machine is relied on |
| Origin | `stated` or `added` |
| Cites | passage addresses |

Premises of class store phenomena and choice exist only as code adds them
([§code-premises](forms.md#code-premises)). A premise of class `bound` says, in
the developer's terms, why bounds suffice for what the claims resting on it are
about; the bounds of each claim on each model are carried apart from it, as
`bound:` premises ([decisions.md §carry](decisions.md#carry)). A premise is one
page however many claims rest on it.

<a id="choices"></a>

### Choices (M76)

A choice puts to the developer an interpretation the brief leaves open, where it
can be read two ways or a story, a source and a rule disagree; only the
developer's pick settles it, so the agent poses it and writes neither reading as
an entry (M76, M199–201).

The heading, then this field table:

| Field | Value |
| --- | --- |
| Question | the question, in the developer's terms |
| Recommendation | `a` or `b`, then `: ` and the reason |
| Cites | passage addresses |

then `## a` and `## b`, in that order, each an alternative: a journey's field
table without `Origin` and `Cites`, its start table if it has one, and its steps
([§journeys](forms.md#journeys)); then, when the choice poses cells, an effects
table `| Lifecycle | Phase | Action | Outcome |`. Its rows give, under that
alternative, the outcome of each cell or case the choice poses, each once:
Lifecycle a lifecycle of this part by its key, Phase and Action one of its
cells, and Outcome, for a cell the choice poses whole, the cell as
[§lifecycles](forms.md#lifecycles) writes one, but not `choice:`; for cases it
poses within a cell of cases, `<case>: <outcome>` for each of them, separated by
`<br>`, the cell's other cases keeping theirs.

The alternatives differ, and may differ in anything a journey holds: an
operation that is one step in one and a start and a completion in the other is a
choice of atomicity. When both should happen, have the same start rows, in any
order, and the same number of steps, and differ in one step's action or case and
in nothing else, they **differ at one step**, and the pick adds the other as a
must-not journey refused there
([design.md §code-journeys](design.md#code-journeys); M199–201). Every cell or
case outcome holding `choice:<this key>` has an outcome in both alternatives,
and the effects tables give no other. A choice's key does not end in `-not`, so
the keys of the journeys picks add never collide
([design.md §code-journeys](design.md#code-journeys)).

<a id="code-premises"></a>

## Premises code adds

<a id="store-premises"></a>

### Store premises (M74)

Each store row gets the premise `store:<part>/<row>`, of class store phenomena:
the store permits exactly the anomalies its isolation permits below and prevents
the rest; an anomaly a store's behaviour leaves in doubt counts as permitted.
Its statement is `<the row's Names> permits exactly <the anomalies> and prevents
the rest.`, the anomalies those below in the order
dirty read, read skew, lost update, write skew, phantom, separated by `, `, or
`no anomaly`; its falsifier is `an observed prevented anomaly`; its provider is
`the store's documented and measured isolation`.

| Isolation | Permits |
| --- | --- |
| `read uncommitted` | dirty read, read skew, lost update, write skew, phantom |
| `read committed`, `postgres read committed`, `oracle read committed`, `sql server read committed` | read skew, lost update, write skew, phantom |
| `snapshot isolation`, `postgres repeatable read`, `oracle serializable`, `sql server snapshot` | write skew, phantom |
| `mysql repeatable read` | lost update, write skew, phantom |
| `sql server repeatable read` | read skew, phantom |
| `serializable`, `postgres serializable`, `sql server serializable`, `mysql serializable`, `cockroachdb serializable` | none |
| `unknown` | every anomaly above |

The rows rest on these facts: snapshot isolation aborts a lost update, which
MySQL's repeatable read permits; SQL Server's repeatable read prevents write
skew on items, permits phantoms on predicates, and sometimes permits read skew,
which counts as permitted. Duplicate writes are no isolation anomaly: no
isolation level prevents them, only an idempotency mechanism. A claim resting on
what the store permits names `store:<reference to the row>` in its `Rests on`.
Its carry, and what that pins, are [decisions.md §carry](decisions.md#carry)'s.

<a id="choice-premises"></a>

### Choice premises (M201)

Each choice gets the premise `choice:<part>/<choice>`, of class choice, which its
pick in force carries ([decisions.md §pick](decisions.md#pick)) and which binds
every claim that rests on it (M201). A claim that depends on the choice names
`choice:<reference to the choice>` in its `Rests on`.

<a id="struck"></a>

### Struck misbehaviours

Each item of a world row's misbehaviour menu ([§menu](forms.md#menu)) that the
developer strikes is a premise of class world
([decisions.md §carry](decisions.md#carry); M74, M215–216).

<a id="premise-says"></a>

### What each premise code adds says

Each premise code adds is shown, in the reading and the box, with a class, a
statement, a falsifier and a provider, as a premise page is. A span premise and
a claim's bounds, which [§surface](forms.md#surface) and
[engines.md §bounds](engines.md#bounds) give, are premises code adds too
([decisions.md §carry](decisions.md#carry)).

| Premise | Class | Statement | Falsifier | Provider |
| --- | --- | --- | --- | --- |
| `store:<part>/<row>` | `store phenomena` | [§store-premises](forms.md#store-premises)'s | [§store-premises](forms.md#store-premises)'s | [§store-premises](forms.md#store-premises)'s |
| `choice:<part>/<choice>` | `choice` | `<the choice's Question> Picked <a or b>.`, followed by ` <its Expected end>` where the picked alternative has one; with no pick in force, `<the choice's Question> Not yet picked.` | `a pick of the other alternative` | `the developer's pick` |
| `strike:<part>/<row>/<item>` | `world` | `<the row's Names> never does <the item as the menu names it>.` | the words of the strike in force, or before one what Forma pre-writes ([decisions.md §carry](decisions.md#carry)) | `the developer's strike` |
| `span:<part>+<part>` | `span` | `<each part's Purpose, in key order, joined by " and "> hold together over what they share: <each surface row naming it, as <direction> <name>, separated by ", ">.` | the words of the carry in force, or `-` before one | `the developer's carry` |
| `bound:<model>/<part or span>/<claim>` | `bound` | `Beyond its bounds on <model> (<each bound as <bound> = <value>, in the model's order, separated by ", ">): <the claim's Sentence>`, or on a lifecycle model `Beyond phase level on <model>: <the claim's Sentence>` | the words of the carry in force, or `-` before one | `the developer's carry` |

A carry revoked keeps its words as the falsifier; after a withdrawal, the
falsifier is what it was before any carry. A span's statement takes its two
parts in key order, and each part's surface rows in its table's order, as
written.

<a id="menu"></a>

## The misbehaviour menu and strikes

Every world row with a seam, a world row of kind actor, service, queue or clock
([§boundary](forms.md#boundary)), has the whole menu, whatever
its kind of seam: at every point it acts, the world may do each of these to the
machine (M74, M96–98).

Each item, in the developer's terms, and how it is written in `model.md` and
paths:

- **drop**: `drop`
- **duplicate**: `duplicate`
- **delay**: `delay`
- **reorder**: `reorder`
- **fail forever**: `fail-forever`
- **fail then succeed**: `fail-then-succeed`
- **crash**: `crash`
- **go silent mid-step**: `go-silent`

A falsifier, a showing or a rendering names an item in the developer's terms,
the name in bold; `model.md` and a slot's path write it in the form after it. An
item is struck while the developer's strike of it, a carry of the item as a
premise with its falsifier, is in force
([decisions.md §carry](decisions.md#carry); M215–216). Strikes bear on a model
so:

- Its Misbehaviours table has a row for each item not struck
  ([engines.md §model-misbehaviours](engines.md#model-misbehaviours)), and may
  have one for a struck item. A TLC model's questions leave that row out; an
  Alloy model's observe it and keep out every behaviour that takes it, since the
  model's own facts may still take it
  ([engines.md §composition](engines.md#composition)). No question rests on a
  struck misbehaviour (M96–98).
- A struck item has no misbehaviour witness
  ([models.md §slots](models.md#slots)), and no question asks whether its row is
  enabled or produced.
- The receipt line of `model.md` records the strikes in force when the answer
  was accepted ([door.md §receipts](door.md#receipts)).
  [models.md §model-answer](models.md#model-answer) does not check the operator
  of a TLC row of a struck item, so a TLC model whose line records a strike no
  longer in force is owed a Model answer, whatever its table holds
  ([models.md §parts-change](models.md#parts-change)). An Alloy model's row of a
  struck item was checked as any other, so for Alloy a strike no longer in force
  asks only for the rows of
  [engines.md §model-misbehaviours](engines.md#model-misbehaviours).
- A strike made after a model was accepted leaves the item's row allowed and owes
  nothing.
