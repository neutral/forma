| Field | Value |
| --- | --- |
| Action | gate/open |
| Mechanism | The guard that refuses another opening until the ticket resets. |

```alloy
pred Fault {
  (Ticket.count = 0 and Ticket.count' = 1)
  or (Ticket.count = 1 and Ticket.count' = 2)
}
```
