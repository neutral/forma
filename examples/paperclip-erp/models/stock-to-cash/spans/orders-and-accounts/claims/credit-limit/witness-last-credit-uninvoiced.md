| Field | Value |
| --- | --- |
| Meaning | Northline remains exactly at its twenty-pound limit after collection while invoice issue is delayed, with a second draft and available cartons still waiting for headroom. |

```tla
Target ==
  /\ limits[1] = 2 /\ Exposure(1) = 2
  /\ db.shipmentPhase[1] = "collected" /\ 1 \notin db.issued /\ db.pending[1] = 2
  /\ db.commitment[1] = 0
  /\ db.orderPhase[2] = "draft" /\ db.orderCustomer[2] = 1 /\ db.orderQty[2] = 2
  /\ PairB \subseteq Available
```
