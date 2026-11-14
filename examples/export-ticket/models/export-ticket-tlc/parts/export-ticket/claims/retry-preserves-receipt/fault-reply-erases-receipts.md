| Field | Value |
| --- | --- |
| Action | export-ticket/return-retry-receipt |
| Mechanism | A retry reply leaves the service's stored receipts intact whether delivery succeeds or fails. Removing only that preservation permits erasing stored receipts during the reply attempt. |

```tla
Fault(t, k) ==
  /\ requests[k].retryCompleted /\ ~requests[k].retryReplied /\ ticket.claimed
  /\ requests[k].retryReceipt \in receipts
  /\ LET r == ReplyReceipt(k, "retry")
         c == ChannelFor("retry")
         succeeds == recipient.mode = "up" /\ c.route[k] = "direct"
         waits == c.route[k] # "dropped"
                   /\ (recipient.mode = "silent"
                       \/ (recipient.mode = "up" /\ c.route[k] = "held"))
         sent == WithChannel(channel, "retry",
                   [c EXCEPT !.before = @ \cup (ReplyAttempted("retry") \X {k}),
                             !.pending = IF waits THEN @ \cup {k} ELSE @])
     IN /\ requests' = [requests EXCEPT ![k].retryReplied = TRUE]
        /\ channel' = [sent EXCEPT !.replyBefore = @ \cup (AllAttempted \X {<<k, "retry">>})]
        /\ recipient' = IF succeeds THEN Delivered(recipient, r) ELSE recipient
        /\ audit' = MarkReply(audit, "retry",
             IF ~succeeds /\ ~waits THEN {k} ELSE {},
             IF c.route[k] = "dropped" \/ recipient.mode = "crashed" THEN {k} ELSE {},
             IF recipient.mode = "transient" THEN {k} ELSE {}, "return-retry")
  \* The sole change from the expanded reply action: a finite, type-correct
  \* weakening of UNCHANGED receipts that permits deletion, never creation.
  /\ receipts' \in SUBSET receipts
  /\ UNCHANGED <<ticket, exportPresent>>
```
