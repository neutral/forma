# The project

Spells out [SPEC.md](SPEC.md) for the project: what its folder holds and which
contract owns each path, the words the contracts share, the rules every `forma`
command follows, and the explorer. `M<n>` is line n of [SPEC.md](SPEC.md).

<a id="tree"></a>

## The tree

Paths are relative to the project folder ([§commands](project.md#commands)).
Nothing need exist in it: Forma creates each folder when it first writes there.

```
<project>/
  design/                                      tracked
    README.md  receipt  .gitattributes          the part list and the reading order
    brief/                                      the developer's documents; brief/sources/ with provenance
    decisions/                                  decisions on the project as a whole
    parts/<part>/
      README.md  actions.md  boundary.md  omissions.md  receipt
      decisions/                                decisions on what has no folder of its own
      lifecycles/<key>/  journeys/<key>/  claims/<key>/  premises/<key>/  choices/<key>/
          README.md  receipt  decisions/
    spans/<span>/
      README.md  receipt  decisions/
      journeys/<key>/  claims/<key>/
          README.md  receipt  decisions/
  models/                                      tracked
    .gitattributes
    <model>/
      model.md  <engine files>  receipt
      phases.<d>.json  facts.<d>.json
      parts/<part>/<kind>/<key>/                slots, evidence, surprises and their stems, receipt
      spans/<span>/<kind>/<key>/                the same
      actions/<part>/<action>.<d>.json
      world/<part>/<row>/                       misbehaviour witnesses, their evidence, receipt
  work/                                        scratch, ignored by git
  runs/                                        scratch, ignored by git
```

Each path, the contract that owns it, and for a page or a model file where its
form is given:

- **`design/brief/**`**: [design.md §brief](design.md#brief)
- **`design/README.md`, a part's or span's `README.md`**:
  [design.md §paths](design.md#paths); its form,
  [forms.md §front-pages](forms.md#front-pages)
- **`actions.md`, `boundary.md`, `omissions.md` of a part**:
  [design.md §paths](design.md#paths); their forms,
  [forms.md §part-tables](forms.md#part-tables)
- **a thing's `README.md`**: [design.md §paths](design.md#paths); its form,
  [forms.md §thing-pages](forms.md#thing-pages)
- **every `decisions/` folder and its files**:
  [decisions.md §decision-file](decisions.md#decision-file)
- **every `receipt`**: [door.md §receipts](door.md#receipts)
- **`models/<model>/model.md` and engine files**:
  [models.md §paths](models.md#paths); their forms,
  [engines.md §model-md](engines.md#model-md)
- **slots under `models/`**: [models.md §slots](models.md#slots); their forms,
  [engines.md §slot-forms](engines.md#slot-forms)
- **evidence, surprises and the files sharing their stems under `models/`**:
  [evidence.md §names](evidence.md#names)
- **`runs/**`**: [evidence.md §runs](evidence.md#runs)
- **`work/**`**: [door.md §scratch](door.md#scratch)
- **`design/.gitattributes`, `models/.gitattributes`, `work/.gitignore`,
  `runs/.gitignore`**: [door.md §copies](door.md#copies)

Deleting `work/` and `runs/` changes nothing the account says (M56–58). Running
`forma run` a second time, with nothing changed, changes no tracked byte
(M170–171).

<a id="words"></a>

## The words

Each word, and what it means:

- **design**: what the developer's brief describes; `design/` is the folder
  that holds the brief and the restatement's pages
- **page**: one entry of the restatement in a file of its own, or one of a
  part's three table files, or a front page; the explorer's page is its own
  ([§explore](project.md#explore))
- **reading**: what `forma account` prints
  ([presentation.md §reading](presentation.md#reading)); the explorer's reading
  is what its page shows, derived from the graph
  ([presentation.md §explorer](presentation.md#explorer))
- **thing**: a lifecycle, journey, claim, premise or choice: an entry with a
  folder
- **journey**: the restatement's entry that should happen or must not (M71);
  also how a trace is shown; an offered journey is one the lifecycle tool offers
- **decision**: the developer's record, one file each (M53); a ruling is a
  decision of kind `rule`
- **evidence**: what one question's runs found, one file per question (M51)
- **receipt**: the record of what Forma checked and took in, one per folder of
  accepted files, one line per file (M52)
- **surprise**: a question's failure on one basis, a file of its own until the
  developer rules (M143–147)
- **item**: one piece of missing work, as [account.md §items](account.md#items)
  names it (M264–267)

"Finding" names only the verdict *real finding* and what the lifecycle tool
reports.

<a id="commands"></a>

## Commands

Every `forma` command is `forma [--project <folder>] <command> ...`, `--project`
and `--json` taken before or after the command. The project folder is the folder
`--project` names, or else the current folder; every path a contract gives is
relative to it. Every `forma` command:

- reads the project as [door.md §read-checks](door.md#read-checks)
  says, and writes in it only as its contract says, holding the writer's lock
  ([door.md §lock](door.md#lock)) for any write but its `work/.gitignore`, and
  never while the clock rule holds ([door.md §clock](door.md#clock));
- prints text by default, and with `--json` one JSON object, as its contract
  gives it; `forma explore` prints the JSON alone ([§explore](project.md#explore));
- exits with status 0 when it did what was asked, and 1 when it refused, printing
  each reason, each in [door.md §forma-answer](door.md#forma-answer)'s form where
  a check gave it, or with `--json` printing `{"refused": [<reason>, ...]}`
  (M236, M239);
- refuses, printing each reason and writing nothing: no command; an unknown
  command or option; an option given twice or without its value; more arguments
  than the command takes; a `--project` that names no folder.

Each command, and its contract:

- **`forma give <item> <folder>`**: [door.md §forma-give](door.md#forma-give)
- **`forma answer <item> <folder> --provider <name> --model <name> --session <id>`**:
  [door.md §forma-answer](door.md#forma-answer)
- **`forma run`**: [evidence.md §forma-run](evidence.md#forma-run)
- **`forma show <kind> [<on>]`**:
  [decisions.md §forma-show](decisions.md#forma-show)
- **`forma decide <kind> [<on>] ...`**:
  [decisions.md §forma-decide](decisions.md#forma-decide)
- **`forma missing`**: [account.md §commands](account.md#commands)
- **`forma account [<part, span or thing>]`**:
  [account.md §commands](account.md#commands)
- **`forma box`**: [account.md §box](account.md#box)
- **`forma diff [<commit or folder>]`**: [account.md §diff](account.md#diff)
- **`forma explore --json`**:
  [account.md §explorer-graph](account.md#explorer-graph),
  [§explore](project.md#explore)

Two other commands come with Forma and follow rules of their own:
`forma-toolchain`, which fetches the engines and reads no project
([evidence.md §toolchain](evidence.md#toolchain)), and `forma-explorer`
([§explore](project.md#explore)).

<a id="explore"></a>

## The explorer

`forma explore --json` prints the graph of
[account.md §explorer-graph](account.md#explorer-graph) and exits; without
`--json` it refuses, naming that form. Forma serves no page of its own. The
explorer is a separate app, `forma-explorer`, that reads the graph through
Forma's own code and shows
[presentation.md §explorer](presentation.md#explorer)'s page. It depends on
Forma; Forma does not depend on it. Neither `forma explore` nor the explorer
takes an answer, makes a decision or runs an engine (M37–38, M54, M322–324).

**Serving.** `forma-explorer serve [--project <folder>] [--port <port>]` serves
the page for one project on `127.0.0.1`. The project defaults to the folder
the command is run from. It prints its launch URL as soon as it listens, with a
fresh, unpredictable token in the URL fragment; the page sends that token with
each data read. Only the serving loopback origin and host are allowed, only GET,
and no cross-site request; no project data is served without the token. The
default port is chosen by the OS; `--port` names an integer from 1 to 65535. The
page's script and style are the app's built files, served as they are, and hold
no project data. Stopping the command closes its server and its workers
(M54, M238–240, M247–249).

The server offers three reads. `status` gives the generation and time of the
reading it holds, whether it is computing another, and its last failure. `sheet`
names a standing, `recorded` or `here`, the graph's two modes
([account.md §explorer-graph](account.md#explorer-graph)), and gives that
standing's sheet: everything the page shows before a name is opened. `thing`
names a standing, the name to open and the generation of the sheet the page
holds, and gives what that name opens in that generation, so what opens never
differs from the sheet it opens on; a generation no longer kept answers that it
is gone. `sheet` and `thing` name their generation in the `Forma-Generation`
response header. Until a first reading exists a `sheet` or `thing` read answers
that one is pending, or, after a failure, the failure. The server computes a
reading when it starts, and again whenever the project's inputs or the versions
it is judged by change. A reading is replaced only by a complete later one: a
computation that fails keeps the reading before it, and `status` reports the
failure. Other methods, reads and paths are refused (M54, M162–185, M269–286).

**The read index.** The explorer may keep its readings in an SQLite file in the
operating system's local cache, under
`forma/explorer/<SHA-256 of the canonical project path>/reading.sqlite`, never
inside the project. A reading is stored whole, in one transaction, under its
generation, which names the complete input set and the versions it was
computed with; it is served again only for the same generation, so a project
whose inputs are unchanged is read without computing. The latest two
generations are kept. The file names its application and its schema version;
one of another version is rebuilt, never read. While
[door.md §clock](door.md#clock)'s rule holds a tracked time ahead, or the cache
cannot be written, the index is kept in memory. Deleting the file loses nothing
(M54, M56–60, M238–240).

**Export.** `forma-explorer export [--project <folder>] <folder>` writes a
self-contained `index.html`: the page's script and style, and both standings'
readings with the generation, the input hashes, the versions and the
computation time. It opens directly from disk and makes no network request.
Standing here is the exporting machine's at that computation time. No
credential or machine path is in it; source text remains as written. The folder
is new or empty and outside the project; no existing file is overwritten. The
clock rule is checked before and after computing (M54, M166–185, M269–286).

Each of the two refuses, printing each reason and writing nothing in the
project: no command; an unknown command or option; an option given twice or
without its value; an argument the command does not take, or `export` without
its folder; a `--project` that names no folder; an invalid or unavailable port;
an export destination inside the project, nonempty or unwritable; and a missing
build of the app's page, naming the command that builds it. Export also refuses
a graph that cannot be computed; serving instead keeps running and reports it,
as above (M54, M238–240, M269–286).
