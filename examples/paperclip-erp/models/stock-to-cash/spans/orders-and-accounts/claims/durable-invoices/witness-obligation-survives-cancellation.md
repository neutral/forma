| Field | Value |
| --- | --- |
| Meaning | After a two-carton partial collection, cancelling the uncollected remainder leaves the collected shipment and its full twenty-pound obligation awaiting invoice issue. |

```tla
Target ==
  /\ db.orderPhase[1] = "cancelled" /\ db.commitment[1] = 0
  /\ db.shipmentPhase[1] = "collected" /\ db.shipmentOrder[1] = 1
  /\ db.shipmentCartons[1] = PairA /\ 1 \notin db.issued /\ db.pending[1] = 2
  /\ db.invoiceCount[1] = 0 /\ db.exposure[1] = 2
```
