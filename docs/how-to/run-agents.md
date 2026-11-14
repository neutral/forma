# Run agents on the missing work

Agents supply restatements, models, slots, explanations and repairs. Each works
in a folder of its own and reaches the project only through `forma`. This page
assumes the project at `~/orders`.

1. List what is owed, and pick items an agent supplies:

   ```bash
   forma missing
   ```

   Items read like `passage:…`, `restate:<part>`, `cover:<parts>`,
   `slot:<model>/parts/<part>/claims/<claim>/encoding`, `explain:<surprise>` or
   `repair:<ruling>/<model>`. Each says who supplies it and what it waits for
   ([items reference](../reference/items.md)). Leave alone what waits.

2. Give each agent a folder of its own, outside the project, with a wrapper
   that runs Forma on your project with the toolchain set:

   ```bash
   mkdir -p ~/agents/w01
   cat > ~/agents/w01/forma <<EOF
   #!/bin/sh
   export FORMA_TOOLCHAIN="${FORMA_TOOLCHAIN:-$HOME/Library/Caches/forma/toolchain}"
   exec "$(command -v node)" "$(command -v forma)" --project "$HOME/orders" "\$@"
   EOF
   chmod +x ~/agents/w01/forma
   ```

   The wrapper is written with the absolute paths of Node, Forma, the project
   and the toolchain, so it works whatever the agent's own path and environment
   hold. Start the agent with `~/agents/w01` as its working folder.

   If the agent runs in a sandbox, the Forma process its wrapper starts needs to
   read Forma's own files and the toolchain, run Java, and write the project
   folder, where it takes in accepted files. That access is the agent's too:
   only its standing text keeps it out of the project, and Forma's read checks
   catch accidents, not forgery ([door.md §door](../../spec/door.md#door)). Give
   it nothing else of yours: no private notes, nothing it should not read.

3. Start the agent with the standing text in Forma's
   [`base/session.md`](../../base/session.md): copy the text between its two
   `---` lines and fill in its five placeholders:

   | Placeholder | Fill in |
   | --- | --- |
   | `PROVIDER`, `MODEL` | the agent's provider and model, as it names them |
   | `SESSION` | a name for this session, used by no other, as `w01` |
   | `TOOLCHAIN` | the toolchain's absolute path and what it holds: `/Users/you/Library/Caches/forma/toolchain`, with Java at `jdk-21.0.13+9-jre/Contents/Home/bin/java`, TLC and SANY in `tla2tools-1.7.4.jar`, Alloy in `org.alloytools.alloy.dist-6.2.0.jar` |
   | `SCOPE` | the items, or the part of the work, it is to supply |

   Scopes that work:

   | Work | Scope |
   | --- | --- |
   | the first restatement | Restate the brief: supply every `passage:` item `./forma missing` lists, in one Restate answer. Stop when no item a Restate answer can supply is left that waits for nothing; a `span:` item whose `why` is `no-model` or `unexamined` is not yours. |
   | the first model | Supply the `cover:` item with one TLC or Alloy model that covers every part. Stop when your model is accepted. |
   | slots | Fill slots: every `slot:` item in the missing list, an answer of its own for each. Stop when no `slot:` item that waits for nothing is left. |
   | an explanation | Explain one surprise: supply `explain:<surprise>` in one Explain answer. Supply no other item. |
   | a repair | Repair the model `<model>`: supply `repair:<ruling>/<model>` in one Repair answer. |

   Name no parts in a first restatement's scope: the agent proposes them, and
   you confirm the part list. A restatement's scope also leads the agent to the
   `findings:`, `restate:` and `span:` items a Restate answer supplies. The
   brief is yours: the standing text keeps agents out of the project folder, so
   to have an agent draft a brief document, have it write the document in its
   own folder, and copy it into `design/brief/` yourself.

4. The agent asks for an item's inputs into one folder, writes its answer into
   another, following the paths its answer kind requires, and submits it,
   declaring its session. Restatement and model files use their project paths;
   a Restate answer's `removed.md`, Explain files (`explain.md` and
   `weaker/<key>.<ext>`) and Repair metadata (`repair.md`, and `removed.md`
   where it removes) are relative to the answer folder's top
   ([door.md §answer-holds](../../spec/door.md#answer-holds)):

   ```bash
   cd ~/agents/w01
   ./forma give "passage:design/brief/orders.md#payments" packet
   # the agent reads packet/, then writes answer/design/README.md,
   # answer/design/parts/orders/README.md, and the part's other pages
   ./forma answer "passage:design/brief/orders.md#payments" answer \
     --provider <provider> --model <model> --session w01
   ```

   - A relative folder is read from the current folder, and must lie outside
     the project. `give` writes into a folder that is absent or empty.
   - `give` writes the packet: the files the item rests on, the contracts that
     bind the answer under `forma/`, the base pages under `base/`, and
     `item.json`. A Restate packet holds the whole brief and every page, so one
     Restate answer, submitted for any one `passage:` item, may cover every
     passage: each passage its pages cite leaves the list.
   - The answer folder holds only regular files, at the paths its kind holds: a
     stray file, a link or an empty folder refuses it. On a Mac, delete any
     `.DS_Store` that Finder leaves in it.
   - `answer` prints `accepted` with each file written, or `refused` with every
     reason, each naming the contract section that refused it.

5. When an answer is refused, nothing in the record changes. The agent reads
   each reason's section, corrects every reason at once, and submits again,
   never the same files unchanged:

   - Forma checks the door first: the item is missing and an agent's, the folder
     is outside the project and holds only what its kind holds, the session has
     made no decision, and an explainer wrote none of the model. Only when those
     pass are the answer's own files checked, so a corrected answer can meet new
     reasons.
   - The reasons are kept on this machine only, under the item: `forma missing`
     shows them beneath it, and the next `give`, into a new empty folder,
     returns them in `item.json` under `refused`.
   - Each answer counts one of your allowance, accepted or refused, except one
     refused before it counts: an unknown or repeated option, an argument missing
     or empty, a folder that is not a folder, the clock rule, or the allowance
     spent. When answers run out, the item `allow` appears beside the account;
     allow more with:

     ```bash
     forma decide allow --answers 100 --by "Your Name"
     ```

6. Run what is owed:

   ```bash
   forma run
   ```

   It prints each run as it ends, and opens a surprise for each result that
   answered and does not match its question's expected outcome, unless that
   surprise is already open or ruled on that basis. Runs are owed as soon as a
   TLC or Alloy model is accepted (its rows' `enabled` questions, its `phases`
   question and, on Alloy, its `facts` question), more as its slots are filled;
   and as soon as you confirm a lifecycle and a journey of its part, on the
   part's lifecycle model `lifecycles-<part>`, which needs no Model answer
   ([models.md §lifecycle-model](../../spec/models.md#lifecycle-model)).

7. Repeat. Several agents can work at once on independent items. Forma takes
   answers one at a time under its writer's lock.

- **The first model covers every part.** While no TLC or Alloy model exists, a
  Model answer is accepted only when its model covers every part on the part
  list. A later model may cover fewer parts only while a question on a model it
  splits from has current evidence whose outcome is `unanswered`, or, for a
  model on another engine than every model it splits from, while a claim it
  covers is owed another engine
  ([models.md §one-model-first](../../spec/models.md#one-model-first)).
- **Keep sessions apart.** A session that answers never decides, and a session
  that decides never answers. The agent that wrote a model never explains its
  surprises; on a lifecycle model, neither does the agent that wrote its part's
  confirmed lifecycle pages. Give each agent its own session name.
