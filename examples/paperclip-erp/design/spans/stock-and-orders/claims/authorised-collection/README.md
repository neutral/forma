# Only current authority permits a carton to leave once

| Field | Value |
| --- | --- |
| Sentence | A carton is collected at most once and only as a member of a prepared shipment whose order is still open, whose cartons are still reserved for it and whose batches are released at the collection commit; a prior hold or cancellation prevents that handoff, while a later one never reverses it. |
| Kind | safety |
| Stake | A customer could receive unsafe or cancelled goods and Coil & Clip could lose physical stock without a valid order. |
| Rests on | stock/serial-commits, stock/stable-identities, store:stock/records, stock/truthful-scans, orders/physical-handoff |
| Parts | stock, orders |
| Origin | stated |
| Cites | design/brief/orders.md#authorising-collection, design/brief/stock.md#holds-after-release, design/brief/orders.md#cancelling-the-remainder, design/brief/overview.md#the-boundary-of-the-result, design/brief/stories.md#qa-stops-a-packed-box, design/brief/stories.md#a-customer-cancels-after-a-partial-shipment |
