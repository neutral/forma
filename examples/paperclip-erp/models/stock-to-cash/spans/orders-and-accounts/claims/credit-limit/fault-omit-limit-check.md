| Field | Value |
| --- | --- |
| Action | orders/confirm-order |
| Mechanism | Remove the confirmation check that current customer exposure plus the full new commitment stays within the fixed limit; all reservation and accounting effects remain. |

```tla
Fault(request) ==
  LET o == request[1] c == request[2] q == request[3] cs == request[4]
  IN /\ db.orderCustomer[o] = c /\ db.orderQty[o] = q
     /\ IF o \in db.confirmed THEN
          /\ cs = db.orderCartons[o]
          /\ Commit(2,Cmd(5,o,c,q,0,cs),db)
        ELSE /\ db.orderPhase[o] = "draft" /\ Cardinality(cs) = q
             /\ cs \subseteq Available
             /\ Commit(2,Cmd(5,o,c,q,0,cs),[db EXCEPT
                  !.orderPhase[o] = "open", !.confirmed = @ \cup {o}, !.orderCartons[o] = cs,
                  !.reserved = [x \in Cartons |-> IF x \in cs THEN o ELSE db.reserved[x]],
                  !.commitment[o] = q, !.exposure[c] = @ + q])
```
