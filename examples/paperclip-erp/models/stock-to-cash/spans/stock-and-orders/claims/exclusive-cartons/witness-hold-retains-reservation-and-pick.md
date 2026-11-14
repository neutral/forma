| Field | Value |
| --- | --- |
| Meaning | A currently held batch has already prepared cartons still on hand, reserved for their open order and picked for their shipment; none is available to a second order. |

```tla
Target ==
  /\ db.batchPhase[1] = "held" /\ db.revision[1] = 2
  /\ db.orderPhase[1] = "open" /\ 1 \in db.confirmed
  /\ db.shipmentPhase[1] = "prepared" /\ db.shipmentCartons[1] = PairA
  /\ \A c \in PairA: c \in db.onHand /\ db.reserved[c] = 1 /\ db.picked[c] = 1 /\ c \notin Available
```
