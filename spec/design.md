# The design folder

Spells out [SPEC.md](SPEC.md) for `design/`, leaving
its decisions and receipts to their own contracts: the brief, its passages,
coverage and additions; what a thing's parts are and where it is filed; the
journeys code adds; units and what a confirmation pins; and the Restate answer,
with removal and re-filing. The pages' forms and the premises code adds are
[forms.md](forms.md)'s, and the lifecycle tool is
[lifecycle-tool.md](lifecycle-tool.md)'s. It owns, relative to the project
folder, `design/brief/**`, `design/README.md`, every part's and span's
`README.md`, every part's `actions.md`, `boundary.md` and `omissions.md`, and
every thing's page, `design/parts/<part>/<kind>/<key>/README.md` or
`design/spans/<span>/<kind>/<key>/README.md`.
[project.md](project.md) lays out the whole tree and names the owner of every
other path. `M<n>` is line n of [SPEC.md](SPEC.md).

<a id="paths"></a>

## The paths this contract owns

| Path | Form | Written by | Read by |
| --- | --- | --- | --- |
| `design/brief/**` | [§brief](design.md#brief) | the developer, or agents directly for the developer to review; never Forma (M48, M240) | code, for passages, coverage and pins ([§passages](design.md#passages), [§coverage](design.md#coverage), [§units-and-pins](design.md#units-and-pins)); agents; the developer |
| `design/README.md` | [forms.md §part-list](forms.md#part-list) | agents, through Restate answers ([§restate](design.md#restate)) | code, for the part list, the checks and the reading order; everyone, where reading starts |
| `design/parts/<part>/README.md`, `design/spans/<span>/README.md` | [forms.md §part-readme](forms.md#part-readme), [§spans](forms.md#spans) | agents, through Restate answers | code, for the checks and the reading order; agents; the developer |
| `design/parts/<part>/actions.md`, `boundary.md`, `omissions.md` | [forms.md §part-tables](forms.md#part-tables) | agents, through Restate answers | code, for the checks, the lifecycle tool and pins, and for what models and evidence rest on; agents; the developer, in what decisions show and in the account |
| `design/parts/<part>/<kind>/<key>/README.md`, `<kind>` one of `lifecycles`, `journeys`, `claims`, `premises`, `choices`; `design/spans/<span>/<kind>/<key>/README.md`, `<kind>` one of `journeys`, `claims` | [forms.md §thing-pages](forms.md#thing-pages) | agents, through Restate answers; Forma, for a redirect's claim sentence or new journey ([decisions.md §redirect](decisions.md#redirect)) | as the tables |

Forma writes a page only when it takes in an accepted answer or makes a
redirect, each with a receipt line (M52, M220–222, M236). A change to a page
that neither made, the developer's own edit included, counts for nothing
(M238, M326–329; [door.md §change](door.md#change)).

Under each model a thing is examined at the path its folder has under `design/`:
`design/parts/billing/claims/invoice-terms/` is examined in
`models/<model>/parts/billing/claims/invoice-terms/` (M50–51, M107–108). A
journey code adds has, under each model, the folder its page would have
([§code-journeys](design.md#code-journeys)), and no folder under `design/`.

<a id="brief"></a>

## The brief

`design/brief/` holds the developer's documents and the sources supplied with
them (M48):

- **every `.md` file under `design/brief/` outside `design/brief/sources/`**: a
  document of the developer's
- **every `.md` file under `design/brief/sources/`**: a supplied source, with
  its provenance

A file's `.md` is matched in any letter case. A symbolic link to a file outside
`design/brief/` counts as a file at the link's path; one to a file inside it is
not read, since that file is read as itself. Any other file under
`design/brief/` is no part of the brief and is ignored. Forma writes nothing
here, and checks nothing here by a receipt (M48).

Agents may write the brief directly, for the developer to review (M240,
M308–310). Who wrote a passage is not recorded (M286): the developer reviews
what agents write through what follows from it, coverage
([§coverage](design.md#coverage)), citations and staleness
([§passages](design.md#passages), [§units-and-pins](design.md#units-and-pins)),
and each confirmation shown beside the passages it cites
([presentation.md §showings](presentation.md#showings)).

A document is CommonMark Markdown read with no extension, so a table is read as
a paragraph. Front matter, a YAML block between `---` lines at the top of a
file, is not part of its text. A source's front matter has four fields, each a
string holding a character other than whitespace: `title`; `author`; `date`, a
calendar date that exists written `YYYY-MM-DD`, or `YYYY-MM` or `YYYY` when no
more is known, or `unknown`; and `origin`, where the source came from and who
saved it. A source without all four is not citable until it has them (M48); its
passages are still to be covered, by omissions
([§coverage](design.md#coverage)).

<a id="passages"></a>

## Passages

Code addresses and hashes every passage of the brief (M158).

- **A passage** is the section of one heading that stands in no block quote or
  list item, whatever its level: the heading line and every block after it, up
  to the next such heading. A heading
  inside a block quote or a list item belongs to its container and starts no
  passage. Text before a file's first heading is the file's opening passage.
- **Its address** is `<path>#<slug>`, the path relative to the project folder,
  so beginning `design/brief/`. The slug follows GitHub's rule for heading
  anchors as stated here, which governs: the heading's text with its inline
  markup removed and an image read as its alt text, lowercased; every character
  other than a letter (Unicode category L), a digit (category Nd), a space, a
  hyphen or an underscore removed; each
  space replaced by a hyphen. A slug already given in the same file, in file
  order, takes the suffix `-<n>`, `n` the least number from 1 that gives a slug
  not yet given. An opening passage's address is its path alone.
- **Its hash** is the SHA-256, in UTF-8, of its canonical text: the canonical
  texts of its top-level CommonMark blocks, link reference definitions
  included, in order, joined by one blank line. A block's canonical text is its
  source with every run of whitespace, the characters of Unicode's `White_Space`
  property, collapsed to one space and its ends
  trimmed, except the lines of fenced code at any depth, kept as written less
  trailing whitespace; a block that holds fenced code is the collapsed text
  before, between and after its fences and the fences' lines, in order, joined
  by line feeds. The heading line is part of the text. A line ends at a line
  feed, a carriage return, or the two together.

So rewrapping a paragraph changes no hash, and any other edit in a section
changes its hash. Renaming a heading changes the passage's address: citations of
the old address no longer resolve ([§at-read](design.md#at-read)), and the new
address is uncovered until a Restate answer covers it
([§coverage](design.md#coverage)).

<a id="coverage"></a>

## Coverage and additions

Every entry cites the brief passages it restates (M79). A passage is covered
when an entry or the part list cites it, or an omission names it, the entries
being every page's and every journey code adds
([§code-journeys](design.md#code-journeys)). Every passage of every document and
source is to be covered: an uncovered passage is missing work for a Restate
answer, whose agent chooses the part that restates it (M79–81), by the item
`passage:` ([account.md §items](account.md#items)).

An entry that cites only sources, none of the developer's documents, is an
addition: it is `added` whatever its `Origin` says (M81–82).

<a id="filing"></a>

## What a thing's parts are, and where it is filed

A claim's parts are those its `Parts` names; a journey's are the parts of the
actions its steps name, whatever folder holds it (M84–85). A claim or journey of
several parts belongs to their span, and filing it in a span folder or a part's
changes neither its parts nor its pin, so filing never changes what it is judged
by (M85–87). No rule refuses a claim or journey for where it is filed. Its
folder decides only where its bare references are read
([forms.md §page-rules](forms.md#page-rules)), which stated unit holds it when
it is stated ([§units](design.md#units)), where its decisions and its folders
under the models sit ([§paths](design.md#paths);
[decisions.md §filing](decisions.md#filing)), and where it is read
([forms.md §reading-order](forms.md#reading-order)).

<a id="code-journeys"></a>

## Journeys code adds

Code adds journeys of three kinds. None is a page, so no answer can change or
remove one, and no page may take one's key (M87–90). Each has the journey form
([forms.md §journeys](forms.md#journeys)) without a heading, and for a pick's
journeys without `Origin`, is stepped like any journey
([lifecycle-tool.md §stepping](lifecycle-tool.md#stepping)), is a unit
([§units](design.md#units)) judged like any other journey, and counts wherever
journeys count (M131–135, M195–198). Under each model it has the folder its page
would have, `journeys/<key>/` in the folder of the part or span it belongs to
([§paths](design.md#paths)), and its decisions are filed in that part's or
span's `decisions/` ([decisions.md §filing](decisions.md#filing)).

| Journey | Key | Belongs to | Read from | Goes with |
| --- | --- | --- | --- | --- |
| a pick's | `<choice>-<pick>`; and, when the alternatives differ at one step, `<choice>-not-<other>` | the choice's part | the choice's page, while a pick of it is in force ([decisions.md §pick](decisions.md#pick)) | its choice |
| an offered one | `reach-<lifecycle>--<phase>` | the lifecycle's part | the lifecycles as read ([lifecycle-tool.md §shortest](lifecycle-tool.md#shortest)); once confirmed, what its confirmation showed | its lifecycle; once confirmed, its part |
| a kept one | `kept-<twelve hexadecimal digits>`, as its ruling names it | the part or span its ruling's `Journey` reference names | its ruling's `## Kept` ([decisions.md §kept-journeys](decisions.md#kept-journeys)) | that part or span |

**A pick's journeys.** The pick is confirmed as written (M199–201):
`<choice>-<pick>` is the picked alternative, its fields, start rows and steps.
When the alternatives differ at one step, `<choice>-not-<other>` is the other
alternative as a must-not journey refused at that step: Polarity `must not`,
Expected end `-`, Refused step that step's number, its start rows and steps as
written. Both cite the choice's passages and have no `Origin`.

**Offered journeys.** Once a lifecycle's confirmation is in force, the tool
offers, for each of its phases but the initial one that a shortest journey
reaches ([lifecycle-tool.md §shortest](lifecycle-tool.md#shortest)) and that no
confirmed journey other than an offered one reaches
([lifecycle-tool.md §stepping](lifecycle-tool.md#stepping)), in whatever part or
span it is filed, that shortest journey as a should-happen journey of the
lifecycle's part (M195–198): Expected end
`<the entity's Names> reaches <phase>.`; each step's Actor the Names of its
action's actor, its Arguments and Entity `-`, its Case the step's case or `-`;
no start table; `Origin` `added`; citing the lifecycle's passages. The tool
admits it, since it found it by stepping the part's lifecycles as
[lifecycle-tool.md §stepping](lifecycle-tool.md#stepping) does.

Its key is `reach-<lifecycle>--<phase>`. Keys hold no two hyphens together
([forms.md §page-rules](forms.md#page-rules)), so the double hyphen tells the
lifecycle from the phase, no two offered journeys share a key, no page can take
one, and a key never depends on what is confirmed.

Where the latest decision whose `On` names an offered journey's key is a
confirmation, current or lapsed
([decisions.md §in-force](decisions.md#in-force)), the journey is read from that
confirmation's `## Journey` ([decisions.md §confirm](decisions.md#confirm)),
whatever the lifecycles now say, and stays a journey of its part (M89–90); it
keeps its key, and no journey is generated under that key. Generating it again
would ask the developer afresh each time its shortest path moved, though the
journey they confirmed still reaches the phase. Every other offered journey is
generated afresh at every read; a declined one is known by its pin as well as
its key. A lifecycle edit that breaks a confirmed offered journey shows as a
conflict ([lifecycle-tool.md §findings](lifecycle-tool.md#findings)), cleared by
repairing the lifecycle, by posing a choice, or by the developer's later
decline, after which a journey is offered afresh. A journey code adds that is
read from a decision keeps the references and citations it was confirmed with:
one that no longer resolves makes its pin `missing` ([§pins](design.md#pins)),
so its confirmation lapses and it is put to the developer again. While a written
journey that reaches the phase awaits its confirmation, the offered journey
waits for it ([account.md §items](account.md#items)).

**Kept journeys.** A *model wrong* ruling keeps a surprise's trace as a must-not
journey; its `## Kept` holds that journey under its key with the reference that
files it in the claim's part or span (M205–206). It goes with that part or span,
and its ruling keeps the record.

<a id="units-and-pins"></a>

## Units and pins

The developer confirms units, and a confirmation pins its unit's meaning as it
was shown (M161–165, M193–198).

<a id="units"></a>

### Units

| Unit | Name | Holds |
| --- | --- | --- |
| the part list | `parts` | the table of `design/README.md` |
| a part's or span's stated entries | `<part or span>/stated` | every stated action, claim, premise, boundary row and surface row of the part or span, together; a part or span with none has no such unit (M194–195, M296–297) |
| an added action, claim, premise or boundary row | `<part or span>/<kind>/<key>`, `<kind>` one of `actions`, `claims`, `premises`, `boundary` | that entry |
| an added surface row | `<part>/surface/<direction>/<name>` | that row |
| a lifecycle | `<part>/lifecycles/<key>` | that lifecycle, stated or added |
| a journey | `<part or span>/journeys/<key>` | that journey, stated or added, written or added by code |
| an omission | `<part>/omissions/<address>` | that omission |

A span's stated entries are its stated claims. Choices are picked, not
confirmed, and are no unit. A pick's journeys are confirmed by their pick and a
kept journey by its ruling, as well as by any confirmation
([decisions.md §in-force](decisions.md#in-force)) (M199–201,
M205–206).

<a id="pins"></a>

### Canonical text, pins and entry names

An entry's canonical text is one line per field, in the order its form lists the
fields, each `<Field>: <value>`, with:

- keys, `Origin` and the page's heading left out, since they name the entry
  rather than say what it means; the names of phases and cases kept, since they
  are what a lifecycle means;
- every value's whitespace collapsed as in [§passages](design.md#passages);
- every reference replaced by what it names: an action by its Sentence, followed
  by ` (cases <its cases>)` when it has cases and ` (guard <its Guard>)` when it
  has one; a boundary row by its Names, followed by
  ` (<Kind>, <Side>, <Seam>, <Isolation>)`, so a change to what an action needs
  or to how a row behaves stales what names it; a premise by its Statement; a
  choice by its Question; a lifecycle by its entity's Names; a part by its
  Purpose; in `Rests on`, a `store:` item by `store <the row's Names>` and a
  `choice:` item by `choice <the choice's Question>`; an event keeps its key,
  which is its name, and another part's event is
  `<event> (<that part's Purpose>)`;
- every citation replaced by its passage's hash;
- a reference or citation that names nothing that counts, which only a read of
  the project can meet ([§at-read](design.md#at-read)), replaced by
  `missing <as written>`, a citation of an address that is no citable passage
  included;
- the items of a list, once replaced, sorted and joined by `, `; a list written
  `none` has the empty string as its value.

Beyond its fields:

- a lifecycle has a line `Cell: <phase> | <action> | <outcome>` for each cell,
  the action replaced by what it names as every reference is,
  the outcome its phase, `None.`, `choice <the choice's Question>`, `(empty)`,
  or, for a cell of cases, each `<case>: <outcome>`, these sorted and joined by
  `; `; `Initial` reads `<phase>` or `<phase>, entered by <action>`;
- a journey has a line `Start: <lifecycle> | <entity> | <phase>` for each start
  row, then a line `Step <n>: <actor> | <action> | <arguments> | <entity> | <case>`
  for each step;
- a choice has, for `a` and then `b`, a line `Alternative a` or `Alternative b`,
  that alternative's lines as a journey's for the fields it has, with no `Origin`
  or `Cites` line since it has neither, then a line
  `Effect: <lifecycle> | <phase> | <action> | <outcome>` for each effects row;
- an omission is `Passage: <its passage's hash>` and `Reason: <its reason>`.

The cell, start and effect lines are sorted; the steps keep their order. A unit
of one entry has that entry's canonical text. `<part or span>/stated` holds each
of its entries' texts preceded by a line naming its kind, `actions`, `claims`,
`premises`, `boundary` or `surface`; `parts` holds, for each row,
`Purpose: <purpose>` and `Cites: <hashes>`; each sorts these entries' texts.
Sorting is in code-point order, and lines are joined by one line feed, with none
after the last.

This rule is part of the contract: a change to it changes pins, and so lapses what
they pinned as a change of meaning would, so it changes only as this contract does.

**A pin** is the SHA-256 of a canonical text in UTF-8: a unit's pin is that of
its text, and an entry's pin that of its own text alone, whatever unit holds it.
So renaming a key or a heading, re-filing, reordering a list or a table's rows,
and rewrapping a paragraph change no pin, and any change to what an entry says,
to an action or row it names, or to a passage it cites changes it (M161–165). An
entry's pin is what a slot's receipt line records for each entry it was written
for, and what a question's evidence records for each entry it read or its trace
names (M166–169, M176–177); a choice's, a claim's and a premise's are what
picks, acceptances and carries pin.

**An entry's name.** Wherever a record names an entry, it is named
`<part or span>/<kind>/<key>`, the kind being `actions`, `boundary`,
`lifecycles`, `journeys`, `claims`, `premises` or `choices`; a surface row
`<part>/surface/<direction>/<name>`; an omission `<part>/omissions/<address>`.
So an added entry's name is its unit's ([§units](design.md#units)).

<a id="confirmation-pins"></a>

### What a confirmation pins

A confirmation pins its unit as it was shown, by the unit's pin then, which the
decision records ([decisions.md §decision-file](decisions.md#decision-file)). It stays
current while the unit's pin is the same, and it attaches to that content, not
to the unit's name, a key or a file's bytes, so a unit rewritten with the same
meaning-carrying text keeps it (M161–165). A receipt's hash of a file is never a
pin. A change to what a confirmed entry says changes its pin, so no answer
changes a confirmed entry without the developer confirming it again, and claims
stay the developer's (M237–238).

<a id="restate"></a>

## The Restate answer

A Restate answer writes the pages of one or more parts or spans and names those
it removes; Forma gives it the brief's passages and the current restatement
([door.md §gives](door.md#gives)), and takes it in when its forms
parse, its references resolve and the lifecycle tool runs (M230). One answer may
write several parts, so parts that refer to one another enter together
(M302–304).

<a id="restate-holds"></a>

### What it holds

Its folder ([door.md §answer-holds](door.md#answer-holds)) holds, at their paths
in the project, any of `design/README.md`; a part's `README.md`, `actions.md`,
`boundary.md` and `omissions.md`; a span's `README.md`; and thing pages
([forms.md §thing-pages](forms.md#thing-pages)); and, at the folder's top,
`removed.md`. It holds at least one page or one path in `removed.md`, and
nothing else: no file of the brief, decision, receipt, evidence or model file,
and no page under a key code gives ([§code-journeys](design.md#code-journeys))
(M230, M238).

`removed.md` holds one path a line, each the path of a thing, a part or a span,
without a final `/`: `design/parts/<part>/<kind>/<key>`,
`design/spans/<span>/<kind>/<key>`, `design/parts/<part>` or
`design/spans/<span>`. Each names one that exists, once. Naming a part or span
removes its `README.md`, its tables and every thing page in it. No empty file
removes anything: a page is removed only by being named here.

<a id="restate-applied"></a>

### How it is applied

Code applies the answer to the restatement as it stands: from the pages that
count now ([door.md §read-checks](door.md#read-checks);
[§at-read](design.md#at-read)) it drops every page `removed.md` removes, then
puts in every page the answer holds. That is the restatement after the answer,
and [§restate-checks](design.md#restate-checks)'s checks are asked of it whole,
with the brief as it is, so an answer may also mend what no longer holds as
things stand: a citation of a renamed heading, a reference to a page that counts
for nothing. Checks 2 and 3 refuse it for each failure in a page it holds, and
for each failure elsewhere that the restatement before it did not have; a
failure elsewhere that was there before is left to its own item and refuses
nothing, so answers on different parts do not wait on each other. A refused
answer changes no tracked file ([door.md §scratch](door.md#scratch) keeps its
reasons on this machine), and its item stays missing with every failed check,
each named by file, entry and field (M239).

<a id="restate-checks"></a>

### Its checks

1. **Form.** Every page the answer holds parses into its form
   ([forms.md §page-rules](forms.md#page-rules) to
   [§thing-pages](forms.md#thing-pages)), and `removed.md` into its own
   ([§restate-holds](design.md#restate-holds)).
2. **Resolution**, over the restatement after the answer:
   - every key is well formed and unique as
     [forms.md §page-rules](forms.md#page-rules) says, and no span has a part's
     key;
   - the part list has a row for every part and for nothing else
     ([forms.md §part-list](forms.md#part-list));
   - every reference resolves to an entry of its field's kind; every phase, case
     and choice that a lifecycle, a journey, a cell or an effects row names is
     one of its lifecycle's, its action's or its part's; every citation names a
     passage of a document, or of a source with all its provenance
     ([§brief](design.md#brief)); every omission names a passage; every part a
     claim's `Parts` or a promise's `Provider` names exists;
   - every liveness claim rests on a premise of class `fairness`;
   - no journey page has a key code gives ([§code-journeys](design.md#code-journeys));
   - every front page names only pages that exist
     ([forms.md §reading-order](forms.md#reading-order)).
3. **Placement.** Each action of a part is a column of each lifecycle of the
   part or is in its `Unaffected`, and not both; every column, every
   `Unaffected` item and every `entered by` action is an action of the part;
   every cell holds what [forms.md §lifecycles](forms.md#lifecycles) allows for
   its action; and each choice's effects tables give exactly the cells and cases
   the choice poses ([forms.md §choices](forms.md#choices)).
4. **The lifecycle tool runs to completion** over every lifecycle and journey
   ([lifecycle-tool.md](lifecycle-tool.md)), when checks 1 to 3 hold; when they
   do not it is not run, and they refuse the answer. Its findings never refuse
   one ([lifecycle-tool.md §findings](lifecycle-tool.md#findings)), and a part
   past [lifecycle-tool.md §shortest](lifecycle-tool.md#shortest)'s limit is
   such a finding, `unchecked`: only the tool's failing refuses.
5. **Nothing frozen moves.** The answer holds and removes no page the freeze holds,
   whatever its bytes
   ([models.md §freeze](models.md#freeze)), and removes or re-files nothing
   an unruled surprise rests on ([§removal](design.md#removal)) (M143–147).

<a id="removal"></a>

### What is removed, what is re-filed, and what follows

An entry before the answer, a thing or a row of a table, is the same entry after
it when an entry of its kind and key stands in the same part or span after it,
with the same pin if `removed.md` removed it and the answer holds it again. An
entry after the answer that is the same as none before it is new. A thing before
the answer that is the same as none after it, and a new thing, are one thing
re-filed when they have the same kind, key and pin and no other such thing
before or after the answer shares all three (M84–87). Every other entry before
the answer is removed by it.

Accepting the answer, Forma:

- writes each page it holds and removes each page `removed.md` removes, with
  their receipt lines ([door.md §receipts](door.md#receipts)); a folder whose page is
  removed keeps its `decisions/`, which never move (M224), and is otherwise
  removed;
- moves, under each model, each re-filed thing's folder to its new path, with
  all it holds, and, for a re-filed choice, the folders of its pick's journeys to
  its new part's `journeys/` ([§code-journeys](design.md#code-journeys));
- removes, under each model, what is kept for each removed entry: a thing's
  folder; an action's evidence under `actions/<part>/<action>`; a world row's
  folder under `world/<part>/<row>/`; and the folders of the journeys code adds
  that go with it ([§code-journeys](design.md#code-journeys)) (M171–172;
  [models.md §parts-change](models.md#parts-change);
  [evidence.md §written-moved](evidence.md#written-moved));
- leaves to an entry that is the same its slots and evidence, current or not as
  [models.md §slot-currency](models.md#slot-currency) and
  [evidence.md §currency](evidence.md#currency) say.

So a thing removed and added back in one answer with the same key and pin keeps
its slots and evidence, while one removed in one answer and added in a later one
is new: its slots are owed again and its questions run again against the
allowance. There is no rename: a thing added under another key is new, and the
decisions of the one removed, which stay where they were filed, are in force for
it by kind and pin
([decisions.md §in-force](decisions.md#in-force)). Re-filing a
stated entry changes the stated units of both folders, whose confirmations then
lapse ([§units](design.md#units)).

The answer is refused when it would remove or re-file an entry on which an
unruled surprise rests: the entry its question serves
([evidence.md §questions](evidence.md#questions)); each entry its basis names;
for a journey code adds, what that journey goes with
([§code-journeys](design.md#code-journeys)); and the part or span that holds any
of them (M145–147). Re-filing is refused as removal is, since it renames the
questions of what it moves, and so the surprise. The developer rules first. That
a Model answer may not drop such a part is
[models.md §parts-change](models.md#parts-change)'s.

<a id="at-read"></a>

### When the project is read

Whenever the project is read, the restatement is checked again as an answer's is
([door.md §read-checks](door.md#read-checks); M247–249):
checks 1 to 3, once, over the pages as they stand.

- **A page's own checks** are check 1's: that the page parses into its form
  ([forms.md §page-rules](forms.md#page-rules) to
  [§thing-pages](forms.md#thing-pages)). Its blocks, in order and nothing else;
  each table's columns and each row's cells; each field once; no empty cell but
  where [forms.md §page-rules](forms.md#page-rules) allows one; each cell
  written as its form gives, a closed list's cell holding one of its values, and
  `-` and `none` only where its form allows them; a list cell's items separated
  as [forms.md §page-rules](forms.md#page-rules) says; a journey's steps
  numbered from 1 in order, a must-not journey's refused step one of them and a
  should-happen journey's `-`; a choice's two alternatives differing
  ([forms.md §choices](forms.md#choices)). A page that fails one is
  `change:<path>` with the failed checks, and counts for nothing (M238, M240;
  [door.md §change](door.md#change)). Every rule about names is check 2's or
  3's, even where the page alone answers it: a key's form and uniqueness, and
  whether what a cell names exists.
- **Any other failure** of check 2 or 3 makes no page a change: what holds it is
  owed a Restate answer of its part or span, by the item `restate:<part or span>`,
  or, for `design/README.md`, by the item `restate:parts`
  ([account.md §items](account.md#items)), and is read as it stands meanwhile. What
  holds it is the page that holds the reference, citation, key, cell, effects row
  or front page's item; `design/README.md`, for a part list that does not match
  the part folders; and both `README.md` files, for a span sharing a part's key.
  A citation of an address that is no citable passage, as after the developer
  renames a heading, is owed by the item `passage:` instead. A page in a part or
  span folder that has no `README.md`, as a merge can leave, fails check 2 and is
  owed by `restate:<that folder's key>`.
- **What rests on a page that counts for nothing** is neither a change nor owed:
  it waits until that page counts again (M238). For checks 2 and 3 a reference
  into such a page, or a phase, case or cell of it, is taken as holding.

In a pin, a reference or citation to what does not count or does not resolve is
`missing` ([§pins](design.md#pins)), so what pinned it lapses meanwhile, and the
lifecycle tool reports `unchecked` on a lifecycle or journey it cannot check
([lifecycle-tool.md §findings](lifecycle-tool.md#findings)). Check 4's refusal
and check 5 belong to an answer alone.

<a id="repairs-redirects"></a>

### Repairs and redirects

A Repair answer whose target is the restatement holds what a Restate answer holds
and is checked and applied as one, its mechanism and its routing being
[door.md §repair-answer](door.md#repair-answer)'s (M234); so is each lifecycle page in
a Repair of a lifecycle model
([models.md §model-repair](models.md#model-repair)). A page Forma writes for a
redirect, a claim's new sentence or a new journey, is held to checks 1 to 4 as if
an answer held it, and is then an ordinary page (M220–222;
[decisions.md §redirect](decisions.md#redirect)).
