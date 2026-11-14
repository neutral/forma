---- MODULE Ticket ----
EXTENDS Naturals
CONSTANT Tickets
VARIABLE state
vars == <<state>>
Init == state = 0
TypeOK == state \in 0..2
Finish == state' = 1
Phase(e) == IF state = 0 THEN "idle" ELSE "done"
====
