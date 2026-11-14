# What dispatch does not cover

| Passage | Reason |
| --- | --- |
| design/brief/orders.md#orders-and-dispatch | Order editing, address changes and backorders are explicitly excluded. |
| design/brief/orders.md#picking-and-preparing-a-shipment | Gathering scans, packing and printing labels make no business record change and are not separate state-changing actions; the complete preparation submission is one atomic operation. |
| design/brief/orders.md#cancelling-the-remainder | Discarding a draft is explicitly outside this slice; cancelling a draft or a fully collected order is refused. |
