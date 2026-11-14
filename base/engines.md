# Which engine answers which question

Forma drives three engines. Each answers some questions exactly and cannot
answer others at all. Pick the engine by the shape of the question. Where none
can say a claim, its encoding is `Cannot express` with the reason: that is an
honest answer, and a forced encoding is not.

| Engine | Pick it for | Cannot tell | Its search |
| --- | --- | --- | --- |
| TLC | whether interleaving, retry, crash, restart or cancellation can break a rule; whether something eventually happens under the fairness a premise names; a deadline or a rate, with time as a bounded clock or counter in the model; whether a scheduled journey is taken or refused | anything outside its constants and constraint; continuous time | exhaustive within constants |
| Alloy | whether a bad structure or configuration can exist; whether operations keep a structural rule; a single constraint with no time; short behaviours within its steps | anything outside its scope and steps: it says nothing beyond them | scoped |
| lifecycle engine | whether a part's lifecycles admit its confirmed journeys and refusals; a combination of phases that must never hold together; a move that must never happen | two entities of one lifecycle explored together, data, guards, other parts, time | phase level |

No engine tells whether the model matches the brief, or whether a premise's
fairness holds in the world. None says a probability, a percentile, a property
over two behaviours at once such as non-interference, or that a detailed model
keeps a coarser one's promise; that last stays a premise of class `promise`.
A run out of time or memory has not answered, and says nothing of the claim.

Alloy bounds the atoms by its scope and the trace by its steps, in separate
rows. A counterexample longer than the steps is not found, and the evidence
says no violation with no flag ([alloy.md](alloy.md), section 3). So
"eventually" goes on Alloy only when the behaviour that would break it fits in
the steps and its fairness can be the assertion's antecedent; otherwise it is
TLC's.

Phase level holds one entity of each lifecycle, every case possible and no
guard evaluated, so it admits everything the design can do and possibly more.
A no violation or a refusal there carries to the design. A violation through
an action with a guard may be spurious: Forma sends it back to an agent first,
and a TLC or Alloy model, which evaluates the guard, settles it. A witness
reached that way shows reachability at phase level only. A refusal that only a
guard over data gives is left to a TLC or Alloy model's refusal question.

A claim has an encoding slot on every model covering its parts, and is
established on any one. Write a property where an engine can say the whole
claim, and `Cannot express` elsewhere: a property that says part of its claim
is silence about the rest, and each property owes its own witnesses and
faults. When every encoding gives a reason, the models so far cannot say it,
not that no engine can; the claim is owed an adequate model or the developer's
acceptance of its risk (`express:` in the account contract §items). A model on
the other engine may cover fewer parts than the largest TLC or Alloy model
only while a claim whose parts it covers is owed another engine, or while a
question on that one has unanswered evidence (the models contract
§one-model-first). Otherwise write it for the whole system, and cut the
search, not the system.

A TLC model that spends its variables on sets of pairs, and blows up at two of
each thing, is asking Alloy's question. An Alloy run out of memory, or a
relation it cannot represent, is read against [alloy.md](alloy.md), section 5,
before you change the model or its bounds.
