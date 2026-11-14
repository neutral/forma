| Field | Value |
| --- | --- |
| Meaning | Northline is exactly at its twenty-pound limit with a confirmed order; its other two-carton draft has available stock but no credit headroom. |

```tla
Target ==
  /\ limits[1] = 2 /\ Exposure(1) = 2 /\ db.commitment[1] = 2
  /\ db.orderPhase[2] = "draft" /\ db.orderCustomer[2] = 1 /\ db.orderQty[2] = 2
  /\ PairB \subseteq Available
```
