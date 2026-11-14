\* A reply pending when expiry occurred subsequently arrived. With only one
\* attempted key and no copy-first delivery, DelayReply released
\* the original. A copied reply overtaking its original is checked separately.
\* Expiry is an intervening event, not an invented reply deadline.
Target ==
  /\ ticket.expired
  /\ recipient.mode = "up"
  /\ \E k \in Keys :
       /\ Attempted = {k}
       /\ k \in audit.expiryPending
       /\ k \notin channel.pending
       /\ k \notin channel.copyFirst
       /\ channel.route[k] = "held"
       /\ requests[k].receipt \in receipts
       /\ requests[k].receipt \in recipient.seen
       /\ recipient.deliveries[requests[k].receipt] > 0
