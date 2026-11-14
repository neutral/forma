# Decisions

Your judgment enters the record as decisions, made through `forma decide`, after
`forma show`; made anywhere but at a terminal, a decision declares its session,
which must have submitted no answer
([decisions.md §who-decides](../../spec/decisions.md#who-decides)). Each is a
file of its own, filed beside what it is on, and never changed, moved or
removed ([decisions.md §decision-file](../../spec/decisions.md#decision-file)).

## Shown, then decided

`forma show` prints exactly what you would decide on, in your terms. Every kind
except `intake` and `allow` prints a token
([presentation.md §show-output](../../spec/presentation.md#show-output)). For
those kinds, `forma decide` records the decision only when what it would show
then is what the token was printed for, so you never decide on something that
changed under you. At a terminal, with no `--shown` token, `forma decide` shows
the decision and asks; for `intake` and `allow`, this interaction also requires
that none of their own options was given.

## Pinned to meaning

A confirmation, pick or acceptance, or a carry of a premise page, pins the
canonical text of what it is on: the meaning of its entries, with every reference
replaced by what it names, and every citation by the hash of the passage it cites
([design.md §pins](../../spec/design.md#pins)). A carry of a premise code adds
(a store, bounds, a strike, a span) pins that premise's own lines. The intake,
an allowance and a ruling pin what they showed, and never lapse; a `brief`
decision pins the mechanism and the passages it names.
Reflowing a page, or renaming a page's own heading, changes no pin. Changing what
a claim says does, and so does changing a brief passage it cites. Renaming a
heading in the brief moves the passage to a new address, so the citations of
the old one no longer resolve. When the pin of what a decision is on changes, the
decision lapses. A lapsed confirmation, pick, carry or `brief` decision is asked
for again by its item, shown with what changed since. A lapsed decline counts as
met, and its unit is owed a confirmation. No item asks for a lapsed acceptance,
except `express:`: accept again yourself. Decisions on things that did not
change stay in force, but a carry counts only while its basis claim is
established.

## Which decision is in force

Of the decisions on one subject at its current pin, the latest is in force.
Earlier ones are superseded, and stay readable. Allowances are the exception,
since every allowance counts; and of the `brief` decisions on a repair only the
last can be in force. A ruling can revoke a carry. A
decision whose subject no longer stands decides nothing until a subject of its
kind and pin is added again
([decisions.md §in-force](../../spec/decisions.md#in-force)).

## The kinds

| Kind | You decide |
| --- | --- |
| intake | the situation, the allowance and the settings, once |
| allow | more answers or runs, more engine time or memory, or other settings |
| confirm, decline | that a unit of the restatement says what you mean, or not and why |
| pick | between the two alternatives a choice poses |
| rule | the verdict on a surprise, with its level and target |
| carry | that a premise holds, with what would show it false |
| accept | a claim's risk, without its examination |
| redirect | a claim's sentence in your own words, or a new journey |
| brief | after a real finding repaired a model: that the brief now states the mechanism, or that the difference is accepted |

The [reference](../reference/decisions.md) gives each kind's options.

## Rulings

A surprise is shown to you as a journey, with the agent's explanation and its
recommended verdict, never preselected. You rule one of four verdicts
([decisions.md §rulings](../../spec/decisions.md#rulings)):

- **model wrong**: the model misstates the design. The model is repaired. A
  claim's violated base question whose trace tells a journey is kept as a
  must-not journey of the claim's part or span, so the repaired model must
  refuse it.
- **property wrong**: the claim, or its encoding, says other than you mean. It is
  restated, or its encoding refilled.
- **abstraction too coarse**: the restatement lacks what the trace needs. The
  parts are restated, and every earlier confirmation of a unit holding a claim
  over those parts lapses, to be made again on the new restatement.
- **real finding**: the design really does this. The repair goes where you
  direct: to the brief, which you edit yourself; to a model, for an agent's
  Repair; or to a premise, whose carry is revoked and asked again; for a
  choice's premise, the pick's carry is revoked, while the pick's journeys and
  cells stay. When it goes to a model, the box names the mechanism the repair
  adds, under each claim established there: *not in the brief* until you decide
  that the brief states it, or that the difference is accepted.
