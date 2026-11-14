Target ==
  /\ (focus = 5)
  /\ (hazard = 8)
  /\ (env.stage = 2)
  /\ (env.mode = 4)
  /\ (~ENABLED (CollectShipment(1)))
  /\ (db.shipmentPhase[1] = "collected" /\ db.shipmentPhase[2] = "unprepared" /\ db.shipmentCartons[1] = {1,2} /\ (\A c \in {1,2}: db.collectedBy[c] = 1 /\ db.collectionCount[c] = 1 /\ c \notin db.onHand) /\ db.pending[1] = 2 /\ 1 \notin db.issued)
  /\ (env.reply = 1)
  /\ (env.last = Cmd(7,1,0,0,0,{}))
