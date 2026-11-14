| Field | Value |
| --- | --- |
| Meaning | One two-carton order holds its exact cartons and full twenty-pound commitment while another draft holds no carton or credit. |

```tla
Target ==
  /\ db.orderPhase[1] = "open" /\ 1 \in db.confirmed
  /\ db.orderQty[1] = 2 /\ db.orderCartons[1] = PairA /\ Reserved(1) = PairA
  /\ db.commitment[1] = 2 /\ db.exposure[1] = 2
  /\ db.orderPhase[2] = "draft" /\ 2 \notin db.confirmed
  /\ db.orderCartons[2] = {} /\ Reserved(2) = {} /\ db.commitment[2] = 0
  /\ PairB \subseteq Available
```
