Target ==
  /\ (focus = 3)
  /\ (hazard = 2)
  /\ (env.stage = 2)
  /\ (env.copies = 2)
  /\ (env.retry = NoCmd)
  /\ (db.batchPhase[1] # "unrecorded" /\ db.batchCartons[1] = {1,2} /\ db.batchQty[1] = 2 /\ (\A c \in {1,2}: db.cartonBatch[c] = 1) /\ db.batchPhase[2] = "unrecorded" /\ (\A s \in Shipments: db.shipmentPhase[s] = "unprepared"))
