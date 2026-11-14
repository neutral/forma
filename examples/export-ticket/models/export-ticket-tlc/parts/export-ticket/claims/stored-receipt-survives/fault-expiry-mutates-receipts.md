| Field | Value |
| --- | --- |
| Action | export-ticket/expire |
| Mechanism | Expiry preserves the stored receipts. Remove only that frame condition by allowing any subset of the model's finite receipt-id set; keep the expiry snapshot, claim, remembered checks, export and recipient state unchanged as before. |

```tla
Fault(t) ==
  /\ ~ticket.expired
  /\ ticket' = [ticket EXCEPT !.expired = TRUE]
  /\ audit' = [audit EXCEPT !.expiryReceipts = audit.created,
                !.expiryPending = channel.pending, !.event = "expire"]
  /\ receipts' \in SUBSET ReceiptIds
  /\ UNCHANGED <<requests, exportPresent, channel, recipient>>
```
