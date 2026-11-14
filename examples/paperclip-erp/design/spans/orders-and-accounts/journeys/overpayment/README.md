# An overpayment cannot reduce debt below zero

| Field | Value |
| --- | --- |
| Polarity | must not |
| Expected end | - |
| Refused step | 8 |
| Origin | added |
| Cites | design/brief/accounts.md#recording-payment, design/brief/accounts.md#customer-credit-invoices-and-receipts |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | Warehouse staff | stock/receive-batch | Batch B with cartons c1, c2; quantity equals the listed set. | - | - |
| 2 | QA | stock/release-batch | Fresh decision R1 for B at quality revision 0; inspection complete. | - | new |
| 3 | Sales | orders/record-order | Order O for Northline; 2 cartons; fixed customer limit £100; no opening balance. | - | - |
| 4 | Sales | orders/confirm-order | Order O; selected cartons c1, c2; use current stock and total customer exposure. | - | new |
| 5 | Picker | orders/prepare-shipment | Shipment S; order O; complete fixed set c1, c2. | - | new |
| 6 | Carrier and warehouse staff | orders/collect-shipment | Shipment S; authorise and take exactly its fixed cartons at this commit. | - | complete |
| 7 | Finance | accounts/issue-invoice | Issue the invoice identified by collected shipment S. | - | new |
| 8 | Finance | accounts/apply-receipt | Receipt P1; invoice for S; amount £30. | - | settle |
