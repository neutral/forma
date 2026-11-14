| Entity | Value |
| --- | --- |

| Step | Bindings |
| --- | --- |
| 1 | t = "t"; k = "a" |
| 2 | t = "t"; k = "a"; r = "r-a" |
| 3 | t = "t"; k = "a"; lose = TRUE |
| 4 | t = "t"; k = "a" |
| 5 | t = "t"; k = "a"; r = "r-a" |
| 6 | t = "t"; k = "a" |

| Field | Value |
| --- | --- |
| Meaning | After loss of the original reply, the one retry of key a has successfully replied with the original receipt r-a while the ticket remains active and claimed. The same r-a is the only receipt stored or ever created; a reply containing a replacement receipt does not meet this end. |

```tla
End ==
  /\ ~ticket.expired /\ ticket.claimed
  /\ requests["a"].completed /\ requests["a"].receipt = "r-a"
  /\ requests["a"].replied /\ "a" \in audit.lost
  /\ receipts = {"r-a"} /\ audit.created = {"r-a"}
  /\ recipient.retrySent = {"a"}
  /\ requests["a"].retryCompleted /\ ~requests["a"].retryAvailable
  /\ requests["a"].retryReceipt = "r-a" /\ requests["a"].retryReplied
  /\ recipient.replies["a"] = {"r-a"} /\ "r-a" \in recipient.seen
  /\ recipient.deliveries["r-a"] > 0
```
