# Confirm the restatement

After an agent restates your brief, `forma missing` lists `confirm:<unit>` items
for you. A unit is what one confirmation covers
([design.md §units](../../spec/design.md#units)):

| Unit | Name |
| --- | --- |
| the part list | `parts` |
| a part's or span's stated entries, together: every action, claim, premise, boundary row and surface row that restates the brief outright | `<part or span>/stated` |
| one added action, claim, premise or boundary row | `<part or span>/<kind>/<key>`, `<kind>` one of `actions`, `claims`, `premises`, `boundary` |
| one added surface row | `<part>/surface/<direction>/<name>` |
| a lifecycle | `<part>/lifecycles/<key>` |
| a journey, written by an agent or added by Forma | `<part or span>/journeys/<key>` |
| an omission, a passage the part leaves out on purpose | `<part>/omissions/<address>` |

Every decision below is two commands. `forma show` prints exactly what you
decide on and a token; `forma decide`, given that token with `--shown`, records
the decision only if the showing is still what the token was printed for. A
token is for the decisions its showing covers, of one kind. At a terminal,
`forma decide <kind> <on>` with no token shows the decision and asks.

1. Confirm the part list first; every other unit waits for it:

   ```bash
   forma show confirm parts
   forma decide confirm parts --shown <token> --by "Your Name"
   ```

2. Then each part's units. Each entry is shown beside the passages it cites; a
   lifecycle as its table, phase and move text, and structured diagram JSON; a
   journey as its steps:

   ```bash
   forma show confirm orders/stated
   forma show confirm orders/lifecycles/order
   forma show confirm orders/journeys/pay-then-ship
   ```

   To see that lifecycle drawn, with a journey's path on it, run the explorer
   and open the lifecycle, or the journey, which its page calls a scenario,
   from the section that describes it:

   ```bash
   forma-explorer serve --project ~/orders
   ```

   Keep it in a separate terminal while making the decisions below, or stop it
   with Control-C. The path is the lifecycle tool's walk; it does not establish
   a claim. See [Explore a project](explore-a-project.md).

   A unit cannot be confirmed while a finding of the lifecycle tool blocks it
   ([lifecycle-tool.md §findings](../../spec/lifecycle-tool.md#findings)): a
   conflict, such as a phase nothing reaches; an unspecified cell; or a
   lifecycle or journey the tool could not finish checking. A journey that
   starts in an unreachable phase, or takes a step a lifecycle refuses, other than
   a must-not journey's refused step, blocks that lifecycle too, even before the
   journey is confirmed. The item
   `findings:<part>` asks an agent to mend the pages. Declining the journey or
   lifecycle at fault sends its repair to an agent. The repair is met once the
   page is rewritten or removed; the block lifts only when the lifecycle tool no
   longer reports a finding that blocks the unit.

3. If a unit does not say what you mean, decline it, with why:

   ```bash
   forma show decline orders/journeys/pay-then-ship
   forma decide decline orders/journeys/pay-then-ship --shown <token> \
     --words "Shipping may start before payment clears for trusted customers." --by "Your Name"
   ```

   The words go to an agent as the direction of a repair, but for a pick's
   journey or a kept one, whose decline is met at once: no answer writes those.
   You may decline a unit at any time, a confirmed one included.

4. If a choice is posed, pick one of its two alternatives:

   ```bash
   forma show pick orders/choices/late-payment
   forma decide pick orders/choices/late-payment --choice a --shown <token> --by "Your Name"
   ```

   - The showing gives, for each alternative, the journeys a pick of it would
     add: `<choice>-<pick>`, the picked alternative, and, when the alternatives
     differ at one step, `<choice>-not-<other>`, the other one as a must-not
     journey refused at that step. The pick confirms them as written.
   - The pick fills the lifecycle cells the choice poses. A lifecycle's pin and
     its confirmation stay as they were, but how it is shown changes, so take a
     fresh token for anything shown before the pick.
   - A pick is refused when, with it in force, a finding that is not there
     without it would block a journey it adds or a lifecycle whose cells it
     fills.

5. Once a lifecycle is confirmed, Forma offers, for each of its phases but the
   initial one that the lifecycles let a journey reach, and that no confirmed
   journey reaches, offered ones aside, the shortest journey that reaches it, as
   `confirm:<part>/journeys/reach-<lifecycle>--<phase>`
   ([design.md §code-journeys](../../spec/design.md#code-journeys)). While a
   journey an agent wrote that reaches the phase awaits your confirmation, the
   offered one waits for it. Confirm it, or decline it if the design should not
   get there that way.

While a surprise is open on a part's lifecycle model, its lifecycles cannot be
confirmed or declined, and a choice whose cells they pose cannot be picked,
until you rule ([models.md §freeze](../../spec/models.md#freeze)).

## Say it in your own words

To say a claim in your own words instead of confirming or declining it,
redirect it. Forma writes the claim's page with your sentence, and the redirect
confirms the unit that holds the claim as it then reads
([decisions.md §redirect](../../spec/decisions.md#redirect)).

1. Show the redirect with the sentence:

   ```bash
   forma show redirect orders/claims/<claim> --words "<the sentence>"
   ```

2. Record it with the same sentence and the token:

   ```bash
   forma decide redirect orders/claims/<claim> --words "<the sentence>" \
     --shown <token> --by "Your Name"
   ```

A redirect may also add a journey of your own: `--from <file>` names a file
holding its page, on `<part or span>/journeys/<key>`, a key no journey there has
and not one Forma reserves: `reach-…`, `kept-…`, or a choice's `<choice>-a`,
`-b`, `-not-a` and `-not-b` ([forms.md §journeys](../../spec/forms.md#journeys)).
A new claim enters through the brief, which an agent then restates.
