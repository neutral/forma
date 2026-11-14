| Entity | Value |
| --- | --- |

| Step | Bindings |
| --- | --- |
| 1 | t = "t"; k = "a" |
| 2 | t = "t"; k = "a"; r = "r-a" |
| 3 | t = "t"; k = "a"; lose = FALSE |

| Field | Value |
| --- | --- |
| Meaning | The ticket remains active and is claimed, exactly receipt r-a is stored, and that receipt has been delivered to the recipient. |

```tla
End == /\ ~ticket.expired
       /\ ticket.claimed
       /\ receipts = {"r-a"}
       /\ "r-a" \in recipient.seen
       /\ recipient.deliveries["r-a"] > 0
```
