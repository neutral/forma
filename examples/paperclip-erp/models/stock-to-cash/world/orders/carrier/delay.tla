Target ==
  /\ (focus = 5)
  /\ (hazard = 3)
  /\ (env.stage = 2)
  /\ (env.delayed = Cmd(7,1,0,0,0,{}))
  /\ (env.reply = 2)
  /\ (db.shipmentPhase[1] = "collected" /\ 1 \in db.issued /\ db.pending[1] = 0 /\ db.invoiceCount[1] = 1 /\ db.invoiceOriginal[1] = 2 /\ (\A c \in {1,2}: db.collectedBy[c] = 1 /\ db.collectionCount[c] = 1))
