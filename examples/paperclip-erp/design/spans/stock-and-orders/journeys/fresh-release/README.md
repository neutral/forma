# A fresh QA decision lets the same prepared shipment leave

| Field | Value |
| --- | --- |
| Polarity | should happen |
| Expected end | R2 moves B to released at revision 3 and the original prepared S is collected once with its invoice obligation retained. |
| Refused step | - |
| Origin | stated |
| Cites | design/brief/stories.md#qa-stops-a-packed-box, design/brief/stock.md#holds-after-release, design/brief/orders.md#authorising-collection, design/brief/overview.md#the-boundary-of-the-result |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | Warehouse staff | stock/receive-batch | Batch B with cartons c1, c2; quantity equals the listed set. | - | - |
| 2 | QA | stock/release-batch | Fresh decision R1 for B at quality revision 0; inspection complete. | - | new |
| 3 | Sales | orders/record-order | Order O for Northline; 2 cartons; fixed customer limit £100; no opening balance. | - | - |
| 4 | Sales | orders/confirm-order | Order O; selected cartons c1, c2; use current stock and total customer exposure. | - | new |
| 5 | Picker | orders/prepare-shipment | Shipment S; order O; complete fixed set c1, c2. | - | new |
| 6 | QA | stock/hold-batch | Fresh H1 at B revision 1, after preparation; B becomes held at revision 2. | - | new |
| 7 | QA | stock/release-batch | Replay R1 with its original revision 0 after the new hold. | - | replay |
| 8 | QA | stock/release-batch | New R2 at B current revision 2, following fresh inspection. | - | new |
| 9 | Carrier and warehouse staff | orders/collect-shipment | Shipment S; authorise and take exactly its fixed cartons at this commit. | - | complete |
