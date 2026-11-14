| Field | Value |
| --- | --- |
| Action | export-ticket/complete |
| Mechanism | Receipt creation checks that the ticket is still unclaimed in the same atomic store action that creates the receipt and marks the ticket claimed, so only one overlapping request key can create a receipt. |

```tla
Fault(t, k, r) ==
  /\ ~ticket.expired
  /\ requests[k].checked /\ ~requests[k].completed
  /\ r \notin audit.created
  /\ ticket' = [ticket EXCEPT !.claimed = TRUE]
  /\ requests' = [requests EXCEPT ![k].completed = TRUE, ![k].receipt = r]
  /\ receipts' = receipts \cup {r}
  /\ audit' = [audit EXCEPT !.created = @ \cup {r}, !.event = "complete"]
  /\ UNCHANGED <<exportPresent, channel, recipient>>
```
