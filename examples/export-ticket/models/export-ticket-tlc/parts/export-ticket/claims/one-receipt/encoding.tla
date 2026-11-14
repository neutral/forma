\* Count distinct historical creations, not deliveries or current copies.
Invariant == Cardinality(audit.created) <= 1
