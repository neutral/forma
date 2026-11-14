# An expired ticket cannot pass a new check

| Field | Value |
| --- | --- |
| Polarity | must not |
| Expected end | - |
| Refused step | 2 |
| Origin | added |
| Cites | design/brief/overview.md#claim-design |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | The export-ticket service | expire | Ticket t; take its sole expiry event. | - | - |
| 2 | The export-ticket service | check | Ticket t and unused request key a. | - | - |
