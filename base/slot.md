# Filling a slot

A slot says what one restatement entry says, in the model's terms. Forma fixes
every expected outcome before anything runs, and the engines contract
§slot-forms gives each slot's form. Your work is to say exactly what the entry
says, so that an outcome means what it appears to mean.

## What each slot is evidence of

Each kind of slot rules out one empty pass of [principles.md](principles.md),
"A pass is earned". A slot that matches without ruling its case out is worse
than an empty one: it reads as evidence and is none.

| Slot | Expected outcome | Rules out | Only when |
| --- | --- | --- | --- |
| Encoding | no violation within the bounds | a pass about something other than the claim | it forbids what the sentence forbids and admits what it allows |
| Witness | `Target`, or the combination or transition, reached | the situation never arose, or the bounds kept it out | `Target` is the situation itself, at its corner, and false before it |
| Fault | `caught`: this claim's encoding violated; on TLC, the type invariant not violated up to that state | nothing could have broken the claim | it removes the one mechanism the claim rests on, and nothing else |
| Misbehaviour witness | `Target` reached | the claim was never tried against the world's failure | `Target` holds only once that misbehaviour has happened |
| Schedule | should happen: every step taken from the start, and `End` holding after the last; must not: the steps before the refused one taken, then it not enabled | the model does not do what the journeys do | each binding, entity, start and `End` is what the journey means, so only the design can refuse |

Forma checks each slot's form. It cannot see whether a `Target` is the
situation, a fault removes the mechanism, or a binding is the one the journey
means. That part is yours. A slot owed again keeps its old text only if it is
still exact for the changed entry. While a surprise on one of a claim's
questions is open, every slot of that claim on that model is frozen until
the developer rules, a new one included, and so are the model's own files:
an answer holding one is refused whatever its bytes, and their items wait
(the models contract §freeze). Slots of other claims and of journeys may be
written meanwhile.

## Which way each question errs

This table gives the slot's own mistakes for each question of the table in
[principles.md](principles.md), "Loud before silent". Aim to be exact. Where
you cannot, take the loud side and say in your report that you did.

| Question | Wrongly matches (silent) when the slot | Wrongly surprises (loud) when the slot | The loud side |
| --- | --- | --- | --- |
| base: no violation | asks less than its sentence: a looser limit, a narrower quantifier, an antecedent that never holds, the wrong variable, fairness the premise does not name; names the faulted operator | asks more than its sentence: two copies agreeing in every state where the claim is about a decision, a limit off by one inward, fairness short of what the premise names | the stricter reading |
| witness: reached | is weaker than the situation: true in the first state where the situation is not, an implication, a disjunction, a state that needs neither the antecedent nor the guarded action | asks more than the situation, a value the bounds never hold, or the claim's violation itself | the whole situation, as a conjunction |
| misbehaviour: reached | holds without it: in the first state, while a message is in transit, after two ordinary sends; reads only a mark its own operator writes | asks for a consequence it need not have, or at a place the bounds never reach | the trace only that misbehaviour leaves |
| fault: caught | removes more than the mechanism; breaks the claim by an unrelated route; is caught by an encoding that names the faulted operator or asks more than its sentence | removes a mechanism the claim does not rest on; leaves another protection standing, a guard no action states or a second stated mechanism (say which, and remove no more); leaves the types; needs more than the bounds hold | the smallest removal, at the line |
| path: reached | starts weaker than the journey's start; binds what the model can take, not what the journey says; leaves a step whose case no lifecycle places, examined as its operator alone; gives an `End` weaker than the expected end | binds an input the bounds do not admit, the wrong entity, or a start the model cannot reach; gives an `End` that asks more than the expected end | the journey's own inputs and end, exactly |
| refusal: not enabled | binds the refused step so that its operator is disabled for another reason: another actor, another entity, an input outside the guard | binds an input the design admits | bindings under which only the mechanism refuses |
| start: reached | is weaker than the journey's start | holds in no reachable state, or only where the Phases give other phases | the journey's start, exactly |

A fault shows an encoding's silent error only at the line: "at most three"
for "at most twice" is violated when the limit goes, not when it moves by one.

## Encoding

### Place the claim before you encode it

Its genre decides whether the engine says it natively, by a workaround, or not.

| Genre | Example | TLC | Alloy | Lifecycle engine |
| --- | --- | --- | --- | --- |
| a state invariant | a loan is never renewed more than twice | `Invariant` | an assertion over `always` | a forbidden combination, when that form says the whole claim; otherwise `Cannot express` |
| a property of a step | a renewal never moves the due date earlier | `Property`, an action property over variables and their primed values: `[][due' >= due]_vars` | `always` over the variables before and after the step | a transition, when the claim forbids one move |
| a property over history: never twice; in order | a late fee is never charged twice for one loan | only over a variable the model already keeps: a count, a log, a phase. A slot adds none, and TLC refuses a temporal formula nested inside an action | past-time operators such as `once`, or `after always` inside `always` | sometimes one transition or combination; otherwise `Cannot express` |
| a response: something follows | every overdue loan is eventually returned or charged | `Property` with its `Fairness` | `eventually`, the premise's fairness as the assertion's antecedent | `Cannot express`: a forbidden form is safety only |
| structure | no loan has two borrowers | an invariant, when the model holds the structure as data | native | `Cannot express` |
| a deadline the model counts | a reply within two ticks of the clock | an invariant over the model's clock, when it has a clock row; otherwise `Cannot express`, naming the clock it lacks | the same | `Cannot express`: phases hold no time |
| real time, a probability, a percentile, a hyperproperty | a reply within two seconds of wall time | `Cannot express`, naming what the engine lacks | the same | the same |

Write the encoding over the model's variables, naming no action's operator.
A fault changes what such a name means, and differently on each engine: on
TLC the encoding keeps the real operator, which a faulted step need not
satisfy; on Alloy it reads the faulted predicate ([tlc.md](tlc.md), section
5; [alloy.md](alloy.md), section 1). Either way an encoding that names the
action catches or misses a fault by how it names it, not by what the claim
says. Where you must name one, as Alloy does for a repeat the model records
nowhere, run the fault and say in your report whether the claim's sentence
catches it.

A history claim on a TLC model that keeps no record of the event is `Cannot
express`, naming the record the model would need. A repeat that changes no
variable is a stuttering step to TLC, invisible to any property; Alloy counts
it. Either way a repeat needs an effect the model records.

`Cannot express` is never for a run out of time or memory, and never reshapes
the claim: a new sentence goes to the developer through the restatement.

### Exact in both directions

Asking more than the claim is the commonest slip. Asking less is worse,
because nothing shows it. Name one behaviour the sentence forbids and one it
allows, both as close to the line as you can: "renewed a third time" and
"renewed exactly twice". Behaviours far apart separate nothing: "never" and
"ten times" tell `<= 2` from `<= 3` no better than from `<= 9`.

- **It admits the allowed one.** For a state invariant, add the allowed
  behaviour's last state as a target, its negation as a second invariant after
  the encoding: the target must be reached first. For a temporal property a
  target stops the search too soon. Check instead that the property holds on
  a copy of the model that allows only the allowed behaviour.
- **It rejects the forbidden one.** Your fault at the line is the copy in
  which the forbidden behaviour happens. The encoding must be violated there.
- **Report both** behaviours, and what each run showed.

For a claim about a decision, check the step that decides, not that two
copies agree in every state: they may disagree for a while by design.

### Liveness and its fairness

A liveness claim rests on a premise of class fairness. Behaviours may stutter,
so without fairness it fails by everyone stopping: the fairness decides.

- Put fairness only on the actor and action a premise names. Any other makes
  the claim hold for a reason the developer never agreed to.
- Choose the form by the premise. `\A l \in Loans : WF_vars(Return(l))`,
  fairness of each binding, says each borrower returns. `WF_vars(\E l \in
  Loans : Return(l))`, fairness of the row, says some loan is returned, and is
  met while another waits forever. Neither implies the other.
- Bind each parameter once, over its own row's domain as the row writes it.
  Fairness on an instance the model never takes would pass the claim for want
  of a fair behaviour, and Forma refuses it ([tlc.md](tlc.md)).
- Use strong fairness only when the premise says the party acts even when
  able to only now and then. Otherwise let the surprise show the gap.
- `Fairness` names only operators of the Actions table. When a premise's
  party acts through a misbehaviour's operator, say so in your report.
- On Alloy the premise's fairness is the assertion's antecedent, and only it.

## Witness

A witness is the claim's situation, never its violation, which is reached only
if the claim is false. For an implication it is the antecedent; for a guarded
action, the guard held and the action taken; for a response, the trigger; for
a limit or a repeat, the corner: the limit met exactly, the second arrival.

Write `Target` as a conjunction: an implication is reached in the first state,
where its antecedent is false, and says nothing. A witness reached in the
first state is right only when the situation holds there; when the situation
is that something happened, require the state it leaves. Ask for values and
dates the bounds hold. Every witness must be reached for the claim to be
established, so give each situation the sentence names its own, and no other.
Only the first is listed as missing: answer each further one for the item
`slot:<the claim's folder on the model>/witness`, under a key not yet used
(the models contract §owed). `give` hands out that item whether or not it is
missing (the door contract §forma-give), so ask for its packet as for any other.
Say in its Meaning what the developer would see.

## Fault

A fault takes away one mechanism and shows that the claim notices. It changes
one action of the model, never the property. On TLC only that action's row
applies `Fault`, and everything else that names the operator, `Fairness`
included, keeps the real one, so a liveness claim's fault in its fair action
needs care ([tlc.md](tlc.md), section 5). On Alloy the predicate is replaced
wherever the model's files call it.

- On Alloy a fact that writes out the action's body escapes the fault
  ([alloy.md](alloy.md)).
- Remove exactly the mechanism the claim rests on, and nothing it needs.
- The claim must catch it, not a neighbour, and on TLC with no state up to the
  violation outside the types. Read the trace: the step the mechanism held
  back lets the violation happen, perhaps well before the violating step. For
  liveness read the whole loop.
- A claim true by how the model is built, as when the type invariant
  `renewals \in [Loans -> 0..MaxRenew]` says it, cannot be faulted. Say so:
  the model needs to change.
- If no sentence, guard or repair states the mechanism you remove, the model
  has a guard nobody asked for ([model.md](model.md)). Say so.

Write one `Fault` with its operator's parameters, in one of six ways.
[mechanisms.md](mechanisms.md) gives the fault that removes each mechanism.

| Kind | What it removes | How `Fault` is written |
| --- | --- | --- |
| drop a guard conjunct | a check | the body with one conjunct of its enabling condition removed. The smallest removal moves the line by one, `<=` for `<` |
| duplicate an event | the consumption or de-duplication of an input | the action leaves its input in place, so it can be applied again: a second step when the order of the arrivals matters; twice in one step only when the stated design can do that. Say in the Mechanism which |
| skip a step | one effect the mechanism needs: the key recorded, the log written | the action leaves that effect out and keeps its variable unchanged |
| reorder | an ordering between two steps | drop the condition that makes the action follow the other; one step cannot be reordered within itself |
| widen a set | a membership | inside the body, since the parameters keep the Actions table's domains: a test against a larger set, or an update that adds more |
| remove a frame condition | what keeps a variable still | on TLC, `x' \in S` for a finite set `S` of `x`'s type: deleting `UNCHANGED x` leaves `x` unassigned and the run unanswered, and an infinite set such as `Nat` cannot be enumerated. When the model gives no such set, say so rather than shrink the effect. On Alloy, delete the frame constraint |

## Misbehaviour witness

A misbehaviour's `Target` holds once the misbehaviour has happened, and at no
state the ordinary course reaches without it. Test it: on TLC compose the
next-state relation without that row, on Alloy take the behaviour out of the
facts in a copy. `Target` must then not be reached, and with it, must be.

| Item | `Target` holds once |
| --- | --- |
| drop | a message was sent, is no longer in transit, and was never received |
| duplicate | the same request, identified apart from its send attempts, arrived again; whether it was applied again is recorded separately |
| delay | the message or operation is still pending past the point the seam's ordering or deadline names, by state the model records |
| reorder | two messages were received in the other order than they were sent |
| fail-forever | the party has failed and holds no way back to success |
| fail-then-succeed | a request failed, and the same request later succeeded |
| crash | the party stopped and lost what it held but had not stored; a restart is a separate step, an action of the restatement, and required only by a premise |
| go-silent | the model records that the party stopped partway through its step without finishing or replying |

When the model keeps no state that tells the result from the ordinary course,
write the stricter `Target` and say what the model would need to keep. What
the parties do is in [world.md](world.md).

## Schedule

Bind each step of the journey, in order, from its start, to inputs the bounds
admit. When the model cannot take a step, do not bend the schedule: submit
what the journey asks and say which step the model lacks. A journey code adds,
a pick's, an offered one or a kept one, has no page: `item.json` holds it in a
journey page's form (the door contract §gives).

- **Entities.** Give a constant-level value for every entity the journey
  names and every entity a step with a case moves. The case is asked of that
  entity, so a wrong one leaves a path not reached and lets a refusal match.
- **Start.** The start predicate is the journey's start, its phases and the
  data its first step needs, and no weaker. It must hold in a reachable state.
- **Bindings.** Mind the schedule form's rule for a `|` inside an expression.
  Each names the actor, entity and input the journey means, right in the
  state the step before left: the path takes no step between, so a journey
  that needs another party to act between two steps lacks one. Say so.
- **A refused step.** Bind it as the journey means it: the same entity, the
  actor it names, inputs inside every guard but the mechanism. On a copy with
  the mechanism removed the step must then be enabled.
- **End.** A journey that should happen has an expected end, and its schedule
  gives it as `End`, a state predicate asked of the state after the last step,
  with a `Meaning` saying how it reads `Expected end` (the engines contract
  §slot-forms). Make it the expected end and no weaker: an `End` that holds
  wherever the steps can be taken lets a path pass that ended elsewhere. A
  must-not journey has none.

## Slots of a lifecycle model

The lifecycle engine holds one entity of each lifecycle of one part and
evaluates no guard. A part's lifecycle model exists once one of its lifecycles
is confirmed, and no answer writes it: it is those lifecycles (the models
contract §lifecycle-model). Only a claim of that part alone has an encoding
slot there, and a witness and a fault only when that encoding is a forbidden
form. Every slot there is written for each lifecycle of the part too, so a
change to any lifecycle of the part owes every slot there again: return the
same text where it is still exact.

- **Encoding.** What holds at once is a combination of phases, at most one per
  lifecycle; a move is a transition. One transition row forbids one move to
  one phase, less than a sentence that forbids an action leading to several.
- **Witness.** Prefer one reached without a guarded transition, which may be
  unreachable in the design and is not sent back. When there is none, say so.
- **Fault.** The overlay gives the one cell that refuses or leads elsewhere
  the outcome the mechanism prevents, and changes no other.
- **`Cannot express`** when the claim turns on data a guard reads, on two
  entities of one lifecycle, on another part, on something that must follow,
  or on an order over several moves.

## Before you submit

Parse and run each slot in your own folder, as [tlc.md](tlc.md) and
[alloy.md](alloy.md) say Forma invokes each engine, so that no answer is spent
on a parse error. Your runs give no standing. Report what they showed: a
surprise you can foresee is worth saying.

| Slot | Run |
| --- | --- |
| Encoding | the base question; the allowed behaviour nearest the line reached; for liveness, the same without your `Fairness`, to see that the premise decides |
| Witness | the witness and its trace: the state reached is the situation |
| Fault | this claim's encoding violated, the type invariant not, and the held-back step letting it happen |
| Misbehaviour witness | the `Target` with the behaviour and without it |
| Schedule | the path, with `End` holding after its last step; for a must-not, the refusal, also on a copy with the mechanism removed |

- Import in your wrapper exactly what the model imports. An extra module hides
  an operator the slot uses that the model never brought in.
- Give each Java process its own `-Djava.io.tmpdir=<folder>` when you run
  several at once. TLC and SANY unpack their standard modules there, and two
  processes sharing it fail in ways that look like parse errors.
