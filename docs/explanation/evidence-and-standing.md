# Evidence and standing

## Questions and evidence

A question is one thing asked of one engine about one model: a claim's property,
a witness reached, a fault caught, a journey's path, a refusal, a start, an
action enabled. Code composes each question from the model's files, its slots
and the restatement; no agent writes any part of it, and its expected outcome is
fixed before anything runs
([evidence.md §questions](../../spec/evidence.md#questions)).

Each question keeps one evidence file. It names what its question read: the
model's files and slots, and the generated files Forma composes, by their
hashes; and the entries of the restatement by their pins, so reflowing an entry
or renaming its own heading changes no pin. It also names the engine and runtime
versions, XState's version for the lifecycle engine, and Forma's version and
source hash. While the question is still asked and those inputs and versions
agree with this machine's computation, the evidence is current
([evidence.md §currency](../../spec/evidence.md#currency)):

- when an accepted answer changes a model file or slot it read, it is owed a
  run again;
- when what an entry means changes, each slot written for that entry is owed
  again first (`slot:`, owed again), and the questions those slots serve are
  asked, and owed a run, only once the slots are refilled; a question that reads
  the entry through no slot, as an action's `enabled` question or a `phases`
  question, is owed a run at once;
- a file changed any other way counts for nothing (`change:`), and owes no run.

Renaming a key is no rename: the thing under the new key keeps its decisions, by
pin, but its slots are owed again, and its questions run again.

The explorer also offers **as recorded** standing. It uses the same computation
as `forma diff`: files and entry pins are checked against the evidence's basis,
using the versions that basis names, without recomposing generated files or
reading `work/`. It is computed from the record as it reads, not a historical
standing saved in the evidence. It never changes `forma box`, and what
`forma show` shows you uses standing here
([account.md §explorer-graph](../../spec/account.md#explorer-graph)).

## Standing

A claim is established on a model whose parts include all of the claim's parts,
at that model's bounds, only when all of these hold
([account.md §standing](../../spec/account.md#standing)). *Current* means the
evidence's inputs and versions are unchanged on this machine:

| Condition | Holds when | Because |
| --- | --- | --- |
| confirmed | the unit holding the claim has a confirmation in force at its current pin | nothing you have not confirmed is examined toward standing |
| examined | its encoding on the model is a property, and its base question's evidence is current and found no violation | the question itself |
| controlled | the evidence of at least one of its faults is current and was caught by the property | an instant or vacuous pass would otherwise count |
| witnessed | it has at least one witness, and every witness's evidence is current and reached | so the property is not true of nothing |
| conforming | the model meets the journey rules, below | the journeys you confirmed must happen, or be refused, before any property counts |
| carried | every premise it rests on there is carried: its `Rests on` premises, its bounds on the model, and every strike in force on the model's world rows | what no run examines is your decision |
| no open surprise | no surprise is open on any question on the model | a surprise freezes what it rests on until you rule |

A fault plants one defect: on TLC and Alloy, one action changed with one
mechanism removed; on a lifecycle model, cells overlaid on its lifecycles
([engines.md §slot-forms](../../spec/engines.md#slot-forms)). A fault or witness
counts only on the same model bytes and bounds as the base question. A claim is
`established` when it is established on at least one model; otherwise
`accepted` while you accept its risk, or `not established`, with every condition
that fails on each model.

Since evidence is current only for the toolchain and Forma that wrote it,
standing is computed per machine: a clone with another version reads that
evidence as owed a run until it runs again, which an older build of Forma never
does for evidence a later version wrote.

### The journey rules

A TLC or Alloy model meets them when it is not owed a Model answer, its rows
match its parts, and each of these questions has current evidence that matched
([account.md §journey-rules](../../spec/account.md#journey-rules)):

| Rule | For | The question |
| --- | --- | --- |
| `journeys` | each confirmed journey within the model's parts, those Forma adds included | its path; for a must-not journey its refusal; for a journey with a start, its start |
| `progress` | each part the model covers | the path of one should-happen journey of the part |
| `enabled` | each action, but one only an unpicked alternative takes, and each misbehaviour not struck | that it is enabled |
| `misbehaviours` | each misbehaviour not struck of each world row in its parts | its misbehaviour question |
| `phases` | the state projection, when the model has one | its phases question |
| `facts` | an Alloy model | its facts question |

A lifecycle model meets `journeys` and `progress` by its lifecycle path
questions, and `explored`: no current base evidence on it reports an unreachable
phase, an untaken action or an open pair.

## Surprises

When a question's evidence answered and does not match its expected outcome, a
surprise opens unless it already exists or a ruling names a surprise of that
question and basis digest. It is a file of its own, beside the evidence, never
rewritten, removed only when you rule
([evidence.md §surprises](../../spec/evidence.md#surprises)). While it is open:

- its question is not asked again, and the model's files, and the claim's slots
  on that model, are frozen;
- for a violation found by a TLC or Alloy `base` or `fault` question, code reruns
  it at smaller bounds, for at most six reduction runs. It stops when no
  reduction of the last kept bounds retains the violation or none is left,
  and shows the shortest reduction first;
- an agent that wrote none of the model explains it and recommends a verdict;
  for a TLC or Alloy violation of a claim's own property, it also gives weaker
  forms of the claim for code to run;
- some surprises carry a reason the explaining agent must address: one through
  a guarded transition at phase level, one using a misbehaviour you struck, one
  whose journey's start is not reached. The reason comes in the Explain item's
  `found` ([evidence.md §sent-back](../../spec/evidence.md#sent-back)).

A waiting decision is offered to you once each of its surprises has an accepted
explanation and no reduction remains to run.

Then you rule, and the ruling sends a repair to its target. The repair's receipt
names the ruling and the mechanism it adds, with each file's hash before and
after.

## What a result says

No violation within the stated bounds; reached in at least one behaviour;
refused at a step. An engine that ran out of time or memory has not answered,
and is shown as unanswered, never as a pass. The kind of search travels with
every result.
