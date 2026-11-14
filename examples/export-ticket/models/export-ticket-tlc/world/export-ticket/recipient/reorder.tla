\* A later transport copy arrived before its original reply, then that
\* original arrived too. These are two message deliveries of one receipt,
\* not two creations. reordered records the second arrival only after the
\* copy's real delivery while the original was still pending.
Target ==
  /\ recipient.mode = "up"
  /\ Cardinality(audit.created) = 1
  /\ \E k \in Keys :
       /\ k \in Attempted
       /\ k \in channel.copyFirst
       /\ k \in channel.reordered
       /\ k \notin channel.pending
       /\ k \notin channel.extra
       /\ requests[k].receipt \in receipts
       /\ requests[k].receipt \in recipient.seen
       /\ recipient.deliveries[requests[k].receipt] > 1
