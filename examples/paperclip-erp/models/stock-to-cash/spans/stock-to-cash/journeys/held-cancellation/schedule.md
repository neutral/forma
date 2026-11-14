| Entity | Value |
| --- | --- |
| batch | 1 |
| order | 1 |
| shipment | 1 |

| Step | Bindings |
| --- | --- |
| 1 | request = IF profile = 2 /\ <<1, {1,2}, 2>> \in BatchRequests THEN <<1, {1,2}, 2>> ELSE <<1, {}, 1>> |
| 2 | request = <<1, 1, 0, TRUE>> |
| 3 | request = <<1, 1, 2>> |
| 4 | request = <<1, 1, 2, {1,2}>> |
| 5 | request = <<1, 1, {1,2}>> |
| 6 | request = <<2, 1, 1>> |
| 7 | request = <<1, 1, 0, TRUE>> |
| 8 | o = 1 |
| 9 | o = 1 |

| Field | Value |
| --- | --- |
| Meaning | Order O is cancelled, S is void, c1 and c2 are on hand and unreserved but still held and unavailable, and exposure is zero. |

```tla
End ==
  /\ limits[1] = 10
  /\ db.orderPhase[1] = "cancelled" /\ db.shipmentPhase[1] = "void"
  /\ db.shipmentOrder[1] = 1 /\ db.shipmentCartons[1] = {1,2}
  /\ db.onHand = {1,2} /\ db.batchPhase[1] = "held" /\ db.revision[1] = 2
  /\ (\A c \in {1,2}: db.reserved[c] = 0 /\ db.picked[c] = 0
        /\ db.collectedBy[c] = 0 /\ db.collectionCount[c] = 0 /\ ~Released(c))
  /\ Available = {} /\ db.exposure[1] = 0 /\ db.commitment[1] = 0
  /\ db.pending[1] = 0 /\ db.issued = {}
```
