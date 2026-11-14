# Cancelling a held prepared remainder frees its reservation but not its availability

| Field | Value |
| --- | --- |
| Polarity | should happen |
| Expected end | Order O is cancelled, S is void, c1 and c2 are on hand and unreserved but still held and unavailable, and exposure is zero. |
| Refused step | - |
| Origin | stated |
| Cites | design/brief/stock.md#holds-after-release, design/brief/orders.md#cancelling-the-remainder, design/brief/stories.md#qa-stops-a-packed-box, design/brief/overview.md#the-boundary-of-the-result |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | Warehouse staff | stock/receive-batch | Batch B with cartons c1, c2; quantity equals the listed set. | - | - |
| 2 | QA | stock/release-batch | Fresh decision R1 for B at quality revision 0; inspection complete. | - | new |
| 3 | Sales | orders/record-order | Order O for Northline; 2 cartons; fixed customer limit £100; no opening balance. | - | - |
| 4 | Sales | orders/confirm-order | Order O; selected cartons c1, c2; use current stock and total customer exposure. | - | new |
| 5 | Picker | orders/prepare-shipment | Shipment S; order O; complete fixed set c1, c2. | - | new |
| 6 | QA | stock/hold-batch | Fresh H1 at B revision 1, after preparation; B becomes held at revision 2. | - | new |
| 7 | QA | stock/release-batch | Replay R1 with its original revision 0 after the new hold. | - | replay |
| 8 | Customer | orders/cancel-remainder | Cancel only the confirmed uncollected remainder of order O. | - | new |
| 9 | Customer | orders/cancel-remainder | Cancel only the confirmed uncollected remainder of order O. | - | replay |
