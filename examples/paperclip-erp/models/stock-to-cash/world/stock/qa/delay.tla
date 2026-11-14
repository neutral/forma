Target ==
  /\ (focus = 1)
  /\ (hazard = 3)
  /\ (env.stage = 2)
  /\ (env.delayed = Cmd(2,1,1,0,1,{}))
  /\ (env.reply = 2)
  /\ (db.qaKind[1] = 1 /\ db.qaKind[2] = 2 /\ db.qaRevision[1] = 0 /\ db.qaRevision[2] = 1 /\ db.batchPhase[1] = "held" /\ db.revision[1] = 2)
