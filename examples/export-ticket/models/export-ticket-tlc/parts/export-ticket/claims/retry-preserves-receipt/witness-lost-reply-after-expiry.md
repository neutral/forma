| Field | Value |
| --- | --- |
| Meaning | After expiry, the recipient has just retried a key whose original receipt remains stored after a lost reply. The retry is queued and has not executed, and exactly one receipt has been created. |

```tla
Target ==
  /\ ticket.expired
  /\ ticket.claimed
  /\ Cardinality(audit.created) = 1
  /\ audit.event = "request-retry"
  /\ \E k \in Keys :
       /\ requests[k].completed
       /\ requests[k].receipt \in receipts
       /\ requests[k].replied
       /\ k \in audit.lost
       /\ recipient.replies[k] = {}
       /\ recipient.retrySent = {k}
       /\ requests[k].retryAvailable
       /\ ~requests[k].retryCompleted
```
