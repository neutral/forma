| Field | Value |
| --- | --- |
| Action | stock/hold-batch |
| Mechanism | Remove the frame preserving the batch link of already-collected cartons affected by a fresh hold. Each such link may take any batch identity or the unused marker within its type; all other fields and cartons retain the ordinary hold behavior. |

```tla
Fault(request) ==
  LET k == request[1] b == request[2] v == request[3]
  IN
    IF db.qaKind[k] = 0 THEN
      /\ db.batchPhase[b] = "released" /\ v = db.revision[b]
      /\ \E links \in [Cartons -> Batches \cup {0}]:
           /\ \A c \in Cartons:
                (db.collectedBy[c] = 0 \/ db.cartonBatch[c] # b) => links[c] = db.cartonBatch[c]
           /\ Commit(1,Cmd(3,k,b,v,0,{}),[db EXCEPT
                !.cartonBatch = links,
                !.batchPhase[b] = "held", !.revision[b] = @ + 1,
                !.qaKind[k] = 2, !.qaBatch[k] = b, !.qaRevision[k] = v])
    ELSE /\ db.qaKind[k] = 2 /\ db.qaBatch[k] = b /\ db.qaRevision[k] = v
         /\ Commit(1,Cmd(3,k,b,v,0,{}),db)
```
