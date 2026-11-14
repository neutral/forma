---- MODULE Tiny ----
EXTENDS Naturals
CONSTANT N
VARIABLE x
vars == <<x>>
Init == x = 0
TypeOK == x \in {0, 1}
Pick == CHOOSE n \in 0..N : TRUE
Observe == x' = x
====
