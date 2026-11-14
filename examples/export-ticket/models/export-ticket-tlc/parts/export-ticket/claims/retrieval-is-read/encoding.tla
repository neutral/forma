\* Observe a fetch by its recorded event, never by calling FetchReceipt.
\* Re-reading an old id is allowed before or after expiry, with any number
\* of previously created receipts; this does not assume the other claims.
Property == [][
  audit.event' = "fetch" =>
    /\ audit.fetchResult' \in receipts
    /\ audit.fetched' = audit.fetched \cup {audit.fetchResult'}
    /\ receipts' = receipts
    /\ audit.created' = audit.created
    /\ Completed' = Completed
    /\ ticket.claimed' = ticket.claimed
]_vars
