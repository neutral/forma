Target ==
  /\ (focus = 2)
  /\ (hazard = 2)
  /\ (env.stage = 2)
  /\ (env.copies = 2)
  /\ (env.retry = NoCmd)
  /\ (db.orderPhase[1] = "draft" /\ db.orderCustomer[1] = 1 /\ db.orderQty[1] = 2 /\ db.orderPhase[2] = "unrecorded" /\ db.confirmed = {})
