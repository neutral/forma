Target ==
  /\ (focus = 3)
  /\ (hazard = 6)
  /\ (env.stage = 2)
  /\ (env.failure = 2)
  /\ (env.mode = 0)
  /\ (db.batchPhase[1] # "unrecorded" /\ db.batchCartons[1] = {1,2} /\ db.batchQty[1] = 2 /\ (\A c \in {1,2}: db.cartonBatch[c] = 1) /\ db.batchPhase[2] = "unrecorded" /\ (\A s \in Shipments: db.shipmentPhase[s] = "unprepared"))
