| Field | Value |
| --- | --- |
| Action | orders/cancel-remainder |
| Mechanism | Remove clearing the uncollected cartons picked markers during cancellation; reservations and commitment are released and the preparation is voided, leaving the picked record stranded. |

```tla
Fault(o) ==
  IF db.orderPhase[o] = "cancelled" THEN Commit(4,Cmd(8,o,0,0,0,{}),db)
  ELSE /\ db.orderPhase[o] = "open" /\ Remaining(o) # {}
       /\ LET cs == Remaining(o)
              c == db.orderCustomer[o]
              q == Cardinality(cs)
          IN Commit(4,Cmd(8,o,0,0,0,{}),[db EXCEPT
               !.orderPhase[o] = "cancelled", !.commitment[o] = @ - q,
               !.exposure[c] = @ - q,
               !.reserved = [x \in Cartons |-> IF x \in cs THEN 0 ELSE db.reserved[x]],
               !.shipmentPhase = [s \in Shipments |->
                  IF db.shipmentOrder[s] = o /\ db.shipmentPhase[s] = "prepared"
                  THEN "void" ELSE db.shipmentPhase[s]]])
```
