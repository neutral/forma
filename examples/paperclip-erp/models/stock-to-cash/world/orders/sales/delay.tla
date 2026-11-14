Target ==
  /\ (focus = 2)
  /\ (hazard = 3)
  /\ (env.stage = 2)
  /\ (env.delayed = Cmd(4,1,1,2,0,{}))
  /\ (env.reply = 2)
  /\ (db.orderPhase[1] = "open" /\ db.orderCustomer[1] = 1 /\ db.orderQty[1] = 2 /\ 1 \in db.confirmed /\ db.orderCartons[1] = {1,2} /\ db.commitment[1] = 2)
