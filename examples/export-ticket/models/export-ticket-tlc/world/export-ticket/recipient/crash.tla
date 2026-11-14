\* A delivered receipt was in the recipient's volatile view. Crash erased
\* that view while the service's claimed ticket, receipt and export survived.
Target ==
  /\ recipient.mode = "crashed"
  /\ recipient.seen = {}
  /\ ticket.claimed
  /\ exportPresent
  /\ \E r \in receipts : recipient.deliveries[r] > 0
