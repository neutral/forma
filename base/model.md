# Writing a model

A model is the restatement in an engine's terms. This page follows the work in
its order. Which engine to use is in [engines.md](engines.md).

## What a model is for

The developer reads only what the engines say about the model, and an engine
is exact about it. So a model's error lies in translating the design and the
world, and no check sees it beyond the journeys the model takes and refuses.
A model does what the restatement says, no more and no less, and is searchable.

## One operator for each action row

Each action has one row in the Actions table and one operator. The operator
does what the action's sentence says. Its guard is the action's Guard and the
phases its lifecycle cells allow, and nothing else:

- a cell naming a phase, or a case's outcome, admits the action in that phase
  and moves the entity to the outcome;
- `None.` refuses it in that phase;
- `choice:<key>` takes the effects of the developer's pick;
- a lifecycle that lists the action as unaffected is neither read nor moved.

A journey step's case is read from the phases after the step, so the
operator must produce every case's move on the inputs that give that case, and
the Phases expressions must show it. The pages show no picks or strikes:
`item.json` names the units confirmed, each pick and what it makes of the
cells it posed, and each strike in force (the door contract §gives). Read them
before you write, since the cells are as the picks fill them and the
Misbehaviours table answers to the strikes.

Never add a guard so that a claim, or a journey that must not happen, holds.
Where the actions let a must-not journey happen, leave it possible: an engine
shows it, the developer rules, and a mechanism enters by a repair that names
it. The model refuses a step only by the action's Guard, or by what another
part's actions leave in the state the step reads. Derive each operator from
its action and the world rows, never from what a claim needs. Then compare:
where a claim holds only by something no action states, a guard, an order of
steps, a value never written, the model has built the claim in.

Keep the actions apart from the world's misbehaviours, and never let an
operator lose or repeat its own message. On TLC the next-state relation is
composed from the Actions rows and the unstruck Misbehaviours rows, so a
misbehaviour inside an action survives the developer's strike, and its trace
shows our action where the world misbehaved. On Alloy, see
[alloy.md](alloy.md), section 1.

## What a step may read

A step reads only what its actor holds. What another party holds reaches it as
a message or a reply, which can be late, lost or old. A guard that reads the
truth elsewhere, such as the provider's record or another service's table, is
an indivisible read across a seam: the model lets less happen than the design,
and the flaw in the gap is silent. One operator is one step, and the grain was
set when the brief was restated ([restate.md](restate.md)).

### When an action hides a read and a later write

An action may read something and later write on the strength of it, with room
for another actor's action between. Where a mechanism, a premise or a pick
makes the two one, model one step; a store's isolation does so only within one
transaction ([stores.md](stores.md)). Where nothing does, the design takes two
steps and the restatement one, and a Model answer cannot split the action. Do
both of these:

1. **Model the read as possibly old, inside the one operator.** The operator
   acts on a value the record held at some earlier state, evaluates the Guard
   on it and computes the write from it, so an engine can show the lost update
   or the decision on a superseded value. Make the value read a parameter, so
   a schedule can bind it and a trace shows what the actor saw. TLC shows a
   step's bindings only when the model has Phases rows and the replay
   succeeds; otherwise read the value from the states. How far back a read
   reaches is in [stores.md](stores.md), "How a model lets a permitted anomaly
   happen". An old value from another party's message belongs to that row's
   delay or reorder.
2. **Say in your report that the action is too coarse.** Name its
   read, its write and what could come between, in the brief's words, and how
   you modelled it. A Model answer has no field for this, and the cure is the
   developer's: declining the unit that holds the action sends a Restate
   repair.

The first is the loud side, and shows only where some claim, journey or
witness reaches the stale effect; hence the second. Never take two steps under
one row, which leaves every journey naming the action a step short, or carry
the second half on a misbehaviour row, which shows the world acting for us.

Where what matters is the action seen half done, a lock held, a seat held and
not yet paid, nothing is half done in one step. Write the action in one step
and do not invent the half-done state. In your report, name each claim that
turns on it and the cure: the action split into a start and a completion, or
a premise of class `atomicity` naming what cannot fall between. Until then
those claims' passes say nothing about what could come between.

An action that makes two writes, with nothing making them one, can stop
between them. Where the first write alone leaves every entity in a phase of
its lifecycle, let the operator end with only that write done, as one of its
outcomes, and say so in your report; it cannot be struck, only ruled on.
Otherwise write it in one step and report it as above.

## State

Keep every variable that a guard, a claim, a phase, a journey, a witness or a
misbehaviour's target reads, and every variable those depend on: a slot
declares no variable, so it reads only what the model holds. Drop a variable
only when nothing kept depends on it. Where you merge or drop state something
kept depends on, say in your report which way the model now errs.

Collapse values to the classes the guards and claims tell apart: under, at
and over a limit, when nothing reads more. A claim that reads the value
itself, such as a sum, keeps the values it needs. Keep what a party has
stored apart from what it holds only while it runs, wherever a crash is kept
or our own service can stop, so that a stop loses exactly what was not stored.

History a claim needs, such as "never twice", must be readable from the state:
on TLC a variable the operators that make it write; on Alloy perhaps past-time
operators, at a cost in steps ([alloy.md](alloy.md), section 5). The type
invariant says only which values each variable may take. Never put a claim in
it: TLC checks it first on every question ([tlc.md](tlc.md)).

## The world at its worst

Each unstruck item of each world row has a Misbehaviours row, enabled in some
reachable state, whose target is reached. Never take a misbehaviour away, or
make it harmless, so that a claim holds; the mechanism has to hold against it.
A struck item's row is ignored on TLC; on Alloy leave it out of the facts
([alloy.md](alloy.md), section 1). What real parties do is in
[world.md](world.md). Each wrong way below lets less
happen than the world does, and gives silence.

| Item | Producing it in a model | The usual wrong way |
| --- | --- | --- |
| drop | a request, event or reply in flight is removed and never arrives; the receiver never acts on it, and the sender is not told; the costly case is the reply lost after the party acted | a drop only of a message already acted on, or only while nothing waits; a drop with a resend the brief does not have in the same step; room for one message in flight |
| duplicate | the same request or event arrives again, both while its first handling is in progress and after it; only the receiver's stated guards decide whether either handling applies the effect | messages held in a set, so the copy is the same element; a receiving guard that ignores a message already seen, which the brief does not state; a duplicate only before, or only after, the first handling |
| delay | the message stays in flight while other steps happen, and can arrive after a timeout, a retry, a later message, a deadline or the entity moving on | sending and arrival in one step; a delay bounded by a number of steps, or shorter than the timer it races; a row that changes no variable, so its target cannot tell |
| reorder | two messages in flight arrive in the other order from the one they were sent in | a queue that delivers only its head; bounds that never hold two in flight; a sequence number the brief does not have |
| fail-forever | from some step on, every request to the party fails, the caller sees it, and it never succeeds again | a failure that clears; a failure only before the first request; a failure the caller never sees |
| fail-then-succeed | a request fails, the caller sees it, and a later attempt succeeds; the error may follow an effect done in part or in full, unless the party's documented guarantee or a premise says otherwise | a failure only where no retry can follow; a failure assumed to leave no effect, with no source or premise saying so |
| crash | the party stops: what it held only while running is lost, what it stored durably is kept, its work is unfinished; a restart, later or never, is a step of its own that needs an action of the restatement, and without one the party stays down and the report says so | a crash that loses nothing; a crash only when nothing is in progress; a crash bound to an immediate restart; every acknowledged write treated as durable, or durable writes lost, with no durability guarantee cited |
| go-silent | the party has done some of its work, then does nothing more and never replies; the caller cannot tell whether it acted | silence before doing anything, which is a drop; a silent party that answers later, which is a delay; a silence that undoes what was done |

Our own services stop too, and no row forces that into the model
([shapes.md](shapes.md)). A behaviour in which our second action never comes
models inaction, not a stop: memory and locks are kept, and no other worker
takes over. Lost memory, a takeover or a restart is in the model only where
the restatement has an action or a phase for it. Where it has none, report
which claims that leaves unexamined, and that the cure is such an action or a
premise of class `omission`.

Hold each store at the isolation its boundary row names; `unknown` permits
every anomaly. A store row has no menu, so only you put a permitted anomaly
into the model, and a store modelled stricter than its row hides every flaw in
that anomaly ([stores.md](stores.md)).

## Choice, not selection

Where the world or an actor chooses, every choice is possible: which item,
which value, which party first, whether two parameters of one domain are equal.
On TLC put choices into parameters with domains as wide as the bounds allow,
since each row is composed over every binding. On Alloy the rows only observe,
so the facts must admit every binding. Exclude a binding only where the design
or a carried premise does.

## Bounds

Choose each constant to the smallest world in which the flaws can show
([principles.md](principles.md), 8). A bound must admit every action the
claims and journeys need: a liveness claim cannot hold where the action that
brings it about is left out, a bound on dates must not make one obligation
impossible once another is met, and each binding a schedule gives must be a
value the bounds hold.

Each Bounds row has a Meaning in the developer's terms, such as "two members,
one book, a limit of two loans". The developer carries it as a premise with a
falsifier, so it says plainly what the bound holds and leaves out. A change to
the Bounds lapses those carries, and makes every question it bounds a new
question, run again against the allowance while the old keeps its evidence,
not current (the evidence contract §question-names). Never put a note there: the
developer reads a Meaning as what a bound bounds.

A TLC `constraint` cuts the search and is carried as a bound; its Meaning says
what states it leaves out. One that leaves out a claim's situation makes the
pass unearned, and only a declared witness of that situation catches it. A
liveness claim is examined without the constraint, since TLC drops every
behaviour past it and a false liveness claim could pass ([tlc.md](tlc.md),
section 3). So a model with liveness claims must be finite by its constants
alone, or those runs end unanswered. Bound it by the constants and what the
state keeps, never by a guard no action states.

## Keep it searchable

Every action carries one sentence in the developer's terms. Aim for 50 to 200
lines a part; a model nobody could restate in a sitting is too big. Each run
has a limit of time and memory, beside others on at most half the machine's
processors. A run out of time beside others is rerun alone and spends the
allowance twice; one out of time alone is unanswered. Measure with your own
engine, and report what the longest run took.

When the model is too heavy, cut entities before behaviours: two that contend
still show a race, and a cut action or misbehaviour is a way of going wrong
nobody examines. When the whole cannot be searched, cut the search, not the
system: bound the model of every part to worked examples, each a small opening
situation with its inputs, explored in full, and say in the Meanings what all
of them leave out, such as steps that cross two examples.

Start with one model of every part. A model covering fewer parts is accepted
only while a question on that one has unanswered evidence, or, on the other
engine, while a claim whose parts it covers is owed another engine (the models
contract §one-model-first), and the spans it splits still owe a claim or
journey of both parts examined on a model covering both, or the developer's
carry. Where one part leans on another, that is a premise of class `promise`
for the part that leans and a claim for the part that keeps it; name them in
your report. Until they exist, the receiving action takes any input the other
part could send.

## Liveness and fairness

Fairness goes only on what a carried premise names, and never in the model: on
TLC it is the encoding's `Fairness`, on Alloy the antecedent of its assertion
([slot.md](slot.md), Liveness). Weak fairness is not enough when another action
keeps disabling the one that must happen. Deadlock checking is off, so a state
with no row enabled stutters forever, and a liveness claim that fails there
may fail on the bounds ([tlc.md](tlc.md), "Deadlock checking is off").

## Recital

Model the system in the brief, not the textbook protocol it resembles. Two
models can reach the same states and differ in the order of steps, the repeats
and what must happen next, so compare those too. When you write a step, a
message, a vote or a lock that no action has, stop: it is a mechanism the brief
lacks, or a step the restatement lacks, which is for your report.

## Lifecycle models

A part's lifecycle model, `lifecycles-<part>`, is written by no answer: it is
the part's confirmed lifecycles, and exists while one of them is confirmed
(the models contract §lifecycle-model). A Model answer for that key is
refused; a repair of it changes its slots ([slot.md](slot.md)) or the
lifecycle pages, each page checked as a Restate answer's. It is for claims at
phase level and for conformance: it meets the journey rules only when every
confirmed journey of that part alone steps through its lifecycles and no base
question on it is flagged for an unreachable phase, an untaken action or an
open pair (the account contract §journey-rules). It costs an encoding slot for
every claim whose parts are its one part, many `Cannot express`, and a
phase-level bound the developer carries on each claim with a property there.
It is no split, and before a TLC or Alloy model exists the model owed covers
every part, whatever the lifecycle models cover.

## Check before you submit

Forma accepts a Model answer on checks of form alone. Everything else is found
by runs that spend the developer's allowance. Your own runs give no standing,
so check with your own engine and report what they showed:

- the model parses, with your wrapper importing exactly what it imports;
- every Actions and Misbehaviours row is enabled in some reachable state;
- every should-happen journey is taken, every must-not one refused as designed;
- every trace your engine reaches is one the design allows, read by its first
  wrong step;
- every Phases expression gives one phase in every reachable state;
- on Alloy, the facts admit an instance at the bounds;
- for each claim, the action that could break it can try.

## When a question fails: three responses, and no others

1. Repair the model and name the mechanism added.
2. Report a finding for the developer to rule on.
3. Leave the expectation to the developer: only they revise a claim.

Weakening a property, constraining a race away, lowering a bound, narrowing
what a claim names, and editing an expectation so a run passes are not
repairs. A failure in your own run is your slip, which you correct, or a flaw,
which you report and leave in the model. A surprise in Forma's run stays open
until the developer rules, and is explained by an agent who wrote none of the
model. Meanwhile the model's files and the claim's slots on it are frozen, a
new engine file or slot included: an answer holding one is refused whatever
its bytes, and its item waits for the ruling (the models contract §freeze).

## Repairing a model

- **A real finding.** Add the smallest mechanism, one a team could build, that
  prevents what the developer said must not happen, inside the actions the
  restatement has ([mechanisms.md](mechanisms.md)). A step it needs that the
  restatement lacks, such as a release or a recovery, is not hidden in an
  operator: report the change. Name the mechanism in `repair.md` in a sentence
  the developer can agree with or not, with no operator or variable in it.
  Where a ruled surprise is on a claim, the same answer holds a fault of that
  claim whose Mechanism is that sentence, so the mechanism enters with the
  defect that removes it (the models contract §model-repair). Then check the
  liveness claims of everything it touches.
- **Model wrong.** Repair what the developer's words say: model files, slots
  or both, but never the encoding of a claim the ruled surprises are on (the
  models contract §model-repair).
- **Property wrong, on a model.** Where the ruling leaves the sentence as it
  is and says the encoding misreads it, the Repair changes that claim's
  encoding and none of the model's own files; an encoding the engine cannot
  say gives its reason instead (the models contract §model-repair).
- **The slots in the same answer.** Where a repair changes what a slot rests
  on, change the slot: a claim's fault takes away the mechanism added for it.
  A fault or witness the repair makes pointless is retired by naming its file
  in `removed.md` at the answer's top, one path a line, beside the slot that
  takes its place under a new key; never a claim's last encoding, witness or
  fault there, and nothing a surprise freezes (the models contract
  §model-repair).
- **What the ruled question read.** A Repair changes at least one file a ruled
  surprise's question read, so that question is asked again; one that changes
  only what it never read is refused (the models contract §model-repair).
- **One item, one answer.** A ruling owes `repair:<decision>/<model>` for each
  model it sends a Repair to. Each repair item takes its own answer and its
  own `repair.md`, and each later answer holds the files as the earlier left
  them. When the restatement has changed, the first answer must already hold
  tables that fit the parts as they are now.
- **After every ruling on the model.** A Repair that changes the model's
  files waits for the ruling of every other surprise still open on the model
  (the models contract §model-repair, §freeze).
