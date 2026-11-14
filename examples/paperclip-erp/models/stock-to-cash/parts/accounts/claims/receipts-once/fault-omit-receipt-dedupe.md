| Field | Value |
| --- | --- |
| Action | accounts/apply-receipt |
| Mechanism | Remove the successful-reference lookup that returns a receipt replay without applying it again; a reused reference can pass the ordinary positive amount and remaining balance checks and be applied again. |

```tla
Fault(request) ==
  LET p == request[1] s == request[2] a == request[3]
  IN /\ s \in db.issued /\ a > 0 /\ a <= db.balance[s]
     /\ Commit(6,Cmd(10,p,s,a,0,{}),[db EXCEPT
          !.receiptShipment[p] = s, !.receiptAmount[p] = a,
          !.balance[s] = @ - a, !.exposure[db.invoiceCustomer[s]] = @ - a])
```
