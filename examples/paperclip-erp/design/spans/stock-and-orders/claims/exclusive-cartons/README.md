# Reservations and picking never allocate the same stock twice

| Field | Value |
| --- | --- |
| Sentence | Every uncollected carton allocated to an open confirmed order is on hand and reserved for that order alone, picked cartons remain reserved and on hand, and new reservations or picking use only currently released cartons; available cartons are precisely released on-hand unreserved cartons. |
| Kind | safety |
| Stake | Two customers could be promised the same carton, or a held carton could be prepared as safe stock. |
| Rests on | stock/serial-commits, stock/stable-identities, store:stock/records, stock/truthful-scans |
| Parts | stock, orders |
| Origin | stated |
| Cites | design/brief/stock.md#finished-cartons-and-quality, design/brief/stock.md#recording-a-batch, design/brief/stock.md#holds-after-release, design/brief/orders.md#confirming-an-order, design/brief/orders.md#picking-and-preparing-a-shipment, design/brief/stories.md#the-last-cartons-and-the-last-credit |
