| Field | Value |
| --- | --- |
| Action | export-ticket/complete |
| Mechanism | Receipt creation checks that the ticket is still active in the same atomic store action that creates the receipt and marks the ticket claimed; a remembered passing check cannot authorize creation after expiry. |

```tla
Fault(t, k, r) ==
  /\ ~ticket.claimed
  /\ requests[k].checked /\ ~requests[k].completed
  /\ r \notin audit.created
  /\ ticket' = [ticket EXCEPT !.claimed = TRUE]
  /\ requests' = [requests EXCEPT ![k].completed = TRUE, ![k].receipt = r]
  /\ receipts' = receipts \cup {r}
  /\ audit' = [audit EXCEPT !.created = @ \cup {r}, !.event = "complete"]
  /\ UNCHANGED <<exportPresent, channel, recipient>>
```
