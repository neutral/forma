# Customer credit, invoices and receipts

Finance sets a fixed credit limit for each customer before orders begin. Credit
limit changes and opening balances are outside this slice. All amounts are
whole multiples of the carton price, with no fees or rounding.

## Exposure before and after collection

The customer's exposure is the value of confirmed, uncollected cartons plus the
value of collected shipments not yet invoiced plus the unpaid balance of issued
invoices. Each value belongs in exactly one of those buckets. Confirmation
increases exposure; cancellation of the remainder reduces it. Collection and
invoice issue only move value between buckets. They never open temporary credit
headroom. Exposure never exceeds the customer's limit.

## Issuing invoices

Finance issues one invoice for each collected shipment from its durable
obligation, using that shipment's identity. The invoice has the shipment's
customer and collected quantity times £10. An uncollected shipment has no invoice.
Repeating invoice issue returns the same invoice. A delayed invoice job must not
allow the customer to spend the same credit twice. No obligation disappears until
the corresponding invoice exists; cancelling an order does not remove it.

## Recording payment

Finance applies a bank receipt to one issued invoice. A receipt has a unique
reference and a positive amount no greater than that invoice's remaining balance.
Partial payments are allowed. Applying it reduces the invoice balance and the
customer's exposure together. Replaying the same receipt has no further effect;
trying its reference with a different invoice or amount is refused. Overpayment
and payment before invoice issue are refused without changing credit or balances
or consuming the receipt reference; a later valid retry can succeed.
We assume finance matches the actual bank receipt correctly; reconciliation with
the bank is outside this examination.
