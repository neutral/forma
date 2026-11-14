| Entity | Value |
| --- | --- |

| Step | Bindings |
| --- | --- |
| 1 | t = "t"; k = "a" |
| 2 | t = "t"; k = "a"; r = "r-a" |
| 3 | t = "t"; k = "a"; lose = TRUE |
| 4 | t = "t" |
| 5 | t = "t"; r = "r-a" |

| Field | Value |
| --- | --- |
| Meaning | The original reply for key a was lost without being observed. After expiry, fetching returns the same original stored receipt r-a to the recipient; the ticket remains claimed, and r-a is the only receipt stored or ever created. |

```tla
End ==
  /\ ticket.expired /\ ticket.claimed
  /\ requests["a"].completed /\ requests["a"].receipt = "r-a"
  /\ requests["a"].replied /\ "a" \in audit.lost
  /\ recipient.replies["a"] = {}
  /\ receipts = {"r-a"} /\ audit.created = {"r-a"}
  /\ audit.fetchResult = "r-a" /\ "r-a" \in audit.fetched
  /\ "r-a" \in recipient.seen
```
