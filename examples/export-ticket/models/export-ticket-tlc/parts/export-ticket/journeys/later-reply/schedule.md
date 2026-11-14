| Entity | Value |
| --- | --- |

| Step | Bindings |
| --- | --- |
| 1 | t = "t"; k = "a" |
| 2 | t = "t"; k = "a"; r = "r-a" |
| 3 | t = "t" |
| 4 | t = "t"; k = "a"; lose = FALSE |

| Field | Value |
| --- | --- |
| Meaning | The reply after expiry delivers key a's original receipt r-a, which was created before expiry; the set of created receipts has not grown since expiry. |

```tla
End == /\ ticket.expired
       /\ requests["a"].replied
       /\ requests["a"].receipt = "r-a"
       /\ "r-a" \in recipient.seen
       /\ recipient.deliveries["r-a"] > 0
       /\ "r-a" \in receipts
       /\ audit.expiryReceipts = {"r-a"}
       /\ audit.created = audit.expiryReceipts
```
