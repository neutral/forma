# Recover from a `change:` item

`change:<path>` means a file counts for nothing. The account is computed as if
the file were absent, and what rests on it waits until it is restored or answered
again ([door.md §change](../../spec/door.md#change)). A file that fails only
because another file counts for nothing is no change itself; it waits.

1. Read why:

   ```bash
   forma missing --json
   ```

   The item's `found` gives every reason. A file counts for nothing when:

   - its bytes match no receipt line: edited by hand or by an editor, merged
     from both sides' text, or never taken in through an answer;
   - it is a page that fails a check of its own form, or an explanation or weaker
     form that fails at read a check its answer passed;
   - the freeze holds it and it changed or is gone, or it is an engine file or a
     slot of the frozen claim added while a surprise is open;
   - its current version was written by a session that has made a decision, or
     it is an explanation or weaker form whose current version was written by
     one of the model's authors;
   - it is in a `decisions/` folder and is no decision, a folder included;
     evidence whose digest fails, or whose question is not the one its path
     names; or a receipt with a line that does not parse;
   - it is `design/.gitattributes` or `models/.gitattributes`, missing while its
     folder holds a file Forma reads (outside `design/brief/`, for `design/`),
     or holding anything but what Forma writes there;
   - it is not Forma's: any other file under `design/` outside the brief, or
     under `models/`, a symbolic link included.

   While it lasts, the unit a page belongs to reads without it, so the unit's
   confirmation is not in force, and what refers to the page reads `missing` in
   its pin ([design.md §at-read](../../spec/design.md#at-read)). Restoring the
   file brings the same pins back, and with them the same decisions, with no new
   one.

2. Choose how to clear it:

   - **Restore it**, if the change was a mistake:

     ```bash
     git restore <path>                                    # an edit not yet staged
     git restore --source=HEAD --staged --worktree -- <path>   # an edit staged, not committed
     git restore --source=<commit> -- <path>                # an edit committed: from the last commit whose file matched
     ```

   - **Answer for it**, if the change was wanted. The answer is of the kind
     that holds the file, and holds what that kind holds
     ([door.md §answer-holds](../../spec/door.md#answer-holds)):

     | The file | The answer holds |
     | --- | --- |
     | a page | the page at its project path, as a Restate answer |
     | `model.md` or an engine file of a TLC or Alloy model | `models/<model>/model.md` and every engine file of the model, the changed one as it should read: an engine file left out is removed |
     | a slot | the one slot file at its project path |
     | an explanation or weaker form | `explain.md`, and its `weaker/<key>.<ext>`, at the top of the answer folder; Forma files them beside the surprise |

     An agent asks for the item's packet into a folder of its own, outside the
     project, writes its answer into a second, empty folder, and submits that
     second folder:

     ```bash
     cd ~/agents/w01
     ./forma give "change:<path>" packet-2
     # write answer-2/… as the table says
     ./forma answer "change:<path>" answer-2 --provider <p> --model <m> --session <s>
     ```

     Use folders not used before: `give` writes only into an absent or empty
     folder. The packet holds the project files the item rests on, `item.json`,
     the contracts and the base pages; never submit the packet folder itself.

   - **Remove it**, if it is a stray file no answer can hold.

   - **Let Forma rewrite it**, for what Forma writes itself: evidence clears at
     the next run of its question, a receipt at Forma's next write of it, and a
     `.gitattributes` file at Forma's next write in its folder.

3. If the reason is the freeze, the ruling of the surprise that holds the file
   lifts that reason; a file whose bytes also match no receipt line stays a
   change until it is restored or answered for. If the reason is the session
   rule or the authors rule, restore the file it replaced, or have a different
   session answer for it.

To say a claim in your own words, do not edit its page: restore it, then
redirect the claim ([confirm the restatement](confirm-the-restatement.md)). A
redirect is refused while the page holds the hand edit.

Your own documents under `design/brief/` never show as `change:`: you edit them
directly.
