# A fresh identity does not legitimise a stale QA revision

| Field | Value |
| --- | --- |
| Polarity | must not |
| Expected end | - |
| Refused step | 8 |
| Origin | added |
| Cites | design/brief/stock.md#holds-after-release, design/brief/overview.md#the-boundary-of-the-result, design/brief/stories.md#qa-stops-a-packed-box |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | Warehouse staff | stock/receive-batch | Batch B with cartons c1, c2; quantity equals the listed set. | - | - |
| 2 | QA | stock/release-batch | Fresh decision R1 for B at quality revision 0; inspection complete. | - | new |
| 3 | Sales | orders/record-order | Order O for Northline; 2 cartons; fixed customer limit £100; no opening balance. | - | - |
| 4 | Sales | orders/confirm-order | Order O; selected cartons c1, c2; use current stock and total customer exposure. | - | new |
| 5 | Picker | orders/prepare-shipment | Shipment S; order O; complete fixed set c1, c2. | - | new |
| 6 | QA | stock/hold-batch | Fresh H1 at B revision 1, after preparation; B becomes held at revision 2. | - | new |
| 7 | QA | stock/release-batch | Replay R1 with its original revision 0 after the new hold. | - | replay |
| 8 | QA | stock/release-batch | New operation R2 incorrectly cites revision 1 although B is held at revision 2. | - | new |
