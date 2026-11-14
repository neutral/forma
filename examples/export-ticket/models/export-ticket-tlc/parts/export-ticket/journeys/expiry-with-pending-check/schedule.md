| Entity | Value |
| --- | --- |

| Step | Bindings |
| --- | --- |
| 1 | t = "t"; k = "a" |
| 2 | t = "t" |

| Field | Value |
| --- | --- |
| Meaning | The ticket is expired and unclaimed, key a retains its passing check without completion, and no receipt has been created. |

```tla
End == /\ ticket.expired
       /\ ~ticket.claimed
       /\ requests["a"].checked
       /\ ~requests["a"].completed
       /\ receipts = {}
       /\ audit.created = {}
```
