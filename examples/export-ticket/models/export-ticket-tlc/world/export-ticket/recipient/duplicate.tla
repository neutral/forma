\* The reply for one stable request key arrived at least twice with the same
\* receipt identity before any retry reply is attempted. Two legitimate
\* sends of the same durable result cannot satisfy this transport-copy target.
Target ==
  /\ recipient.mode = "up"
  /\ RetryAttempted = {}
  /\ \E k \in Keys :
       /\ k \in Attempted
       /\ requests[k].receipt \in receipts
       /\ requests[k].receipt \in recipient.seen
       /\ recipient.deliveries[requests[k].receipt] > 1
