| Field | Value |
| --- | --- |
| Meaning | Exactly one receipt has been created, its completed request has a failed or lost reply, and a different passing check remains unfinished. The intended one-receipt limit is met while an overlapping contender remains. |

```tla
Target ==
  /\ Cardinality(audit.created) = 1
  /\ PendingChecks # {}
  /\ \E k \in Completed : k \in audit.lost /\ k \in audit.failed
```
