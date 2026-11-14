\* The service attempted its reply, but the dropped reply is neither pending
\* nor received. Its stored receipt remains available to a live recipient.
Target ==
  /\ recipient.mode = "up"
  /\ ticket.claimed
  /\ \E k \in Keys :
       /\ k \in Attempted
       /\ channel.route[k] = "dropped"
       /\ k \in audit.lost
       /\ k \in audit.failed
       /\ k \notin channel.pending
       /\ k \notin channel.extra
       /\ requests[k].receipt \in receipts
       /\ requests[k].receipt \notin recipient.seen
       /\ recipient.deliveries[requests[k].receipt] = 0
