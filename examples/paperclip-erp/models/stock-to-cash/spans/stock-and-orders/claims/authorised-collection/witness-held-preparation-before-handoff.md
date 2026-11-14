| Field | Value |
| --- | --- |
| Meaning | An active carrier faces a prepared two-carton shipment with no collected cartons while its batch is held. Its order is still open and its cartons remain on hand and reserved, so current quality is the outstanding handoff condition. |

```tla
Target ==
  /\ CanAct(5)
  /\ db.shipmentPhase[1] = "prepared" /\ db.shipmentOrder[1] = 1 /\ db.shipmentCartons[1] = PairA
  /\ db.orderPhase[1] = "open" /\ db.batchPhase[1] = "held" /\ db.revision[1] = 2
  /\ \A c \in PairA: c \in db.onHand /\ db.reserved[c] = 1 /\ db.collectedBy[c] = 0 /\ db.collectionCount[c] = 0
```
