# Restating a brief

The restatement is what the developer confirms, beside the passages each entry
cites, and every model rests on it. This page says what to put in the forms of
the design contract and the forms contract §page-rules to §thing-pages. Its
example: members borrow at a library desk, a provider collects late fees, a
job sends reminders.

## Read for stakes first

List the people outside the machine the brief names or implies, and what each
can lose: money, a thing promised, access, privacy, a record, time. Each loss
becomes claims, written before the actions, whose Stake names the person and
the loss: "a member is charged a late fee for a copy returned on time", never
a piece of the machine such as "the queue holds a duplicate".

An internal rule earns a claim through the loss it protects: "one renewal at a
time" serves "no member keeps a copy past the renewal limit". Write the claim
of the loss, and the rule too where the brief states it. Whether a rule stated
for one actor binds the others, when you cannot tell, is a choice.

Where a rule spans two parts that talk by an event, ask whether it means the
same step, which only one action changing both records gives, or following:
then it is a liveness claim, or the gap between breaks it with no flaw.

Where something must happen in the end, write a liveness claim resting on a
`fairness` premise, and a should-happen journey showing it can happen, which
does not establish the claim. A limit in business time, "within fourteen
days", makes the claim safety, with the clock as an action marking a day.

An unwanted state, unlike an illegal one, may arise but must not persist: its
claim names who resolves it, by which action, and how soon. Where no action
resolves it, ask; never add one.

Where the world can break a claim whatever the machine does, write the
recovery the brief gives and the misbehaviours it holds over: "every late fee
is collected, or written off and the member told, within thirty days". Where
the brief states only the strong form, keep it, and where it reads either way,
pose it. Never write a premise that repeats a menu item: striking is the
developer's decision, and the premise is code's (the forms contract §struck).

## Draw the boundary by control

The machine is what the team deploys and can change; the world is everything
else. A service whose owners will not change it for this team is world,
whoever wrote it. A claim may rest on the world acting, never require it.

Write a boundary row for every actor, service, store, queue, clock and entity
the brief names or its actions need. Rows briefs leave implicit: the clock
behind every deadline and nightly job, the person on each side of a form, the
store each part keeps its records in, the queue or webhook an event travels
by, the support tool or migration that writes outside every flow. A row is a
role: two people at the desk are two actors of one row.

A world row of kind actor, service, queue or clock gets the whole misbehaviour
menu ([world.md](world.md)); a machine row gets none, so a world party written
as machine has its failures silenced. When the brief does not say who controls
a row, the side cannot be posed as a choice, since it is no step: write it
`world`, mark it `added`, and say in your report that it was open.
Each such world row names its seam (`request-response`, `webhook`, `queue`,
`clock` or `person`), which narrows nothing but says which items bite most.

A store's Isolation is one of the names in the forms contract §store-premises,
written only as the brief or a cited source names it. A store whose
isolation the brief does not name is `unknown`, which permits every anomaly,
also when the brief names only the product or says only "default settings".
Do not infer the level. Say in your report what the vendor documents
as its default, so the developer can name it ([stores.md](stores.md)). A claim
that depends on what the store prevents lists `store:<row>` in its Rests on.

List in each store's and entity's Reads and Writes every row that reads or
writes it, world rows included: another team's job, a support tool, a
migration. A writer left off is in no model, and its race is never seen.
Spans come from the surfaces alone, so list in each part's surface every event
it emits and consumes, every store and entity it touches, every row it calls.

Write what a world party normally does, and anything it does outside the menu
that the brief relies on or fears (a charge the bank later reverses), as
actions of its row; its misbehaviours are the menu's, never actions.

## Set the grain of the actions

Each action is one step in every model of its part, on every engine, and no
model can split it ([model.md](model.md)), so the grain is set here. Too
coarse hides the half-done state from every model; too fine only slows.

Where an actor looks at something and acts on what it saw, and the brief names
no mechanism holding it still between, write a start, which reads and decides,
and a completion, which acts: "the desk checks the copy is on the shelf and
lends it" is `check-copy` and `lend-copy`. "At once" and "immediately" speak
of timing and exclude nothing. Where the brief requires the two to be one
("atomically"), write one action with that requirement in its Sentence, and
the claims that need it rest on an `atomicity` premise whose provider is the
team that builds it.

Where the grain is open, write the two halves. A choice may set one step
against two (the forms contract §choices), and both grains' actions then stand
in the part whichever is picked. Every model must take each action, since its
row must be enabled, until a pick is in force: an action that only the
alternative not picked takes is then asked no longer (the account contract
§journey-rules). Mark
the half the brief's words do not name `added`, and pose as a choice what the
completion does when the thing it read has changed.

The completion's Sentence acts on what the start read: it lends the copy the
start found free, not "the copy, if it is free". Its cell in each phase another
writer can reach between the two is the brief's to decide. A refusal there is
a conditional write, a mechanism: say so in the choice's Question. A start
that stores nothing leads back to its own phase.

Where the brief names what makes the two one (one transaction, a lock held
across both, a conditional write, a single writer), write one action with the
mechanism in its Sentence or Guard. Each claim the interleaving would cost
rests on `store:<row>` when the isolation prevents the anomaly, and otherwise
on an `atomicity` premise that names the halves and what cannot fall between,
with an observable falsifier ("a copy recorded as lent to two members") and
its provider. Write two actions under `unknown` or a level that permits the
anomaly, for a check and a write in two transactions, for a writer that does
not take the lock, and for a lease that can lapse. No fault can remove an
action's oneness, so the premise alone carries it.

Asking a party outside the machine is three actions: `request-fee`,
`charge-card` (the provider's, in the calling part's lifecycles) and
`record-fee-answer`; as one, no model loses the reply after the charge.

An arriving event and the change it makes are two actions, receive and apply,
when another event, the same one again, or a stop after acknowledging can come
between. Whether it acknowledges before applying is the brief's, or a choice.
A receiver that applies at once and stores nothing first is one action.

Our own services stop too, and the menu does not reach them: where one action
of ours writes two records, or writes and calls, write two. The split puts the
state between in every search, but a second action that never comes is
inaction, not a stop: memory, locks and leases are kept. So write the restart,
retry or takeover as an action with its cell in the phase the first attempt
left; let that phase hold only what the design stores, and the next action
speak only of that; and ask who finishes or undoes the first half. Where the
brief is silent on what survives and a claim turns on it, write an `omission`
premise, or a choice when the brief reads two ways.

Each split costs a column in every lifecycle of its part. Keep two things one
action when all three hold: no other actor (only this row writes the thing,
and no two holders act in the role at once), no stop that matters (the first
half stores, decides and sends nothing the second or anyone outside depends
on), and nothing beyond the menu (the halves are inside one step of a world
party).
One transaction whose isolation prevents the interleaving gives the first two.

## Between the steps

Once the grain is set, ask the seven questions ([principles.md](principles.md))
of every action and seam: each world row, shared store and entity, and event
between parts. Read [shapes.md](shapes.md) against each part too. A guard
speaks only of what its actor holds: where it reads another party's state,
write how the copy reaches the actor, or pose what the actor sees.

Each hazard that could cost a stake becomes one entry, and you settle none: a
claim when the brief says it must not happen; a must-not journey, `added`,
refused at the step where the loss happens, when the only question is whether
the developer wants it refused; a choice when the brief reads two ways; an
`omission` premise, in the Rests on of each claim relying on it, when the
brief is silent and you assume that does not matter. An omission entry only
records a passage left out, and asks nothing.

When you notice you are choosing between two readings to write an entry, stop
and pose it in the developer's words: two short journeys that differ exactly
on it, by opposite polarity or by one step's action or case. Recommend the
reading the brief best supports; never pick. Where the brief settles a
reading, write it as written. Look in every row, of each part:

| Where | The readings | Why it matters |
| --- | --- | --- |
| every "eventually" | each item or the total; then on what business timescale, which often turns it into a bound; only an unbounded reading stays a liveness claim | a liveness claim rests on a premise that the work keeps getting done |
| one step or two | whether an operation happens at once, or starts and completes with room for something between | the room between is where a race lives |
| what the actor sees when it decides | the latest state or a copy; its own store or the provider's | an actor acting on what it cannot know is the most common modelling error |
| replace or add | whether a second arrival overwrites the first, or adds to it | events that come twice or out of order |
| which window | the period a rule counts over: "20 requests a minute" is per calendar minute or per any sixty seconds | limits, retry budgets, deadlines |
| what the store permits | a row of the isolation table, named in the store's own name | the faults the store supplies |
| never, or not for long | whether a state must never exist, or must not persist, and then who resolves it | what the claim says |
| the same one twice | an action that takes two things of one kind: may they be the same one | the same-slot, same-key race |
| the gaps of a rule with conditions | a combination of conditions the brief does not state | an empty or doubled row is a missing or contradictory requirement |

"One step or two" is settled by the grain, and "what the store permits" by the
brief alone: unnamed is `unknown`, not a choice.

## Rules with several conditions

Check a rule with several conditions ("a member may renew if nobody reserved
the copy, the loan is not overdue, and they renewed fewer than twice") as a
table in your own folder before writing guards and cells: every combination
(2ⁿ rows for n yes-or-no conditions), each with its outcome from the brief. A
row with no outcome is a gap and one with two an overlap: pose each as a
choice. A `-` means "does not matter", never "unknown".

A condition on phase becomes cells, one on data the Guard. Cases are for
different phases after the step; outcomes differing only in data go in the
Sentence, asked for by a claim. No cell is posed in stages: where a gap has
more than two outcomes, pose the two the brief best supports, say in the
Question that others exist, and in your report that the developer
settles any other in the brief.

## Lifecycles: every cell

Give each entity a part's actions move a lifecycle of flat phases in the
brief's words. Refuse an action in each phase where its guard cannot hold;
never admit it because nothing forbids it. An action is a column of each
lifecycle of its part, or in Unaffected when it neither reads nor changes the
phase. A lifecycle names its own part's actions only: where another part
writes the entity through a shared store, invent no event; list the store in
both surfaces and ask across them by a claim or journey.

The lifecycle tool's findings block confirmation of what they bear on and
never refuse an answer: clear them before you submit, except a cell awaiting a
pick (the lifecycle tool contract §findings). A must-not whose refused step
the lifecycles admit is left to a model. Once a lifecycle is confirmed, the
developer is offered a journey to each phase nothing confirmed reaches; write
your own to each phase that matters to a stake.

The confirmed lifecycles are also their part's lifecycle model, which explores
them together: an action that several of them have as a column is taken only
where all of them admit it. A phase no reachable combination holds, an action
or case none takes, and a posed cell one meets each flag every base question
there, and block every claim on that model until the restatement or a pick
clears them (the account contract §journey-rules, `explored`). So check a
part's lifecycles together, not one at a time.

## Journeys: whole, from the start

A journey holds every step its rules require, from each lifecycle's start
unless its start table names a later phase. Name the entities when it holds
two of one kind, and the actors when two holders of one role act ("the first
desk"). A must-not is refused at the effect that must not happen, not at a
request that may repeat harmlessly. Write a should-happen journey for each
stake's good outcome: a part with a TLC or Alloy model needs one confirmed, or
no claim on that model is established. Write a journey across each span, and
a claim of both parts where their rules could combine into a loss: a span
owes one of them examined on a model covering both, or the developer's carry
(the account contract §journey-rules).

## Claims and journeys of several parts

A claim's parts are those its `Parts` names, and a journey's those of the
actions its steps name, wherever either is filed: filing changes neither its
parts nor its pin, and no rule refuses a part's folder or a span's (the design
contract §filing). The folder decides only where the developer reads and
confirms it. So file a claim or journey about a seam in a span folder named
for that seam: the developer reads it there beside the rest of what crosses
the seam, and confirms the span's stated claims in a decision of their own,
apart from what either part states (the forms contract §spans, the design
contract §units). File it in a part when it serves that part's stake and
another part only sets the scene, such as a journey that borrows another
part's action for its first step: the developer looks for it there, and it
still counts for the span. In a span every reference is `<part>/<key>`.

Choose the folder once. Moving a stated entry lapses the confirmation of
both folders' stated entries, and a thing removed in one answer and added in
a later one is new, with every slot owed and every question run again: a
move belongs in one answer that removes it and holds it, under the same key
and unchanged, in its new folder (the design contract §removal).

## Premises

A premise is what a claim rests on that no examination here establishes. You
write six classes. Code adds `store:` and `choice:` premises, and the
developer carries each strike as `strike:` and each claim's bounds on a model
as `bound:`, apart from any page (the forms contract §premises, §code-premises).

| Class | Write it when | Its provider |
| --- | --- | --- |
| `world` | an outside party is relied on beyond the menu: the provider never charges more than asked | the party, by its own documentation |
| `promise` | another part is relied on at a seam: the catalogue never lists a withdrawn copy | that part's key |
| `fairness` | a liveness claim needs an action that stays or keeps becoming possible to be taken | whoever runs the actor |
| `atomicity` | an action is one step only by a mechanism nothing here examines | the store, the lock service, or the implementing team |
| `bound` | a claim needs a reason why small bounds suffice for what it is about, which no bound states; rarely | the developer |
| `omission` | the brief is silent, and the restatement assumes that does not matter | the developer |

No examination discharges a promise, so write it also as a claim of the part
that makes it, for the developer to carry the premise on with that claim as
its basis. A fairness premise names the actor, the action and the chance:
"the reminder job, while a loan is overdue, eventually runs" when it stays
possible; "the provider, asked again and again, eventually answers" when
something keeps taking the chance away. Name every action that must keep
happening, and only those.

Write each premise once, listed in the Rests on of each claim on it. Why not
examined is `impossible`, `not worth the cost` or `not verifiable here`, with
the engine or observation needed. The Falsifier is an observation (a record, a
log line, a vendor's statement), never "if the premise is false".

## Before you submit

- **Coverage.** Every passage is cited by an entry or the part list, or named
  in an omission.
- **The answer.** It holds pages at their project paths under `design/`, and
  in `removed.md` each thing, part or span it removes. A page it leaves out
  stands as it is, and an empty file removes nothing (the design contract
  §restate-holds). It is checked against the restatement as it would stand
  after it, so new parts that refer to one another come in one answer.
- **The checks.** Every page parses, every reference resolves, every action is
  in every lifecycle of its part or unaffected. A failed check refuses the
  whole answer and spends one of the allowance.
- **Nothing frozen.** While a surprise is open, nothing it rests on can be
  removed or re-filed, and the lifecycle pages a surprise on the part's
  lifecycle model read are frozen (the design contract §restate-checks, check
  5). Leave them out of the answer, even unchanged, until the developer rules.
- **Origin.** The developer confirms a part's or span's `stated` actions,
  claims, premises, boundary and surface rows in one decision, and each
  `added` one, each lifecycle, each journey and each omission alone, beside
  its passages, so a Sentence must read alone (the design contract §units). An
  entry is `stated` only when it restates its passages outright; a half the
  brief does not name, a claim broadened to every actor, a journey from a
  shape, an open world side and an omission premise are `added`. When unsure,
  mark it `added`.

## Repairing a restatement

| It comes from | It asks |
| --- | --- |
| a unit declined with a reason (`repair:<decision>`) | the unit restated as the reason says |
| a ruling of `property wrong` | the claim restated, so it no longer reads at the pin the ruled surprise read |
| a ruling of `abstraction too coarse` | the parts restated with what the surprise turns on: an action, a case, a phase, a step |

The answer holds what a Restate answer holds, and a `repair.md` saying what
changed, in the developer's terms (the door contract §repair-answer). The
decision's words, which `item.json` holds as `decision`, are your direction. A
choice a corrected brief settles goes, with what rested on it. Read
`./forma missing` after each accepted answer: one for an item no longer
missing is refused and spends the allowance.

Keep keys. A thing under another key is a new thing, with every slot owed
and every question run again, though the developer's decisions follow its
meaning, not its key (the design contract §removal).

A coarse abstraction is often a coarse grain: a start and a completion, a
reply as its own action, an event received before applied. A late split is
dear: every unit naming the changed action is confirmed again, and every model
of the part owes a Model answer. Set the grain before the first answer.
