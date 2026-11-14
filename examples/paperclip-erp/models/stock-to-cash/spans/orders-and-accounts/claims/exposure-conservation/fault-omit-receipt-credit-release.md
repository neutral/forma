| Field | Value |
| --- | --- |
| Action | accounts/apply-receipt |
| Mechanism | Remove the customer exposure reduction from a newly applied receipt commit; the immutable receipt and invoice balance reduction still commit. |

```tla
Fault(request) ==
  LET p == request[1] s == request[2] a == request[3]
  IN IF db.receiptShipment[p] # 0 THEN
       /\ db.receiptShipment[p] = s /\ db.receiptAmount[p] = a
       /\ Commit(6,Cmd(10,p,s,a,0,{}),db)
     ELSE /\ s \in db.issued /\ a > 0 /\ a <= db.balance[s]
          /\ Commit(6,Cmd(10,p,s,a,0,{}),[db EXCEPT
               !.receiptShipment[p] = s, !.receiptAmount[p] = a,
               !.balance[s] = @ - a])
```
