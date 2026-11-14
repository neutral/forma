| Field | Value |
| --- | --- |
| Meaning | Issuing the first partial shipment invoice moves its twenty pounds from the obligation bucket to unpaid invoice balance while the uncollected twenty-pound commitment and forty-pound exposure remain. |

```tla
Target ==
  /\ db.orderPhase[1] = "open" /\ db.commitment[1] = 2
  /\ 1 \in db.issued /\ db.pending[1] = 0 /\ db.balance[1] = 2
  /\ db.exposure[1] = 4 /\ Exposure(1) = 4
```
