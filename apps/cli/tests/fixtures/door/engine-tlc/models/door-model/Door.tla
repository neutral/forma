---- MODULE Door ----
VARIABLE phase
vars == <<phase>>
Init == phase = "open"
TypeOK == phase \in {"open", "closed"}
Close == /\ phase = "open"
         /\ phase' = "closed"
Phase(d) == phase
====
