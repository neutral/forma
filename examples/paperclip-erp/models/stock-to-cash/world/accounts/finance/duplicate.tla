Target ==
  /\ (focus = 6)
  /\ (hazard = 2)
  /\ (env.stage = 2)
  /\ (env.copies = 2)
  /\ (env.retry = NoCmd)
  /\ (db.issued = {1} /\ db.invoiceCount[1] = 1 /\ db.invoiceOriginal[1] = 2 /\ db.balance[1] = 2 /\ db.invoiceCustomer[1] = 1 /\ (\A p \in Receipts: db.receiptShipment[p] = 0))
