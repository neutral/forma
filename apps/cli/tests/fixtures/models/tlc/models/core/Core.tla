------------------------------ MODULE Core ------------------------------
EXTENDS Integers
CONSTANT Things
VARIABLE phase

vars == <<phase>>
Init == phase = "idle"
TypeOK == phase \in {"idle", "done"}
Step == phase' = "done"
Phase(e) == phase
=============================================================================
