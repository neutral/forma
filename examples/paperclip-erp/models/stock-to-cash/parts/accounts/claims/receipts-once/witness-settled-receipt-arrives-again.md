| Field | Value |
| --- | --- |
| Meaning | An exact retry of a successful receipt request is pending while its invoice is settled. The reference still identifies the same invoice and full amount, with no remaining balance; this target does not assert that the pending retry has been processed. |

```tla
Target ==
  /\ focus = 6 /\ hazard = 2 /\ env.retry # NoCmd /\ CmdKind(env.retry) = 10
  /\ LET p == CmdId(env.retry) s == CmdA(env.retry) a == CmdB(env.retry)
     IN /\ db.receiptShipment[p] = s /\ db.receiptAmount[p] = a /\ a > 0
        /\ s \in db.issued /\ db.balance[s] = 0 /\ a = db.invoiceOriginal[s]
```
