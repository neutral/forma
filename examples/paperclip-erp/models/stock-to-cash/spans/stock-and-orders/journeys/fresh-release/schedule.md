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
| 8 | request = <<3, 1, 2, TRUE>> |
| 9 | s = 1 |

| Field | Value |
| --- | --- |
| Meaning | R2 moves B to released at revision 3 and the original prepared S is collected once with its invoice obligation retained. |

```tla
End ==
  /\ limits[1] = 10
  /\ db.batchPhase[1] = "released" /\ db.revision[1] = 3
  /\ db.qaKind[3] = 1 /\ db.qaBatch[3] = 1 /\ db.qaRevision[3] = 2
  /\ db.qaInspected[3] = 1
  /\ db.shipmentPhase[1] = "collected" /\ db.shipmentOrder[1] = 1
  /\ db.shipmentCartons[1] = {1,2} /\ db.orderPhase[1] = "complete"
  /\ (\A c \in {1,2}: db.collectionCount[c] = 1 /\ db.collectedBy[c] = 1)
  /\ db.onHand = {} /\ db.pending[1] = 2 /\ 1 \notin db.issued
  /\ db.exposure[1] = 2 /\ db.commitment[1] = 0
```
