\* After the recipient began the exchange, the service completed and tried
\* its direct reply. The silent recipient leaves it pending and unseen.
Target ==
  /\ recipient.mode = "silent"
  /\ ticket.claimed
  /\ \E k \in Keys :
       /\ requests[k].checked
       /\ requests[k].completed
       /\ k \in Attempted
       /\ channel.route[k] = "direct"
       /\ k \in channel.pending
       /\ k \notin audit.failed
       /\ requests[k].receipt \in receipts
       /\ requests[k].receipt \notin recipient.seen
       /\ recipient.deliveries[requests[k].receipt] = 0
