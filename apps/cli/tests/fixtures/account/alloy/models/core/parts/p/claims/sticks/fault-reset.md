| Field | Value |
| --- | --- |
| Action | p/finish |
| Mechanism | Completion preserves the done phase. |

```alloy
pred Fault {
  Ticket.phase = idle implies Ticket.phase' = done else Ticket.phase' = idle
}
```
