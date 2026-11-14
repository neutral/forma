# The contracts

Forma's behaviour is fixed by its specification in [`spec/`](../../spec/SPEC.md).
[SPEC.md](../../spec/SPEC.md) says what Forma is and does, in one document. The
contracts beside it spell it out exactly enough for code to implement without
deciding anything, and each rule of theirs cites the lines of `SPEC.md` it comes
from, as `M<n>`. Agents are given the contracts their work needs in every packet,
under `forma/`.

## What each holds

The record's rules, and how the account is computed from it:

| Contract | Holds |
| --- | --- |
| [project.md](../../spec/project.md) | the project tree, the words, the rules every command follows, and the explorer: serving, the read index and export |
| [design.md](../../spec/design.md) | the brief and passages, where things are filed, units and pins, the Restate answer |
| [decisions.md](../../spec/decisions.md) | who decides, every kind, which decision is in force, rulings and repairs |
| [models.md](../../spec/models.md) | which slots exist, the answers that write models and slots, the freeze, what is owed |
| [evidence.md](../../spec/evidence.md) | questions, running, the evidence file, currency, surprises, explanations |
| [door.md](../../spec/door.md) | give and answer, receipts, sessions, the allowance, scratch, the checks at every read |
| [account.md](../../spec/account.md) | standing, items, what the basis line and the box hold, the diff, what it cannot know, and the graph `forma explore --json` prints |

The shapes of pages, engines, the lifecycle tool and output:

| Contract | Holds |
| --- | --- |
| [forms.md](../../spec/forms.md) | the form of every page: the shared rules, the part's tables, the thing pages, the premises code adds, the misbehaviour menu |
| [engines.md](../../spec/engines.md) | how each engine is driven: engine text, slot forms, composition, traces |
| [lifecycle-tool.md](../../spec/lifecycle-tool.md) | the lifecycle tool: stepping, shortest journeys, findings |
| [presentation.md](../../spec/presentation.md) | what Forma shows and prints, and the explorer's page |

## Where your own judgment comes in

The page forms, the misbehaviour menu and the store isolation table are the
shapes Forma describes a system in. Your problem may need a shape they do not
have: a boundary they cannot draw, a kind of store they do not list, a
lifecycle that does not fit a phase table. Where it does, you and your agents
decide how to say it in the forms there are.
