| Entity | Value |
| --- | --- |

| Step | Bindings |
| --- | --- |
| 1 | t = "t"; k = "a" |
| 2 | t = "t"; k = "a"; r = "r-a" |
| 3 | t = "t"; k = "a"; lose = FALSE |
| 4 | t = "t" |

| Field | Value |
| --- | --- |
| Meaning | The ticket is expired and still claimed, and its original receipt r-a and prepared export remain stored. |

```tla
End == /\ ticket.expired
       /\ ticket.claimed
       /\ "r-a" \in receipts
       /\ exportPresent
```
