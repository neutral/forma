| Field | Value |
| --- | --- |
| Meaning | One held batch identifies two collected shipments for different customers: the first order has a cancelled remainder and part-paid invoice, and the second retains its collected but uninvoiced obligation. |

```tla
Target ==
  /\ db.batchPhase[1] = "held" /\ db.batchCartons[1] = Cartons
  /\ db.orderPhase[1] = "cancelled" /\ db.orderCustomer[1] = 1 /\ db.orderCustomer[2] = 2
  /\ db.shipmentPhase[1] = "collected" /\ db.shipmentOrder[1] = 1 /\ db.shipmentCartons[1] = PairA
  /\ db.shipmentPhase[2] = "collected" /\ db.shipmentOrder[2] = 2 /\ db.shipmentCartons[2] = PairB
  /\ 1 \in db.issued /\ db.invoiceCustomer[1] = 1 /\ db.balance[1] = 1 /\ Paid(1) = 1
  /\ 2 \notin db.issued /\ db.pending[2] = 2
  /\ \A c \in PairA: db.cartonBatch[c] = 1 /\ db.collectedBy[c] = 1
  /\ \A c \in PairB: db.cartonBatch[c] = 1 /\ db.collectedBy[c] = 2
```
