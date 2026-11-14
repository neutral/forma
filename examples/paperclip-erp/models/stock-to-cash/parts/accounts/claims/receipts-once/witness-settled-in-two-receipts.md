| Field | Value |
| --- | --- |
| Meaning | Two distinct ten-pound receipt references pay one twenty-pound invoice exactly, leaving zero balance and zero customer exposure. |

```tla
Target ==
  /\ 1 \in db.issued /\ db.invoiceOriginal[1] = 2 /\ db.balance[1] = 0
  /\ db.receiptShipment[1] = 1 /\ db.receiptAmount[1] = 1
  /\ db.receiptShipment[2] = 1 /\ db.receiptAmount[2] = 1
  /\ db.exposure[1] = 0
```
