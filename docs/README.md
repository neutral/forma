# Forma documentation

Forma examines the claims of a software design with formal methods, at the
design level. You write the design, the brief, in your own terms. Agents
restate it in fixed forms and model it, and nothing rests on their word: Forma
checks or refuses each piece of their work, composes every question and puts
it to an engine, TLC, Alloy or its own lifecycle engine. You confirm that the
restatement says what you meant, and rule on what surprises a run. From the
runs and your decisions Forma computes what holds: which claims are
established, within which bounds, on which premises, and what is still open.

These pages are for you, the developer, and for whoever sets up the agents
working with you; agents themselves are given the contracts and the base. The
pages bind nothing. Where a page and a contract in [`spec/`](../spec/SPEC.md)
differ, the contract holds, and a reference entry links to the contract that
binds it, where one does.

## How-to guides

For when you know what you want done.

| Guide | When |
| --- | --- |
| [Set up Forma](how-to/set-up.md) | before your first project |
| [Start a project](how-to/start-a-project.md) | you have a brief to examine |
| [Run agents on the missing work](how-to/run-agents.md) | the project owes work an agent supplies |
| [Confirm the restatement](how-to/confirm-the-restatement.md) | agents have restated your brief |
| [Rule on a surprise](how-to/rule-on-a-surprise.md) | a run found what its question did not expect |
| [Carry premises and accept risk](how-to/carry-premises-and-accept-risk.md) | a claim rests on what no run examines |
| [Respond to a change in the brief](how-to/respond-to-a-brief-change.md) | you edited the brief |
| [Explore a project](how-to/explore-a-project.md) | you want to read the brief with its examination beside it, or a portable snapshot |
| [Read the account and the box](how-to/read-the-account-and-the-box.md) | you want to know where things stand |
| [Recover from a `change:` item](how-to/recover-from-a-change-item.md) | a file counts for nothing |

## Explanation

For when you want to know why Forma works the way it does.

- [What Forma is for, and what it cannot know](explanation/what-forma-is.md)
- [The record](explanation/the-record.md)
- [The door](explanation/the-door.md)
- [Decisions](explanation/decisions.md)
- [Evidence and standing](explanation/evidence-and-standing.md)
- [The box](explanation/the-box.md)
- [The contracts](explanation/the-contracts.md)

## Reference

For looking things up.

- [Commands](reference/commands.md)
- [Items of missing work](reference/items.md)
- [Decision kinds](reference/decisions.md)
- [The project tree](reference/project-tree.md)
- [Settings and allowances](reference/settings.md)
- [The toolchain](reference/toolchain.md)
