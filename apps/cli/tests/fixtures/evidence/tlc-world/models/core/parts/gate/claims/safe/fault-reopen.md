| Field | Value |
| --- | --- |
| Action | gate/open |
| Mechanism | The guard that refuses another opening until the ticket resets. |

```tla
Fault == /\ n < Count
         /\ n' = n + 1
         /\ UNCHANGED last
```
