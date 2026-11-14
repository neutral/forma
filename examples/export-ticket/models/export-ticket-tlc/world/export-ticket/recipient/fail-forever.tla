\* A permanent recipient failure has actually refused a reply. The model has
\* no transition from permanent (or its subsequent crashed mode) back to up.
Target ==
  /\ recipient.mode = "permanent"
  /\ audit.event = "return"
  /\ channel.pending = {}
  /\ ticket.claimed
  /\ \E k \in Keys :
       /\ k \in Attempted
       /\ k \in audit.failed
       /\ channel.route[k] = "direct"
       /\ requests[k].receipt \in receipts
       /\ requests[k].receipt \notin recipient.seen
       /\ recipient.deliveries[requests[k].receipt] = 0
