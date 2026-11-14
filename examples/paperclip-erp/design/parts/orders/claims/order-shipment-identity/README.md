# Orders and shipment contents cannot change underneath their history

| Field | Value |
| --- | --- |
| Sentence | Each order has one customer and a positive whole carton quantity fixed once confirmed; each prepared, collected or void shipment retains one order and an immutable non-empty set chosen while those cartons were reserved for that order; no carton belongs to two prepared shipments at once, a void shipment retains its historical membership without blocking reuse of its released cartons by another order, and successful identity replays cannot create or edit another order or shipment. |
| Kind | structure |
| Stake | Customers could be charged for another order or have the contents of an already prepared or collected shipment silently changed. |
| Rests on | stock/serial-commits, stock/stable-identities, store:stock/records |
| Parts | orders |
| Origin | stated |
| Cites | design/brief/overview.md#the-business-we-examine, design/brief/orders.md#orders-and-dispatch, design/brief/orders.md#picking-and-preparing-a-shipment, design/brief/orders.md#cancelling-the-remainder, design/brief/overview.md#the-boundary-of-the-result |
