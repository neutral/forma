Target ==
  /\ (focus = 2)
  /\ (hazard = 8)
  /\ (env.stage = 2)
  /\ (env.mode = 4)
  /\ (~ENABLED (RecordOrderRequest(<<1,1,2>>)))
  /\ (db.orderPhase[1] = "draft" /\ db.orderCustomer[1] = 1 /\ db.orderQty[1] = 2 /\ db.orderPhase[2] = "unrecorded" /\ db.confirmed = {})
  /\ (env.reply = 1)
  /\ (env.last = Cmd(4,1,1,2,0,{}))
