| Field | Value |
| --- | --- |
| Meaning | An exact retry of the shipment invoice request is pending while the existing invoice is part-paid. Its original customer and amount and single invoice record remain, with ten pounds outstanding; this target does not order the retry queueing relative to the partial payment or assert that the pending retry has been processed. |

```tla
Target ==
  /\ focus = 6 /\ hazard = 2 /\ env.retry # NoCmd /\ CmdKind(env.retry) = 9
  /\ LET s == CmdId(env.retry)
     IN /\ s \in db.issued /\ db.invoiceCount[s] = 1
        /\ db.invoiceOriginal[s] = 2 /\ Paid(s) = 1 /\ db.balance[s] = 1
        /\ db.invoiceCustomer[s] = db.orderCustomer[db.shipmentOrder[s]]
```
