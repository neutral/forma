# Coil & Clip: from factory stock to a paid invoice

Coil & Clip makes paperclips and sells sealed cartons to office suppliers. This
project examines one connected slice of its ERP: recording finished stock,
reserving it for orders, stopping unsafe dispatches, and keeping the customer's
credit exposure correct through collection, invoicing and payment. A warehouse
picker, a sales representative, quality assurance and finance all work on the
same facts. Their actions can overlap.

Read [stock and quality](stock.md), then [orders and dispatch](orders.md), then
[customer accounts](accounts.md). The [stories](stories.md) follow ordinary work
and the awkward cases that make these connections matter.

## The business we examine

There is one warehouse beside the production line, one paperclip product and a
fixed price of £10 per carton. All customers in this slice buy on account. An
order has one customer and a positive whole number of cartons. It can leave in
several shipments. Every carton has a unique identity and belongs to one batch;
every shipment belongs to one order. The same rules apply when there are several
customers, orders and batches.

The software records a completed batch at the warehouse door. Wire purchasing,
line scheduling and work in progress are outside this slice. The end is an
invoice settled by a recorded bank receipt. Card capture, refunds, tax, credit
notes, bad debt, accounting export, customer login and delivery tracking are
outside it too. This lets a reader follow one complete stock-to-cash story
without treating the entire business as one model.

## The boundary of the result

The application keeps the records in one authoritative store, with serializable
isolation. Each named business operation commits all its effects together or has
no effect; concurrent operations must behave as some serial order of those
commits. A stale screen is never authority to confirm an order, change a batch's
quality decision or dispatch a carton. Implementing that
transaction guarantee and recovering the database from storage failure are
outside this examination, so the result depends on that guarantee.

Staff commands carry stable business identities. A repeated command refers to
the same order, batch, shipment, invoice or bank receipt; it cannot mean a new
one. Successful effects are remembered. A refusal makes no business change and
does not consume an identity: the same request may be retried after the reason
for refusal is resolved. Reusing a successful identity with different contents
is refused. Software validates each command against current records. We assume scans
identify the actual physical cartons, staff record bank receipts truthfully and
the carrier takes exactly the cartons in an authorised collection. The software
cannot establish these physical facts. It also cannot guarantee that staff,
customers or the carrier eventually act. This slice makes safety claims and
demonstrates possible journeys, not a promise that every order eventually ships.
