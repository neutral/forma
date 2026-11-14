------------------------------ MODULE Gate ------------------------------
EXTENDS Naturals

CONSTANT Count
VARIABLES n, last

vars == <<n, last>>
Tickets == {"ticket"}

Init == /\ n = 0
        /\ last = 0

TypeOK == /\ n \in 0..Count
          /\ last \in 0..8

Open == /\ n = 0
        /\ n' = 1
        /\ UNCHANGED last

Reset == /\ n' = 0
         /\ UNCHANGED last

Drop == /\ UNCHANGED n
        /\ last' = 1

Duplicate == /\ UNCHANGED n
             /\ last' = 2

Delay == /\ UNCHANGED n
         /\ last' = 3

Reorder == /\ UNCHANGED n
           /\ last' = 4

FailForever == /\ UNCHANGED n
               /\ last' = 5

FailThenSucceed == /\ UNCHANGED n
                   /\ last' = 6

Crash == /\ UNCHANGED n
         /\ last' = 7

GoSilent == /\ UNCHANGED n
            /\ last' = 8

DoorPhase(t) == IF n = 1 THEN "opened" ELSE "closed"
=============================================================================
