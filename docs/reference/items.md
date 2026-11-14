# Items of missing work

`forma missing` lists every item, each with who supplies it and what it waits
for. The binding list, with every case and wait, is
[account.md §items](../../spec/account.md#items).

| Item | Is | Supplied by |
| --- | --- | --- |
| `intake` | no intake yet; nothing else is listed before it but `change:` items | you: intake |
| `passage:<address>` | a brief passage nothing covers (`uncovered`), or a cited address that is no citable passage (`unresolved`), as after a heading is renamed, or for a source without its four provenance fields | agent: restate |
| `restate:<part or span>` | a page of the part or span fails a check of its references or placement, or the part's lifecycle model is flagged, but for a posed cell, which the choice's `pick:` owes | agent: restate |
| `restate:parts` | the part list fails such a check | agent: restate |
| `findings:<part or span>` | the lifecycle tool found what blocks confirming a unit there | agent: restate |
| `confirm:<unit>` | a unit with no confirmation or decline in force (`unconfirmed`), or whose confirmation lapsed (`lapsed`) | you: confirm |
| `pick:<part>/choices/<choice>` | a choice with no pick in force, or whose pick a ruling revoked | you: pick |
| `journey:<part>` | a part a model covers with no confirmed should-happen journey | agent: restate |
| `cover:<parts>` | parts no one model covers; while no TLC or Alloy model exists, one item naming every part, since the first model covers them all | agent: model |
| `model:<model>` | a model owed a Model answer | agent: model |
| `slot:<path>` | a slot not filled, or owed again; `<path>` from `models/`, without its extension, as `slot:<model>/parts/<part>/claims/<claim>/encoding`. A witness or fault the claim does not yet have, whose key the answer gives, is `slot:<model>/parts/<part>/claims/<claim>/witness` or `…/fault`; a further one may be answered at any time | agent: slot |
| `express:<part or span>/claims/<claim>` | a claim no model covering it can express, with no acceptance of its risk in force | agent: model, or you: accept |
| `run:<question>` | a question owed a run: no evidence, not current, larger limits, or a lost surprise | run |
| `run:<surprise>/reduction` | a surprise with a reduction still to run | run |
| `run:<surprise>/weaker-<key>` | a weaker form of an accepted explanation not yet run | run |
| `unanswered:<question>` | current evidence that did not answer at the limits its engine has now; once you allow more, it is `run:` (`larger-limits`) | you: allow, or agent: model |
| `explain:<surprise>` | an open surprise with no accepted explanation | agent: explain |
| `rule:<waiting decision>` | open surprises waiting for your ruling, named by the smallest of their surprises' names | you: rule |
| `repair:<decision>`, `repair:<ruling>/<model>` | a decline or ruling in force whose repair is not met, named by its decision's file name without `.md`; `/<model>` for each model a ruling sends a Repair to | agent: repair |
| `brief:<ruling>/<model>` | a real finding's repair added a mechanism: does the brief state it? | you: brief |
| `carry:<premise>` | a premise a claim rests on, not carried, or whose carry lapsed | you: carry |
| `span:<part>+<part>` | two parts no claim or journey examines together | agent: restate or model, or you: carry |
| `change:<path>` | a file that counts for nothing ([recover from it](../how-to/recover-from-a-change-item.md)) | an agent's answer for it, or anyone restoring or removing it |

Beside the account, marked as this machine's: `allow`, when this machine's
allowance cannot pay for what is missing: no answers left (`answers`), no runs
left (`runs`), or no time or memory for an engine a run needs (`engine`).
Beneath each item, `forma missing` shows the reasons this machine keeps for
answers to it that were refused.
