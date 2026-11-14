| Field | Value |
| --- | --- |
| Meaning | A four-carton order has two cartons still committed and two collected but uninvoiced; the two twenty-pound buckets total the original forty-pound exposure. |

```tla
Target ==
  /\ db.orderPhase[1] = "open" /\ db.commitment[1] = 2
  /\ db.shipmentPhase[1] = "collected" /\ 1 \notin db.issued /\ db.pending[1] = 2
  /\ db.exposure[1] = 4 /\ Exposure(1) = 4
```
