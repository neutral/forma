Target ==
  /\ (focus = 3)
  /\ (hazard = 3)
  /\ (env.stage = 2)
  /\ (env.delayed = Cmd(1,1,2,0,0,{1,2}))
  /\ (env.reply = 2)
  /\ (db.batchCartons[1] = {1,2} /\ db.batchQty[1] = 2 /\ db.shipmentPhase[1] = "prepared" /\ db.shipmentOrder[1] = 1 /\ db.shipmentCartons[1] = {1,2} /\ (\A c \in {1,2}: db.cartonBatch[c] = 1 /\ db.picked[c] = 1))
