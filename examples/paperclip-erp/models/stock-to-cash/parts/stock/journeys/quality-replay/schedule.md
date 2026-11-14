| Entity | Value |
| --- | --- |
| batch | 1 |

| Step | Bindings |
| --- | --- |
| 1 | request = IF profile = 2 /\ <<1, {1,2}, 2>> \in BatchRequests THEN <<1, {1,2}, 2>> ELSE <<1, {}, 1>> |
| 2 | request = <<1, {1,2}, 2>> |
| 3 | request = <<1, 1, 0, TRUE>> |
| 4 | request = <<2, 1, 1>> |
| 5 | request = <<1, 1, 0, TRUE>> |
| 6 | request = <<1, {1,2}, 2>> |

| Field | Value |
| --- | --- |
| Meaning | Exactly c1 and c2 remain recorded in B, B remains held at revision 2, and neither old release nor batch-receipt replay changes it. |

```tla
End ==
  /\ Recorded = {1,2}
  /\ db.batchCartons[1] = {1,2} /\ db.batchQty[1] = 2
  /\ db.batchPhase[1] = "held" /\ db.revision[1] = 2
  /\ db.qaKind[1] = 1 /\ db.qaBatch[1] = 1 /\ db.qaRevision[1] = 0
  /\ db.qaInspected[1] = 1
  /\ db.qaKind[2] = 2 /\ db.qaBatch[2] = 1 /\ db.qaRevision[2] = 1
  /\ db.onHand = {1,2} /\ (\A c \in {1,2}: db.cartonBatch[c] = 1)
```
