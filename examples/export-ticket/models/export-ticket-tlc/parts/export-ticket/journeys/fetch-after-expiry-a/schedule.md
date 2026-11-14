| Entity | Value |
| --- | --- |

| Step | Bindings |
| --- | --- |
| 1 | t = "t"; k = "a" |
| 2 | t = "t"; k = "a"; r = "r-a" |
| 3 | t = "t"; k = "a"; lose = FALSE |
| 4 | t = "t" |
| 5 | t = "t"; r = "r-a" |

| Field | Value |
| --- | --- |
| Meaning | After expiry the recipient reads the original receipt r-a; it is still the only receipt created or stored, and a is still the only completed request key. |

```tla
End == /\ ticket.expired
       /\ ticket.claimed
       /\ audit.fetchResult = "r-a"
       /\ "r-a" \in audit.fetched
       /\ "r-a" \in recipient.seen
       /\ receipts = {"r-a"}
       /\ audit.created = {"r-a"}
       /\ audit.expiryReceipts = {"r-a"}
       /\ Completed = {"a"}
```
