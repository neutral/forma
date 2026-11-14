Target ==
  /\ (focus = 1)
  /\ (hazard = 6)
  /\ (env.stage = 2)
  /\ (env.failure = 2)
  /\ (env.mode = 0)
  /\ (db.qaKind[1] = 1 /\ db.qaBatch[1] = 1 /\ db.qaRevision[1] = 0 /\ db.qaInspected[1] = 1 /\ db.batchPhase[1] = "released" /\ db.revision[1] = 1 /\ (\A k \in Decisions \ {1}: db.qaKind[k] = 0))
