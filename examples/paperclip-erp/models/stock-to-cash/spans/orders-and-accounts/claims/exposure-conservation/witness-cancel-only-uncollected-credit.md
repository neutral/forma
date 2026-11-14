| Field | Value |
| --- | --- |
| Meaning | After a partial shipment and ten-pound receipt, cancelling the two uncollected cartons releases their twenty-pound commitment and leaves the collected invoice debt of exactly ten pounds. |

```tla
Target ==
  /\ db.orderPhase[1] = "cancelled" /\ db.commitment[1] = 0
  /\ 1 \in db.issued /\ db.balance[1] = 1 /\ Paid(1) = 1
  /\ db.pending[1] = 0 /\ db.exposure[1] = 1 /\ Exposure(1) = 1
```
