| Field | Value |
| --- | --- |
| Meaning | A held batch still identifies its collected shipment, Northline order and part-paid invoice while the order remainder is cancelled; the successful receipt and outstanding ten pounds remain recorded. |

```tla
Target ==
  /\ db.batchPhase[1] = "held" /\ db.orderPhase[1] = "cancelled"
  /\ db.shipmentPhase[1] = "collected" /\ db.shipmentOrder[1] = 1 /\ db.shipmentCartons[1] = PairA
  /\ db.orderCustomer[1] = 1 /\ 1 \in db.issued /\ db.invoiceCustomer[1] = 1
  /\ db.invoiceOriginal[1] = 2 /\ db.balance[1] = 1 /\ db.receiptShipment[1] = 1 /\ db.receiptAmount[1] = 1
  /\ \A c \in PairA: db.cartonBatch[c] = 1 /\ db.collectedBy[c] = 1 /\ db.collectionCount[c] = 1
```
