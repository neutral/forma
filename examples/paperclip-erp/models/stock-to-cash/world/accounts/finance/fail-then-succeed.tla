Target ==
  /\ (focus = 6)
  /\ (hazard = 6)
  /\ (env.stage = 2)
  /\ (env.failure = 2)
  /\ (env.mode = 0)
  /\ (db.issued = {1} /\ db.invoiceCount[1] = 1 /\ db.invoiceOriginal[1] = 2 /\ db.balance[1] = 2 /\ db.invoiceCustomer[1] = 1 /\ (\A p \in Receipts: db.receiptShipment[p] = 0))
