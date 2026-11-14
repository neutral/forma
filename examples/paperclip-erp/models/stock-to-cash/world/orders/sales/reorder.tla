Target ==
  /\ (focus = 2)
  /\ (hazard = 4)
  /\ (env.stage = 2)
  /\ (env.delayed = Cmd(4,1,1,2,0,{}))
  /\ (env.delivered = Cmd(4,2,2,2,0,{}))
  /\ (env.reply = 3)
  /\ (db.orderPhase[1] = "draft" /\ db.orderPhase[2] = "draft" /\ db.orderCustomer[1] = 1 /\ db.orderCustomer[2] = 2 /\ db.orderQty[1] = 2 /\ db.orderQty[2] = 2)
