# The project tree

Paths are relative to the project folder. Forma creates each folder the first
time it writes there. The binding tree, with the owner of every path, is
[project.md §tree](../../spec/project.md#tree).

```
<project>/
  design/                         tracked
    README.md                     the part list and the reading order
    receipt  .gitattributes       what Forma took in here; how git merges it
    brief/                        your documents; brief/sources/ for sources, with provenance
    decisions/                    decisions on the project as a whole
    parts/<part>/
      README.md                   the part's name and reading order
      actions.md                  its actions
      boundary.md                 its boundary rows and surface
      omissions.md                what of the brief it deliberately leaves out
      receipt
      decisions/                  decisions on what has no folder of its own
      lifecycles/<key>/  journeys/<key>/  claims/<key>/  premises/<key>/  choices/<key>/
        README.md  receipt  decisions/
    spans/<span>/                 claims and journeys about several parts
      README.md  receipt  decisions/
      journeys/<key>/  claims/<key>/
        README.md  receipt  decisions/
  models/                         tracked
    .gitattributes
    <model>/
      model.md  <engine files>  receipt
      phases.<digest>.json  facts.<digest>.json   the model's phases and facts evidence
      parts/<part>/<kind>/<key>/  slots, evidence, surprises and their stems, receipt
      spans/<span>/<kind>/<key>/  the same
      actions/<part>/<action>.<digest>.json       each action's enabled evidence
      world/<part>/<row>/         misbehaviour witnesses, their evidence, each
                                  misbehaviour's enabled evidence, receipt
  work/                           this machine's scratch, ignored by git
  runs/                           each run's inputs and engine output, ignored by git
```

## Files and their forms

| Path | Form |
| --- | --- |
| `design/README.md`, a part's or span's `README.md` | [forms.md §front-pages](../../spec/forms.md#front-pages) |
| `actions.md`, `boundary.md`, `omissions.md` | [forms.md §part-tables](../../spec/forms.md#part-tables) |
| a thing's `README.md` | [forms.md §thing-pages](../../spec/forms.md#thing-pages) |
| a decision | [decisions.md §decision-file](../../spec/decisions.md#decision-file) |
| a `receipt` | [door.md §receipts](../../spec/door.md#receipts) |
| `model.md` and engine files | [engines.md §model-md](../../spec/engines.md#model-md) |
| a slot | [models.md §slots](../../spec/models.md#slots), [engines.md §slot-forms](../../spec/engines.md#slot-forms) |
| an evidence file | [evidence.md §evidence-file](../../spec/evidence.md#evidence-file) |
| a surprise and its stem | [evidence.md §stems](../../spec/evidence.md#stems) |

## Names

A thing's key is its folder's name: lowercase letters, digits and single
hyphens, beginning with a letter and ending with no hyphen, as
`[a-z][a-z0-9]*(-[a-z0-9]+)*`
([forms.md §page-rules](../../spec/forms.md#page-rules)). A span folder's key is
a name of its own; the computed span of two parts, `<part>+<part>`, is no
folder. An evidence file is named by its question's kind and, on TLC and Alloy,
the digest of its bounds: `base.<digest>.json`, `witness-<key>.<digest>.json`,
`path.<digest>.json`; on a lifecycle model there is no digest, as `base.json`
and `lifecycle-path.json`. A surprise's file shares its question's name, with
`.surprise-<twelve hex digits>.json`.
