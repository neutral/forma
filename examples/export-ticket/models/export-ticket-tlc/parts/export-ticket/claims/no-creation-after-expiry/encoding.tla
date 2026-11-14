\* The expiry snapshot contains exactly the creations preceding expiry.
Invariant == ticket.expired => audit.created \subseteq audit.expiryReceipts
