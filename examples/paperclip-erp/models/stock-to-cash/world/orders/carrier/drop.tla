Target ==
  /\ (focus = 5)
  /\ (hazard = 1)
  /\ (env.stage = 2)
  /\ (env.dropped = Cmd(7,1,0,0,0,{}))
  /\ (env.reply = 4)
  /\ (db.shipmentPhase[1] = "collected" /\ db.shipmentPhase[2] = "unprepared" /\ db.shipmentCartons[1] = {1,2} /\ (\A c \in {1,2}: db.collectedBy[c] = 1 /\ db.collectionCount[c] = 1 /\ c \notin db.onHand) /\ db.pending[1] = 2 /\ 1 \notin db.issued)
