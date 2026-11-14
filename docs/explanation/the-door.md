# The door

An agent's work enters the record through `forma answer` and, where its scope
says, the runs of `forma run`. It finds its work with `forma missing` and takes
an item's inputs with `forma give` ([door.md §door](../../spec/door.md#door)).
Two commands carry the work:

- `forma give <item> <folder>` writes into an empty folder everything an agent
  needs to supply one item of missing work: the project files the item rests on,
  the contracts that say exactly what an answer must hold, the base pages agents
  lean on, and `item.json`, with the item and every refusal of it kept on this
  machine.
- `forma answer <item> <folder> --provider <name> --model <name> --session <id>`
  submits the files in a folder as the answer, declaring the session.
  Forma checks them against the contracts and takes them in, each with a
  receipt line, or refuses them with every reason, each naming the check by its
  contract and section.

## Why a hand edit counts for nothing

Every file an answer wrote has a receipt line holding its hash. A page, model
file or slot whose bytes match no receipt line counts for nothing: it shows as
`change:<path>` and the account is computed as if it were absent
([door.md §change](../../spec/door.md#change)). So an edit made outside the door
cannot raise standing. To change a file, answer for it, or restore it from git
([recover from a `change:` item](../how-to/recover-from-a-change-item.md)).

These checks catch accidents, not forgery: a file written into the project
together with a matching receipt line would read as Forma's. What keeps that out
is the boundary: agents work in folders of their own and are told to stay out of
the project folder.

Your own documents under `design/brief/` are the exception: they are written
directly, by you or by an agent whose draft you place there, and Forma reads
them as they stand.

## Sessions

Every answer declares the session that made it: provider, model and session. A
session that has answered can never make a decision, and the answers of a
session that has made one count for nothing
([door.md §sessions](../../spec/door.md#sessions)). An explanation of a
surprise is accepted only from a session that wrote none of the model; a
lifecycle model's authors include the sessions that wrote its part's confirmed
lifecycle pages ([door.md §receipts](../../spec/door.md#receipts)). So the
agent that built a model never explains its own surprises, and your decisions
never come from a session doing the work.

## The allowance

The intake allows a number of answers and runs, and the time, and for TLC and
Alloy the memory, that one run of each engine may take. Every answer Forma
checks spends one, accepted or refused; one refused before it counts, for an
unknown, repeated, missing or empty argument, a folder that is not a folder,
the clock rule, or the allowance already spent, spends nothing
([door.md §forma-answer](../../spec/door.md#forma-answer)). What is spent is
counted on each machine. When this machine's allowance cannot pay for what is
missing, the item `allow` appears, beside the account, for you to allow more
([door.md §spent](../../spec/door.md#spent)).

## The freeze

While a surprise is open, these files are frozen, and nothing its question rests
on may be removed or re-filed
([models.md §freeze](../../spec/models.md#freeze)):

- the model's files: for TLC or Alloy, its `model.md` with the bounds and its
  engine files; for a lifecycle model, its part's confirmed lifecycle pages;
- when the surprise is on a claim's question, the claim's slots on that model.

An answer that holds or removes one, or adds an engine file or a slot of that
claim, is refused whatever its bytes until you rule, and a frozen file changed by
other means counts for nothing meanwhile. The other pages a question rests on
may still change through an answer. On a lifecycle model the freeze holds
decisions too: its lifecycles cannot be confirmed or declined, and the choices
whose cells they pose cannot be picked. So a surprise cannot be hidden by
changing what found it.
