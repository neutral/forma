Target ==
  /\ (focus = 1)
  /\ (hazard = 1)
  /\ (env.stage = 2)
  /\ (env.dropped = Cmd(2,1,1,0,1,{}))
  /\ (env.reply = 4)
  /\ (db.qaKind[1] = 1 /\ db.qaBatch[1] = 1 /\ db.qaRevision[1] = 0 /\ db.qaInspected[1] = 1 /\ db.batchPhase[1] = "released" /\ db.revision[1] = 1 /\ (\A k \in Decisions \ {1}: db.qaKind[k] = 0))
