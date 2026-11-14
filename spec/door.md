# The door

Spells out [SPEC.md](SPEC.md) for how work enters the record: what Forma gives
an agent for an item (`forma give`); what an answer holds, which contract checks
it, and how Forma takes it in (`forma answer`), the Repair answer's routing
included; the receipt of each folder of accepted files; refusals, the allowance
spent and the sessions seen on each machine, the session rule's answer side and
the writer's lock; which file Forma checks how whenever it reads the project,
and `change:<path>`; how two copies of a project meet through git; and the clock
rule. What `forma give` and `forma answer` print is
[presentation.md §outputs](presentation.md#outputs)'s. It owns every `receipt`,
everything under `work/`, the `.gitignore` in `work/` and in `runs/`, and the
`.gitattributes` in `design/` and in `models/`. `M<n>` is line n of
[SPEC.md](SPEC.md). Paths are relative to the project folder
([project.md §commands](project.md#commands)).

<a id="door"></a>

## The door

- Agents choose what to work on; Forma checks every answer and takes in what it
  accepts with a receipt (M236). An agent reads what is missing from
  `forma missing` ([account.md §items](account.md#items)), takes an item's
  inputs with `forma give` ([§forma-give](door.md#forma-give)), does the work in
  a folder of its own, and submits it with `forma answer`
  ([§forma-answer](door.md#forma-answer)). That list is the work; there is no
  other flow (M264–267).
- An agent may write `design/brief/` directly. Otherwise it works outside the
  project: it writes no other file of the project folder, nor Forma itself, and
  reaches the record only through Forma's commands, from folders of its own (M48,
  M240, M308–313).
- Only the developer makes decisions, through `forma decide`
  ([decisions.md §forma-decide](decisions.md#forma-decide)); no answer holds a decision
  or any evidence (M238).
- The checks of [§read-checks](door.md#read-checks) catch accidents. The
  boundary keeps out forgery, since a well-formed file written inside the
  project would read as Forma's (M240).

<a id="forma-give"></a>

## `forma give`

`forma give <item> <folder> [--json]` writes into `<folder>` what Forma gives for
`<item>` ([§gives](door.md#gives); M228–234).

| Argument | Is |
| --- | --- |
| `<item>` | an item as `forma missing` names it ([account.md §items](account.md#items)), missing now and supplied by an agent's answer ([§answer-holds](door.md#answer-holds), [§change](door.md#change)) |
| `<folder>` | the agent's own: with every symbolic link in its path resolved, neither the project folder nor inside it (M240); absent or an empty folder, so it holds exactly the packet. Forma creates it when absent |

- **Reads** the project, with the checks of [§read-checks](door.md#read-checks);
  Forma's own contracts and base pages; `work/refused/`
  ([§scratch](door.md#scratch)); and, for an Explain item, `runs/`
  ([evidence.md §runs](evidence.md#runs)).
- **Writes** the packet into `<folder>`, and in the project only the runs an
  Explain item needs again ([§gives](door.md#gives)), as a writer does
  ([§lock](door.md#lock)). Nothing is recorded of a give, and a give spends
  nothing ([§spent](door.md#spent)).
- **Prints** as [presentation.md §give-output](presentation.md#give-output) gives.
- **Refuses**, printing each reason and writing nothing, with exit status 1, or
  with `--json` printing `{"refused": [<reason>, ...]}`: an argument missing; an
  item that is not missing, but for `slot:<the claim's folder>/witness` and
  `/fault`, which [models.md §owed](models.md#owed) lets an agent answer at any
  time; or an item not supplied by an agent's answer (M264–267); a folder that
  is the project folder or inside it, that is not a folder, or that is not empty
  (M240); a run the packet needs that the clock rule holds back
  ([§clock](door.md#clock)); and what every command refuses
  ([project.md §commands](project.md#commands)).

<a id="gives"></a>

## What Forma gives

Spells out the column "Forma gives" (M228–234). What Forma writes into the
folder for an item is its **packet**. Each input is written at its project path
in the folder (`design/…`, `models/…`, `runs/…`), as it stands.

| Kind | Forma gives |
| --- | --- |
| restate | every brief document and source with its provenance ([design.md §brief](design.md#brief)); every page under `design/` outside `design/brief/` (M230) |
| model | `design/README.md`; every page in the folder of each part the model covers ([engines.md §model-md](engines.md#model-md)), or, for a model not yet written, of each part its item names; the page of every thing filed in a span whose parts ([design.md §filing](design.md#filing)) all lie among those; the model's `model.md` and engine files when it exists; for an item that names no model, as `cover:`, `span:` and `express:` do, every TLC and Alloy model's `model.md` and engine files, so the answer may extend one (M231) |
| slot | the page of the thing the slot serves and the page of every entry it names; `actions.md`, `boundary.md` and every lifecycle page of each of its parts; the model's `model.md` and engine files; the thing's other accepted slots on that model; the slot's own file when it is owed again ([models.md §slot-currency](models.md#slot-currency)) (M232) |
| explain | the surprise's own file, the evidence of each of its reductions and weaker forms, and for a path surprise the evidence of its journey's start question ([evidence.md §surprises](evidence.md#surprises)); the page of every entry they read or their traces name, and the brief document or source holding each passage those entries cite ([design.md §passages](design.md#passages)), since the verdict an explanation recommends turns on what the brief says; every input file their bases name, the model's files and the slots; and what `runs/` holds of the run of the surprise and of each reduction, its composed inputs and the engine's output among it (M233) |
| repair | what its target's kind is given ([§repair-answer](door.md#repair-answer)) and, for a model target, every slot on that model, accepted or not, since the answer may change any of them, and could break one it had not seen (M234) |
| an item two kinds may answer, as `span:` may a Restate or a Model answer, and a property wrong `repair:` a Restate repair or a Repair of a model | what each of those kinds is given, together, since the kind is known only from the answer ([§answer-holds](door.md#answer-holds)) |

- **Contracts**, under `forma/`: `door.md`, `account.md` and `presentation.md`
  with every packet, the last for what each command prints; `design.md`,
  `forms.md` and `lifecycle-tool.md` for restate; `models.md`, `engines.md`,
  `design.md`, `forms.md` and `evidence.md` for model and slot; `evidence.md`,
  `engines.md`, `models.md`, `decisions.md`, `design.md`, `forms.md` and
  `lifecycle-tool.md` for explain, since an explanation recommends a verdict,
  reads the engines' traces and lifecycles, and its `explain.md` follows the
  pages' table rules; for repair, those of its target's kind and `decisions.md`,
  which says when a repair is met (M228–234). A contract in a packet cites the
  model and links contracts the packet does not hold; each rule states what
  holds without them.
- **The base**: every page of Forma's base, under `base/`. A page binds nothing;
  code copies the pages and reads none.
- **The run Explain needs.** Where `runs/` on this machine holds no run of the
  surprise, or of a reduction, on the basis its evidence names, Forma first runs
  it again as [evidence.md §rerun](evidence.md#rerun) says, writing no evidence;
  that run spends nothing ([§spent](door.md#spent); M233). A generated file
  composed now can differ from the one that ran where an entry changed since:
  `differ` names each whose SHA-256 is not the one the evidence keeps
  (M166–167). Where the run cannot be made on this machine, as when a file it
  needs counts for nothing, the packet holds no engine output and `forma give`
  prints why.
- **Nothing else.** A packet holds no receipt, no decision file and no file of
  `work/`, so no session of the developer's is in it (M238).

`item.json`, written by code (M59–60):

- **`item`**: the item as `forma missing --json` gives it
  ([account.md §items](account.md#items))
- **`confirmed`**: each unit confirmed and in force among the entries given, by
  its name and pin ([design.md §units-and-pins](design.md#units-and-pins),
  [decisions.md §in-force](decisions.md#in-force))
- **`picks`**: each pick in force on a choice among the entries given, or on a
  choice whose cells a lifecycle given poses: the choice, the journey picked,
  and what the pick makes of each cell it posed
  ([lifecycle-tool.md §as-read](lifecycle-tool.md#as-read))
- **`struck`**: each misbehaviour struck and in force in the parts given, by its
  name ([decisions.md §carry](decisions.md#carry))
- **`refused`**: the reasons of each refusal of the item kept on this machine
  ([§scratch](door.md#scratch)), oldest first
- **`journey`**: for a slot or a surprise of a journey code adds, that journey
  in a journey page's form ([design.md §code-journeys](design.md#code-journeys))
  (M87–90); absent otherwise
- **`decision`**: for a repair, what its decision says
  ([§repair-answer](door.md#repair-answer)); absent otherwise
- **`differ`**: for an explain, the generated files named above; absent
  otherwise

<a id="answer-holds"></a>

## What an answer holds

An answer is a folder the agent submits. It holds only regular files and the
folders that hold them: a symbolic link, an empty folder or any other kind of file
refuses it. Each file is at a path its kind holds, and a file at any other path
refuses it, so no answer holds a decision, a receipt, evidence or JSON (M59–60,
M238).

| Kind | The folder holds | Its form and checks |
| --- | --- | --- |
| restate | pages at their project paths under `design/`, outside `design/brief/`, and `removed.md` at the folder's top naming what it removes (M230) | [design.md §restate](design.md#restate), which refuses a page at a reserved key's path |
| model | `models/<model>/model.md` and every engine file of one model, at the top of its folder (M231) | [models.md §model-answer](models.md#model-answer) |
| slot | the one slot file, at its path under `models/<model>/` (M232) | [models.md §slot-answer](models.md#slot-answer) |
| explain | `explain.md`, which names the surprise it explains, and `weaker/<key>.<ext>`, at the folder's top (M233) | [evidence.md §explain](evidence.md#explain) |
| repair | what its target's kind holds, and `repair.md` at the folder's top; for a model target, also `removed.md` there, naming the slots of the model it removes, when it removes any (M234) | [§repair-answer](door.md#repair-answer) |

- **Its kind** is the one its item's supplier names
  ([account.md §items](account.md#items)) (M228–234, M264–267). Where that names
  two, a Restate and a Model answer, the kind is the one at whose paths its files
  are; files at both kinds' paths refuse it. An answer for `change:<path>` is of
  the kind that holds `<path>`, and holds it ([§change](door.md#change)).
- **A file is taken as written**, an empty one too. An answer removes what it
  names in `removed.md`, or, for a Model answer, the engine files it leaves out,
  as its kind's contract says; leaving a file empty removes nothing (M230–231).
- **What an unruled surprise rests on** is not removed: the Restate checks refuse
  an answer that removes or re-files it, and the Model checks one that drops a
  part it rests on (M146–147;
  [design.md §removal](design.md#removal),
  [models.md §parts-change](models.md#parts-change)).

<a id="forma-answer"></a>

## `forma answer`

`forma answer <item> <folder> --provider <name> --model <name> --session <id> [--json]`
submits the files in `<folder>` as the answer for `<item>`, with the session the
agent declares ([§sessions](door.md#sessions); M189, M236). The three are
required, none empty, and `<folder>` is a folder. An agent may answer without
asking for its inputs; its answer is checked the same way.

- **Reads** the project, with the checks of [§read-checks](door.md#read-checks);
  the folder; `work/spent.json`, `work/sessions.json` and `work/refused/`
  ([§scratch](door.md#scratch)); and the decisions, for their sessions and the
  allowance ([decisions.md §intake](decisions.md#intake)) (M189, M239–240).
- **Writes**, holding the writer's lock ([§lock](door.md#lock)): what an
  accepted answer brings into the record, with its receipt lines
  ([§receipts](door.md#receipts)) and the folders' git files
  ([§copies](door.md#copies)); and in `work/`, what it spends, the session seen
  and a refusal ([§scratch](door.md#scratch)) (M52, M236, M239–240).

With an argument missing or empty, or a `<folder>` that is not a folder, or
while the clock rule holds ([§clock](door.md#clock)), the answer is refused
before anything is written, and nothing is counted (M236). Otherwise Forma takes
the writer's lock, reads the project, and then:

1. **Allowance.** When the answers allowed are spent ([§spent](door.md#spent)),
   the answer is refused: it counts nothing and its refusal is not kept; its
   item goes to the developer (M239–240).
2. **Count.** The answer counts one answer ([§spent](door.md#spent)), and its
   session joins the sessions seen ([§sessions](door.md#sessions)).
3. **The door's checks**, each failure a reason: the item is missing and
   supplied by an agent's answer, or is a further witness or fault that
   [models.md §owed](models.md#owed) lets be answered at any time (M264–267);
   the folder is neither the project folder nor inside it, with every symbolic
   link in its path resolved (M240), and holds what
   [§answer-holds](door.md#answer-holds) allows; the session has made no
   decision ([§sessions](door.md#sessions); M189); for an Explain answer, the
   session is none of the authors of the surprise's model
   ([§receipts](door.md#receipts); M237). When any fails, the answer is refused
   with all of them, and its kind's checks are not made.
4. **Its kind's checks.** Its kind's contract
   ([§answer-holds](door.md#answer-holds)) checks it against the project as the
   project would read with the answer taken in, and gives every check that
   fails. A check that cannot finish, because a tool it needs fails, refuses the
   answer with that reason.
5. **Taken in**, when nothing failed (M236). Forma writes each file at its
   project path, an Explain answer's files at the paths
   [evidence.md §stems](evidence.md#stems) gives beside its surprise, and keeps
   no `repair.md` ([§repair-answer](door.md#repair-answer)); it removes what the
   answer removes, and what its kind's contract has code remove with it; it
   writes each file's receipt line ([§receipts](door.md#receipts)); and it
   deletes the item's refusals ([§scratch](door.md#scratch)).
6. **Refused** otherwise. The record does not change. While the item is missing,
   the refusal is kept under it in `work/refused/` on this machine, and the agent
   may answer again (M239).

While Forma takes in a file, the file is never without a receipt line its bytes
match: Forma adds the new line beside the file's earlier lines, writes the file,
then drops the earlier lines; it removes a file before its lines. It writes every
file whole, from a temporary file in `work/tmp/` renamed into place, so no reader
finds a file half written, and a stop midway leaves each file with a line it
matches (M52, M236).

**A reason.** Every check of every contract gives each failure in this form
(M239):

- **`check`**: the contract and section that state the check, as
  `door.md §forma-answer`
- **`file`**: the file it is about: its path in the answer's folder, or in the
  project for a file the answer does not hold; or `null`
- **`entry`**: the entry it is about, by its name
  ([design.md §pins](design.md#pins)); or `null`
- **`field`**: the field or column it is about; or `null`
- **`says`**: what failed, in one sentence

**Prints** as [presentation.md §answer-output](presentation.md#answer-output) gives.

<a id="repair-answer"></a>

## The Repair answer

A decline's reason and each ruling's verdict send a repair to a target, as
[decisions.md §rulings](decisions.md#rulings) says, and its item
is named by the decision ([account.md §items](account.md#items)) (M198, M204–214). A
target in the restatement or a model is given a Repair answer:

| Target | The answer holds | Checked as |
| --- | --- | --- |
| the restatement: a claim, the parts, or a declined unit, as the decision names | what a Restate answer holds | [design.md §restate](design.md#restate) |
| a TLC or Alloy model | files of that model only: what a Model answer holds, any of its slots, or both, and at least one; and, when it removes slots of the model, `removed.md` at the folder's top naming them | [models.md §model-answer](models.md#model-answer) for its model files, [models.md §slot-answer](models.md#slot-answer) for each slot, [models.md §model-repair](models.md#model-repair) for `removed.md` |
| a lifecycle model | its slots, its part's confirmed lifecycle pages, or both, and at least one; and, when it removes slots of the model, `removed.md` at the folder's top naming them | [models.md §slot-answer](models.md#slot-answer) for each slot, [design.md §restate](design.md#restate) for the pages, [models.md §model-repair](models.md#model-repair) for `removed.md` |

- **`repair.md`** is one field table, `| Field | Value |`, with exactly one row,
  `Mechanism`, whose value says what the repair adds or changes, in the
  developer's terms; the file holds nothing else, and the table follows
  [forms.md §page-rules](forms.md#page-rules) (M212–213, M234).
- **What it is given** ([§gives](door.md#gives)) is what the decision says,
  never its file: every row and section of it but `Provider`, `Model`, `Session`
  and `By` ([decisions.md §who-decides](decisions.md#who-decides); M234).
- **Checked** as its target's kind, the freeze
  ([models.md §freeze](models.md#freeze)) and the verdict's own rules
  ([models.md §model-repair](models.md#model-repair)) included, so a Repair waits
  for the ruling of every other surprise still open on what it would change
  (M143–147, M204–214). It is refused when it changes no file, or when, taken in,
  it would not do what its decision expects
  ([decisions.md §expects](decisions.md#expects)).
- **Taken in**, the receipt line of each file it changed names the decision in
  `answers`, the decision with its mechanism in `mechanisms`, and the file's
  SHA-256 before it ([§receipts](door.md#receipts)), as
  [decisions.md §expects](decisions.md#expects) says; `repair.md` is not kept
  (M212–214). Nothing an agent submits lands in `decisions/`.
- **A repair made by removing.** When an answer, a Repair answer or another,
  makes or meets a repair by removing files, Forma records the decision in
  `answers`, for a Repair answer the decision with its mechanism in
  `mechanisms`, and each file removed with its SHA-256 before in `removed`, on
  the line of the `README.md` of the part or span it removed them from, or of
  `design/README.md` when it removed a part or span whole, or under
  `models/<model>/` of that model's `model.md`, and for a lifecycle model of its
  part's `README.md`, or of `design/README.md` when that part is removed whole
  in the same answer, rewriting that line with the same `sha256`. So every
  repair has a surviving line that names it, with each file's hash before and
  after, a removed file's after being its absence (M212–214).
- **An answer for another item** that meets an open repair, as
  [decisions.md §expects](decisions.md#expects) says, names
  the decision in `answers` on the line of each file it writes that meets it,
  with each file's hash before; it has no mechanism, since only a Repair answer
  gives one (M212–214).
- What a repair removed, and each earlier version of what it changed, is in git
  once whoever runs Forma has committed it (M242–243).

<a id="receipts"></a>

## Receipts

Every folder under `design/` (outside `design/brief/`) or under `models/` that
holds a file Forma took in from an answer, or wrote for a redirect, holds one
receipt, named `receipt` (M52, M220–222, M236): `design/`, each part's and span's
folder, each thing's folder, each model's folder, and each folder under a model
that holds a slot, an explanation or a weaker form. Evidence and decisions are in
no receipt ([§read-checks](door.md#read-checks)).

- **Written** by code alone: by `forma answer`
  ([§forma-answer](door.md#forma-answer)), by `forma decide` for a redirect
  ([decisions.md §redirect](decisions.md#redirect)), and by whatever removes a
  file Forma took in ([design.md §removal](design.md#removal),
  [models.md §model-repair](models.md#model-repair),
  [models.md §parts-change](models.md#parts-change),
  [evidence.md §at-ruling](evidence.md#at-ruling)) (M52, M59–60).
- **Read** by the checks of every read ([§read-checks](door.md#read-checks)),
  the sessions ([§sessions](door.md#sessions)), the authors below,
  [models.md §slot-currency](models.md#slot-currency) and
  [§parts-change](models.md#parts-change) for slots' pins and models' strikes,
  [decisions.md §redirect](decisions.md#redirect),
  [§who-decides](decisions.md#who-decides) and [§rulings](decisions.md#rulings)
  for redirects, the session rule, repairs and `brief` decisions, and
  [account.md §box](account.md#box) for the mechanisms the box names (M52,
  M176–177, M212–214, M237, M240, M276–281).

**Form.** UTF-8. Forma writes one line for each file it took in that the folder
holds, each line the text `JSON.stringify` gives for one JSON object with its
keys in the order below, ending in a line feed, the last line too (a last line
without one does not parse), the lines in byte order (M52,
M59–60).

| Key | Holds | On |
| --- | --- | --- |
| `file` | the file's name in this folder | every line |
| `sha256` | the SHA-256 of the file's bytes as Forma wrote them, 64 lowercase hexadecimal digits | every line |
| `at` | when Forma wrote the line ([§clock](door.md#clock)) | every line |
| `session` | `{"provider", "model", "session"}`, as the answer declared them ([§sessions](door.md#sessions)) | a file an answer wrote |
| `decision` | the redirect's name ([decisions.md §decision-file](decisions.md#decision-file)) | a file a redirect wrote, in place of `session` |
| `authors` | every session that wrote any version of the file: this line's `session` and the `authors` of each line it replaced, each once, in byte order of provider, model and session | a file an answer wrote, or that one wrote before |
| `pins` | `[{"entry", "pin"}]`, in byte order of `entry`: each entry the slot was written for, by its name, with its pin ([models.md §slot-currency](models.md#slot-currency), [design.md §pins](design.md#pins)) | a slot |
| `strikes` | each strike in force over the parts the model covers when Forma took it in, named as its decision's `On` names it, `strike:<part>/<row>/<item>`, in byte order ([decisions.md §carry](decisions.md#carry)) | a model's `model.md` |
| `answers` | the names of the decisions whose repairs the file made or met, this time or in a version it replaced, in byte order ([§repair-answer](door.md#repair-answer)) | a file that made or met a repair, and every later version of it |
| `mechanisms` | `[{"decision", "mechanism"}]`, in byte order of `decision`: for each decision whose repair a Repair answer made with the file, this time or in a version it replaced, the value of that answer's `repair.md` ([§repair-answer](door.md#repair-answer)) | a line on which a Repair answer named its decision in `answers`, its removals' line included ([§repair-answer](door.md#repair-answer)), and every later version of it |
| `before` | the SHA-256 of the file before the answer wrote it, or `null` where there was none | a line a Repair answer, or an answer meeting a repair, wrote |
| `removed` | `[{"file", "before"}]`, in byte order of `file`: each file a repair's removal took, by its path relative to this folder, with its SHA-256 before; a file an answer held or removed, never evidence or a folder ([§repair-answer](door.md#repair-answer)) | the line a repair made by removing is recorded on ([§repair-answer](door.md#repair-answer)): a `README.md`'s, or a `model.md`'s |

- **One line per file, and what it carries forward.** Taking in a file replaces
  every line for its name with its new line; removing it removes them, and a
  receipt goes with its last line, so a removed thing's folder keeps only
  `decisions/` (M52). The new line keeps the `authors`, `answers`, `mechanisms`
  and `removed` of the lines it replaces, so who ever wrote a file, and a repair
  once met with the mechanism it added, outlive later versions of it (M212–214,
  M237, M276–281). A receipt names files within its folder, so a
  folder code moves keeps its receipt. Git keeps every earlier receipt that
  was committed (M242–243).
- **Union merge.** The `.gitattributes` of [§copies](door.md#copies) gives
  receipts git's union merge, so a merge keeps both sides' lines and a file may
  then have several (M244–245). Lines are read as a set: their order means
  nothing and a line twice is one line. A line that does not parse in this form
  is ignored, makes the receipt `change:<path>` ([§change](door.md#change)), and
  is left out when Forma next writes the receipt.
- **A file's entry.** A file is accepted when its folder's receipt has a line
  whose `file` is its name and whose `sha256` is that of its bytes. That line is
  its entry; of several, the latest by `at`, then the first in byte order. A
  file with no entry counts for nothing ([§change](door.md#change); M238). Where
  a merge left several lines for one file, the `authors`, `answers` and
  `mechanisms` of the file are those of all its lines together, and Forma's next
  write of the line joins them.
- **A model's authors**, whom no explanation of its surprises may come from
  (M237), are the authors of its `model.md` and of each of its engine files,
  every line of each counted as the bullet above says; for a lifecycle model, of
  its part's confirmed lifecycle pages
  ([models.md §lifecycle-model](models.md#lifecycle-model)). A slot's line is in its own
  folder's receipt, so a session that wrote only slots is no author.
- **Strikes.** A model's action table holds a row for each unstruck misbehaviour,
  so its acceptance rests on the strikes then in force (M96–98).
  [forms.md §menu](forms.md#menu) reads the strikes
  on the entry of a model's `model.md`, for what a strike withdrawn since makes of
  the model.
- **Slot pins.** A slot is owed again when an entry its entry lists has another pin
  now, even if its file is unchanged; which entries, and the rest, are
  [models.md §slot-currency](models.md#slot-currency)'s
  (M176–177).
- **A redirect** writes its page's line with `decision`, so the page counts as
  accepted (M220–222).

<a id="sessions"></a>

## Sessions

- **A session** is what an agent declares with `--provider`, `--model` and
  `--session`; two are one session when all three are equal. Forma records it as
  declared and cannot check it (M189, M286).
- **Sessions seen.** `work/sessions.json` ([§scratch](door.md#scratch)) lists
  every session that has submitted an answer on this machine, accepted or
  refused ([§forma-answer](door.md#forma-answer)) (M189, M239–240).
- **Has submitted an answer**: a session that a receipt line in the project
  names, as its `session` or in its `authors` ([§receipts](door.md#receipts)),
  or that `work/sessions.json` on this machine lists.
  [decisions.md §who-decides](decisions.md#who-decides) refuses a decision from
  such a session (M189).
- **The answer side.** An answer from a session that has made a decision, one a
  decision in the project names as its session
  ([decisions.md §decision-file](decisions.md#decision-file)), is refused
  ([§forma-answer](door.md#forma-answer)). Whenever the project is read, a file
  whose entry's `session` is such a session counts for nothing, shown as
  `change:<path>` with the reason; the decision stands (M247–249).
- **Across clones** the rule holds once decisions are merged. A session known only
  by answers refused is known only on the machine where it submitted (M189).

<a id="spent"></a>

## The allowance spent

The allowance is what the intake and every allowance give: a number of answers,
a number of engine runs, and each engine's limits for one run, as
[decisions.md §intake](decisions.md#intake) totals them (M191–192, M219). What
is spent is counted in `work/spent.json` ([§scratch](door.md#scratch)) on each
machine: a clone, or a machine whose `work/` was deleted, starts with nothing
spent, and what one machine spent is not known to another (M239–240, M286).

- An answer counts one answer when [§forma-answer](door.md#forma-answer) counts
  it, accepted or refused (M239–240).
- A run counts one run when it starts
  ([evidence.md §forma-run](evidence.md#forma-run)), a reduction's and a weaker form's
  included (M148, M191–192, M233). A run counts nothing when its question's
  evidence has a basis that differs from the one it runs on only in the versions
  it names ([evidence.md §versions](evidence.md#versions)), and nor does
  the run `forma give` makes for an Explain item ([§gives](door.md#gives); M233).
- Forma takes an answer only while answers spent are fewer than answers allowed,
  and starts a run that counts only while runs spent are fewer than runs allowed; a
  run that counts nothing starts either way
  ([evidence.md §forma-run](evidence.md#forma-run)). When answers are spent, the items
  an answer would serve go to the developer; when runs are, the runs
  ([account.md §waits](account.md#waits); M239–240).

<a id="scratch"></a>

## Scratch: `work/`

`work/` is scratch, ignored by git through its `.gitignore`
([§copies](door.md#copies)), and only code writes it (M56–60). Deleting it
changes nothing the account says of the record; this machine then starts again
with nothing spent, refused or seen (M56–57, M239–240, M286). A file in it that
does not parse is read as absent, and Forma writes it whole the next time it
writes it. Each file but `work/.gitignore` and those under `work/tmp/` is JSON
in UTF-8 (M59–60); a file under `work/tmp/` holds the bytes of the file being
written, whatever they are, and is renamed into place or removed by the writer
that made it, or by the next writer once the process that made it is not
running.

| Path | Holds | Written by | Read by |
| --- | --- | --- | --- |
| `work/.gitignore` | `*` and a line feed ([§copies](door.md#copies)) | code | git |
| `work/refused/<h>.json` | `{"item": <name>, "refusals": [[<reason>]]}`: the item and the reasons of each refusal of it, oldest first; `<h>` is the first twelve hexadecimal digits of the SHA-256 of the item's name. Deleted when an answer for the item is taken in; one holding another item's name is replaced (M239) | `forma answer` ([§forma-answer](door.md#forma-answer)) | `forma missing` and `forma account` ([account.md §commands](account.md#commands)); `forma give` ([§gives](door.md#gives)) |
| `work/spent.json` | `{"answers": <n>, "runs": <n>}`, what this machine spent ([§spent](door.md#spent)) | `forma answer`; `forma run` ([evidence.md §forma-run](evidence.md#forma-run)) | [§forma-answer](door.md#forma-answer), [§spent](door.md#spent); [account.md §items](account.md#items); [evidence.md §forma-run](evidence.md#forma-run) |
| `work/sessions.json` | `[{"provider", "model", "session"}]`, each once, in byte order of provider, then model, then session ([§sessions](door.md#sessions)) | `forma answer` | [§sessions](door.md#sessions): `forma answer` and `forma decide` |
| `work/lock` | `{"pid": <n>, "at": <time>}`, the writer holding the lock ([§lock](door.md#lock)) | every writer | every writer |
| `work/tmp/` | files being written, named for the process writing them ([§forma-answer](door.md#forma-answer)) | every writer | none |

<a id="lock"></a>

## The writer's lock

One writer at a time on each machine: Forma checks and takes in one answer at a
time, and records one decision or writes one run's results at a time, each against
the project as the one before it left it (M236).

- A command that writes in the project folder holds `work/lock` from before it
  reads what it checks until it has written what follows from it. An engine run is
  not held under the lock; its results are written under it
  ([evidence.md §forma-run](evidence.md#forma-run)). `forma decide` holds it to record
  a decision (M236).
- The lock appears whole in one step: Forma writes it in `work/tmp/` and links it
  to `work/lock`, which fails while a lock is there. A command that finds the lock
  held waits until it is gone. A lock that names no process running on this
  machine is stale, and the next writer removes it (M56–57).
- A command that only reads takes no lock and writes nothing in the project.
  Read while an answer is being taken in, it may show that answer partly
  written; the next read shows it whole (M54, M247).
- So two answers submitted together for one item on one machine are one taken in
  and one refused, the item no longer missing. Across clones there is no lock: two
  clones can each take in an answer for one item, and their merge keeps one side's
  files ([§copies](door.md#copies)).

<a id="read-checks"></a>

## Checks whenever the project is read

Every command reads the project. Whenever it does, it checks each file as this
list says, and puts each accepted page, model file, slot and explanation to the
checks its kind's contract makes of an answer, as the project now stands (M240,
M247–249).

The files, and what they are checked by:

- **under `design/brief/`**: nothing: the developer's documents and sources,
  which agents may write directly (M48, M240)
- **the pages under `design/` outside `design/brief/`
  ([design.md §paths](design.md#paths))**: their receipt
  ([§receipts](door.md#receipts)), then
  [design.md §at-read](design.md#at-read)'s checks
- **each file under a `decisions/` folder of `design/`**: its name
  ([decisions.md §decision-file](decisions.md#decision-file))
- **under `models/`: `model.md`, engine files and slots
  ([models.md §paths](models.md#paths)); explanations and weaker forms
  ([evidence.md §stems](evidence.md#stems))**: their receipt
  ([§receipts](door.md#receipts)), then their contract's checks
- **evidence under `models/`
  ([evidence.md §question-names](evidence.md#question-names))**: its own digest,
  and that its question is the one its path names
  ([evidence.md §own-check](evidence.md#own-check))
- **every `receipt`**: each line parses ([§receipts](door.md#receipts))
- **`design/.gitattributes`, `models/.gitattributes`**: each holds what Forma
  writes there ([§copies](door.md#copies))
- **any other file under `design/` outside `design/brief/`, or under `models/`,
  and anything there that is neither a regular file nor a folder, a symbolic
  link included**: nothing: it is not Forma's, and counts for nothing
  ([§change](door.md#change)) (M240)
- **under `work/`**: as [§scratch](door.md#scratch) says
- **under `runs/`**: as [evidence.md §runs](evidence.md#runs) says
- **anything else in the project folder**: not read, but git, for the diff alone
  (M243–244)

Accepted files are also checked against:

- **the freeze**, as [models.md §freeze](models.md#freeze) states it: a file the
  freeze holds whose bytes are not those an open surprise's basis names counts for
  nothing (M143–147);
- **the session rule**: the answer side of [§sessions](door.md#sessions) (M189);
- **the authors**: an explanation or weaker form whose entry's session is one of
  the authors of its surprise's model ([§receipts](door.md#receipts)) counts for
  nothing (M237).

What fails its receipt, its name, its digest, these three, or a check of its own
form ([design.md §at-read](design.md#at-read) says which of a page's checks are
its own) is `change:<path>` ([§change](door.md#change)). Every other failure at
read is what its contract makes of it, not a change: a citation or reference
that no longer resolves leaves what holds it owed
([design.md §at-read](design.md#at-read)); a model whose rows no longer match
its parts is `model:<model>`, and a slot the model's files no longer accept is
owed again ([models.md §parts-change](models.md#parts-change),
[models.md §slot-currency](models.md#slot-currency)).

Checked when an answer is submitted, and never at read: that its item is
missing, the allowance ([§spent](door.md#spent)), the folder's rules
([§answer-holds](door.md#answer-holds)), and what
[models.md §model-answer](models.md#model-answer) and
[§slot-answer](models.md#slot-answer) check only then (M236, M239–240,
M247–249). So an answer taken in on another clone spends nothing here and is not
refused here for this machine's allowance.

A file deleted, by hand or by a merge, leaves nothing to check, but a file the
freeze holds ([§change](door.md#change)): it shows only through what rested on
it, an item opening or standing changing, and through git (M240).

<a id="change"></a>

## `change:<path>`

A file that counts for nothing shows as the item `change:<path>`, `<path>` from
the project folder, with every reason ([§forma-answer](door.md#forma-answer))
([account.md §items](account.md#items)). It is:

1. a page, model file, slot, explanation or weaker form with no entry
   ([§receipts](door.md#receipts)): one edited by hand or by an editor, or
   merged from both sides' text, or never taken in (M238). A developer's direct
   edit of a page or a model file is one (M326–329);
2. a page that fails a check of its own form
   ([design.md §at-read](design.md#at-read));
3. an accepted file the freeze, the session rule or the authors discount
   ([§read-checks](door.md#read-checks)); a file the freeze holds that is gone,
   cleared by restoring it ([models.md §freeze](models.md#freeze)); and an
   explanation or weaker form that fails at read a check its answer passed
   ([evidence.md §explain](evidence.md#explain)). Of that section's checks, at
   read its check 2 asks only that `Question` and `Basis` name the surprise of
   its stem, and its check 3 discounts no weaker form that the engine's parser
   cannot check on this machine, for want of its toolchain, until it can;
4. a file under a `decisions/` folder that is no decision
   ([decisions.md §decision-file](decisions.md#decision-file));
5. evidence whose digest fails, or whose question is not the one its path names;
   its question is then missing, as if it had none
   ([evidence.md §own-check](evidence.md#own-check));
6. a receipt holding a line that does not parse ([§receipts](door.md#receipts));
7. `design/.gitattributes` missing while `design/` holds a file outside
   `design/brief/`, or `models/.gitattributes` missing while `models/` holds a
   file, or either holding anything but what Forma writes there
   ([§copies](door.md#copies)); a missing or altered `work/.gitignore` or
   `runs/.gitignore` is no item, since Forma writes it again at its next write
   there, and deleting either folder changes nothing the account says;
8. any other file under `design/` outside `design/brief/`, or under `models/`,
   and anything there that is neither a regular file nor a folder, a symbolic
   link included: not Forma's.

A file that counts for nothing is read as absent: what it holds is no part of the
record, and what rests on it waits until it is restored or answered again, since
Forma keeps no copy (M238). A file that fails only because another counts for
nothing is not itself a change; it waits (M238, M240). What is at `<path>`, and
what it is cleared by:

- **a page**: restoring it, or a Restate answer that holds it
- **a model file**: restoring it, or a Model answer for its model
- **a slot**: restoring it, or an answer for its slot
- **an explanation or weaker form**: restoring it, or an Explain answer for its
  surprise
- **a file the freeze discounts**: the developer's ruling of the surprise, or
  restoring the file it replaced
- **a file the session rule or the authors discount**: restoring the file it
  replaced, or an answer from another session
- **a decision file**: restoring it, or removing what is no decision
- **evidence**: the next run of its question
  ([evidence.md §forma-run](evidence.md#forma-run)), or restoring it
- **a receipt**: Forma's next write of it, or restoring it
- **`.gitattributes`**: Forma's next write in its folder
  ([§copies](door.md#copies)), or restoring it
- **a file not Forma's**: removing it

Whoever keeps the project's history restores a file, from git or wherever they
keep it; Forma restores nothing (M238, M242–244). The answers this list names
are submitted for `change:<path>` ([§answer-holds](door.md#answer-holds)) or for
any item they serve.

<a id="copies"></a>

## Two copies

Two copies of a project meet through git (M242). Whoever runs Forma commits what it
wrote; what nobody commits exists on one machine only (M242–243). Forma never
commits, merges or restores: it reads git only to fetch the earlier copy for the
diff ([account.md §diff](account.md#diff)), and of git's files it writes only
`.gitignore` and `.gitattributes` (M243–244). A project commits `design/` and
`models/`; `work/` and `runs/` stay out by the `.gitignore` Forma writes in each,
so the project's own `.gitignore` needs no line for them (M56).

Whenever Forma writes a file in `design/`, `models/`, `work/` or `runs/`, it first
writes that folder's file below where the file is missing or holds anything else,
so a change to it lasts only until then. Written by code, read by git; each line
ends in a line feed.

`work/.gitignore` and `runs/.gitignore`:

```
*
```

`design/.gitattributes`:

```
* -text -ident -filter -working-tree-encoding
receipt merge=union
brief/** !text !ident !filter !working-tree-encoding !merge
```

`models/.gitattributes`:

```
* -text -ident -filter -working-tree-encoding
*.json -merge
receipt merge=union
```

So git converts no byte of a file Forma wrote; merges no evidence by line, as every
evidence file is JSON ([evidence.md §evidence-file](evidence.md#evidence-file)), and
stops with a conflict whenever both sides changed one; and keeps both sides'
receipt lines. `design/brief/` is left to git's own defaults (M244–245).

**Settling a merge.** A conflict in a file Forma wrote is settled by taking one
side's file whole, never by editing it; a file one side removed and the other
changed, by keeping the removal or the file whole, and its folder's receipt from
the same side (M245–246).

- **a page, model file, slot, explanation, weaker form**
  - Git merges it: line by line
  - Then: one both sides changed and git merged without a conflict holds neither
    side's bytes, so it has no entry and is `change:`
    ([§change](door.md#change)) until one side's file is restored whole
- **a receipt**
  - Git merges it: by union, keeping both sides' lines
  - Then: each file's entry is the line its bytes match
    ([§receipts](door.md#receipts))
- **evidence, a surprise's own file included**
  - Git merges it: not by line
  - Then: the side taken stands, and its question's next run rewrites it when it
    is not current; evidence merged by line anyway fails its digest
    ([§change](door.md#change)). An open surprise is a file of its own, so
    taking one side of its question's evidence never drops it (M143–145). Two
    clones that found one answer at different times hold different times and
    durations, so their evidence conflicts and one side is taken, either being
    right
- **a decision**
  - Git merges it: without conflict, each being a new file under a name of its
    own
  - Then: both sides' are kept; which is in force is
    [decisions.md §in-force](decisions.md#in-force)'s (M224)

After a merge, the checks of [§read-checks](door.md#read-checks) find whatever
it brought in that the record, the freeze or the session rule forbids
(M247–249). What each machine keeps alone does not merge: refusals, the
allowance spent, the sessions seen, the lock and a run in progress stay on their
machine ([§spent](door.md#spent) to [§lock](door.md#lock); M239–240, M286).

<a id="clock"></a>

## The clock rule

Forma writes nothing while a tracked time is more than a minute ahead of its
clock, so no time it writes is more than a minute before one the record holds
(M52, M224). A tracked time is one Forma wrote into the record: a receipt line's
`at` ([§receipts](door.md#receipts)), a decision's `At`
([decisions.md §decision-file](decisions.md#decision-file)) and each time
evidence holds ([evidence.md §keys](evidence.md#keys)), in a receipt line that
parses, a decision read under its own name, or evidence whose digest holds.

- Before it writes anything in the project folder, a command compares the latest
  tracked time with the machine's clock. More than sixty seconds ahead, the command
  is refused, naming the file and the time, and writes nothing: not in the record,
  not in `work/`, not in `runs/`.
- A command that only reads still reads, and says which time is ahead.
- Each time this contract writes is the machine's clock in UTC to the millisecond,
  `YYYY-MM-DDTHH:MM:SS.sssZ` (M52).
