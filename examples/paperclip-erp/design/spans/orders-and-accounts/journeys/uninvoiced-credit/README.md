# Shipping before invoice issue frees no credit

| Field | Value |
| --- | --- |
| Polarity | must not |
| Expected end | - |
| Refused step | 8 |
| Origin | stated |
| Cites | design/brief/stories.md#the-last-cartons-and-the-last-credit, design/brief/accounts.md#issuing-invoices, design/brief/accounts.md#exposure-before-and-after-collection, design/brief/orders.md#authorising-collection |

| Lifecycle | Entity | Phase |
| --- | --- | --- |
| orders/order | first-order | unrecorded |
| orders/order | second-order | unrecorded |
| orders/shipment | first-shipment | unprepared |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | Warehouse staff | stock/receive-batch | Batch B with cartons c1, c2, c3, c4; quantity equals the listed set. | - | - |
| 2 | QA | stock/release-batch | Fresh decision R1 for B at quality revision 0; inspection complete. | - | new |
| 3 | Sales | orders/record-order | Order O1 for Northline; 2 cartons; fixed customer limit £20; no opening balance. | first-order | - |
| 4 | Sales | orders/record-order | Order O2 for Northline; 2 cartons; fixed customer limit £20; no opening balance. | second-order | - |
| 5 | Sales | orders/confirm-order | Order O1; selected cartons c1, c2; use current stock and total customer exposure. | first-order | new |
| 6 | Picker | orders/prepare-shipment | Shipment S1; order O1; complete fixed set c1, c2. | first-order | new |
| 7 | Carrier and warehouse staff | orders/collect-shipment | Shipment S1; authorise and take exactly its fixed cartons at this commit. | first-order | complete |
| 8 | Sales | orders/confirm-order | Order O2; selected cartons c3, c4; use current stock and total customer exposure. | second-order | new |
