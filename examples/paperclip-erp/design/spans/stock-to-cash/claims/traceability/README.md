# Collected cartons remain traceable through billing and later holds

| Field | Value |
| --- | --- |
| Sentence | Every collected carton retains its batch and shipment links, every shipment retains its order and customer, and every issued invoice retains that shipment link, so a later batch hold identifies every affected collected shipment and customer without erasing or reversing their collection, cancellation or payment history. |
| Kind | structure |
| Stake | Customers affected by a defective batch could be missed, and finance or support could lose the chain explaining goods and charges. |
| Rests on | stock/serial-commits, stock/stable-identities, store:stock/records, stock/truthful-scans, orders/physical-handoff |
| Parts | stock, orders, accounts |
| Origin | stated |
| Cites | design/brief/stock.md#finished-cartons-and-quality, design/brief/stock.md#holds-after-release, design/brief/overview.md#the-business-we-examine, design/brief/stories.md#northline-buys-then-pays, design/brief/stories.md#qa-stops-a-packed-box |
