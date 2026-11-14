# Shapes: what goes wrong between the steps

The seven questions of [principles.md](principles.md), "Between the steps", as
shapes to look for. Use the list at three moments.

- **Restating.** Ask each shape of each part it could apply to. A shape the
  brief does not mention, on a part it plausibly applies to, is a question for
  the developer. Never assume the answer either way
  ([restate.md](restate.md)).
- **Planting a fault.** Each shape names a mechanism. Taking that mechanism
  away is a ready fault, and the claim it protects must be what catches it
  ([mechanisms.md](mechanisms.md)).
- **Explaining a surprise.** Name the shape. Two surprises of one shape on one
  mechanism are one matter.

## The shapes

| Shape | What happens | What it costs |
| --- | --- | --- |
| double charge or booking from a race | two actors read a resource as free and both commit; a person submitting twice is the same race with one actor | paid twice; a seat, room or name sold twice |
| lifecycle hole | a transition nobody forbade: cancel after shipment, refund of a partial shipment, two statuses at once, a final status left | cancelled and shipped; a refund above what shipped |
| permission gained or lost through a transition | a move, role change or regrant grants what no grant gave, or removes access the holder should keep; a patch can close one half and leave the other | access never granted; owners locked out |
| tenancy leak | an object reachable from two tenants through a chain of relations, or a shared job, queue, replica or failover carrying one tenant's data into another's view | one tenant's data reaches another |
| retry that is not idempotent | a retry at one of three points (before the server, during the work, after the work but before the response) repeats the effect | the operation happens twice |
| webhooks out of order or twice | provider events arrive reordered or duplicated; a receipt written as replace lets an earlier state overwrite a later one; a receipt without an identifier applies an effect twice | a later state overwritten by an earlier one |
| half-applied saga | a compensation runs on part of a chain, or a step fails after its neighbour committed and nothing compensates | one side applied, the other not |
| split commit across services | a coordinator commits one participant and aborts another, or ignores a refusal; a participant left in doubt holds its locks | recorded on one side, refused on the other |
| a global rule broken three components away | features each correct combine into a violation with no single broken component | a stated rule bypassed |
| expiry racing a completion | a timer and a completion are both possible in one state and both fire | a completed thing expired, or an expired thing completed |
| deadline or timer hole | the tick that enforces a deadline is delayed, lost or out of order | a hold never released; a trial that never ends |
| time of check to time of use | an actor checks, waits on the world, and acts on the stale answer: a lease held past expiry, a balance read then spent, a permission checked then revoked | an action on a decision already invalidated |
| exactly-once mechanism defect | the mechanism exists and its own rule breaks: a sequence kept only in memory, a key's record committed after the foreign call | applied twice or dropped despite the mechanism |
| work lost at a crash | a consumer acknowledges before it has either committed the effect or durably recorded the work, and crashes; or delivery is at most once and nothing else recovers what was lost | a paid order never fulfilled |
| abandoned flow | the client stops partway: a charge made, no order created, nobody to finish or undo it | a charge with no order; a hold never released |
| store anomaly | a concurrent write the store's isolation permits | a balance or count wrong by one write |
| stale or backward read | a lagging replica or cache returns a superseded value, or a later read an earlier state, and an actor decides on it | a write vanishes and reappears |
| ownership hole | an object with no owner, an ownership cycle, or an owner losing ownership by their own action with no way back | an orphan nobody can administer |
| migration that loses or merges records | under the mapping from old to new, an old record has no image, or two have one | data silently dropped or merged |

What a store's isolation permits, and what a replica or a cache returns, is in
[stores.md](stores.md). What each kind of outside party does is in
[world.md](world.md).

## Our own services stop too

The misbehaviour menu covers the world outside. The services the team deploys
also stop between two steps. Wherever one of our own actions does two things
in a row, ask what holds if it stops between them, and who finishes or undoes
it. [restate.md](restate.md) says how to write that so a model can show it.
