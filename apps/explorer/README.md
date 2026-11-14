# forma-explorer

The explorer, `forma-explorer`: it reads a Forma project and shows the brief as
written, with what its examination says beside each section. It changes nothing
in the project, takes no answer, makes no decision and runs no engine. What the
page shows is in
[presentation.md §explorer](../../spec/presentation.md#explorer); how it is
served, kept and exported is in
[project.md §explore](../../spec/project.md#explore); and the graph it reads is
in [account.md §explorer-graph](../../spec/account.md#explorer-graph).
[Explore a project](../../docs/how-to/explore-a-project.md) is the guide to
reading with it.

## Run it

From the repository's root, after `pnpm install`:

```bash
pnpm explorer --project <project folder>
```

This builds the page, then serves it on `127.0.0.1`; open the URL it prints. To
write a snapshot that needs no server, into a new or empty folder outside the
project:

```bash
pnpm --filter @forma/explorer export --project <project folder> <folder>
```

## The code

Three parts, each reading only the one before it. The domain decides what the
page shows, in the page's words, from Forma's graph, and adds no standing, cause
or link of its own. The server computes a reading, keeps it and serves it. The
client draws it.

| Path | Holds | Contract |
| --- | --- | --- |
| `src/domain/graph.ts` | the graph as `forma explore --json` gives it, checked where it enters | [account.md §explorer-graph](../../spec/account.md#explorer-graph) |
| `src/domain/reading.ts` | the reading as data: one sheet, and every thing a name on it opens; the one contract between the three parts | [presentation.md §explorer](../../spec/presentation.md#explorer) |
| `src/domain/derive/` | graph to reading: the documents in reading order, the notes, each thing opened, the lists, the top | [presentation.md §explorer](../../spec/presentation.md#explorer) |
| `src/domain/words.ts`, `src/domain/markdown.ts` | the page's words for the record's names, and a passage rendered as written | [presentation.md §explorer](../../spec/presentation.md#explorer) |
| `src/server/cli.ts`, `src/server/args.ts` | the command line: `serve` and `export`, and every refusal | [project.md §explore](../../spec/project.md#explore) |
| `src/server/compute.ts`, `src/server/reading-worker.ts`, `src/server/snapshot.ts` | one computation in a worker of its own: the fingerprint, then the graph and both standings' readings | [project.md §explore](../../spec/project.md#explore) |
| `src/server/holding.ts`, `src/server/serve.ts`, `src/server/http.ts` | the reading held, computed again when the project changes, and the loopback reads that need the launch token | [project.md §explore](../../spec/project.md#explore) |
| `src/server/store.ts`, `src/server/cache.ts` | the read index, in the operating system's cache folder and never in the project | [project.md §explore](../../spec/project.md#explore) |
| `src/server/export.ts`, `src/server/document.ts`, `src/server/page.ts` | the export: the built page with its script, its style and both readings inside one file | [project.md §explore](../../spec/project.md#explore) |
| `src/client/` | the page: the sheet, the notes, opened things, a lifecycle drawn and stepped through, the lists and the help | [presentation.md §explorer](../../spec/presentation.md#explorer) |

The server's `.ts` files run as they are, with Node stripping their types.

## Tests

```bash
pnpm --filter @forma/explorer typecheck
pnpm --filter @forma/explorer test
pnpm --filter @forma/explorer test:browser
```

`test` runs the domain and server tests. The domain's read both examples through
Forma's own graph, kept under `node_modules/.cache/` by the fingerprint of its
inputs, so the first run after a change to an example or to `apps/cli/src`
builds each graph again, which takes minutes. `test:browser` builds the page and
runs it in Chromium against a snapshot of `examples/export-ticket`; install the
browser once with `pnpm --filter @forma/explorer exec playwright install chromium`.
