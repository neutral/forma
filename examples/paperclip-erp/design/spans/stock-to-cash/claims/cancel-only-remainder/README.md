# Cancellation releases the remainder and preserves collected work

| Field | Value |
| --- | --- |
| Sentence | After cancelling a confirmed open remainder, none of its uncollected cartons remains reserved or picked, its uncollected shipments are void and its commitment is released, held cartons remain unavailable, no new picking or collection for that order is allowed, and already collected shipments, obligations, invoices and their balances are unchanged. |
| Kind | safety |
| Stake | A customer could receive goods after cancelling, lose credit for returned stock, or lose the valid bill for goods already received. |
| Rests on | stock/serial-commits, stock/stable-identities, store:stock/records |
| Parts | stock, orders, accounts |
| Origin | stated |
| Cites | design/brief/orders.md#cancelling-the-remainder, design/brief/stories.md#a-customer-cancels-after-a-partial-shipment, design/brief/stock.md#holds-after-release, design/brief/accounts.md#issuing-invoices, design/brief/accounts.md#exposure-before-and-after-collection |
