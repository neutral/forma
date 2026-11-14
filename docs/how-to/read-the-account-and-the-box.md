# Read the account and the box

1. Read the account, the whole of it or one part:

   ```bash
   forma account                         # the project
   forma account orders                  # one part or span
   forma account orders/claims/<claim>   # one thing, with its decisions wherever they sit
   ```

2. See what leaves Forma:

   ```bash
   forma box
   ```

3. See what is owed, and by whom:

   ```bash
   forma missing
   ```

4. After a change, see what it caused:

   ```bash
   forma diff                 # since the commit of your latest decision
   forma diff <commit>        # since a commit
   forma diff <folder>        # against another copy
   ```

Every command takes `--json` for the same content as one JSON object.

## The account

It reads part by part, and what is not established comes first. Under each part:

- **Open**: claims neither established nor accepted, with each failing condition
  on each model; journeys that do not conform; open surprises; the rest of the
  work.
- **Accepted**: claims whose risk you accepted.
- **Established**: each claim with its basis line on each model: the bounds,
  the fault it caught by its mechanism, the witnesses by the journeys that
  reached them, the premises in force, any mechanism a repair added, then the
  engine, its version and the kind of search.
- **Assumed**: each premise, with its statement, class, falsifier and carry.
- **Decided**: the decisions in force, and those superseded.
- **Left out**: the omissions.
- **Lifecycles**: each lifecycle's table, phases and moves, and its picture as
  data. The [explorer](explore-a-project.md) draws the lifecycle.

To read the brief with this account beside each section, run the explorer.
[Explore a project](explore-a-project.md) describes its page and its portable
export.

## The box

Each established claim with its bounds and premises on each model it is
established on, and under it the mechanisms real-finding repairs added there
and whether the brief states them; each claim accepted and not established
whose premises are all carried, marked accepted and not examined; every carried
premise with its falsifier; and what the account cannot know. This is what to
show someone else ([the box](../explanation/the-box.md)).

## What is missing

Every item, grouped by who supplies it: agents, runs, then you, by checkpoint.
Each says what it waits for. This machine's allowance and its refusals are shown
beside the account, never in it.

## What changed

The default needs a commit that introduced the latest decision. If that
decision has not been committed, name a commit or another project folder.

It lists what went stale, what changed outcome, the items and surprises opened
and closed, each group by the change that caused it, so what one change caused
arrives together; then what waits for you now, as things stand.
