# Alloy as Forma runs it

What Alloy 6.2.0 does with what Forma composes, which way each trap errs, and
how to see it before you submit.

## 1. What Forma composes, and what follows for what you write

**The model's own facts give its behaviour; the rows only observe it.** Code
writes no next-state relation for Alloy (the engines contract §alloy). A step
the facts allow happens whether or not a row names it, and a row's predicate
is observed for every allowed step it is true of, called or not. So the fact
that says what a step may be, usually `always (...)` over a disjunction of
the action and misbehaviour predicates, is the next-state relation you write.

**A fact is a silent guard.** It removes behaviours and raises no alarm. Write
the design's guards inside the action predicates, from each action's own
sentence. Keep facts for the initial state, the step relation, and relations
the signatures' types cannot say.

**The wrapper leaves out every behaviour that takes a struck misbehaviour:** a
step its row holds for and no Actions row does. Still leave the struck item
out of the step relation whenever you write the model, keeping its predicate
and row: facts that need the struck step lose the behaviours that took it. A
strike alone does not make a Model answer owed; when a model you cannot
answer for still takes a struck item, say so in your report.

**The facts question shows only that one instance exists.** It is `run {}`
at the model's bounds, and one state looping to itself answers it. It does not
show that an action is possible, a guarded state reachable, or that every
reachable state can go on (section 3). A facts question not reached blocks
every claim on the model, and nothing clears it.

**The names kept for code.** No model file, definition or tabled parameter may
begin `Forma` or `forma`, and no definition may be `Claim`, `Target`, `Fault`
or `End`. The wrapper is `FormaExam.als`, and would overwrite a file so named.

**A slot is one definition:** exactly `assert Claim`, `pred Target`,
`pred Fault` with its action's parameters, or, in a schedule of a journey that
should happen, `pred End`. Nothing stands beside it, no
helper, fact, `open` or `private`; a helper goes in the model through a Model
answer. What the engine cannot express is the `Cannot express` file (the
engines contract §slot-forms), never a weakened assertion. The parser does not
tell a state predicate from an action: keep `Target` a state predicate.

**A fault is a copy of a file with one predicate replaced** by your
`pred Fault` and a predicate of the action's name that applies it to its
parameters. The claim is checked on that copy.

- It reaches every predicate that calls the faulted one, a duplicate written
  as a call to the action included, and a violation through that shows
  nothing of the named mechanism. Give such a predicate a body of its own.
- It reaches nothing the facts do not call by name: a step relation that
  writes an action's body out leaves the behaviour as it was. Let the step
  relation call each action's predicate.
- `Fault` is parsed in the copy, where names the entry sees may not be. Write
  it from names the defining file has.

## 2. Facts, predicates and the empty pass

A `check` passes whenever the facts admit no counterexample.

| What over-constrains | What catches it |
| --- | --- |
| facts that admit no instance | the facts question, not reached |
| an action no behaviour can take | its enabled question, not reached |
| a reachable state no behaviour can hold | a witness or path that asks for it |
| a fact that says what the claim says | the claim's fault, not caught |
| a fact that forbids the design's trigger, while the fault reaches the violation another way | nothing |

The last row is silent. A fact "no two people see one seat free at once"
hides a seat booking's race, yet the witness, enabled and facts questions are
reached and the fault "take without looking" is caught. So a fact needs a
reason in the design's or the brief's words, never "so that the claim holds".
A narrowing the world needs is a bound or a premise the developer carries.

## 3. Time in Alloy 6

**Every trace is infinite, found as a lasso:** a finite list of states whose
last steps back to one of them. A behaviour that ends in the design exists in
the model only if its last state can step for ever, to itself or round a loop.

**A state from which no step is possible is invisible to a check.** No trace
passes through it, or through a state whose every continuation leads to one:
a `check` passes there and a `run` fails, while the facts and enabled
questions are reached. Ask of each reachable state whether the facts let it
go on, and ask for the design's end states by a witness of your own. Never
forbid a step that changes nothing: where nothing more happens, the world
still goes on.

**Steps.** `N steps` lets a trace hold at most N states, its loop included,
and a violation first seen in state k needs at least k. With no steps given,
Alloy's default is ten. At `1 steps` only steps that change nothing exist, and
Forma flags `tiny-trace`. Give the steps the claim's worst story needs, two of
each contender acting in turn, and a few more. Steps are never reduced.

**Frame conditions.** A predicate that says nothing of a `var` relation lets
the step set it to anything: a check fails by a step the design cannot take,
loud, and a witness, path or enabled question is reached by it, silent. Every
action and misbehaviour predicate says what each `var` relation becomes,
"unchanged" included. A predicate that says only its guard holds for every
step taken while the guard is true. A frame is necessary, not sufficient:
read each step for a relation that changed and its sentence does not change.

## 4. Scope

**The Bounds form.** The required `scope` row is what follows `for`: a default
number; a default number, ` but ` and signature bounds; or signature bounds
alone; steps and bitwidth are rows of their own. The default number bounds
each top-level signature the scope does not name; a `one` signature holds one
atom whatever the scope. `exactly n Sig` fixes a count, `n Sig` caps it, and a
child never holds more than its top-level parent: `for 1 but 2 Staff` gives
one Staff.

**Small, but able to interact.** Give every signature whose atoms contend at
least two, the same request able to arrive twice, and one more than each
limit. Forma flags `tiny-scope` when a signature declared without `one`,
`lone` or `abstract` may hold fewer than two, but misses a bound on a middle
signature and a `one` signature where the design has many.

**Integers wrap at the bitwidth.** At bitwidth b integers run from −2^(b−1)
to 2^(b−1)−1; the default is 4, from −8 to 7. Forma does not pass `-n`, so at
3 Int a counter steps from 3 to −4, a false alarm, and four books count as
−4, so "never more than 3 on the shelf" passes, silent. Give every count and
value the claim compares room for one more than its limit, and no more: each
bit doubles the integer atoms (section 5). The row is at least 1. Where the
design needs only order or identity, use atoms.

**`util/ordering` makes its signature's scope exact.** At `for 3` an ordered
signature holds exactly three, so two are not examined. Where a smaller
population matters, run it yourself and report what the Bounds leave out.

**Reduction shrinks only the default number,** by one, at most six times.
A scope whose contending signatures are all named gets no smaller story.

## 5. What the observers cost

**A row of k parameters is a relation of k columns over the whole universe:**
the model's atoms and every integer of the bitwidth. On 20 atoms at 4 Int
with 1,024 MB of heap, a row of 3 answers in 2 s at `for 5`; a row of 4 runs
out of memory at `for 3` at every steps above one, and answers in 2 s at 1
Int; a row of 8 is refused as not representable. Keep every parameter the
action's sentence needs and none it does not, give the bitwidth only what the
design's numbers need, and time the enabled and base questions with the
observers in.

**A past-time predicate may need more steps with the observers in.** One
that `once`, `before` or `historically` ties to the past can differ at two
visits of one state: a counter going 0, 1, 2, 0 needs five states, not three,
under a row "after it has once been 2". Write action predicates over the
state and the step from it, and keep history in a `var` relation the actions
set.

**An Over's domain, a parameter's domain and a Phases expression are each one
whole expression,** refused if it ends its definition or adds one. A domain
is a set of atoms, with no `set`, `lone` or arrow, and may name earlier
parameters. Write it as the predicate's, unchecked: a binding outside it is a
step no observer sees. A Phases expression gives one atom of one phase's
signature in every reachable state; read the phases question, not the
trace, which still shows an entity given two atoms of one phase.

**One atom for an entity.** A schedule's entity value is evaluated in the
first state and must give exactly one atom. A `var` relation empty at the
start gives none; `Seat` reaches a path only in instances with one seat,
silently. Give a `one` signature or an atom the fixed relations single out.

## 6. Properties

**Safety needs `always`.** A formula without a temporal operator is about the
first state only, so it passes and its fault goes uncaught. Write
`assert Claim { always ... }`, with primes under `always` for a claim over a
step. A claim over relations not declared `var` needs no `always`.

**Liveness is read from the lasso.** A counterexample is a loop that never
brings what the claim waits for; a loop that changes nothing violates it only
where that is still to come. Read the loop, not only the prefix.

**The fairness a premise names is the assertion's antecedent, never a fact,**
where it would be a silent guard on every other question ([slot.md](slot.md),
under Liveness). An antecedent no behaviour satisfies passes the claim
unexamined, and no witness shows it. Run `run { <antecedent> }` at the model's
bounds, `and eventually <the trigger>` when the claim waits on one. With no
instance the pass means nothing: report it, never weaken premise or claim.

**Structure claims are Alloy's natural ground.** It searches every structure
in scope at once, where steps that build them reach only some. Model a claim
about what a configuration may be, not how it arose, as fixed relations, and
give the instance as the story: "is this configuration one you meant?".

## 7. Reading an instance

`exec` writes its command summary, which Alloy names `out/receipt.json` and
which is no receipt of Forma's, and `out/FormaQuestion-solution-0.xml` only
when it finds an instance. The summary gives `type`, `overall` (the default
number), `scopes`, `minprefix` and `maxprefix` (least and most steps, −1 if
not given), `bitwidth`, and, exactly when found, a `solution` whose
`instances` are the states. In the XML the last state steps back to state
`tracelength − looplength + 1`, from 1. Forma shows `Booking/Seat$0` as
`Seat$0`, a `one` atom without its number unless two would clash, and the
observers' fields under one integer atom, such as `-8`.

A row's observer in state i holds the bindings its predicate holds for from
state i to i + 1, shown as the step into i + 1; the last state's is the step
that loops back. Read each step three ways:

- **Which rows hold.** Predicates that hold, not the action that took the
  step: two rows mean an unframed predicate, two that coincide here, or a
  copy. Read both before you change either. A step two Actions rows hold for
  keeps a ruling from keeping the trace as a journey. A misbehaviour is taken
  where its row holds and no Actions row does.
- **No row holds.** A step that changes nothing, a disjunct with no row, or a
  binding outside its row's domain.
- **What changed.** A `var` relation the step's sentence does not change is
  where the model and the design part. Find it, then its cause.

## 8. Running Alloy yourself as Forma does

Write the wrapper beside copies of the model's files: a module `FormaExam`
that opens the entry, the slot's text, the observers of the engines contract
§alloy for every row and Phases row, and one command at the model's bounds,
such as `FormaQuestion: check Claim for 3 but 8 steps, 4 Int`. Without the
observers you leave out their cost and steps. Copy a fault as in section 1. A
file system that ignores case treats `q.als` and `Q.als` as one. Give each
Java process its own temporary folder. From the wrapper's folder, with
TOOLCHAIN the folder the standing text gives:

```sh
alloy() { "$TOOLCHAIN/jdk-21.0.13+9-jre/Contents/Home/bin/java" -Xmx1024m \
  -Djava.io.tmpdir="$PWD/java-tmp" \
  -jar "$TOOLCHAIN/org.alloytools.alloy.dist-6.2.0.jar" "$@"; }
alloy commands FormaExam.als
alloy exec -q -f -c FormaQuestion -t xml -o out FormaExam.als
```

`commands` type-checks the file and what it opens and lists its commands; an
error names file, line and column. `exec` solves the command with SAT4J and
replaces `out/`. Set `-Xmx` to the developer's allowance for Alloy runs.

Before you submit a model, run its facts, every enabled row, the phases check
and each base you foresee, with the observers in, and note the longest. For an
encoding, run its check, its fault and its witness. Your own runs count for
nothing in the account.

## Sources

- Alloy 6, https://alloytools.org/alloy6.html
