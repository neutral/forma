| Field | Value |
| --- | --- |
| Meaning | Collected cartons remain handed off exactly once while their batch is held and the same order has a cancelled uncollected remainder. |

```tla
Target ==
  /\ db.orderPhase[1] = "cancelled" /\ db.batchPhase[1] = "held"
  /\ db.shipmentPhase[1] = "collected" /\ db.shipmentCartons[1] = PairA
  /\ db.shipmentPhase[2] = "void" /\ db.shipmentCartons[2] = PairB
  /\ \A c \in PairA: db.collectedBy[c] = 1 /\ db.collectionCount[c] = 1 /\ c \notin db.onHand
```
