# Commands

Every command is `forma [--project <folder>] <command> …`, on the folder
`--project` names or the current one, `--project` and `--json` taken before or
after the command. It exits 0 when it did what was asked and 1 when it refused,
printing every reason; with `--json`, one JSON object, and on refusal
`{"refused": [<reason>, …]}`. `forma answer` is the one exception: an answer
it checked and refused still prints its full object, with `accepted` false and
every reason under `reasons`; `{"refused": […]}` is only for an answer refused
before it counts (an unknown, repeated, missing or empty argument, a folder that
is not a folder, the clock rule, the allowance spent)
([presentation.md §answer-output](../../spec/presentation.md#answer-output)).
A command that writes in the project holds the writer's lock, and one that only
reads writes nothing. No command writes while a tracked time is more than a
minute ahead of this machine's clock
([project.md §commands](../../spec/project.md#commands)).

| Command | Does | Contract | Prints |
| --- | --- | --- | --- |
| `forma give <item> <folder>` | writes the packet for one item of missing work into an empty folder outside the project | [door.md §forma-give](../../spec/door.md#forma-give) | [§give-output](../../spec/presentation.md#give-output) |
| `forma answer <item> <folder> --provider <name> --model <name> --session <id>` | checks the folder's files as the answer for the item, and takes them in with receipt lines, or refuses with every reason | [door.md §forma-answer](../../spec/door.md#forma-answer) | [§answer-output](../../spec/presentation.md#answer-output) |
| `forma run` | runs, on this machine, every question owed a run, within the runs left, and writes evidence and surprises | [evidence.md §forma-run](../../spec/evidence.md#forma-run) | [§run-output](../../spec/presentation.md#run-output) |
| `forma show <kind> [<on>] [--words <text> \| --from <file>]` | shows a decision before it is made, with a token except for `intake` and `allow` | [decisions.md §forma-show](../../spec/decisions.md#forma-show) | [§show-output](../../spec/presentation.md#show-output) |
| `forma decide <kind> [<on>] [<option> …]` | records a decision; see [decision kinds](decisions.md) for the options | [decisions.md §forma-decide](../../spec/decisions.md#forma-decide) | [§decide-output](../../spec/presentation.md#decide-output) |
| `forma missing` | lists every item of missing work, who supplies it and what it waits for, with this machine's allowance and refusals beside it | [account.md §commands](../../spec/account.md#commands) | [§missing-output](../../spec/presentation.md#missing-output) |
| `forma account [<part, span or thing>]` | prints the reading, for the project, a part or span, or one thing as `<part or span>/<kind>/<key>` | [account.md §commands](../../spec/account.md#commands) | [§reading](../../spec/presentation.md#reading) |
| `forma box` | prints the box: each claim that leaves Forma, with its bounds and premises | [account.md §box](../../spec/account.md#box) | [§box-output](../../spec/presentation.md#box-output) |
| `forma diff [<commit or folder>]` | compares the account now with an earlier copy: a commit, a folder, or by default the commit that added the latest decision | [account.md §diff](../../spec/account.md#diff) | [§diff-output](../../spec/presentation.md#diff-output) |
| `forma explore --json` | prints the graph, with standing here and as recorded | [account.md §explorer-graph](../../spec/account.md#explorer-graph) | [project.md §explore](../../spec/project.md#explore) |

The explorer is a separate app, `forma-explorer`. It reads the graph Forma
computes, and what its page shows is in
[presentation.md §explorer](../../spec/presentation.md#explorer); see
[Explore a project](../how-to/explore-a-project.md).

| Command | Does | Contract |
| --- | --- | --- |
| `forma-explorer serve [--project <folder>] [--port <n>]` | serves the page on `127.0.0.1` and prints its launch URL | [project.md §explore](../../spec/project.md#explore) |
| `forma-explorer export [--project <folder>] <folder>` | writes a self-contained `index.html` into a new or empty folder outside the project | [project.md §explore](../../spec/project.md#explore) |

The toolchain has a command of its own, which reads no project; see the
[toolchain reference](toolchain.md).

| Command | Does | Contract |
| --- | --- | --- |
| `forma-toolchain` | fetches the pinned toolchain into its folder, checking each file's size and SHA-256, and unpacks the Java runtime | [evidence.md §toolchain](../../spec/evidence.md#toolchain) |

## Who runs what

| Who | Commands |
| --- | --- |
| an agent doing the work | `give` and `answer`; `missing` and `account` to read; `run` only where its scope says |
| you, holding the developer's role | `show` and `decide` |
| anyone | `run`, `missing`, `account`, `box`, `diff`, `explore`, `forma-explorer` and `forma-toolchain` |

A session that has answered is refused by `decide`, and a session that has
decided is refused by `answer`.
