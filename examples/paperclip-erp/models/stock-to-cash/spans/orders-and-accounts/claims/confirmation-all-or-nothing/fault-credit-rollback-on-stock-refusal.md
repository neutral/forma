| Field | Value |
| --- | --- |
| Action | orders/confirm-order |
| Mechanism | Omit rollback of provisional customer exposure when the carton availability check fails. The order stays draft and unconfirmed, and its carton reservation and commitment stay unchanged; successful confirmation and exact replay retain their ordinary effects. The command observation retains the original submitted customer, quantity and carton set. |

```tla
Fault(request) ==
  LET o == request[1] c == request[2] q == request[3] cs == request[4]
  IN /\ db.orderCustomer[o] = c /\ db.orderQty[o] = q
     /\ IF o \in db.confirmed THEN
          /\ cs = db.orderCartons[o]
          /\ Commit(2,Cmd(5,o,c,q,0,cs),db)
        ELSE /\ db.orderPhase[o] = "draft" /\ Cardinality(cs) = q
             /\ db.exposure[c] + q <= limits[c]
             /\ IF cs \subseteq Available
                THEN Commit(2,Cmd(5,o,c,q,0,cs),[db EXCEPT
                       !.orderPhase[o] = "open", !.confirmed = @ \cup {o}, !.orderCartons[o] = cs,
                       !.reserved = [x \in Cartons |-> IF x \in cs THEN o ELSE db.reserved[x]],
                       !.commitment[o] = q, !.exposure[c] = @ + q])
                ELSE Commit(2,Cmd(5,o,c,q,0,cs),[db EXCEPT !.exposure[c] = @ + q])
```
