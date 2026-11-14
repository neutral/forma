| Entity | Value |
| --- | --- |
| batch | 1 |
| invoice | 1 |
| order | 1 |
| shipment | 1 |

| Step | Bindings |
| --- | --- |
| 1 | request = IF profile = 2 /\ <<1, {1,2}, 2>> \in BatchRequests THEN <<1, {1,2}, 2>> ELSE <<1, {}, 1>> |
| 2 | request = <<1, 1, 0, TRUE>> |
| 3 | request = <<1, 1, 2>> |
| 4 | request = <<1, 1, 2, {1,2}>> |
| 5 | request = <<1, 1, {1,2}>> |
| 6 | s = 1 |
| 7 | s = 1 |
| 8 | request = <<2, 1, 1>> |

| Field | Value |
| --- | --- |
| Meaning | B is held, S remains collected with its £20 invoice, and its c1 and c2 links identify S and Northline for support. |

```tla
End ==
  /\ limits[1] = 10
  /\ db.batchPhase[1] = "held" /\ db.revision[1] = 2
  /\ db.batchCartons[1] = {1,2}
  /\ db.shipmentPhase[1] = "collected" /\ db.shipmentOrder[1] = 1
  /\ db.shipmentCartons[1] = {1,2} /\ db.orderCustomer[1] = 1
  /\ (\A c \in {1,2}: db.cartonBatch[c] = 1 /\ db.collectedBy[c] = 1
        /\ db.collectionCount[c] = 1)
  /\ db.issued = {1} /\ db.invoiceCount[1] = 1
  /\ db.invoiceCustomer[1] = 1 /\ db.invoiceOriginal[1] = 2
  /\ db.balance[1] = 2 /\ db.pending[1] = 0 /\ db.exposure[1] = 2
```
