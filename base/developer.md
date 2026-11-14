# Holding the developer's role

For a person or an agent given the role. Decide with `./forma show <kind>
[<on>]` and `./forma decide <kind> [<on>]` (options: the decisions contract
§forma-decide) for `intake`, `confirm`, `decline`, `pick`, `rule`, `brief`,
`carry`, `accept`, `allow` and `redirect`. Read `./forma missing`, `account`,
`box` and `diff` for what waits for you.

## What the role is

You answer for the owner, as far as the brief, its sources and the owner's
word go. Where a decision turns on what the owner wants and none of them
says, it is not yours: leave the item waiting and bring the owner the two
readings, what each leads to, and which you recommend and why.

A confirmation and a pick record no reason, so keep a record beside the
project of each one's basis: a passage, a source, the owner's word and when,
or your own judgment, which the owner reads first. A ruling takes a basis of
its own: give `--basis` a pointer and one line of premise whenever it rests on
something outside Forma, such as the owner's word (the decisions contract
§rulings).

No decision is undone. Each is a file of its own in the `decisions/` folder
beside what it is on, never changed, moved or removed; a later one on the
same subject overrides it, and both stay readable (the decisions contract
§decision-file, §in-force). Allowances only
add, a repair once met stays met, and a decision on something removed is in
force again when something of the same meaning comes back. Weigh a decision
by what it leaves.

Never read a model to decide. A decision pins what `show` printed, so one
drawn from a model's files rests on what the record does not hold. If the
showing does not let you decide, it failed: leave the item waiting, and say
so.

Never edit a page or a model file yourself, even to mend a word. A change no
accepted answer or redirect made counts for nothing, the developer's own
included, and what rests on it waits until the file is restored or answered
again (the door contract §change). Change the restatement through what is yours:
the brief, a redirect, or a decline whose words an agent repairs.

## How a decision is made

`show` prints what the decision is on, its choices and a token, nothing
preselected. `decide` with the same kind and `<on>`, your choice and
`--shown <token>` records it, or nothing if what it is on has changed since:
show it again. The intake and an allowance take no token. Without a
terminal, declare `--provider`, `--model` and `--session`, and your name with
`--by`.

Your session is the developer's alone. Forma refuses a decision from a session
that has submitted an answer, wherever a receipt names it or this machine saw
it, and once the records meet it discounts every answer from a session that
has decided (the decisions contract §who-decides, the door contract
§sessions). Declare a session no agent has answered from, never answer from
it, and keep its name out of every session that does the work.

## Intake

Made once, first. Its situation is one of six (the decisions contract §intake),
with no effect beyond its record: take it from the owner or the brief, or
ask. Its words say what is out of scope and why. Propose to the owner what
fits poorly: screens, price tables, cheap errors, plumbing, numerics,
requirements still changing, a person in the loop who corrects the system.
Concurrency,
distribution and data integrity fit well. Never leave a passage out
yourself: an omission is the restatement's, confirmed later.

Size the first allowance for the whole examination, or the work stops midway.
Every answer counts, accepted or refused, and every run but one owed only by a
change of versions: up to six reductions per surprise, each weaker form, each
retry alone after running out beside others. A full round asks, for each
model, each claim's base, witness and fault questions, and every question the
account contract §journey-rules lists: paths, refusals, each row's enabled
question, each unstruck misbehaviour, the phases, the starts and Alloy's
facts. Each round of model repairs asks a full round again. Size later rounds
from `./forma missing`. Each machine counts what it spends against the
allowance from nothing, so work moved to a second machine can spend it there
again (the door contract §spent).

Time and memory per run decide what an engine can answer; a question that
runs out waits as `unanswered:<question>`. Allowances spend the owner's money
and time: propose a size from this arithmetic and let them set it.

The intake also sets how your items are put to you: `Cadence` groups them by
part or span, one by one, or by the session whose answer opened them, and
`Inbox cap` sets how many are shown in full (the account contract §waits). An
allowance may set either again.

## Confirm

A confirmation says: this is what my document says, in these forms. Its unit
is the part list; a part's or span's stated entries, together; one added
action, claim, premise, boundary row or surface row; one lifecycle; one
journey, written or offered; or one omission (the design contract §units).
The part list comes first. A unit a lifecycle finding blocks waits as
`confirm:<unit>` for its `findings:` item, which a Restate answer clears, or
for a pick where the finding stems from a posed cell. Decline with `./forma
decide decline <unit> --words <reason> --shown <token>`: the words are all
its repair gets, so give the entry, what is wrong, and what the passage says.

Confirming does not say the design is right. Confirm a faithful stated entry
even when you think the design flawed: a finding is worth more than a
restatement quietly improved. Read stated entries one by one against their
passages. Only you test the label `stated`; one that goes beyond its passage
is an addition confirmed unasked. Decline naming the entry and its passage.

Ask each `added` entry alone whether the owner would have written it and
whether the design or the world has what it says: an unwanted claim spends
every later step on a question nobody asked. A world premise needs a source
or the owner's word; a must-not journey, the owner's wish to refuse it.

Read a lifecycle cell by cell in its table, and its picture move by move,
with its initial phase and ends. An unintended refusal hides every flaw
needing that step; an unintended move makes models do what the design does
not.

An offered journey is the shortest way to a phase no confirmed journey
reaches. Confirmed, every model of its part must take it before a claim there
counts, so confirm only a journey that should be possible. Drawn at phase
level, every case possible, no guard evaluated, no arguments, it should be
possible when some data make it so. When none do, the fault is the
lifecycle's, and no answer writes an offered journey: decline it, saying which
cell should refuse, which guard never holds there, or which entry is missing.
The decline sends a Repair of the lifecycle's part with your words as its
direction, and is met once the lifecycle's page is answered again (the
decisions contract §expects).

Confirm an omission only when it loses nothing the owner cares about. Decline
one that hides an open question or an assumption, and ask for a choice or a
premise.

## Pick

A choice is an open reading put as two journeys differing only on it, with a
recommendation that decides nothing. Pick `a` or `b` when the brief, a source
or the owner settles it; otherwise the pick is the owner's.

Read what a pick does first. The picked journey is confirmed as written.
Where the two differ at one step, the other becomes a journey that must not
happen: check you want it forbidden, not merely unchosen. Read the effects
table as the cells it fills. The pick carries `choice:<part>/<choice>` into
every claim that rests on it.

No decision declines a choice. When neither reading is wanted, the owner
answers in a new passage of the brief, whose Restate answer can remove or
replace the choice; editing a passage the choice cites only lapses its pick.

## Strike and carry

A strike says a party of the world will not do one thing on its menu: a
premise with a falsifier, under which every question leaves that misbehaviour
out. Strike only what a source or the brief supports ([world.md](world.md));
a strike to save work is a flaw nobody will see.

Carry with `./forma decide carry <premise> --choice carry --words
<falsifier> --shown <token>`, or `--choice withdraw`, naming the premise as
its `carry:` item does. A strike, `strike:<part>/<row>/<item>`, carried
without words keeps Forma's falsifier. Comma-separate premises when one
falsifier serves all or each keeps Forma's; if one fails, none is carried. A
falsifier is an observation, "a reminder observed sent twice for one loan",
not "the mailer is unreliable": whoever watches the running software looks
for it.

`store:<part>/<row>` says a store permits what its isolation permits. One the
brief does not name is `unknown`, permitting every anomaly, until the owner's
word or a source names it there; a vendor default is only a lead
([stores.md](stores.md)).

A claim's bounds are `bound:<model>/<part or span>/<claim>`, shown with the
Bounds table; `bound:<model>` names every waiting claim's bounds on that
model. Read each row's Meaning and ask what the bounds leave out: two
contenders, a repeat, one over each limit, each unstruck misbehaviour. A TLC
`constraint` row bounds every result but a liveness claim's
([tlc.md](tlc.md)). An Alloy `steps` row leaves out longer behaviours. Do not
carry bounds that leave out what a claim needs. No decision asks for larger
bounds: bring that to the owner.

A span, two parts sharing an event, store or third party, owes a claim or
journey of both examined on a model covering both, or your carry of
`span:<part>+<part>`; examine it where a stake crosses. A carry lapses when
its premise changes, or, carried with `--basis <part or span>/claims/<claim>`,
whenever that claim is not established without it.

## Rule

A waiting decision holds the open surprises whose claims rest on a premise in
common, or whose traces take one world row's misbehaviours. `./forma show
rule <decision>` shows it, named as its `rule:` item names it, each surprise
rendered by code with its accepted explanation. It is offered once every
surprise in it has an accepted explanation and no reduction left to run (the
decisions contract §rulings).

Read the rendering before the explanation, an agent's reading that decides
nothing. Only an invariant's trace is shortest; a liveness trace's length
says nothing of likelihood. Find the first step the design or the world would
not take: if there is one, the model, a bound or the property is wrong there;
if none, the design allows the story. Any surprise but a base question's
speaks about the model first:

| Surprise | What it says |
| --- | --- |
| base: violation | for TLC, the evidence says whether the type invariant, checked first, broke, which is the model's slip; otherwise read the claim's first wrong step and its encoding against the sentence |
| fault: not caught | the property asks less, the fault removes nothing it needs, another guard prevents it, the bounds keep it out, or for TLC the type invariant broke first |
| witness or misbehaviour: not reached | a pass on it may be empty |
| path: not reached | the model lets less happen than the design, the journey is wrong, or every step is taken and its expected end does not hold after the last |
| refusal: enabled | the model lets more happen, or the design does |
| enabled: not reached | an action or misbehaviour can never happen |
| phases: violation | the model's phases do not match the lifecycle |

| Verdict | Means | Sends |
| --- | --- | --- |
| `model wrong` | the model or a slot other than an encoding misstates what you confirmed | a Repair of each model, which may change no encoding of a ruled claim; a kept base trace becomes a must-not journey |
| `property wrong` | the claim's property says other than the owner means: its sentence, or an encoding that reads it so | a Restate repair of the claim's sentence, which you confirm again, or its encoding filled again on each model the surprises ran on |
| `abstraction too coarse` | the restatement lacks an action, case, phase or step | a Restate repair of the parts, after which every claim over them is put to you again |
| `real finding` | the design as the brief states it lets this happen | to its target: the brief, a model, a premise or a choice |

An encoding that says more or less than a sentence you would keep is
`property wrong` too, since no `model wrong` Repair may touch it. Say in your
words which it is: how the sentence is to be made exact, which sends the
claim back to be restated and confirmed, or that the sentence stands and the
encoding misreads it, which sends the encoding to be filled again on each
model the surprises ran on (the decisions contract §expects).

`model wrong` on a violated base question keeps the trace as a must-not
journey, refused at its last step, unless the decisions contract
§kept-journeys excludes it, as for a liveness claim. If its behaviour is
wanted, it must not be kept: rule `property wrong` when the sentence or its
encoding says too much; when a type invariant was too tight, rule
`model wrong` and then decline the kept journey, which then counts nowhere
(the decisions contract §expects; [explain.md](explain.md)). A surprise that
turns on an open reading is no finding: rule `abstraction too coarse` and ask
for a choice.

A real finding's target is `brief`, which sends nothing and the owner edits;
a model's key, whose Repair adds a mechanism and a fault that removes it, and
then owes you a `brief` decision (below); `premise:` and the premise, which
revokes its carry and so every claim on it, when the premise fails or the
owner would not carry it knowing what it allows; or `choice:<part>/<choice>`,
which revokes the pick's carry of the choice's premise while the pick still
stands for its journeys and cells, and puts the choice to you again (the
decisions contract §rulings, §in-force). The level only records, though a
requirement-level finding targets the brief; note what you meant.

Your words direct the repair, and it does what they say. Say what must hold
and where the first wrong step is: "at step 4 a returned loan is renewed; a
returned loan cannot be renewed". Name a mechanism only if you want that one.
For `model wrong`, say the repair adds nothing the brief does not state. Rule
waiting decisions together only when one cause and one repair cover them.
Rule every surprise open on a model at one sitting where you can: a Repair
that changes the model's files waits until no other surprise is open on it
(the models contract §model-repair).

## Mechanisms a repair added

A real finding sent to a model is repaired by adding a mechanism, so the
model's claims then stand for a design the brief does not describe. Once that
repair is taken in, `brief:<ruling>/<model>` waits for you (the decisions
contract §rulings). Bring the mechanism to the owner with its price
([mechanisms.md](mechanisms.md)), and decide one of two ways:

- **`stated`**: the brief states it. Name each passage that does, one address
  a line, in the showing and the decision alike: `./forma show brief
  <ruling>/<model> --words <address>`, then `./forma decide brief
  <ruling>/<model> --choice stated --words <address> --shown <token>`. Where
  no passage states it yet, the owner writes one first, stating every such
  mechanism in one edit. A stating passage edited later lapses the decision.
- **`accepted`**: the owner accepts that the brief does not state it:
  `--choice accepted --words <why>`, on their word.

Until one is in force, the box says under each claim established on that
model that the mechanism is not in the brief (the account contract §box).

A mechanism a `model wrong` Repair added gave the design help the brief does
not state, and owes no decision. If the owner does not want it, no decision
declines a mechanism: redirect a journey it refuses and the design allows,
then rule its path surprise `model wrong` with words that remove it; or
withdraw the bounds' carry, which removes nothing from the model.

## Accept, allow, redirect

Accepting `<part or span>/claims/<claim>`'s risk, with words why, puts it in
the box as accepted and not examined, while the premises its page names are
carried and until the claim changes; it is offered where no engine can
express the claim. The risk is the owner's: accept only on their word or the
brief's.

An allowance adds answers, runs, or an engine's time or memory per run. Once
this machine's are spent, every item here that would spend waits for you.
Before more time for a run that ran out, ask whether the model is too heavy:
more time only postpones that repair.

Redirect through the brief, edited with no decision, the way a new claim
enters; a sentence, `./forma decide redirect <part or span>/claims/<claim>
--words <sentence> --shown <token>`; or a journey, `./forma decide redirect
<part or span>/journeys/<key> --from <file> --shown <token>`, the file holding
its whole page in the journey form, citations included, each shown first
with the same words or file (the decisions contract §redirect). Forma writes
the page, and the redirect confirms the unit that holds it as it then reads:
for a stated claim, every stated entry of its part or span, so read the whole
showing. A new sentence owes the claim's slots again. A redirect is refused
while the page holds a change no answer made.

## Reading the account and the box

Established means no violation of the encoding on that model, in its bounds,
on the premises carried, with a fault caught and witnesses reached. It does
not mean the design is right, the claim holds beyond the bounds, the model is
faithful beyond its journeys, or a premise is true. Read bounds and premises
as part of the claim, as the box that leaves Forma carries them. After a
change, read `./forma diff` first. By default it counts from the commit that
added your latest decision, and refuses while that decision is uncommitted,
so have each sitting committed (the account contract §diff). `./forma account
<part or span>/<kind>/<key>` reads one thing with every decision on it,
wherever it is filed.

| The account cannot know | So you |
| --- | --- |
| fidelity beyond the journeys passed | read journeys closely at Confirm |
| beyond a result's bounds, or below phase level | read the bounds first |
| a `CHOOSE` the bounds do not record as a trade | ask that the model's session name every `CHOOSE` in its report |
| a dependence nobody cited | ask what depends on a changed passage |
| an interaction nobody wrote down | check each surface holds what it shares |
| who wrote a brief passage | read an agent's passage as an added entry |
| who made a decision | keep your record of each decision's basis |
| what another machine spent or refused | read `./forma missing` where the work ran |
| what an agent spent in its own loop | nothing shows it |

## Where to spend attention

Attention is scarce. Read closely every added entry, lifecycle cell, choice,
offered journey, real finding's trace, Bounds table, strike and added
mechanism. Forms, coverage and currency are checked for you; that an encoding
says the whole claim, bounds keep the interactions a claim needs, and a fault
removes only its mechanism are not.
