| Field | Value |
| --- | --- |
| Meaning | A shipment is collected once and its batch is currently released at revision three; the quality ledger retains an earlier hold decision and a later inspected release. |

```tla
Target ==
  /\ db.shipmentPhase[1] = "collected" /\ db.shipmentCartons[1] = PairA
  /\ db.batchPhase[1] = "released" /\ db.revision[1] = 3
  /\ db.qaKind[2] = 2 /\ db.qaRevision[2] = 1
  /\ db.qaKind[3] = 1 /\ db.qaRevision[3] = 2 /\ db.qaInspected[3] = 1
  /\ \A c \in PairA: db.collectedBy[c] = 1 /\ db.collectionCount[c] = 1 /\ c \notin db.onHand
```
