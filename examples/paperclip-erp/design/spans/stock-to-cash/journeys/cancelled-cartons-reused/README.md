# Cancelled stock can serve a second order without erasing the void shipment

| Field | Value |
| --- | --- |
| Polarity | should happen |
| Expected end | O1 is cancelled and S1 remains void with its original c1 and c2 membership; the same released cartons have been reserved for O2 and collected once in S2, O2 is complete, Northline exposure is zero, Pinpoint exposure is £20 with S2 awaiting its invoice, and both shipment histories retain their own orders. |
| Refused step | - |
| Origin | added |
| Cites | design/brief/orders.md#cancelling-the-remainder, design/brief/orders.md#confirming-an-order, design/brief/orders.md#picking-and-preparing-a-shipment, design/brief/orders.md#authorising-collection, design/brief/stock.md#finished-cartons-and-quality, design/brief/overview.md#the-boundary-of-the-result |

| Lifecycle | Entity | Phase |
| --- | --- | --- |
| orders/order | first-sale | unrecorded |
| orders/shipment | first-sale | unprepared |
| orders/order | second-sale | unrecorded |
| orders/shipment | second-sale | unprepared |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | Warehouse staff | stock/receive-batch | Batch B with cartons c1 and c2; quantity 2. | - | - |
| 2 | QA | stock/release-batch | Fresh decision R1 for B at quality revision 0; inspection complete. | - | new |
| 3 | Sales | orders/record-order | First sale: order O1 for Northline; 2 cartons; fixed limit £100; no opening balance. | first-sale | - |
| 4 | Sales | orders/confirm-order | Order O1; select released cartons c1 and c2 using current records. | first-sale | new |
| 5 | Picker | orders/prepare-shipment | First sale: shipment S1 for O1 with complete fixed set c1 and c2. | first-sale | new |
| 6 | Northline | orders/cancel-remainder | Cancel the whole uncollected remainder of O1; S1 becomes void and its released cartons become free. | first-sale | new |
| 7 | Sales | orders/record-order | Second sale: order O2 for Pinpoint; 2 cartons; fixed limit £100; no opening balance. | second-sale | - |
| 8 | Sales | orders/confirm-order | Order O2; select the same now-free released cartons c1 and c2 using current records. | second-sale | new |
| 9 | Picker | orders/prepare-shipment | Second sale: new shipment S2 for O2 with complete fixed set c1 and c2; S1 retains those identities only as void history. | second-sale | new |
| 10 | Carrier and warehouse staff | orders/collect-shipment | Collect exactly the cartons of S2 for O2; retain S1 as void history. | second-sale | complete |
