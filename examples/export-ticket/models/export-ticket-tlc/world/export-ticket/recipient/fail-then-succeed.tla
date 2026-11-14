\* This key's direct reply failed while the recipient was transiently down.
\* A later fetch now succeeds for that same durable receipt after recovery.
\* ReturnReceipt is deliberately not retried: the design allows one attempt.
Target ==
  /\ recipient.mode = "up"
  /\ audit.event = "fetch"
  /\ \E k \in Keys :
       /\ k \in Attempted
       /\ k \in audit.transientFailed
       /\ k \in audit.failed
       /\ channel.route[k] = "direct"
       /\ k \notin channel.pending
       /\ requests[k].receipt \in receipts
       /\ audit.fetchResult = requests[k].receipt
       /\ requests[k].receipt \in audit.fetched
       /\ requests[k].receipt \in recipient.seen
       /\ recipient.deliveries[requests[k].receipt] = 0
