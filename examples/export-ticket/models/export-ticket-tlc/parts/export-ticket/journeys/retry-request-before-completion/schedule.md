| Entity | Value |
| --- | --- |

| Step | Bindings |
| --- | --- |
| 1 | t = "t"; k = "a" |
| 2 | t = "t"; k = "a" |

| Field | Value |
| --- | --- |
| Meaning | The active ticket remains unclaimed and no receipt has ever been created. Key a retains its passing check and unfinished original request, and the recipient's one retry of a is available to the service without having executed. |

```tla
End ==
  /\ ~ticket.expired /\ ~ticket.claimed
  /\ receipts = {} /\ audit.created = {}
  /\ requests["a"].checked /\ ~requests["a"].completed
  /\ requests["a"].receipt = NoReceipt /\ ~requests["a"].replied
  /\ requests["a"].retryAvailable /\ ~requests["a"].retryCompleted
  /\ requests["a"].retryReceipt = NoReceipt /\ ~requests["a"].retryReplied
  /\ recipient.retrySent = {"a"} /\ recipient.replies["a"] = {}
```
