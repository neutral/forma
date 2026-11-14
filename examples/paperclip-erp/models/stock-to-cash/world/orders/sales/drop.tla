Target ==
  /\ (focus = 2)
  /\ (hazard = 1)
  /\ (env.stage = 2)
  /\ (env.dropped = Cmd(4,1,1,2,0,{}))
  /\ (env.reply = 4)
  /\ (db.orderPhase[1] = "draft" /\ db.orderCustomer[1] = 1 /\ db.orderQty[1] = 2 /\ db.orderPhase[2] = "unrecorded" /\ db.confirmed = {})
