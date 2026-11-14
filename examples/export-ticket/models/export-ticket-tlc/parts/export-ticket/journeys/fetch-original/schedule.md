| Entity | Value |
| --- | --- |

| Step | Bindings |
| --- | --- |
| 1 | t = "t"; k = "a" |
| 2 | t = "t"; k = "a"; r = "r-a" |
| 3 | t = "t"; k = "a"; lose = FALSE |
| 4 | t = "t"; r = "r-a" |

| Field | Value |
| --- | --- |
| Meaning | While the ticket is active, the recipient reads r-a; the sole stored and created receipt is still r-a, and the fetch completes no additional request key. |

```tla
End == /\ ~ticket.expired
       /\ audit.fetchResult = "r-a"
       /\ "r-a" \in audit.fetched
       /\ "r-a" \in recipient.seen
       /\ receipts = {"r-a"}
       /\ audit.created = {"r-a"}
       /\ Completed = {"a"}
```
