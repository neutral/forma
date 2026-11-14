# Two customers cannot reserve the same last cartons

| Field | Value |
| --- | --- |
| Polarity | must not |
| Expected end | - |
| Refused step | 6 |
| Origin | stated |
| Cites | design/brief/stories.md#the-last-cartons-and-the-last-credit, design/brief/orders.md#confirming-an-order, design/brief/overview.md#the-boundary-of-the-result |

| Lifecycle | Entity | Phase |
| --- | --- | --- |
| orders/order | first-order | unrecorded |
| orders/order | second-order | unrecorded |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | Warehouse staff | stock/receive-batch | Batch B with cartons c1, c2; quantity equals the listed set. | - | - |
| 2 | QA | stock/release-batch | Fresh decision R1 for B at quality revision 0; inspection complete. | - | new |
| 3 | Sales | orders/record-order | Order O1 for Northline; 2 cartons; fixed customer limit £100; no opening balance. | first-order | - |
| 4 | Sales | orders/record-order | Order O2 for Pinpoint; 2 cartons; fixed customer limit £100; no opening balance. | second-order | - |
| 5 | Sales | orders/confirm-order | Order O1; selected cartons c1, c2; use current stock and total customer exposure. | first-order | new |
| 6 | Sales | orders/confirm-order | Order O2; selected cartons c1, c2; use current stock and total customer exposure. | second-order | new |
