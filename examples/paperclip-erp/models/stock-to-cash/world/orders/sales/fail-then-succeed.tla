Target ==
  /\ (focus = 2)
  /\ (hazard = 6)
  /\ (env.stage = 2)
  /\ (env.failure = 2)
  /\ (env.mode = 0)
  /\ (db.orderPhase[1] = "draft" /\ db.orderCustomer[1] = 1 /\ db.orderQty[1] = 2 /\ db.orderPhase[2] = "unrecorded" /\ db.confirmed = {})
