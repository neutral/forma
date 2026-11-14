| Field | Value |
| --- | --- |
| Meaning | A cancelled order and its void preparation retain history while every released carton is on hand, unreserved, unpicked and available for reuse. |

```tla
Target ==
  /\ db.orderPhase[1] = "cancelled" /\ db.shipmentPhase[1] = "void"
  /\ db.shipmentCartons[1] = PairA /\ db.batchPhase[1] = "released"
  /\ Available = PairA /\ db.onHand = PairA
  /\ \A c \in PairA: db.reserved[c] = 0 /\ db.picked[c] = 0
```
