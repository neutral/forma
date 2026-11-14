# Explaining a surprise

A surprise is a question that answered and does not match its expected
outcome, kept in a file of its own until the developer rules. The developer
rules on it, reading your explanation beside code's rendering, and no ruling
is offered until every surprise it holds has an accepted explanation.

## What an explanation is for

An explanation carries the run to the developer in the brief's words: what
happened, which shape it has, which mechanism failed, and which verdict you
recommend. It decides nothing. It is good when it lets the developer rule
quickly and rightly, and harmful when it argues them out of a flaw.

You wrote none of the model, and Forma refuses an explanation from any
session that did, a lifecycle model's lifecycle pages included (the door
contract §forma-answer, §receipts). So read the model as what it says, not
what it was meant to say: the trace and the model's text, never its comments,
names or Meaning fields.

Forma gives you the surprise's own file, the evidence of its reductions and,
for a path, of its journey's start question, the entries they read, the
model's files and slots, and under `runs/` the run of the surprise and of
each reduction: the exact files the engine was given, wrapper and
configuration included, and what it printed (the door contract §gives). That run
is scratch, made again on this machine where it was missing. Where
`item.json`'s `differ` names a generated file, something it was composed
from has changed since the surprise ran, and the run you hold is of other
inputs: read what happened from the surprise's own `trace` and `rendered`,
which keep what each step meant when it ran, and take values from the run
only where they agree.

## Read the trace by the first wrong step

1. **Start from the shortest.** Read the shortest of the trace and its kept
   reductions, and note what it no longer needs. A reduction to one loan
   still allows two actors to contend for it.
2. **Restate each step in the brief's words:** who did what, to which entity,
   and what the developer would see change.
3. **Ask of each step:** would the design take it here, by its action, guard,
   case and cell? Would the world, as [world.md](world.md) and
   [stores.md](stores.md) say it behaves, with what the developer left
   unstruck?
4. **At the first "no", name what is wrong** there. The model departs from
   the restatement: an operator kinder or harsher than its action, a bound
   that leaves out an input or lets in a value the world never has, a slot
   that asks the wrong thing. The restatement lacks the action, case, phase or
   step that would refuse it. Or the confirmed sentence forbids a state the
   developer means to allow.
5. **Where there is no "no"**, the design allows the story. It is a finding.
   Do not look for a reading under which it is acceptable.

A liveness trace loops or stutters, and every step can be fine. Ask what never
happens, who would have to act for it, and whether a carried premise obliges
them. A premise that names that actor and action, left out of `Fairness`,
makes it `property wrong`, since the encoding then asks more than its claim.
A premise carried as weak fairness while another action keeps disabling it
does not, as worded, make them act: say so. No premise obliging anyone is a
finding. On TLC a trace ending in stuttering is everyone stopping, one that
returns to an earlier state is a loop, and only an invariant's trace is
shortest: read for the loop, not the length.

A surprise with no trace is a story that should have happened and did not:
find its first missing step. For a path, run its prefixes in your own folder,
one step longer each time; the first not reached ends at the wrong step, and
its start question's evidence says whether the start was reached. Where every
step is taken and the journey's expected end does not hold after the last, as
the evidence's reason says where the engine can tell, the steps are right and
the end is not: read the schedule's `End` against the journey's expected end
and against the state the last step leaves. For a
witness, check that its values are inside the bounds, its `Target` asks no
more than the situation, and the model has the action that reaches it. For a
fault not caught, check that it removes the mechanism, that no other
protection holds the claim, and that the encoding forbids what it lets
happen; on TLC, for a liveness claim, check too whether its `Fairness` names
the faulted operator ([tlc.md](tlc.md), section 5). Name any other
protection: a guard no action states is the model's to repair, and a second
stated mechanism is news for the developer. Never recommend removing more
than one mechanism.

## The smallest experiment

Reason from the run's files, then test the reading. In a private copy change
one thing and run it: add the missing input, restore the guard, loosen the
comparison. If the surprise goes away, your reading is supported, not proved.
Check that the change keeps the trigger and the question, and compare it with
the design before you call it the cause: a restored guard no action states
hides a flaw. Say under Mechanism what you changed, what happened, what it
does not show, and that your run gives no standing.

A kept reduction shows the property violated at smaller bounds, not that the
constant is irrelevant or the cause unchanged. Compare the traces and keep the
least of each thing the failure needs: a race may survive four contenders
becoming two and vanish at one. A reduction that failed to run says nothing.

A surprise on a base question of a TLC or Alloy model that found the
encoding's own property violated takes at least one weaker form of the claim,
and no other surprise takes any: where the type invariant broke first, every
weaker form would fail alike (the evidence contract §explain). Each is implied
by the claim and asks one thing less, to localize the cause:

- one conjunct of the property;
- the universal narrowed to one entity, actor or kind of input;
- an antecedent added, such as only once the copy is current;
- for a property of a step, only the action the trace's last step takes;
- for a limit, the limit loosened by one, which says whether the violation
  passes the next threshold, not whether it has a bound at all;
- for a liveness claim, one fairness term for the actor who never acted,
  which tells "nobody is obliged" from "obliged and still cannot".

List them in `Weaker` from the strongest to the weakest: code runs each once
it accepts the explanation, and shows the last in that order that fails as
the weakest that fails. These forms are not one chain, so say under
Mechanism how each relates to the claim, which do not imply one another, and
what each gave in your own run at the same bounds.

## Name the shape

Say which shape of [shapes.md](shapes.md) it is, and which anomaly of
[stores.md](stores.md) a store's isolation let happen. Recommend treating two
surprises of one shape on one mechanism as one matter.

Two rules each right alone can together leave work that never finishes, or
open a way round a third. That is a finding, not a slip.

## Recommend the verdict by where the repair lands

| Where the repair lands | Verdict |
| --- | --- |
| the model or a slot other than the encoding misstates what was confirmed: an operator, a bound, a witness, a fault, a schedule | `model wrong` |
| the claim's property says other than the developer means: its sentence, or an encoding that asks more or less than the sentence | `property wrong` |
| the restatement lacks an action, case, phase or step | `abstraction too coarse` |
| the design as the brief describes it lets this happen | `real finding`, targeting the brief, a mechanism added to a model, or the carry of a premise or a pick revoked |

Recommend by where the repair must land, not where the mistake was seen. A
slip in the encoding is `property wrong`: a `model wrong` Repair may change
no encoding of a claim the ruled surprises are on, while a `property wrong`
repair may fill the encoding again on its model and leave the sentence as it
is (the models contract §model-repair, the decisions contract §expects). Say
under Mechanism how the encoding misread the sentence, and whether the
sentence itself is exact, so the developer knows which of the two the repair
should be. For a `real finding`, name under Mechanism the mechanism that
would prevent it and its price from [mechanisms.md](mechanisms.md): the
developer chooses by it.

The Level's meaning is the developer's to settle; a `requirement` finding
targets the brief. Say whether the fault is in what is wanted, in the design,
or in how the design was carried into the model, and state under Failure
shape the meaning you give the level. Do not read it off the verdict: for
software already built, `implementation` may mean it departs from its design.

## Say whether the behaviour is wanted

A ruling of `model wrong` on a violated base question can keep its trace as a
journey that must not happen. When the trace shows behaviour the developer
wants, as after a type invariant too tight, keeping it forbids it, and the
repaired model will fail the journey. Say under Failure shape whether it is
wanted, and, when the trace would not be kept, that the ruling leaves no
journey behind. Only a base question's trace that tells a journey is kept:
at least one step, each step an action that exactly one row takes, so no
misbehaviour among them, each entity in one phase in every state, and never
a liveness claim's (the decisions contract §kept-journeys).

## A surprise with a reason to settle first

Some surprises come to you with a reason to settle before anything else
(the evidence contract §sent-back).

| Reason | Settle first |
| --- | --- |
| a lifecycle surprise whose trace takes a guarded transition | Would the guard, as the brief states it, refuse that step there? A TLC or Alloy model evaluates the guard, and `./forma account` shows the claim's or journey's evidence there. If not, read on as for any trace. If so, name the guard and the step. Where the guard can never hold in that phase, the cell is wrong, and a `model wrong` Repair of the lifecycle model corrects the lifecycle page. Where it can, phase level cannot judge it: a lifecycle path leaves the refusal to a TLC or Alloy model, and for a lifecycle base surprise recommend `property wrong` and say under Mechanism that the claim's encoding there should give a reason, since only that verdict's repair may fill the encoding again (the models contract §model-repair) |
| its trace takes a misbehaviour struck now | Does the claim or journey still fail without that step? Say what a run composed now shows |
| a path whose start question has current evidence not reached | Is the start predicate the journey's start (`model wrong`)? Can the model not reach it (`model wrong`, or `abstraction too coarse` for a missing action in the restatement)? Or does the design never hold that state? Then say so: it is the developer's to rule |
| a lifecycle path refused at step 0 | The lifecycles cannot hold the journey's start together: say which start row's phase no reachable combination holds, and whether the journey or a lifecycle is wrong |

## Write for the developer

Trace and Failure shape are a few sentences each, in the brief's words, with
no operator, file or line of a model. Everything about the engine and the
model goes under Mechanism, which is brief too.
