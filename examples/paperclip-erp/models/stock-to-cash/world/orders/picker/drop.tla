Target ==
  /\ (focus = 3)
  /\ (hazard = 1)
  /\ (env.stage = 2)
  /\ (env.dropped = Cmd(1,1,2,0,0,{1,2}))
  /\ (env.reply = 4)
  /\ (db.batchPhase[1] # "unrecorded" /\ db.batchCartons[1] = {1,2} /\ db.batchQty[1] = 2 /\ (\A c \in {1,2}: db.cartonBatch[c] = 1) /\ db.batchPhase[2] = "unrecorded" /\ (\A s \in Shipments: db.shipmentPhase[s] = "unprepared"))
