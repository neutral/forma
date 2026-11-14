Target ==
  /\ (focus = 4)
  /\ (hazard = 8)
  /\ (env.stage = 2)
  /\ (env.mode = 4)
  /\ (~ENABLED (CancelRemainder(1)))
  /\ (db.orderPhase[1] = "cancelled" /\ db.orderPhase[2] = "unrecorded" /\ db.shipmentPhase[1] = "void" /\ db.shipmentCartons[1] = {1,2} /\ db.commitment[1] = 0 /\ (\A c \in {1,2}: c \in db.onHand /\ db.reserved[c] = 0 /\ db.picked[c] = 0))
  /\ (env.reply = 1)
  /\ (env.last = Cmd(8,1,0,0,0,{}))
