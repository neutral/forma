# Decision kinds

Each decision is made with `forma decide <kind> [<on>] [<option> …]`, after
`forma show <kind> [<on>]`, and recorded as a file in the `decisions/` folder of
what it is on. The binding table is
[decisions.md §kinds](../../spec/decisions.md#kinds); the options are
[decisions.md §forma-decide](../../spec/decisions.md#forma-decide)'s.

| Kind | On | Options | Words |
| --- | --- | --- | --- |
| `intake` | the project, once | `--situation`, the allowance, `--cadence`, `--inbox-cap` | what is out of scope and why; required |
| `allow` | the project | any of the allowance and settings | none |
| `confirm` | a unit: `parts`, `<part or span>/stated`, an added action, claim, premise, boundary or surface row, a lifecycle, a journey, an omission ([design.md §units](../../spec/design.md#units)) | `--shown` | none |
| `decline` | a unit | `--shown` | why it is wrong, which goes to an agent as a repair's direction, but for a pick's journey or a kept one, whose decline is met at once; required |
| `pick` | `<part>/choices/<choice>` | `--choice a` or `b`, `--shown` | none |
| `rule` | one or more waiting decisions, by name, separated by commas | `--verdict`, `--level`, `--target` for a real finding, `--basis`, `--shown` | the direction its repairs are given; required |
| `carry` | a premise: `<part>/premises/<key>`, `store:…`, `strike:…`, `bound:…`, `span:…` | `--choice carry` or `withdraw`, `--basis`, `--shown` | for a carry, the falsifier; none for a withdrawal |
| `accept` | `<part or span>/claims/<claim>` | `--choice accept` or `withdraw`, `--shown` | for an acceptance, why its risk is accepted without examination, required; none for a withdrawal |
| `redirect` | a claim, or a new journey `<part or span>/journeys/<key>` | `--words` or `--from <file>`, `--shown` | the claim's new sentence, or the journey's page; required |
| `brief` | `<ruling>/<model>`, the ruling by its file name without `.md` | `--choice stated` or `accepted`, `--shown` | for `stated`, the passages that state the mechanism, one a line, shown with the same `--words`; for `accepted`, why, shown with no words |

Every decision records a name: `--by <name>`, required whenever `--shown`, or
the intake's or an allowance's own options, are given; at a terminal with none
of them, Forma asks for it. A decision takes `--provider`, `--model` and
`--session` for the session that makes it, all three or none. Run anywhere but
at a terminal, as from a script or by an agent, a decision must declare its
session.

## Verdicts and levels

`--verdict`: `model wrong`, `property wrong`, `abstraction too coarse` or
`real finding`. `--level`: `implementation`, `specification` or `requirement`.
A real finding's `--target`: `brief`, a model's key, `premise:<premise>` or
`choice:<part>/<choice>`.
