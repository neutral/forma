| Field | Value |
| --- | --- |
| Action | export-ticket/fetch-receipt |
| Mechanism | Fetching returns the identity of the stored receipt being read. Widen only that returned identity from the selected receipt to any receipt id; retain the existing-receipt guard, fetched-id record, recipient effect and every durable-state frame. |

```tla
Fault(t, r) ==
  /\ r \in receipts /\ ticket.claimed
  /\ \E result \in ReceiptIds :
       audit' = [audit EXCEPT !.fetched = @ \cup {r},
                  !.fetchResult = result, !.event = "fetch"]
  /\ recipient' = IF recipient.mode = "up"
                   THEN [recipient EXCEPT !.seen = @ \cup {r}] ELSE recipient
  /\ UNCHANGED <<ticket, requests, receipts, exportPresent, channel>>
```
