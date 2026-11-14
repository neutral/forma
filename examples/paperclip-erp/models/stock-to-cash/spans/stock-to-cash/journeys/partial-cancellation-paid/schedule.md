| Entity | Value |
| --- | --- |
| batch | 1 |
| invoice-one | 1 |
| invoice-two | 2 |
| order-o | 1 |
| shipment-one | 1 |
| shipment-two | 2 |

| Start |
| --- |
| Init /\ profile = 3 |

| Step | Bindings |
| --- | --- |
| 1 | request = <<1, {1,2,3,4}, 4>> |
| 2 | request = <<1, 1, 0, TRUE>> |
| 3 | request = <<1, 1, 4>> |
| 4 | request = <<1, 1, 4, {1,2,3,4}>> |
| 5 | request = <<1, 1, {1,2}>> |
| 6 | s = 1 |
| 7 | request = <<2, 1, {3,4}>> |
| 8 | o = 1 |
| 9 | o = 1 |
| 10 | request = <<2, 1, {3,4}>> |
| 11 | s = 1 |
| 12 | s = 1 |
| 13 | request = <<1, 1, 2>> |

| Field | Value |
| --- | --- |
| Meaning | S2 is void and c3 and c4 are free; only S1 was collected, its £20 invoice is settled, and exposure is zero while exact replays cause no new picking or collection. |

```tla
End ==
  /\ limits[1] = 10 /\ db.orderPhase[1] = "cancelled"
  /\ db.shipmentPhase[1] = "collected" /\ db.shipmentPhase[2] = "void"
  /\ db.shipmentOrder[1] = 1 /\ db.shipmentOrder[2] = 1
  /\ db.shipmentCartons[1] = {1,2} /\ db.shipmentCartons[2] = {3,4}
  /\ (\A c \in {1,2}: db.collectedBy[c] = 1 /\ db.collectionCount[c] = 1)
  /\ (\A c \in {3,4}: db.collectedBy[c] = 0 /\ db.collectionCount[c] = 0)
  /\ (\A c \in {1,2,3,4}: db.reserved[c] = 0 /\ db.picked[c] = 0)
  /\ db.onHand = {3,4} /\ Available = {3,4}
  /\ db.issued = {1} /\ db.invoiceCount[1] = 1 /\ db.invoiceCount[2] = 0
  /\ db.invoiceCustomer[1] = 1 /\ db.invoiceOriginal[1] = 2 /\ db.balance[1] = 0
  /\ db.pending[1] = 0 /\ db.pending[2] = 0 /\ db.commitment[1] = 0
  /\ db.receiptShipment[1] = 1 /\ db.receiptAmount[1] = 2 /\ Paid(1) = 2
  /\ db.exposure[1] = 0
```
