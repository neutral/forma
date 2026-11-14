# The principles

Every page of the base follows from this one. It states the job and twelve
principles. Each says why it holds, what follows from it, and where no check
of Forma's reaches, so that only your care stands there. When no page covers
your case, work it out from here.

## The job

An examination tries to find the cheapest way the design is wrong: the design
as the brief states it, in the world as it is. It gives the design no help: it
adds nothing that would make a claim hold. It does the design no harm: it
invents no failure the design or the world could not have. Its product is not
a green run. It is an account the developer can rely on without reading a
model.

## 1. Three authorities

The developer says what is wanted. An engine says what a model does. Sources
say what the world's parties do. An agent has no authority of its own: it
carries each of these to the others, and must not let the carrying decide.

The account is worth something only if the same record gives the same account
whoever did the work. Decisions, evidence and sources can be read again. An
agent's say-so cannot, and an agent that settles something is not neutral: it
leans to the reading that lets the work go on, or lets the run pass.

- An open reading of the brief is posed as a choice, never settled by writing
  one reading as an entry ([restate.md](restate.md)).
- A claim's sentence is the developer's. A repair does what their words say
  and no more.
- A fact about a party of the world has a source, or it is a premise the
  developer carries ([world.md](world.md), [stores.md](stores.md)).
- An explanation recommends a verdict and decides nothing
  ([explain.md](explain.md)).
- Whoever holds the developer's role holds the owner's authority only as far
  as the owner gave it ([developer.md](developer.md)).

The small decisions are yours: a key, a variable's name. The test is whether
another honest agent, deciding otherwise, would change the outcome of any
question. No check sees a reading settled inside an entry marked `stated`.

## 2. Claims come from stakes

What matters is what someone outside the machine can lose. A claim is written
from that loss, about the state that must hold whoever acts. A claim that
repeats what an action assigns can only agree with that action.

A property read off an action asks whether the action does what it says,
which it does by construction, and its fault is caught for the same reason. A
property written from a loss says nothing of who acts or how, so every action,
every misbehaviour and every interleaving is tried against it, the ones nobody
thought of included.

- Start a restatement from who can lose what ([restate.md](restate.md)).
- A rule the brief states for one actor is restated of the state it protects.
- A loss the world can cause whatever the design does is no invariant. Where
  the brief says how the machine recovers, it is a claim of recovery.
  Otherwise the claim stands as written, and may be the finding.
- An encoding states the loss, not the action that prevents it
  ([slot.md](slot.md)).

No check sees that a stake is a real loss, or that a claim is broad enough.

## 3. Exact about the model

An engine's answer is exact, about the model it was given, within the bounds
it searched. Every error in an examination therefore lies in a translation:
what matters into claims, the design and the world into a model, a claim into
a property, the size of the real world into bounds.

The engines search completely within what they are given, and none of them
reads the brief. Rerunning finds nothing the run did not say. Rereading a
translation against what it translates is where an error is found.

- Before you trust a result, name the translations it rests on.
- Know what each engine really does with what Forma composes
  ([tlc.md](tlc.md), [alloy.md](alloy.md), [engines.md](engines.md)).
- A run that ran out of time or memory has said nothing.

No check sees whether a model is faithful to the design. Fidelity rests only
on the journeys a model takes and refuses.

## 4. The chain

A flaw becomes a finding only when every link holds: someone asked; the model
can do the thing; the bounds let it happen; the property says what the claim
says; the engine answered; the trace was read rightly. A repair then has to
address the cause. A broken early link gives no error. It gives silence.

| Link | Whose | Breaks by | Then |
| --- | --- | --- | --- |
| someone asked | restating | a claim, a journey or a choice not written | silence |
| the model can do it | modelling | an action guarded beyond its sentence, a misbehaviour made harmless, a step fused | silence |
| the bounds let it happen | modelling | one contender, no repeat, nothing over a limit | silence |
| the property says the claim | a slot | an encoding weaker than its sentence | silence; a stronger one is a false alarm |
| the engine answered | the run | out of time or memory | missing work |
| the trace was read rightly | explaining, ruling | a flaw explained away, a slip ruled a finding | a flaw kept as a must-not journey, or a wasted repair |
| the repair addresses the cause | repairing | a guard that hides the symptom | silence |

The early links leave nothing behind when they break, so they need evidence
that they held. That evidence is the rest of this page.

## 5. Loud before silent

Every translation can be wrong in two directions. For a question that expects
no violation, a model that lets more happen than the design, or a property
that asks more than its claim, errs toward a false alarm, which the developer
sees and rules on. A model that lets less happen, or a property that asks
less, errs toward silence: a flaw nobody sees. Aim to be exact, because every
false alarm spends the developer's attention. Where you cannot be exact,
choose the loud side and say that you did.

For a question that expects `reached`, the directions reverse: more behaviour
makes it match more easily. So a match is evidence only when the story that
reached it is one the design allows. Read it.

| Question | Expects | Wrongly matches when | Wrongly surprises when |
| --- | --- | --- | --- |
| base | no violation | the model lets less happen; the bounds keep the trigger out; the property asks less than its sentence; fairness names more than a premise does | the model lets more happen; the property asks more; fairness leaves out what a premise names; a state leaves the type invariant |
| witness | reached | `Target` is weaker than the situation; a step the design would not take reaches it | `Target` is stronger; the bounds never hold a value it needs |
| misbehaviour | reached | `Target` holds without the misbehaviour, or reads only a mark its own operator writes | the bounds leave it no room |
| fault | caught: this claim's encoding violated | the fault removes more than one mechanism; the property restates the faulted action | another guard still prevents what the mechanism prevented; the fault breaks the type invariant first |
| path | reached | the bindings are bent to what the model can take; `End` asks less than the expected end | a guard no action states refuses a step; the bounds lack an input; `End` asks more than the expected end |
| refusal | not enabled | a guard no action states refuses the step; the bindings disable it for another reason than the journey's | a stated guard is missing |
| enabled | reached | only a binding the design never gives enables it | a guard can never hold |
| phases | no violation | a catch-all gives a key without giving the right one | an expression gives no key, or two |
| lifecycle path | admitted, or refused at its step | a cell admits where a guard would refuse: phase level evaluates no guard | a cell refuses where the design admits |

- Model each action from its own sentence and guard. Never add a guard so
  that a claim holds ([model.md](model.md)).
- Every unstruck misbehaviour does what the world does, with effect.
- Where the world or an actor chooses, every choice is possible.
- Fairness goes only where a carried premise names it.
- Every cap on the search is a declared bound.
- An open reading posed as a choice is the cheapest loud side: one pick, and
  no round of runs.

The loud side is no licence to invent. A behaviour the developer struck, or
one a source rules out, is not put back to be safe. No check sees a guard no
action states, or a property stronger or weaker than its sentence.

## 6. Between the steps

Each action, read alone, usually does what its sentence says. Flaws live in
what can happen between and around the steps: two at the same time; the same
one twice; one that never comes, or comes late; one that stops halfway; two in
the other order; one that acts on what is no longer true; two rules that are
each right alone. Ask each of these of every action and every seam.

A brief is written one action at a time, in the order things go when nothing
goes wrong. Nobody writes down the combinations, and their number is why
review misses them and a search of a small model finds them.

- [shapes.md](shapes.md) lists the shapes these questions turn up.
- Each hazard that could cost a stake becomes a claim, a journey that must not
  happen, or a choice ([restate.md](restate.md)).
- Our own services stop too, between any two things they do.

No check asks these questions for you. An interaction nobody wrote down is
not found.

## 7. The grain of a step

A model's step is indivisible. The design's is indivisible only where a
mechanism makes it so: one transaction at an isolation that prevents the
interleaving, a lock, a conditional write, a single writer. Anywhere else a
read and the write that depends on it are two steps, and asking another party
is three: the request leaves, the party acts, the reply arrives, and the reply
can be lost after the party acted. A step reads only what its actor holds.
What another party holds reaches it as a message that can be late, lost or
old. A stop can fall between any two steps, and loses what was not yet stored.

In Forma each step of a journey is one action, examined as one step, so the
grain is set when the brief is restated. A grain too coarse removes the race
from every model: the silent side.

- A read and the step that depends on it are two actions, unless the brief
  names what makes them one. Then the claims that need it rest on a premise
  ([restate.md](restate.md)).
- An operator reads only what its actor holds ([model.md](model.md)).
- What a store's isolation lets fall between a read and a write is in
  [stores.md](stores.md).
- Split only where something can fall between: another actor's action, a
  misbehaviour, a stop.

No check sees that an action is indivisible in the design.

## 8. Small, but able to interact

Most flaws show in small worlds. The smallest world worth searching has two of
each thing that can contend, the same thing able to arrive twice, one more
than each limit allows, and each unstruck misbehaviour able to happen. A bound
grows only when a question needs it, and never shrinks to make a run finish
without saying what it leaves out.

Small is measured by the interactions, not by a number. A world one smaller
than a race needs cannot show the race, however long the search runs. And a
bound is a premise: the developer carries it, so it is said in their terms.

- Choose each constant from the interactions the claims need
  ([model.md](model.md)).
- When the whole cannot be searched, cut the search, not the system, and say
  what the cut leaves out.
- A witness that sits at the limit shows the bounds reach it
  ([slot.md](slot.md)).

No check sees that the bounds hold two contenders or a repeat.

## 9. A pass is earned

"No violation" is what a search says when the property holds, and also when
the situation never arose, when nothing could have broken the property, when
the model can do nothing, and when the bounds kept the trigger out. A pass
counts only when each of those is ruled out.

| Empty pass | Ruled out by |
| --- | --- |
| the situation never arose | a witness: the claim's situation is reached |
| nothing could have broken it | a fault: one mechanism removed, this claim's encoding violated |
| the world could not break it | every unstruck misbehaviour reached |
| the model can do nothing | every row enabled, every confirmed journey taken |
| the bounds kept the trigger out | the witness and the fault at the same bounds |

Forma asks for this evidence and checks that it matches. Whether it is the
evidence it claims to be is yours. A witness true in the first state, a fault
that removes two mechanisms, a schedule bent to the model: each matches, and
shows nothing.

A violation you see in your own run before submitting is the examination
working. Read it by the next principle. If the slip is yours, repair it there
and nowhere else. If the design allows the story, submit your work as it is
and say what you saw. Adding a guard, lowering a bound or weakening a property
until the run is green turns a finding into an established claim.

## 10. The first wrong step

A trace is a story in which every step is allowed by the model. Read it in the
brief's words and find the first place it parts from the design, the world or
the claim: a first state the design cannot be in, a step the design or the
world would not take, a last state that breaks the encoding and not the
claim's sentence. If there is one, the model, a bound or the encoding is wrong
there. If there is none, the design allows a story that breaks the claim. That
is a finding.

Every step is right about the model, so the trace can be wrong about the
design only where the two part. In the model's terms nothing looks wrong. In
the brief's words the parting shows: an actor acting on what it could not
know, a step a guard forbids, a value no input could give.

- Find the cause by the smallest change that makes the surprise go away
  ([explain.md](explain.md)).
- Recommend the verdict by where the repair must land.
- In a liveness trace the wrong step can be an absence: a step the design
  would take that the loop never takes.
- Read a trace that reached its target the same way before you rely on it.

No check sees whether a trace was read rightly.

## 11. A mechanism has a price

Every repair of a design is a mechanism, something a team could build. Each
prevents one thing and costs another: it strands some work, opens a window, or
needs a promise from the world. Name the mechanism, name its price, and check
that everything it touches can still finish.

A guard refuses some legitimate step too. A lock is held by a holder that
stopped. A key is recorded before its effect. Safety claims cannot show any of
this, since a mechanism that refuses more makes every one of them easier to
hold. Only liveness claims and the journeys that should happen can.

- [mechanisms.md](mechanisms.md) gives each mechanism's price and the fault
  that removes it.
- A repair adds the smallest mechanism that prevents what must not happen,
  inside the actions the restatement has ([model.md](model.md)).
- A mechanism that only detects and repairs afterwards turns "always" into
  "eventually". Whether that will do is the developer's to say.

No check sees work stranded where no liveness claim or journey looks.

## 12. Say what was not examined

The account is only as honest as its bounds, premises and omissions. Whatever
the examination assumed, left out or could not reach is written where the
developer carries it, with the observation that would show it false.

The developer reads the account in place of the models. What is not written
there does not exist for them, and a limit only you know is lost when your
session ends.

- An assumption a claim rests on is a premise with its falsifier, never a
  silence ([restate.md](restate.md)).
- The Bounds say, in the developer's terms, what each bound holds and what the
  bounds leave out ([model.md](model.md)).
- A claim an engine cannot express says so, with the reason.
- Your report says what you assumed, left out and could not reach, and
  where you chose the loud side.

## When two principles pull apart

- **Loud against the developer's attention.** The loud side is for real doubt,
  when no authority settles what the design or the world does. Where one does,
  be exact. Ask first whether the doubt can be posed as a choice.
- **Small against the allowance.** When the smallest world that can interact
  does not finish, do not shrink it below the interactions. Cut the search and
  say what the cut leaves out. If that does not finish either, an unanswered
  run is the honest result.
- **The grain against cost.** Splitting every action multiplies the states.
  Split where something can fall between, and nowhere else.
- **Posing against the developer's attention.** Pose a reading when the two
  readings would change the outcome of some question. Where they would
  not, it is yours to decide.
- **A broad claim against the world.** A claim the world itself can break
  raises a false alarm on every run. It gives way to the world as it is, never
  to the model: a claim is not narrowed so that a model satisfies it.
