| Field | Value |
| --- | --- |
| Meaning | After exactly one receipt was created and the ticket expired, a fetch reads that original stored receipt while its claim and export remain present. The developer chose to permit this post-expiry fetch. |

```tla
Target ==
  /\ ticket.expired
  /\ ticket.claimed
  /\ exportPresent
  /\ Cardinality(audit.created) = 1
  /\ audit.created = audit.expiryReceipts
  /\ receipts = audit.created
  /\ audit.event = "fetch"
  /\ audit.fetched = audit.created
  /\ audit.fetchResult \in receipts
```
