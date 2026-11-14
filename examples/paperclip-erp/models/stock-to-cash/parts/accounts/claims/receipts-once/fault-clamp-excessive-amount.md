| Field | Value |
| --- | --- |
| Action | accounts/apply-receipt |
| Mechanism | Remove exact validation and application of the submitted amount against the remaining invoice balance: a positive excessive application is silently clipped to the positive balance and its reference consumed. Ordinary valid applications and existing-reference checks are unchanged. The command observation retains the original submitted amount, not the clipped amount. |

```tla
Fault(request) ==
  LET p == request[1] s == request[2] a == request[3]
  IN IF db.receiptShipment[p] # 0 THEN
       /\ db.receiptShipment[p] = s /\ db.receiptAmount[p] = a
       /\ Commit(6,Cmd(10,p,s,a,0,{}),db)
     ELSE /\ s \in db.issued /\ a > 0 /\ db.balance[s] > 0
          /\ LET applied == IF a > db.balance[s] THEN db.balance[s] ELSE a
             IN Commit(6,Cmd(10,p,s,a,0,{}),[db EXCEPT
                  !.receiptShipment[p] = s, !.receiptAmount[p] = applied,
                  !.balance[s] = @ - applied, !.exposure[db.invoiceCustomer[s]] = @ - applied])
```
