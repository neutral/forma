# A fully collected order cannot then be cancelled

| Field | Value |
| --- | --- |
| Polarity | must not |
| Expected end | - |
| Refused step | 7 |
| Origin | stated |
| Cites | design/brief/orders.md#authorising-collection, design/brief/orders.md#cancelling-the-remainder, design/brief/stories.md#a-customer-cancels-after-a-partial-shipment |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | Warehouse staff | stock/receive-batch | Batch B with cartons c1, c2; quantity equals the listed set. | - | - |
| 2 | QA | stock/release-batch | Fresh decision R1 for B at quality revision 0; inspection complete. | - | new |
| 3 | Sales | orders/record-order | Order O for Northline; 2 cartons; fixed customer limit £100; no opening balance. | - | - |
| 4 | Sales | orders/confirm-order | Order O; selected cartons c1, c2; use current stock and total customer exposure. | - | new |
| 5 | Picker | orders/prepare-shipment | Shipment S; order O; complete fixed set c1, c2. | - | new |
| 6 | Carrier and warehouse staff | orders/collect-shipment | Shipment S; authorise and take exactly its fixed cartons at this commit. | - | complete |
| 7 | Customer | orders/cancel-remainder | Cancel only the confirmed uncollected remainder of order O. | - | new |
