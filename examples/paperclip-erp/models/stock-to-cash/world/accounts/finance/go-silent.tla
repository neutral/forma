Target ==
  /\ (focus = 6)
  /\ (hazard = 8)
  /\ (env.stage = 2)
  /\ (env.mode = 4)
  /\ (~ENABLED (IssueInvoice(1)))
  /\ (db.issued = {1} /\ db.invoiceCount[1] = 1 /\ db.invoiceOriginal[1] = 2 /\ db.balance[1] = 2 /\ db.invoiceCustomer[1] = 1 /\ (\A p \in Receipts: db.receiptShipment[p] = 0))
  /\ (env.reply = 1)
  /\ (env.last = Cmd(9,1,0,0,0,{}))
