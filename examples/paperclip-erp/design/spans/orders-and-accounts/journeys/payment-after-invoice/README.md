# The same receipt reference succeeds once the invoice exists

| Field | Value |
| --- | --- |
| Polarity | should happen |
| Expected end | Invoice S is settled by receipt P1 for £20 and exposure is zero; this is the positive companion to orders-and-accounts/journeys/payment-before-invoice from their common unchanged pre-state after step 6, followed here by invoice issue and successful application of the same reference, invoice and amount. |
| Refused step | - |
| Origin | added |
| Cites | design/brief/accounts.md#recording-payment, design/brief/accounts.md#issuing-invoices, design/brief/overview.md#the-boundary-of-the-result |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | Warehouse staff | stock/receive-batch | Batch B with cartons c1, c2; quantity equals the listed set. | - | - |
| 2 | QA | stock/release-batch | Fresh decision R1 for B at quality revision 0; inspection complete. | - | new |
| 3 | Sales | orders/record-order | Order O for Northline; 2 cartons; fixed customer limit £100; no opening balance. | - | - |
| 4 | Sales | orders/confirm-order | Order O; selected cartons c1, c2; use current stock and total customer exposure. | - | new |
| 5 | Picker | orders/prepare-shipment | Shipment S; order O; complete fixed set c1, c2. | - | new |
| 6 | Carrier and warehouse staff | orders/collect-shipment | Shipment S; authorise and take exactly its fixed cartons at this commit. | - | complete |
| 7 | Finance | accounts/issue-invoice | Issue the invoice identified by collected shipment S. | - | new |
| 8 | Finance | accounts/apply-receipt | Receipt P1; invoice for S; amount £20. | - | settle |
