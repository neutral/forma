| Field | Value |
| --- | --- |
| Meaning | One invoice is part-paid by a recorded ten-pound receipt with another unused reference; a second collected shipment still awaits its invoice and its own receipt reference remains unused. |

```tla
Target ==
  /\ 1 \in db.issued /\ db.invoiceOriginal[1] = 2 /\ db.balance[1] = 1
  /\ db.receiptShipment[1] = 1 /\ db.receiptAmount[1] = 1
  /\ db.receiptShipment[2] = 0 /\ db.receiptAmount[2] = 0
  /\ db.shipmentPhase[2] = "collected" /\ 2 \notin db.issued /\ db.pending[2] = 2
  /\ db.receiptShipment[3] = 0 /\ db.receiptAmount[3] = 0
  /\ db.exposure[1] = 3
```
