---- MODULE Door ----
CONSTANT Count
VARIABLE phase
vars == <<phase>>
Init == phase = "open"
TypeOK == /\ Count = Count
          /\ phase \in {"open", "closed"}
Close == /\ phase = "open"
         /\ phase' = "closed"
Phase(d) == phase
====
