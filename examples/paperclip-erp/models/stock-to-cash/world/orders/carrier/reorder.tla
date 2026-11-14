Target ==
  /\ (focus = 5)
  /\ (hazard = 4)
  /\ (env.stage = 2)
  /\ (env.delayed = Cmd(7,1,0,0,0,{}))
  /\ (env.delivered = Cmd(7,2,0,0,0,{}))
  /\ (env.reply = 3)
  /\ (db.orderPhase[1] = "complete" /\ db.shipmentPhase[1] = "collected" /\ db.shipmentPhase[2] = "collected" /\ db.pending[1] = 2 /\ db.pending[2] = 2 /\ (\A c \in {1,2}: db.collectedBy[c] = 1 /\ db.collectionCount[c] = 1) /\ (\A c \in {3,4}: db.collectedBy[c] = 2 /\ db.collectionCount[c] = 1))
