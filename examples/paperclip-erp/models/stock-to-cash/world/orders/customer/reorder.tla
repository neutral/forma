Target ==
  /\ (focus = 4)
  /\ (hazard = 4)
  /\ (env.stage = 2)
  /\ (env.delayed = Cmd(8,1,0,0,0,{}))
  /\ (env.delivered = Cmd(8,2,0,0,0,{}))
  /\ (env.reply = 3)
  /\ (db.orderPhase[1] = "cancelled" /\ db.orderPhase[2] = "cancelled" /\ db.orderCartons[1] = {1,2} /\ db.orderCartons[2] = {1,2} /\ (\A c \in {1,2}: c \in db.onHand /\ db.reserved[c] = 0 /\ db.picked[c] = 0))
