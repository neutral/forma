# Cancellation committed first prevents the packed remainder leaving

| Field | Value |
| --- | --- |
| Polarity | must not |
| Expected end | - |
| Refused step | 9 |
| Origin | stated |
| Cites | design/brief/stories.md#a-customer-cancels-after-a-partial-shipment, design/brief/orders.md#cancelling-the-remainder, design/brief/orders.md#authorising-collection |

| Lifecycle | Entity | Phase |
| --- | --- | --- |
| orders/order | order-o | unrecorded |
| orders/shipment | shipment-one | unprepared |
| orders/shipment | shipment-two | unprepared |

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
| 9 | Carrier and warehouse staff | orders/collect-shipment | Shipment S2; authorise and take exactly its fixed cartons at this commit. | shipment-two | complete |
