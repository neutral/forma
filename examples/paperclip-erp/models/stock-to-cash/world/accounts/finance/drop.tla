Target ==
  /\ (focus = 6)
  /\ (hazard = 1)
  /\ (env.stage = 2)
  /\ (env.dropped = Cmd(9,1,0,0,0,{}))
  /\ (env.reply = 4)
  /\ (db.issued = {1} /\ db.invoiceCount[1] = 1 /\ db.invoiceOriginal[1] = 2 /\ db.balance[1] = 2 /\ db.invoiceCustomer[1] = 1 /\ (\A p \in Receipts: db.receiptShipment[p] = 0))
