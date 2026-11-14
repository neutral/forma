# A week at Coil & Clip

These are concrete examples of the rules, not extra limits on the number of
customers, cartons or actions. Smaller equivalent quantities are fine for an
engine, provided its bounds are visible and it still examines competing orders,
partial collection and the gaps between collection, invoicing and payment.

## Northline buys, then pays

QA releases a finished batch. Northline Office has a £100 credit limit and orders
four cartons. Confirmation reserves four cartons and commits £40. Two cartons
leave in the first shipment and two in the second. Finance issues a £20 invoice
for each shipment. Northline pays the first invoice in two £10 receipts and the
second in one £20 receipt. Exposure ends at zero, all four cartons are collected,
and every invoice leads back through its shipment to its order, customer and
production batch. Repeated confirmation, collection, invoice issue and receipt
application must leave the totals unchanged.

## The last cartons and the last credit

Northline and Pinpoint Print both ask for the last two available cartons. The
first successful confirmation gets them; the other leaves no partial reservation
or credit commitment. A separate case has enough cartons but two Northline
orders competing for the last £20 of credit. Only one is confirmed. This remains
true after the first order ships while finance has not yet issued its invoice.
Paying a valid invoice frees credit for a later order.

## QA stops a packed box

Northline's order is confirmed and its first shipment is picked. QA then holds
the batch. The label already printed is no permission to collect: handoff is
refused. A delayed replay of the batch's earlier release leaves the new hold in
place. After a fresh QA decision releases the batch, the same prepared shipment
can leave.
If QA instead finds the defect after collection, the retained carton links
identify Northline and that shipment for support; the collection record remains.

## A customer cancels after a partial shipment

Two of Northline's four cartons are collected. The other two are picked into a
second shipment when the customer cancels the remainder. The second shipment
cannot leave; its cartons and £20 commitment are released. The first shipment
still needs its £20 invoice and payment. If collection and cancellation race,
their commit order decides which cartons count as collected; neither result
loses a carton or an invoice obligation.
