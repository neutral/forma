# Finished cartons and quality

Stock is a set of identified cartons, not just a number on a dashboard. A carton
is on hand until the carrier collects it. It can be free, reserved for one order,
or picked for that order. Picking moves it to the packing area; it remains on
hand and reserved. Collected cartons remain in the traceability record.

## Recording a batch

A finished batch enters once, with its identities and quantity checked, and starts
on quality hold. Repeating that batch receipt does not create more cartons. QA
releases the batch after its inspection. Only released cartons can be reserved.
Available means released, on hand and unreserved. We do not correct counts,
scrap batches, transfer stock or substitute products in this slice.

## Holds after release

QA can put a released batch back on hold, even after a carton is reserved,
picked or collected. A hold immediately blocks new reservations and collection
of the affected cartons still on hand. It does not erase existing reservations:
those orders wait for release or the customer cancels the uncollected remainder.
QA can release the batch again.

Each QA decision has its own operation identity and names the batch's current
quality revision. A successful hold or release increments that revision. A new
operation with a stale revision is refused. Replaying a successful operation
returns its recorded result without changing the current quality state, even if
newer decisions have intervened. Releasing a batch after a new hold therefore
requires a fresh QA decision; an old release message cannot lift the hold.

For cartons collected before a later hold, staff can find every affected
shipment and customer from the retained batch links. We examine the completeness
of those links, not whether support contacts customers or retrieves goods. A
later hold cannot make an earlier authorised collection unhappen.
