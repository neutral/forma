Target ==
  /\ (focus = 4)
  /\ (hazard = 3)
  /\ (env.stage = 2)
  /\ (env.delayed = Cmd(8,1,0,0,0,{}))
  /\ (env.reply = 2)
  /\ (db.orderPhase[1] = "cancelled" /\ db.shipmentPhase[1] = "void" /\ db.orderPhase[2] = "open" /\ db.orderCustomer[2] = 2 /\ db.orderCartons[2] = {1,2} /\ (\A c \in {1,2}: db.reserved[c] = 2 /\ c \in db.onHand))
