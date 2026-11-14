# Atomic creation and claim marking

| Field | Value |
| --- | --- |
| Statement | Receipt creation and marking the ticket claimed in Complete are one atomic store action; another action or a stop cannot observe or leave just one of those two effects committed. |
| Class | atomicity |
| Why not examined | not verifiable here: this examination treats the stated atomic store action as a design primitive rather than testing its implementation. |
| Falsifier | A committed receipt exists while its ticket remains unclaimed, or the ticket is committed as claimed with no corresponding receipt because Complete stopped between the writes. |
| Provider | The team implementing the service's atomic store action |
| Origin | stated |
| Cites | design/brief/overview.md#claim-design, design/brief/overview.md#given-conditions |
