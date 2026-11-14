# Respond to a change in the brief

You edit the brief directly; it is yours. Forma reads it as it stands, and
works out what the change touches from the passages' hashes
([design.md §passages](../../spec/design.md#passages)).

1. Commit the project as it stands, so you can compare after. Then edit or add
   documents under `design/brief/`. Give new concerns headings of their own.

2. See what the change owes:

   ```bash
   forma missing
   ```

   What you see depends on the edit:

   | Edit | Shows as |
   | --- | --- |
   | rewrapping lines outside fenced code | nothing: no hash changes |
   | a new heading at the end of a document, or just before another heading | `passage:<address>`, uncovered, for an agent's Restate answer |
   | a new heading inside a section | the same, and the section before it is cut short there, so its hash changes too, as a changed passage |
   | a changed passage, still at its address | no `passage:` item, since what cites it still covers it. Every entry citing it, and every omission naming it, reads at a new pin, so what is pinned to them lapses (below) |
   | a renamed heading | `passage:<old address>`, unresolved, and `passage:<new address>`, uncovered. Every entry citing the old address reads `missing` in its pin, so what is pinned to it lapses now, and its pins change again once a Restate answer cites the new address |
   | a removed passage | `passage:<address>`, unresolved, while an entry still cites it |

   A new heading whose text matches a later heading in the same document takes
   the plain slug, and the later one moves to `-1`. Unlike a rename, the plain
   address still resolves, to the new passage: entries citing it now cite the new
   heading's text and read at a new pin, and no `passage:` item says so; the
   moved passage shows as `passage:<address>-1`, uncovered. Give a new heading
   text no other heading in the document has.

   The decisions pinned to what changed lapse
   ([decisions.md §in-force](../../spec/decisions.md#in-force)):

   - the confirmations of the units holding those entries and omissions,
     `confirm:` lapsed; when the part list cites the passage, `confirm:parts`
     lapses, and every other confirmation waits for it again;
   - declines of those units: a lapsed decline counts as met, and the unit is
     owed a confirmation;
   - the picks of choices citing it, `pick:`;
   - the carries of premises citing it, and of the bounds of claims citing it,
     `carry:` lapsed;
   - the acceptances of the risk of claims citing it. No item asks for an
     acceptance again, except `express:` for a claim no model covering it can
     express: accept again yourself, if you still mean it;
   - a `brief` decision naming the passage as stating a mechanism, `brief:`
     lapsed;
   - carries whose basis claim cites it, until that claim is confirmed and
     established again;
   - a kept journey citing it, which its ruling no longer confirms: it is owed
     a `confirm:`.

   The intake, allowances and rulings never lapse. Decisions on what did not
   change stay in force, but a carry counts only while its basis claim is
   established.

3. Run agents on the `passage:` items first ([run agents](run-agents.md)), with
   a scope such as:

   > Supply the `passage:` items in one Restate answer: cite the new addresses
   > where the old ones are cited, and restate what the changed passages change.
   > Answer no `slot:` item.

   Wait for it before anything else. Until it is taken in, the pins of what it
   rewrites will change again, so a confirmation, carry or slot made sooner is
   spent for nothing.

4. Decide again what lapsed: confirm, pick, carry, accept and make the `brief`
   decisions again, each shown with what changed since you last decided: the
   lines lost and gained, and how many read as they did.

   ```bash
   forma show confirm orders/stated
   forma decide confirm orders/stated --shown <token> --by "Your Name"
   ```

   If a changed passage means the restatement should change, decline the unit
   with why; its words go to an agent as a repair
   ([confirm the restatement](confirm-the-restatement.md)). A journey Forma
   offered and you confirmed keeps the citations it was confirmed with: when it
   cites a renamed heading, decline it, and Forma offers it afresh with the
   lifecycle's citations as they read now.

5. Let agents refill the slots owed again. A slot written for an entry whose pin
   changed is owed again, though its file is unchanged, and its questions are not
   asked until it is current: `forma missing` lists it as `slot:`, owed again.
   An agent may answer with the same text if it still holds
   ([models.md §slot-currency](../../spec/models.md#slot-currency)).

6. Run what is owed:

   ```bash
   forma run
   ```

   Evidence whose inputs changed is not current and runs again; evidence of what
   did not change stays current and runs nothing.

To compare with the commit you made in step 1, name it:

```bash
forma diff <that commit>
```

`HEAD` names it only while you have committed nothing since.

With no argument, `forma diff` compares with the commit that added your latest
decision, and refuses while that decision's file is in no commit yet; name a
commit or a folder then ([account.md §diff](../../spec/account.md#diff)).

A heading that a kept journey cites, the must-not journey a `model wrong` ruling
keeps, cannot be renamed cleanly: the kept journey keeps citing the old
address, and no answer can change it. Keep that heading's text.
