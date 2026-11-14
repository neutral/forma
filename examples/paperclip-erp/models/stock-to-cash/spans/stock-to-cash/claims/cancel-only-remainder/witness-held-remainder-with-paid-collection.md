| Field | Value |
| --- | --- |
| Meaning | A cancelled order has a void uncollected preparation whose held cartons are on hand, free of reservation and picking and unavailable; its collected shipment retains a part-paid invoice and ten pounds of exposure. |

```tla
Target ==
  /\ db.orderPhase[1] = "cancelled" /\ db.commitment[1] = 0
  /\ db.batchPhase[1] = "held" /\ db.revision[1] = 2
  /\ db.shipmentPhase[1] = "collected" /\ db.shipmentCartons[1] = PairA
  /\ db.shipmentPhase[2] = "void" /\ db.shipmentCartons[2] = PairB
  /\ 1 \in db.issued /\ db.invoiceOriginal[1] = 2 /\ db.balance[1] = 1 /\ Paid(1) = 1
  /\ db.exposure[1] = 1
  /\ \A c \in PairB: c \in db.onHand /\ db.reserved[c] = 0 /\ db.picked[c] = 0 /\ c \notin Available
```
