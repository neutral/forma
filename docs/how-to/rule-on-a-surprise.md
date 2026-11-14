# Rule on a surprise

A surprise opens when a run's evidence answered and does not match its question's
expected outcome: a property violated, a witness or start not reached, a fault
not caught, an action or misbehaviour never enabled, a journey that cannot
happen, a refused step that is enabled, a phases or facts question that fails
([evidence.md §surprises](../../spec/evidence.md#surprises)). No new surprise
opens if that file exists or a ruling already names a surprise of the question
and basis digest. Open surprises wait for you in a *waiting decision*, named
after the smallest of their surprises' names, as the item
`rule:<waiting decision>`. Your ruling on it is a decision file of its own, the
*ruling*, named by its file name without `.md`: what is owed afterwards is
named after the ruling.

1. `forma missing` lists `rule:<waiting decision>` at once, waiting for two
   things: `explain:<surprise>`, an agent's work, and, for a violation found by a
   TLC or Alloy `base` or `fault` question, `run:<surprise>/reduction`, owed
   `forma run`. Give the explanation to a session that wrote none of the model;
   on a lifecycle model, that excludes the sessions that wrote its part's
   confirmed lifecycle pages
   ([door.md §receipts](../../spec/door.md#receipts)). A scope for it:

   > Explain one surprise: supply the item `explain:<surprise>` in one Explain
   > answer. Supply no other item.

   An Explain answer holds `explain.md`, which names the surprise and gives its
   verdict, and for a TLC or Alloy violation of the claim's own property, the
   weaker forms as `weaker/<key>.<ext>`, at the top of the answer folder; Forma
   files them beside the surprise
   ([evidence.md §explain](../../spec/evidence.md#explain)).

2. Show the ruling once nothing waits:

   ```bash
   forma show rule <waiting decision>
   ```

   It shows each surprise as a journey in your terms, lit on your lifecycles,
   its shortest reduction first; the outcomes of the weaker forms that have
   run; the agent's explanation and its recommended verdict, never preselected;
   and what each verdict would send. The weaker forms run as
   `run:<surprise>/weaker-<key>`; the ruling does not wait for them, so run
   `forma run` first if you want their outcomes shown.

3. Choose the verdict by where the repair must land:

   | If | Verdict | Sends |
   | --- | --- | --- |
   | the model misstates the design | `model wrong` | a Repair of each model the surprises ran on. A violation of a claim's base question whose trace tells a journey is kept as a must-not journey of the claim's part or span ([decisions.md §kept-journeys](../../spec/decisions.md#kept-journeys)) |
   | the claim or its encoding says other than you mean | `property wrong` | a repair of the claim: its page restated, or its encoding refilled |
   | the restatement lacks an action, case, phase or step | `abstraction too coarse` | a Restate repair of the parts. Every earlier confirmation of a unit holding a claim over those parts lapses, so you confirm them again once restated |
   | the design really does this | `real finding`, with `--target` | on `brief`: nothing to an agent; you edit the brief. On a model: a Repair of that model. On `premise:<premise>`: its carry is revoked, and asked again. On `choice:<part>/<choice>`: the pick's carry of the choice's premise is revoked, and `pick:` asks again; the pick's journeys and cells stay |

   `--level` is `implementation`, `specification` or `requirement`; a real
   finding at `requirement` targets the brief
   ([decisions.md §rulings](../../spec/decisions.md#rulings)).

4. Record it, with your direction for the repair:

   ```bash
   forma decide rule <waiting decision> --verdict "real finding" --level specification \
     --target orders-tlc --shown <token> \
     --words "Recheck the order's state inside the payment, in the same store action." --by "Your Name"
   ```

   It prints the ruling's path, as
   `design/parts/<part>/…/decisions/<time>-rule-<hash>.md`; the ruling is that
   file's name without `.md`. The surprises close, their
   freeze lifts, and the repair is owed as `repair:<ruling>/<model>` for each
   model it is sent to, or `repair:<ruling>` for the restatement.

5. An agent answers the repair ([run agents](run-agents.md)), with a scope such
   as:

   > Repair the model `orders-tlc`: supply `repair:<ruling>/orders-tlc` in one
   > Repair answer.

   Give it to the session that wrote the model, or another that has made no
   decision. A session that writes a model's files becomes one of its authors,
   and can no longer explain its surprises.

   Every Repair answer holds `repair.md` at the top of the answer folder: one
   table, `| Field | Value |`, with one row, `Mechanism`, saying what the repair
   adds or changes. Beside it, what its target's kind holds
   ([door.md §repair-answer](../../spec/door.md#repair-answer)):

   - for a TLC or Alloy model, when it changes any model file, `model.md` and
     every engine file of the model, changed or not, since an engine file left
     out is removed; the slots it changes or adds; and `removed.md` naming any
     slot it retires;
   - for a lifecycle model, its slots, its part's confirmed lifecycle pages, or
     both;
   - for the restatement, what a Restate answer holds.

   On a model the surprise ran on, it must change a file the surprise's question
   read, or it repairs nothing. For a real finding on a claim, it also holds a
   fault whose `Mechanism` is exactly the text of `repair.md`'s, so the claim is
   held to needing the mechanism
   ([models.md §model-repair](../../spec/models.md#model-repair)). A repair waits
   while another surprise is still open on what it would change.

6. Run again. A repair of a TLC or Alloy model's `model.md` or engine files owes
   a run of every question on that model; a repair of slots only owes runs of
   those slots' questions. A repair of lifecycle pages first owes the `confirm:`
   of each changed lifecycle and a refill of every slot on `lifecycles-<part>`;
   a restatement repair owes the `confirm:` of what it changed and the slots of
   changed entries. Then:

   ```bash
   forma run
   ```

   A repair that changes the model's bounds renames its questions, and the
   bounds' carries lapse: carry them again
   ([carry premises](carry-premises-and-accept-risk.md)).

7. Once a real finding's repair of a model is taken in, `forma missing` lists
   `brief:<ruling>/<model>`: does the brief state the mechanism the repair added?

   - If passages state it, name them, one a line:

     ```bash
     forma show brief <ruling>/<model> --words "design/brief/orders.md#payments"
     forma decide brief <ruling>/<model> --choice stated --shown <token> \
       --words "design/brief/orders.md#payments" --by "Your Name"
     ```

     If no passage states it yet, write one. The cheapest way is a new heading,
     with text no other heading in that document has, at the end of a document
     or just before another heading: that changes no passage already cited, and
     adds only an uncovered `passage:` item. An edit inside a cited passage
     lapses what cites it
     ([respond to a change in the brief](respond-to-a-brief-change.md)).

   - If the difference is acceptable, show it with no words, and say why in the
     decision:

     ```bash
     forma show brief <ruling>/<model>
     forma decide brief <ruling>/<model> --choice accepted --shown <token> \
       --words "The recheck is how the store will be built; the brief need not say it." --by "Your Name"
     ```

   Under each claim established on that model, the box always names the
   mechanism: *not in the brief* until you decide, then *the brief states it*,
   with the passages, or *not in the brief, accepted*, with why. A claim not
   established shows no mechanisms.
