# forma

The `forma` command, which keeps a project's record and computes its account,
and `forma-toolchain`, which fetches the engines it runs. What each command does
and refuses is in the contracts under [spec/](../../spec/SPEC.md), which the
code implements. The [commands reference](../../docs/reference/commands.md)
lists every command with the contract that binds it.

## Run it

From the repository's root, after `pnpm install`:

```bash
pnpm toolchain
pnpm forma --project <project folder> missing
```

`pnpm toolchain` fetches the pinned Java runtime, TLC and Alloy once; see
[Set up Forma](../../docs/how-to/set-up.md). Every command takes
`--project <folder>`, or works on the current folder.

## The code

| Path | Holds | Contract |
| --- | --- | --- |
| `src/cli.mjs` | the command line: options, refusals, and each command handed to its module | [project.md §commands](../../spec/project.md#commands) |
| `src/record/` | reading the record: the project tree, the brief and its passages, pages, models, decisions, evidence, receipts and pins | [project.md](../../spec/project.md), [design.md](../../spec/design.md), [forms.md](../../spec/forms.md) |
| `src/design/` | the restatement: Restate answers, re-filing, what code adds, and the lifecycle tool | [design.md](../../spec/design.md), [lifecycle-tool.md](../../spec/lifecycle-tool.md) |
| `src/door/` | `forma give` and `forma answer`, repairs, receipts, sessions, the writer's lock and the allowance spent | [door.md](../../spec/door.md) |
| `src/decisions/` | `forma show` and `forma decide` | [decisions.md](../../spec/decisions.md) |
| `src/evidence/` | questions, composing and running them on TLC, Alloy and the lifecycle engine, currency, surprises and explanations; `forma run` | [evidence.md](../../spec/evidence.md), [engines.md](../../spec/engines.md) |
| `src/account/` | standing, items, the reading, the box and the diff; `forma missing`, `forma account`, `forma box`, `forma diff` | [account.md](../../spec/account.md), [presentation.md](../../spec/presentation.md) |
| `src/explore/` | the graph `forma explore --json` prints, which the explorer reads | [account.md §explorer-graph](../../spec/account.md#explorer-graph), [project.md §explore](../../spec/project.md#explore) |
| `src/tlc.mjs`, `src/alloy.mjs`, `src/sany.mjs`, `src/lifecycle-machine.mjs` | driving TLC and Alloy, reading TLA+ through its own parser, and the lifecycle moves the engine and the picture share | [engines.md](../../spec/engines.md) |
| `src/toolchain.mjs`, `src/toolchain.json`, `src/setup-toolchain.mjs` | the pinned toolchain, checked before every run, and `forma-toolchain` | [evidence.md §toolchain](../../spec/evidence.md#toolchain) |
| `src/version.mjs` | Forma's version and the hash of its source | [evidence.md §versions](../../spec/evidence.md#versions) |

Every file under `src/` counts toward that hash. Evidence found by another
build of Forma is not current until its question runs again, so any change here
makes a project's recorded evidence owe a run.

## Tests

```bash
pnpm --filter @forma/cli test
```

Each file under `tests/` checks one contract, or the rules several share, and
names the section each test checks. The whole run takes long; while working on
one contract, run its file alone, from this folder:

```bash
node --test tests/door.test.mjs
```

`tests/fixtures/` holds small project trees, by contract, that the tests build
projects from. Tests that run TLC or Alloy skip when the toolchain is absent.
