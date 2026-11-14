# Orders and dispatch

A sales representative records a draft order for a customer. Drafts consume
neither stock nor credit. The quantity and customer are fixed once confirmed;
editing orders, changing addresses and backorders are outside this slice.

## Confirming an order

Confirmation succeeds only when enough released cartons are available and the
customer has credit for the whole order. It reserves particular cartons and
commits the full order value against that customer's credit in the same
operation. If either check fails, neither stock nor credit changes. Two orders
competing for the last cartons or the last credit cannot both take them.
After a successful confirmation, confirming the same order again returns its
recorded result and adds nothing. A refusal for stock or credit leaves the draft
retryable when circumstances change.

## Picking and preparing a shipment

A picker gathers scans, then submits one preparation command with a new shipment
identity, its order and its complete non-empty set of cartons. Scan gathering
before submission changes no stock records. Preparation checks all cartons are
reserved for the order, released and not already in another prepared shipment,
then marks them picked together. Shipment membership is fixed after that. An
exact replay adds nothing; reusing its identity with different contents is
refused, even after collection or cancellation. There may be more than one
prepared shipment for an order. A shipment is prepared, collected or void;
collected and void shipments cannot be edited. Packing and printing a label do
not count as collection or create an invoice.

## Authorising collection

At the carrier handoff, the application checks the order is still open, every
carton in the shipment is still reserved for it, and every batch is currently
released. It then records collection, removes those cartons from on-hand stock
and reservation, and creates a durable obligation to invoice that shipment, all
together. The authorisation and the physical handoff are one business event at
the boundary described in the overview. A hold or cancellation committed before
it wins; one committed afterwards does not undo the collection.

Repeated collection of the same shipment adds no movement or obligation. A
partially collected order remains open for its remaining cartons; it completes
when all its cartons have been collected. The system never collects a carton
twice, a held carton, or the cancelled remainder of an order. A refusal changes
none of these records.

## Cancelling the remainder

The customer may cancel any uncollected remainder of a confirmed open order,
including picked cartons and
prepared shipments, in one operation. Cancellation releases its reservations
and credit commitment and voids its uncollected shipments. The cartons return
to free stock, but a held carton stays unavailable. Already collected shipments,
their invoice obligations and their invoices remain. An order with a cancelled
remainder accepts no further picking or collection. Repeating cancellation
does nothing further. A draft has no committed remainder to cancel, and a fully
collected order cannot be cancelled here. Discarding a draft is outside this slice.
