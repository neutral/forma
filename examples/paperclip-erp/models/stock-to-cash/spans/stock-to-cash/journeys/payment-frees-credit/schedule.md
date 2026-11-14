| Entity | Value |
| --- | --- |
| batch | 1 |
| first-order | 1 |
| first-shipment | 1 |
| invoice | 1 |
| second-order | 2 |

| Start |
| --- |
| Init /\ profile = 1 |

| Step | Bindings |
| --- | --- |
| 1 | request = <<1, {1,2,3,4}, 4>> |
| 2 | request = <<1, 1, 0, TRUE>> |
| 3 | request = <<1, 1, 2>> |
| 4 | request = <<2, 1, 2>> |
| 5 | request = <<1, 1, 2, {1,2}>> |
| 6 | request = <<1, 1, {1,2}>> |
| 7 | s = 1 |
| 8 | s = 1 |
| 9 | request = <<1, 1, 2>> |
| 10 | request = <<2, 1, 2, {3,4}>> |

| Field | Value |
| --- | --- |
| Meaning | The first invoice is settled and O2 reserves c3 and c4, restoring Northline exposure to £20 without exceeding its limit; this positive path pairs with orders-and-accounts/journeys/last-credit at their common unchanged pre-state after step 5 and orders-and-accounts/journeys/uninvoiced-credit after step 7, where the same O2 confirmation is refused by those companion journeys. |

```tla
End ==
  /\ limits[1] = 2 /\ db.orderCustomer[1] = 1 /\ db.orderCustomer[2] = 1
  /\ db.orderPhase[1] = "complete" /\ db.shipmentPhase[1] = "collected"
  /\ db.issued = {1} /\ db.invoiceCount[1] = 1
  /\ db.invoiceOriginal[1] = 2 /\ db.balance[1] = 0 /\ db.pending[1] = 0
  /\ db.receiptShipment[1] = 1 /\ db.receiptAmount[1] = 2
  /\ db.orderPhase[2] = "open" /\ 2 \in db.confirmed
  /\ db.orderCartons[2] = {3,4} /\ Reserved(2) = {3,4}
  /\ db.onHand = {3,4} /\ db.commitment[1] = 0 /\ db.commitment[2] = 2
  /\ db.exposure[1] = 2 /\ db.exposure[1] <= limits[1]
```
