| Field | Value |
| --- | --- |
| Meaning | The first order remains cancelled and its shipment void while a second order reserves and prepares the same physical cartons using a different shipment identity. |

```tla
Target ==
  /\ db.orderPhase[1] = "cancelled" /\ db.commitment[1] = 0
  /\ db.shipmentPhase[1] = "void" /\ db.shipmentOrder[1] = 1 /\ db.shipmentCartons[1] = PairA
  /\ db.orderPhase[2] = "open" /\ db.shipmentPhase[2] = "prepared"
  /\ db.shipmentOrder[2] = 2 /\ db.shipmentCartons[2] = PairA
  /\ \A c \in PairA: db.reserved[c] = 2 /\ db.picked[c] = 2 /\ c \in db.onHand
```
