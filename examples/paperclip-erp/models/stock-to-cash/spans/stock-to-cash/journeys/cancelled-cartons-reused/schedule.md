| Entity | Value |
| --- | --- |
| batch | 1 |
| first-sale | 1 |
| second-sale | 2 |

| Start |
| --- |
| Init /\ profile = 2 |

| Step | Bindings |
| --- | --- |
| 1 | request = <<1, {1,2}, 2>> |
| 2 | request = <<1, 1, 0, TRUE>> |
| 3 | request = <<1, 1, 2>> |
| 4 | request = <<1, 1, 2, {1,2}>> |
| 5 | request = <<1, 1, {1,2}>> |
| 6 | o = 1 |
| 7 | request = <<2, 2, 2>> |
| 8 | request = <<2, 2, 2, {1,2}>> |
| 9 | request = <<2, 2, {1,2}>> |
| 10 | s = 2 |

| Field | Value |
| --- | --- |
| Meaning | O1 is cancelled and S1 remains void with its original c1 and c2 membership; the same released cartons have been reserved for O2 and collected once in S2, O2 is complete, Northline exposure is zero, Pinpoint exposure is £20 with S2 awaiting its invoice, and both shipment histories retain their own orders. |

```tla
End ==
  /\ limits[1] = 10 /\ limits[2] = 10
  /\ db.batchPhase[1] = "released" /\ db.batchCartons[1] = {1,2}
  /\ db.orderPhase[1] = "cancelled" /\ db.orderCustomer[1] = 1
  /\ db.orderPhase[2] = "complete" /\ db.orderCustomer[2] = 2
  /\ db.orderCartons[1] = {1,2} /\ db.orderCartons[2] = {1,2}
  /\ db.shipmentPhase[1] = "void" /\ db.shipmentOrder[1] = 1
  /\ db.shipmentPhase[2] = "collected" /\ db.shipmentOrder[2] = 2
  /\ db.shipmentCartons[1] = {1,2} /\ db.shipmentCartons[2] = {1,2}
  /\ (\A c \in {1,2}: db.cartonBatch[c] = 1 /\ db.collectedBy[c] = 2
        /\ db.collectionCount[c] = 1 /\ db.reserved[c] = 0 /\ db.picked[c] = 0)
  /\ db.onHand = {} /\ db.exposure[1] = 0 /\ db.exposure[2] = 2
  /\ db.commitment[1] = 0 /\ db.commitment[2] = 0
  /\ db.pending[1] = 0 /\ db.pending[2] = 2 /\ db.issued = {}
```
