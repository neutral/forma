Target ==
  /\ (focus = 2)
  /\ (hazard = 5)
  /\ (env.stage = 2)
  /\ (env.mode = 2)
  /\ (~ENABLED (RecordOrderRequest(<<1,1,2>>)))
  /\ (db.orderPhase[1] = "draft" /\ db.orderCustomer[1] = 1 /\ db.orderQty[1] = 2 /\ db.orderPhase[2] = "unrecorded" /\ db.confirmed = {})
  /\ (env.reply = 5)
