\* The historical creations identify every receipt that must remain durable.
\* Neither a reply's success nor permission to fetch is an antecedent.
Invariant ==
  audit.created # {} =>
    /\ audit.created \subseteq receipts
    /\ ticket.claimed
    /\ exportPresent
