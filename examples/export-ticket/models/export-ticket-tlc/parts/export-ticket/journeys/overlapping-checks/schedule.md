| Entity | Value |
| --- | --- |

| Step | Bindings |
| --- | --- |
| 1 | t = "t"; k = "a" |
| 2 | t = "t"; k = "b" |

| Field | Value |
| --- | --- |
| Meaning | The ticket remains active and unclaimed; distinct keys a and b both have remembered passing checks and neither has completed, with no receipt created or stored. |

```tla
End == /\ ~ticket.expired
       /\ ~ticket.claimed
       /\ requests["a"].checked
       /\ requests["b"].checked
       /\ ~requests["a"].completed
       /\ ~requests["b"].completed
       /\ receipts = {}
       /\ audit.created = {}
```
