# Every collected shipment keeps one correct invoice or its obligation

| Field | Value |
| --- | --- |
| Sentence | Each collected shipment has its durable obligation until its single shipment-identified invoice exists, an uncollected shipment has no invoice, and the invoice customer and original amount equal its order customer and collected carton quantity times £10; cancellation and replays lose no obligation, duplicate no invoice and reset no paid balance. |
| Kind | safety |
| Stake | Coil & Clip could lose payment for shipped goods, or a customer could be billed twice, billed for unshipped goods or billed for another customer shipment. |
| Rests on | stock/serial-commits, stock/stable-identities, store:stock/records |
| Parts | orders, accounts |
| Origin | stated |
| Cites | design/brief/orders.md#authorising-collection, design/brief/accounts.md#issuing-invoices, design/brief/orders.md#cancelling-the-remainder, design/brief/accounts.md#recording-payment, design/brief/overview.md#the-boundary-of-the-result |
