# TLC as Forma runs it

This page is TLC 2.19 as Forma composes and runs it, not TLC in general.

## 1. What Forma composes

The generated module extends your entry and holds the slot's text, then one
definition per row of the Actions table and per unstruck Misbehaviours row,
`FormaRow<n>`, the row's operator under `\E` over its Parameters cell's
domains, then their disjunction, the next-state relation, which this page
calls `FormaNext`, from your `Init` (the engines contract §tlc). A path,
refusal or start question adds a step variable and follows the schedule. The
configuration is Forma's: constants, the constraint row, the question,
deadlock checking off. So:

- Your `Next` is not used, nor anything only it did: a conjunct, an
  `UNCHANGED`, a disjunct with no row, a fused step. Each operator holds its
  whole step, frame included.
- The row's domain is the one examined, whatever your quantifier says. It may
  name state, as `i \in 1..Len(chan)`. One TLC cannot enumerate, such as
  `Nat`, leaves the run unanswered once a step of that row is tried.
- The slot's text precedes the generated definitions, so it cannot name the
  next-state relation or a row: name the operators, and read section 5 first.
- Bounds model values are names in no module: `holder # b` in a slot is
  refused, `Unknown operator`. Reach one through the constant set holding it.
- No `SYMMETRY`, `VIEW` or `ACTION_CONSTRAINT` of yours exists. Your one
  configuration cut is the `constraint` row (section 3).
- The names kept for code: no model file or definition begins `Forma` or
  `forma`, and no model file defines `Invariant`, `Property`, `Fairness`,
  `Target`, `Fault` or `End`, which a slot defines (the engines contract
  §model-fields).

These Bounds values leave a run unanswered: a set mixing kinds other than
model values, as `{"s", 1}`; a model value beside a range or a negative
integer, as `{a, 1..2}`; an integer of 2^31 or more. A slot or operator that
writes `-1` itself needs the model to extend `Integers`, not only `Naturals`.

### Deadlock checking is off

A state where no row is enabled ends that branch, unreported. An invariant
catches it only if its predicate rejects that state; an enabled row, only if
the row is enabled nowhere; a witness, misbehaviour or path, only if no
behaviour gets past it. A liveness claim catches it when its property is false
in the endless stutter there, since every fairness instance is disabled there.
So Forma refuses a fairness term over a set wider than its row's domain: its
extra instance, enabled and never taken, would pass the claim in silence.

Before you submit, run the base question once with `CHECK_DEADLOCK TRUE`, and
read the first `Deadlock reached` state in the brief's words. All work done
is a stop the design means. A cap in a guard that stops the world is the
model's error: repair it, or report that the liveness claims will meet it.

### The type invariant first, and the shortest traces

Every question checks the type invariant first in each state, and a state
that breaks it ends the search with that violation, whatever the question.
Write it exact, as membership in each variable's set of values as the design
states it. Too tight answers every question that reaches the left-out value;
too loose lets states outside the design answer. Where you cannot be exact,
take the tight side and say so. It must evaluate in every state, and a fault
must stay inside it, or the type invariant answers the fault.

TLC searches breadth first with one worker, so the trace of an invariant, a
witness, an enabled row or a path is a shortest one. A temporal property's is
whatever TLC's check finds: a twelve-state lasso can come where a three-state
one exists. Find the loop, and ask whether a shorter one exists.

## 2. How TLC evaluates an action

TLC evaluates conjuncts left to right and assigns `x'` at the first `x' = e`
or `x' \in S`. Every disjunct must assign or leave unchanged every variable.
An engine error is no violation: the run is unanswered and the question open.

| Written | What TLC does |
| --- | --- |
| `y' = x' + 1 /\ x' = x + 1`, `x' > 2 /\ x' = 3` | error: `x'` read before it is assigned |
| a disjunct that does not set `y'` | error: `Successor state is not completely specified` |
| `UNCHANGED vars` alone | the row is enabled; its step adds no state |
| `x' \in S`, `\E v \in S : x' = v` | one successor per element of `S` |
| `x' = CHOOSE v \in S : P(v)` | one successor, the value TLC's `CHOOSE` gives |

`CHOOSE` gives one value per set and predicate, so a model that books "some
free seat" by `CHOOSE` never books another free seat from that state. Where
the world or an actor picks, write `\E` or a row parameter. Keep `CHOOSE` for
a selection the design fixes, and record it: each operator whose definition
uses `CHOOSE` takes a Bounds row `choose <Operator>`, its Value `-` and its
Meaning what the pick leaves unexplored, in the developer's terms (the
engines contract §bounds). Forma cannot see a `CHOOSE` you did not record, so
name every one in your report too.

| Set | As a domain, `\E` bound or `x' \in` | As a membership test |
| --- | --- | --- |
| finite: `0..3`, `SUBSET S`, `[S -> T]` | yes | yes |
| `Nat`, `Int` | no: `non-enumerable quantifier bound` | yes |
| `Seq(S)` | no: `not enumerable` | a sequence yes; an integer, error; an untyped model value, `FALSE` |

Bound every set a row, an `\E` or an assignment ranges over by a Bounds
constant. `SUBSET` and function sets grow as powers: two members give
`[Members -> SUBSET {1, 2}]` 16 successors.

Names in the Bounds, `{a, b}`, become model values. An untyped one compares
unequal to strings and integers without error. A name of one letter, an
underscore and more, as `p_a`, is typed: comparing it with a string or integer
is an error. A model value cannot be ordered. A string compared with an
integer, for equality too, is an error: `x \in {"none"} \cup 0..3` fails. Keep
each variable to one kind, untyped model values being the one that mixes.

## 3. What makes the state space large

Distinct states of a base question, symmetry off as Forma runs it:

| What grows | Smaller | Larger |
| --- | --- | --- |
| people and seats, interchangeable | 3 and 3: 34 | 5 and 5: 1,546; 6 and 6: 13,327 |
| independent workers, three steps each | 6: 4,096 | 8: 65,536; 10: 1,048,576 in 5.4 s |
| a log of bookings, 2 people, 2 seats | 3 entries: 217 | 6: 14,545; 8: 232,993 |
| distinct messages sent once, sequence or set | 5: 872 or 243 | 7: 37,200 or 2,187 |
| a clock any step may advance, on 7 states | limit 3: 28 | limit 6: 49 |

Interleavings and identifiers multiply; a history multiplies by every order
the past could have had; a clock multiplies the rest even when no step reads
it. A liveness claim costs many times an invariant: at 65,536 states, 17 to
19 s against 1 to 1.4 s. Measure the liveness claims first.

Every question on a model runs at the same bounds, so check a cut against
every claim, witness, fault and unstruck misbehaviour, and state it in the
Bounds' Meaning column.

| Cut | It must not erase |
| --- | --- |
| fewer entities | a flaw needing three parties or a longer cycle |
| values collapsed to classes | a value a guard, update, property or schedule tells apart: one at a limit, a sum of two, an equality |
| a set for a sequence | order and copies: a duplicate is the same element. Keep copies by counts, delivery identities, or a sequence read anywhere |
| one message in flight | a retry, a second request, a reorder, a duplicate |

A `constraint` row gives a state predicate. TLC checks the invariants in the
first state beyond it and expands no further: a violation one step past is
found, two steps past is not. Every safety result carries it as a bound. A
liveness claim's questions leave it out (the engines contract §tlc): at its
edge TLC cuts the step yet counts the action enabled, and under fairness a
false property passes. So bound a model with liveness claims by its
constants and the cuts above, never by a guard no action states.

## 4. Properties under Forma

A safety `Property` is asked of `Init` and `FormaNext` with no fairness, so an
eventuality unmet along an endless stutter is violated. A liveness `Property`
is asked of `Init /\ [][FormaNext]_vars /\ Fairness`: stuttering is allowed
where no term forbids it. Read where an obligation arises, `Init` or later,
and which terms hold there. Only a liveness claim sees a model that stops.

`[](P)` over a state predicate costs what `Invariant == P` costs; prefer the
invariant. An action property `[][A]_vars` is violated by one step, and the
trace ends after it: read the last step. `[](x' # x)` is refused by the
parser: `[] followed by action not of form [A]_v`.

Each `Fairness` term is `WF_vars` or `SF_vars` of one Actions operator, each
parameter bound once over its row's domain, by an `\A` around the term or an
`\E` inside (the engines contract §slot-forms). Neither implies the other:
`\A m \in Members : WF_vars(Borrow(m))` holds each member to borrow while
their borrow stays enabled, and `WF_vars(\E m \in Members : Borrow(m))` holds
the row to act while some member can. Write the one the premise states; a
premise about fewer bindings goes inside, as `WF_vars(m = "ann" /\
Borrow(m))`. Bind by the `\E` a parameter whose domain is not constant: TLC
takes a fairness `\A` only over a constant set.

Weak fairness takes an action that stays enabled. Two members share one book:
one borrows and returns for ever, and the other's borrow, enabled only in
between, never happens. Strong fairness passes that claim, so strong where the
premise says weak passes on a promise the world did not make.

TLC accepts `P ~> Q`, `[]<>P`, `<>[]P`, `<>[][A]_vars`, `ENABLED`, and
`[](P => []Q)` at seven times an invariant's cost. It cannot handle `\EE`, or
`\A m \in S : <>P` with `S` depending on state. A claim over history,
`[](Revoked => [](~Granted))`, is a temporal formula or a history variable
with an invariant: one costs liveness checking, the other states.

## 5. A fault as TLC sees it

A fault is composed in its action's row alone: that row's `FormaRow<n>`
applies `Fault` where it applied the operator, and nothing is overridden (the
engines contract §tlc). Everything else that names the operator keeps the
real one: a misbehaviour such as `Lose(m) == Return(m)`, the encoding, and
`WF_vars(Return(m))` in `Fairness`.

- **An encoding that names the operator reads the real action**, which a
  faulted step need not satisfy. `[][\A m \in Members : Borrow(m) => count'
  <= 2]_vars` is vacuous on a faulted borrow that `Borrow` would refuse, and
  misses the fault; `[][count' = count \/ \E m \in Members : Borrow(m)]_vars`
  is violated by every such step, whatever the claim says. So state the
  obligation over the variables. Where an encoding must name an operator, run
  the fault and say why the claim's sentence, not the naming, catches it.
- **`Fairness` keeps the real operator, which no row takes once its row is
  faulted.** A behaviour in which that operator stays enabled and is never
  taken is unfair, and left out. So a liveness claim's fault in an action its
  `Fairness` names is caught only by behaviours whose faulted steps are also
  steps of the real operator, or in which it does not stay enabled. A fault
  that only lets more happen (a dropped conjunct, a test against a larger
  set, a frame condition replaced by `x' \in S`) keeps the real steps; one
  that skips an effect or leaves an input in place does not, and can pass for
  want of a fair behaviour. Fault a liveness claim in an action its
  `Fairness` does not name, or by a removal that only adds steps, and read
  the run.

## 6. Reading TLC's output

A safety trace is numbered states from `<Initial predicate>`, each labelled by
the definition that took the step: `<FormaRow3 ...>` is row 3 counting the
Actions table, then unstruck Misbehaviours. On a path, refusal or start
question the scheduled steps, and the step into the start, are definitions of
code's own, named from `Forma` and numbered by step. Model values print bare,
strings in quotes. Parameters are not printed: name a binding only where
states fix it.

A liveness trace is a lasso ending `N: Stuttering`, the last state for ever,
or `N: Back to state: <label>`, a step back to state N. An error in the prefix
makes a loop the design never meets. Forma's replay of a trace adds phases
and bindings and answers nothing; when it fails, missing phases mean nothing.

## 7. Running TLC yourself

In a folder of your own beside copies of the model's files, write what Forma
would generate. For a safety claim's base question, `FormaExam.tla` is
`EXTENDS <Entry>`, your encoding's text, a row such as
`FormaRow1 == \E m \in Members : TRUE /\ Borrow(m)` for each row, its body a
conjunction so that TLC labels each step by its row, and `FormaNext` their
disjunction. `FormaExam.cfg` holds every Bounds constant, `INIT Init`,
`NEXT FormaNext`, `INVARIANT` with the model's type invariant,
`INVARIANT Invariant`, `CHECK_DEADLOCK FALSE`, and, where the Bounds have a
`constraint` row, `CONSTRAINT FormaConstraint`, the module defining
`FormaConstraint` as that row's predicate. Give an
unreadable value as `FormaIntegers == INSTANCE Integers` and
`FormaConstantK == FormaIntegers!..(1, 3)`, with `K <- FormaConstantK`.

| Question | In the module | In the configuration |
| --- | --- | --- |
| a safety `Property` | the encoding | `PROPERTY Property` for `INVARIANT Invariant` |
| a liveness claim | `FormaSpec == Init /\ [][FormaNext]_vars /\ Fairness` | `SPECIFICATION FormaSpec` for `INIT`, `NEXT`; `PROPERTY Property` for `INVARIANT Invariant` |
| a witness | `Target`, then `FormaUnreached == ~Target` | `INVARIANT FormaUnreached` for `INVARIANT Invariant` |
| a fault | the encoding, `Fault`, and the faulted row applying `Fault` in place of its operator | nothing more: no override |

From that folder, with TOOLCHAIN the folder the standing text gives:

```sh
J="$TOOLCHAIN/jdk-21.0.13+9-jre/Contents/Home/bin/java"
T="$TOOLCHAIN/tla2tools-1.7.4.jar"
mkdir -p jtmp-parse jtmp-check
"$J" -Djava.io.tmpdir="$PWD/jtmp-parse" -cp "$T" tla2sany.SANY FormaExam.tla
"$J" -Xmx1024m -XX:+UseParallelGC -Djava.io.tmpdir="$PWD/jtmp-check" \
  -cp "$T" tlc2.TLC -workers 1 -fp 0 -metadir "$PWD/states" \
  -config FormaExam.cfg FormaExam.tla
```

SANY exits 0 even on errors: look for `*** Errors:`, `Semantic errors` or
`Fatal errors`. The check is Forma's command without `-tool`, `-Xmx1024m`
standing for the allowance's memory. TLC exits 0 with `No error has been
found.`, 12 for an invariant, 13 for an action or temporal property, 11 for
`Deadlock reached`. Read the message, not the code. Your own runs give no
standing. What else to check first is in [slot.md](slot.md).
