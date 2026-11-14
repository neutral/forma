# Northline receives two shipments and settles both invoices

| Field | Value |
| --- | --- |
| Polarity | should happen |
| Expected end | All four cartons are collected once, both £20 invoices are settled and exposure is zero, with all batch-to-customer links retained and every replay leaving totals unchanged. |
| Refused step | - |
| Origin | stated |
| Cites | design/brief/stories.md#northline-buys-then-pays, design/brief/overview.md#the-boundary-of-the-result, design/brief/orders.md#picking-and-preparing-a-shipment, design/brief/accounts.md#exposure-before-and-after-collection, design/brief/accounts.md#recording-payment |

| Lifecycle | Entity | Phase |
| --- | --- | --- |
| orders/order | order-o | unrecorded |
| orders/shipment | shipment-one | unprepared |
| orders/shipment | shipment-two | unprepared |
| accounts/invoice | invoice-one | unissued |
| accounts/invoice | invoice-two | unissued |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | Warehouse staff | stock/receive-batch | Batch B with cartons c1, c2, c3, c4; quantity equals the listed set. | - | - |
| 2 | QA | stock/release-batch | Fresh decision R1 for B at quality revision 0; inspection complete. | - | new |
| 3 | Sales | orders/record-order | Order O for Northline; 4 cartons; fixed customer limit £100; no opening balance. | - | - |
| 4 | Sales | orders/confirm-order | Order O; selected cartons c1, c2, c3, c4; use current stock and total customer exposure. | - | new |
| 5 | Sales | orders/confirm-order | Order O; selected cartons c1, c2, c3, c4; use current stock and total customer exposure. | - | replay |
| 6 | Picker | orders/prepare-shipment | Shipment S1; order O; complete fixed set c1, c2. | shipment-one | new |
| 7 | Picker | orders/prepare-shipment | Shipment S2; order O; complete fixed set c3, c4. | shipment-two | new |
| 8 | Carrier and warehouse staff | orders/collect-shipment | Shipment S1; authorise and take exactly its fixed cartons at this commit. | shipment-one | partial |
| 9 | Carrier and warehouse staff | orders/collect-shipment | Shipment S1; authorise and take exactly its fixed cartons at this commit. | shipment-one | replay |
| 10 | Carrier and warehouse staff | orders/collect-shipment | Shipment S2; authorise and take exactly its fixed cartons at this commit. | shipment-two | complete |
| 11 | Carrier and warehouse staff | orders/collect-shipment | Shipment S2; authorise and take exactly its fixed cartons at this commit. | shipment-two | replay |
| 12 | Sales | orders/confirm-order | Order O; selected cartons c1, c2, c3, c4; use current stock and total customer exposure. | - | replay |
| 13 | Picker | orders/prepare-shipment | Shipment S1; order O; complete fixed set c1, c2. | shipment-one | replay |
| 14 | Finance | accounts/issue-invoice | Issue the invoice identified by collected shipment S1. | invoice-one | new |
| 15 | Finance | accounts/issue-invoice | Issue the invoice identified by collected shipment S1. | invoice-one | replay |
| 16 | Finance | accounts/issue-invoice | Issue the invoice identified by collected shipment S2. | invoice-two | new |
| 17 | Finance | accounts/apply-receipt | Receipt P1; invoice for S1; amount £10. | invoice-one | partial |
| 18 | Finance | accounts/apply-receipt | Receipt P1; invoice for S1; amount £10. | invoice-one | replay |
| 19 | Finance | accounts/apply-receipt | Receipt P2; invoice for S1; amount £10. | invoice-one | settle |
| 20 | Finance | accounts/apply-receipt | Receipt P3; invoice for S2; amount £20. | invoice-two | settle |
| 21 | Finance | accounts/apply-receipt | Receipt P2; invoice for S1; amount £10. | invoice-one | replay |
| 22 | Finance | accounts/issue-invoice | Issue the invoice identified by collected shipment S1. | invoice-one | replay |
