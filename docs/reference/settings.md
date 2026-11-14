# Settings and allowances

The intake gives the first allowance and the project's settings; each `allow`
decision adds to the allowance, row by row
([decisions.md §intake](../../spec/decisions.md#intake)).

## Situations

`--situation` is one of `document a known system`, `showcase a fixed bug`,
`localize a live bug`, `understand an unfamiliar system`,
`change against a new requirement` and `design new`. It is recorded in the
intake decision for whoever reads the project; nothing Forma computes or gives
to agents reads it.

## The allowance

| Option | Row | Is |
| --- | --- | --- |
| `--answers <n>` | Answers | answers agents may submit, accepted or refused |
| `--runs <n>` | Runs | engine runs |
| `--tlc-seconds <n>`, `--tlc-megabytes <n>` | TLC seconds, TLC megabytes | the time and memory one TLC run may take |
| `--alloy-seconds <n>`, `--alloy-megabytes <n>` | Alloy seconds, Alloy megabytes | the same for Alloy |
| `--lifecycle-seconds <n>` | Lifecycle seconds | the time one lifecycle engine run may take; its memory is Forma's own |

Each is a whole number, 0 or more; one not given is 0, and an engine allowed no
time, or on TLC and Alloy no memory, runs nothing
([evidence.md §limits](../../spec/evidence.md#limits)). What is spent is counted
on each machine, in its `work/`. A run owed only because a version changed spends
nothing.

An `allow` adds to every row it gives, the per-run limits included: after an
intake of `--tlc-seconds 300`,
`forma decide allow --tlc-seconds 300 --by "Your Name"` lets each TLC run take
600 seconds; off a terminal, add the session's `--provider`, `--model` and
`--session`. A question that ran out of time at the old limits is owed a run at
the new ones.

## The settings

| Option | Row | Is | Default |
| --- | --- | --- | --- |
| `--cadence <cadence>` | Cadence | how `forma missing` and the reading group your waiting items: `span`, `question` or `session` | `span` |
| `--inbox-cap <n>` | Inbox cap | how many of your waiting items they show in full | `7` |

The latest intake or allowance giving a setting is in force
([decisions.md §intake](../../spec/decisions.md#intake)); what each setting
changes is [account.md §waits](../../spec/account.md#waits)'s.
