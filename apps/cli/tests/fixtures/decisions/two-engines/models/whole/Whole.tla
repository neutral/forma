---- MODULE Whole ----
EXTENDS Naturals
VARIABLE x
vars == <<x>>
Init == x = 0
TypeOK == x = 0
Advance == x' = x
Wait == x' = x
====
