Target ==
  /\ (focus = 6)
  /\ (hazard = 4)
  /\ (env.stage = 2)
  /\ (env.delayed = Cmd(9,1,0,0,0,{}))
  /\ (env.delivered = Cmd(10,1,1,1,0,{}))
  /\ (env.reply = 3)
  /\ (1 \in db.issued /\ db.invoiceCount[1] = 1 /\ db.invoiceOriginal[1] = 2 /\ db.receiptShipment[1] = 1 /\ db.receiptAmount[1] = 1 /\ db.balance[1] = 1)
