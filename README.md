# Forma

A software design makes claims: what the system must do, and what it must never
do. Forma examines those claims at the design level, with formal methods, so the
agents that write the code start from a stronger design. You write the design in
your own terms. Coding agents model it, and engines such as
[TLA+](https://lamport.azurewebsites.net/tla/tla.html) and
[Alloy](https://alloytools.org/) search every state the models allow, within
stated bounds, for one where a claim fails.

Agents can write the models. They cannot be the ones to say what the models
showed. So an agent proposes and nothing rests on its word: its forms are fixed,
its work is checked or refused, Forma runs the engines, and a property counts
only once it has caught a defect planted to test it.

You confirm that the restatement says what you meant, and rule on each fault,
shown as steps in your own terms. What holds is computed from the runs and your
decisions: which claims are established, within which bounds, on which premises,
and what is still open.

## Examine your own design

Examining needs Forma's pinned toolchain: a Java runtime, TLC and Alloy, fetched
once. Agents restate, model, explain and repair; you write, confirm, rule and
carry. `forma missing` says at every point what is owed, who supplies it and
what it waits for.

1. [Set up Forma](docs/how-to/set-up.md) and its toolchain.
2. [Start a project](docs/how-to/start-a-project.md) from your brief.
3. [Run agents](docs/how-to/run-agents.md) on the work they supply, as it
   comes due.
4. [Confirm the restatement](docs/how-to/confirm-the-restatement.md) they write.
5. Run the questions: [`forma run`](docs/reference/commands.md) puts every
   question that is owed to its engine.
6. [Rule on each surprise](docs/how-to/rule-on-a-surprise.md) a run turns up.
7. [Carry the premises](docs/how-to/carry-premises-and-accept-risk.md) your
   claims rest on.
8. [Read the account and the box](docs/how-to/read-the-account-and-the-box.md):
   where each claim stands, and what may be said of the software.
9. When the brief changes,
   [respond to the change](docs/how-to/respond-to-a-brief-change.md): the diff
   says what went stale and what changed outcome.

Forma checks that a claim's encoding holds of a model, within the model's
bounds. It cannot check that the model is faithful to your design, or that the
claim you confirmed is the one you needed. It narrows that gap with the journeys
you confirm: each must happen, or be refused, on every model of its parts
before that model's claims count. It never reads code.
[What Forma is for, and what it cannot know](docs/explanation/what-forma-is.md)
says how far each result goes.

For an example to browse, run `pnpm explorer --project examples/export-ticket`
in Forma's checkout after `pnpm install`, and open the URL it prints: a short
design with its examination beside each section, readable without the
toolchain. `examples/paperclip-erp` is a larger one. Everything else is in the
[documentation](docs/README.md).

## Repository

| Path | Holds |
| --- | --- |
| [`apps/cli/`](apps/cli/README.md) | The `forma` and `forma-toolchain` commands |
| [`apps/explorer/`](apps/explorer/README.md) | The explorer, `forma-explorer`, which reads a project and changes nothing in it |
| `spec/` | [SPEC.md](spec/SPEC.md), which says what Forma is and does, and the contracts that spell it out |
| `base/` | What agents are given beside the contracts: how to do the work, and why |
| `docs/` | How-to guides, explanation and reference |
| `examples/` | Two designs, each with the record of its examination |

Forma **0.1.0** runs locally on macOS with Apple silicon and Node 24 or later; a
checkout also needs pnpm.

Original material is available under [CC0 1.0 Universal or 0BSD](LICENSE).
Third-party material keeps [its own terms](THIRD_PARTY.md).
