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
| 5 | request = <<1, 1, 4, {1,2,3,4}>> |
| 6 | request = <<1, 1, {1,2}>> |
| 7 | request = <<2, 1, {3,4}>> |
| 8 | s = 1 |
| 9 | s = 1 |
| 10 | s = 2 |
| 11 | s = 2 |
| 12 | request = <<1, 1, 4, {1,2,3,4}>> |
| 13 | request = <<1, 1, {1,2}>> |
| 14 | s = 1 |
| 15 | s = 1 |
| 16 | s = 2 |
| 17 | request = <<1, 1, 1>> |
| 18 | request = <<1, 1, 1>> |
| 19 | request = <<2, 1, 1>> |
| 20 | request = <<3, 2, 2>> |
| 21 | request = <<2, 1, 1>> |
| 22 | s = 1 |

| Field | Value |
| --- | --- |
| Meaning | All four cartons are collected once, both £20 invoices are settled and exposure is zero, with all batch-to-customer links retained and every replay leaving totals unchanged. |

```tla
End ==
  /\ limits[1] = 10 /\ db.batchCartons[1] = {1,2,3,4}
  /\ db.orderPhase[1] = "complete" /\ db.orderCustomer[1] = 1
  /\ db.orderCartons[1] = {1,2,3,4} /\ db.orderQty[1] = 4
  /\ db.shipmentCartons[1] = {1,2} /\ db.shipmentCartons[2] = {3,4}
  /\ (\A s \in {1,2}: db.shipmentPhase[s] = "collected" /\ db.shipmentOrder[s] = 1
        /\ db.invoiceCount[s] = 1 /\ db.invoiceCustomer[s] = 1
        /\ db.invoiceOriginal[s] = 2 /\ db.balance[s] = 0 /\ db.pending[s] = 0
        /\ Paid(s) = 2)
  /\ (\A c \in {1,2,3,4}: db.cartonBatch[c] = 1 /\ db.collectionCount[c] = 1
        /\ db.collectedBy[c] = (IF c \in {1,2} THEN 1 ELSE 2)
        /\ db.reserved[c] = 0 /\ db.picked[c] = 0)
  /\ db.issued = {1,2} /\ db.onHand = {} /\ db.commitment[1] = 0
  /\ db.exposure[1] = 0
  /\ db.receiptShipment[1] = 1 /\ db.receiptAmount[1] = 1
  /\ db.receiptShipment[2] = 1 /\ db.receiptAmount[2] = 1
  /\ db.receiptShipment[3] = 2 /\ db.receiptAmount[3] = 2
```
