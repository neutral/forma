| Field | Value |
| --- | --- |
| Meaning | A completed receipt and its claim and prepared export remain stored after both expiry and failure or loss of that receipt request's reply, without requiring any fetch. |

```tla
Target ==
  /\ ticket.expired
  /\ ticket.claimed
  /\ exportPresent
  /\ Cardinality(audit.created) = 1
  /\ audit.created = audit.expiryReceipts
  /\ audit.created \subseteq receipts
  /\ audit.fetched = {}
  /\ \E k \in Completed :
       /\ k \in audit.lost
       /\ k \in audit.failed
       /\ requests[k].receipt \in receipts
```
