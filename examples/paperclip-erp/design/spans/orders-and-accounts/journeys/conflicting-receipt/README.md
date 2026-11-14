# A receipt reference cannot be reused with a different amount

| Field | Value |
| --- | --- |
| Polarity | must not |
| Expected end | - |
| Refused step | 9 |
| Origin | added |
| Cites | design/brief/accounts.md#recording-payment, design/brief/overview.md#the-boundary-of-the-result |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | Warehouse staff | stock/receive-batch | Batch B with cartons c1, c2, c3, c4; quantity equals the listed set. | - | - |
| 2 | QA | stock/release-batch | Fresh decision R1 for B at quality revision 0; inspection complete. | - | new |
| 3 | Sales | orders/record-order | Order O for Northline; 4 cartons; fixed customer limit £100; no opening balance. | - | - |
| 4 | Sales | orders/confirm-order | Order O; selected cartons c1, c2, c3, c4; use current stock and total customer exposure. | - | new |
| 5 | Picker | orders/prepare-shipment | Shipment S; order O; complete fixed set c1, c2, c3, c4. | - | new |
| 6 | Carrier and warehouse staff | orders/collect-shipment | Shipment S; authorise and take exactly its fixed cartons at this commit. | - | complete |
| 7 | Finance | accounts/issue-invoice | Issue the invoice identified by collected shipment S. | - | new |
| 8 | Finance | accounts/apply-receipt | Receipt P1; invoice for S; amount £10. | - | partial |
| 9 | Finance | accounts/apply-receipt | Receipt P1; the same invoice for S; changed amount £20 against its remaining £30 balance after P1 originally applied £10 to the £40 invoice. | - | replay |
