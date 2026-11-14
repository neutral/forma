# Cancel the second shipment and settle the collected first one

| Field | Value |
| --- | --- |
| Polarity | should happen |
| Expected end | S2 is void and c3 and c4 are free; only S1 was collected, its £20 invoice is settled, and exposure is zero while exact replays cause no new picking or collection. |
| Refused step | - |
| Origin | stated |
| Cites | design/brief/stories.md#a-customer-cancels-after-a-partial-shipment, design/brief/orders.md#cancelling-the-remainder, design/brief/accounts.md#issuing-invoices, design/brief/accounts.md#recording-payment, design/brief/orders.md#picking-and-preparing-a-shipment, design/brief/overview.md#the-boundary-of-the-result |

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
| 5 | Picker | orders/prepare-shipment | Shipment S1; order O; complete fixed set c1, c2. | shipment-one | new |
| 6 | Carrier and warehouse staff | orders/collect-shipment | Shipment S1; authorise and take exactly its fixed cartons at this commit. | shipment-one | partial |
| 7 | Picker | orders/prepare-shipment | Shipment S2; order O; complete fixed set c3, c4. | shipment-two | new |
| 8 | Customer | orders/cancel-remainder | Cancel only the confirmed uncollected remainder of order O. | shipment-two | new |
| 9 | Customer | orders/cancel-remainder | Cancel only the confirmed uncollected remainder of order O. | shipment-two | replay |
| 10 | Picker | orders/prepare-shipment | Shipment S2; order O; complete fixed set c3, c4. | shipment-two | replay |
| 11 | Carrier and warehouse staff | orders/collect-shipment | Shipment S1; authorise and take exactly its fixed cartons at this commit. | shipment-one | replay |
| 12 | Finance | accounts/issue-invoice | Issue the invoice identified by collected shipment S1. | invoice-one | new |
| 13 | Finance | accounts/apply-receipt | Receipt P1; invoice for S1; amount £20. | invoice-one | settle |
