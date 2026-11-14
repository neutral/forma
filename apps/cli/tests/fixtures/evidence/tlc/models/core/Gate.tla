------------------------------ MODULE Gate ------------------------------
EXTENDS Naturals

CONSTANT Count
VARIABLE n

vars == <<n>>
Tickets == {"ticket"}

Init == n = 0
TypeOK == n \in 0..Count

Open == /\ n = 0
        /\ n' = 1

Reset == n' = 0

DoorPhase(t) == IF n = 1 THEN "opened" ELSE "closed"
=============================================================================
