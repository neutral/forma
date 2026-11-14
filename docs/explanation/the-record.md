# The record

Everything the account says is computed from tracked files, every time, and
never stored ([account.md §what-it-is](../../spec/account.md#what-it-is)).
What only this machine keeps in `work/`, the allowance spent, the sessions seen
and the refusals, decides what this machine takes or refuses, never what the
account says.

## What is tracked

| Folder | Holds | Written by |
| --- | --- | --- |
| `design/brief/` | your documents and sources | you |
| `design/` (outside the brief) | the restatement: the part list, each part's tables and its things (lifecycles, journeys, claims, premises, choices), and every `decisions/` folder | agents' answers; your decisions |
| `models/<model>/` | each model's files, every slot, one evidence file per question beside what it examines, and each open surprise | agents' answers; `forma run` |
| every folder of accepted files | a `receipt`, one line per file, naming who wrote it and what it repaired | Forma |

The models mirror `design/`: a claim's slots and evidence sit under the same path
in each model's folder as the claim's page sits in `design/`. So what examines a
thing is always beside it.

## What is scratch

`work/` (this machine's refusals, allowance spent and sessions seen) and
`runs/` (each run's composed inputs and engine output) are ignored by git.
Deleting either changes nothing the account says. Forma's own tests check it
([properties](../../apps/cli/tests/properties.test.mjs)). What this machine
keeps there is shown beside the account, marked as this machine's, and never
enters the box or the diff.

## Why one file per thing, and per question

A thing's folder holds its page, its receipt and its decisions. A question's
evidence is one file beside what it examines, named by the question and, on TLC
and Alloy, the digest of its bounds; a lifecycle model's evidence has no
digest. That makes the record readable by browsing: everything about a claim is
in its folder in `design/`, and everything about its examination is in the
matching folder under each model. It also makes merges plain: two clones that
found the same answer on the same basis at different times can keep different
times and run measures. A merge takes one side's evidence file whole; the same
inputs alone do not ensure that both clones found the same answer.

Evidence keeps the measures of the run that first found what it says, and is
rewritten only when its inputs or what it found change, when it is unanswered
again at larger limits, or when its thing is re-filed. A rerun that changes
none of those facts changes no tracked byte, and an instant pass found once
stays flagged.

## Commits and the diff

Forma never commits, merges or restores. You commit the project like any other.
`forma diff` compares the account of the project now with an earlier copy, a
commit or a folder ([account.md §diff](../../spec/account.md#diff)).
