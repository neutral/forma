| Field | Value |
| --- | --- |
| Meaning | Expiry has occurred with a remembered passing check still unfinished and no receipt yet created; the check is preserved, but completion must now refuse creation. |

```tla
Target ==
  /\ ticket.expired
  /\ PendingChecks # {}
  /\ audit.created = {}
  /\ audit.expiryReceipts = {}
```
