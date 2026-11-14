| Entity | Value |
| --- | --- |
| batch | 1 |
| invoice | 1 |
| order | 1 |
| shipment | 1 |

| Step | Bindings |
| --- | --- |
| 1 | request = IF profile = 2 /\ <<1, {1,2}, 2>> \in BatchRequests THEN <<1, {1,2}, 2>> ELSE <<1, {}, 1>> |
| 2 | request = <<1, 1, 0, TRUE>> |
| 3 | request = <<1, 1, 2>> |
| 4 | request = <<1, 1, 2, {1,2}>> |
| 5 | request = <<1, 1, {1,2}>> |
| 6 | s = 1 |
| 7 | s = 1 |
| 8 | request = <<1, 1, 2>> |

| Field | Value |
| --- | --- |
| Meaning | Invoice S is settled by receipt P1 for £20 and exposure is zero; this is the positive companion to orders-and-accounts/journeys/payment-before-invoice from their common unchanged pre-state after step 6, followed here by invoice issue and successful application of the same reference, invoice and amount. |

```tla
End ==
  /\ limits[1] = 10
  /\ db.issued = {1} /\ db.invoiceCount[1] = 1
  /\ db.invoiceCustomer[1] = 1 /\ db.invoiceOriginal[1] = 2
  /\ db.balance[1] = 0 /\ db.pending[1] = 0
  /\ db.receiptShipment[1] = 1 /\ db.receiptAmount[1] = 2
  /\ Paid(1) = 2 /\ db.exposure[1] = 0
  /\ db.orderPhase[1] = "complete" /\ db.shipmentPhase[1] = "collected"
```
