| Field | Value |
| --- | --- |
| Meaning | A new ten-pound receipt reduces a partial shipment invoice to ten pounds while twenty pounds remains committed, leaving exactly thirty pounds of exposure. |

```tla
Target ==
  /\ db.commitment[1] = 2 /\ 1 \in db.issued /\ db.pending[1] = 0
  /\ db.receiptShipment[1] = 1 /\ db.receiptAmount[1] = 1 /\ db.balance[1] = 1
  /\ db.exposure[1] = 3 /\ Exposure(1) = 3
```
