# Running the work

For whoever starts the agent sessions and runs the questions between them.
Forma knows two roles, the developer and the agents. Someone also decides
which session does what, and in what order. Holding the developer's role is a
different job, with its own page ([developer.md](developer.md)). One agent
often does both, in different sessions.

## A session

- A session is fresh, and works in a folder of its own outside the project and
  outside Forma. It reaches the project only through a `./forma` wrapper in
  that folder, which names the project with `--project`.
- It is started with the standing text in [session.md](session.md), a scope,
  and a session name of its own.
- Give every session a name no other session has had. Forma knows a session
  only by the provider, model and session it declares: a session that has
  answered can never decide, and the answers of one that has decided count
  for nothing, even when the two met on different clones and their records
  merged later (the decisions contract §who-decides, the door contract
  §sessions). So the developer's role gets sessions of its own, and no name
  is used twice.
- When it ends, read its report, check which commands it ran, and check that
  `missing` lists no `change:<path>`. A file that counts for nothing holds
  back what rests on it until it is restored or answered again (the door
  contract §change): restore it whole from git, or let an answer for its item
  replace it, and never mend it by hand.

## A scope

- A scope says which kind of item, which share, and when to stop. Nothing
  else.
- When sessions work side by side, give each its exact list of items.
- Say "an answer of its own for each item". "One answer for each item" reads
  as a limit, and a refused answer then goes uncorrected.
- Split shares by part. Two sessions never write the same file.
- A scope does not say how to do the work: the page of the base for that
  work does, and every session of that kind reads it.

## One writer for a model

A Model answer holds the whole model, so two sessions writing one model
overwrite each other. Give every repair of a model to one session, and let
slot sessions start only when it has finished.

## The order

1. The developer's intake, with an allowance.
2. One session restates the whole brief.
3. The developer confirms the part list, then each part's entries, and picks,
   strikes and carries.
4. One session writes the TLC or Alloy model that covers every part. No
   session writes a lifecycle model: each is its part's confirmed lifecycles.
5. Slot sessions side by side, by part: schedules and misbehaviours, and for
   each claim its encoding on each model covering its parts, its part's
   lifecycle model included when it has one part, then its witness and fault.
6. `forma run`.
7. Explain sessions side by side, one surprise each, none an author of the
   surprise's model. A lifecycle model's authors are the sessions that wrote
   its part's confirmed lifecycle pages, so a restating session explains no
   surprise there (the door contract §receipts).
8. The developer rules, several waiting decisions together where they are
   one matter. A ruling is offered only once every surprise it holds is
   explained.
9. Repairs: sessions restating by part, beside the one session repairing the
   model. Then the developer confirms what changed and places each mechanism
   a real finding's repair added against the brief, slot sessions refill what
   is owed again, and `forma run` again.
10. Repeat from 7 until nothing is missing. Then the developer carries the
    model's bounds, and the account and the box are read.

Commit what Forma wrote after each step: what nobody commits exists on this
machine only, and the developer's diff counts by default from the commit
that added their latest decision (the door contract §copies, the account
contract §diff). Settle a conflict in a file Forma wrote by taking one side's
file whole, never by editing it.

## While a surprise is open

A surprise freezes its model's files, for a lifecycle model the lifecycle
pages its question read, and, when it is on a claim's question, every slot
of that claim on that model, a new one included. An answer holding or
removing one is refused whatever its bytes, nothing the surprise rests on
can be removed or re-filed, and the items that would change them wait for
its ruling (the models contract §freeze). A Repair that changes a model's
files waits until no other surprise is open on that model. So, while
surprises are open:

- have every one explained, since the developer can rule a waiting decision
  only once each of its surprises has an accepted explanation and its
  reductions have run (the decisions contract §rulings);
- give slot sessions the slots of other claims and of journeys, and
  restating sessions the parts no open surprise rests on;
- ask the developer to rule a model's surprises before its repair starts.

## What to expect

- A claim owes an encoding on each model covering its parts, and a witness
  and a fault on each where the encoding is a property; a journey owes a
  schedule on each TLC or Alloy model covering its parts. A full round asks
  each of those on each model, and the journey questions besides
  ([developer.md](developer.md), Intake).
- A model's claims are asked only once its journey questions match (the
  evidence contract §questions). So most of the first round's surprises are
  slips of the new model and slots against the journeys, not flaws in the
  design: every translation is fresh, and the journeys are asked first.
- Each change to a model's files makes all evidence on it not current, so
  each round of repairs costs a full round.
- Set the allowance for all of that before starting, on each machine that
  does the work, or the work stops midway and waits for the developer.

## Between runs

- Keep one build of Forma for an examination. Another build makes all
  evidence not current until each question runs again; such a run spends
  nothing, but takes the time of a full round.
- Leave `work/` alone. Deleting it changes no account, but forgets what this
  machine spent, why its answers were refused and which sessions it saw, so
  the allowance starts again and the session rule rests on the receipts
  alone (the door contract §scratch).
- A run near its time limit can run out beside others. Forma runs it once
  more alone. If it still runs out, the model is too heavy: that is a model
  repair, or more time from the developer.
