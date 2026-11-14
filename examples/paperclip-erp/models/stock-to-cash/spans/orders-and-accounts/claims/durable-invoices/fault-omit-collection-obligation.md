| Field | Value |
| --- | --- |
| Action | orders/collect-shipment |
| Mechanism | Remove storing the durable invoice obligation in the collection commit; the physical handoff and removal of the uncollected commitment still happen. |

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
                  !.collectedBy = [c \in Cartons |-> IF c \in cs THEN s ELSE db.collectedBy[c]],
                  !.collectionCount = [c \in Cartons |-> IF c \in cs THEN db.collectionCount[c]+1 ELSE db.collectionCount[c]],
                  !.commitment[o] = @ - q])
```
