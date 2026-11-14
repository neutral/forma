| Field | Value |
| --- | --- |
| Action | orders/collect-shipment |
| Mechanism | Remove recording the carton-to-shipment collection link in the collection commit. The collection count, physical stock removal, shipment phase, credit transfer and durable obligation keep their ordinary effects; the original collection command is unchanged. |

```tla
Fault(s) ==
  IF db.shipmentPhase[s] = "collected" THEN Commit(5,Cmd(7,s,0,0,0,{}),db)
  ELSE /\ db.shipmentPhase[s] = "prepared"
       /\ LET o == db.shipmentOrder[s]
              cs == db.shipmentCartons[s]
              q == Cardinality(cs)
          IN /\ db.orderPhase[o] = "open"
             /\ cs \subseteq db.onHand /\ cs \subseteq Reserved(o)
             /\ \A c \in cs: Released(c)
             /\ Commit(5,Cmd(7,s,0,0,0,{}),[db EXCEPT
                  !.shipmentPhase[s] = "collected",
                  !.orderPhase[o] = IF Remaining(o) \ cs = {} THEN "complete" ELSE "open",
                  !.onHand = @ \ cs,
                  !.reserved = [c \in Cartons |-> IF c \in cs THEN 0 ELSE db.reserved[c]],
                  !.picked = [c \in Cartons |-> IF c \in cs THEN 0 ELSE db.picked[c]],
                  !.collectionCount = [c \in Cartons |-> IF c \in cs THEN db.collectionCount[c]+1 ELSE db.collectionCount[c]],
                  !.commitment[o] = @ - q, !.pending[s] = q])
```
