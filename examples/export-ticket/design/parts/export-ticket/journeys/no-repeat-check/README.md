# A request key is checked at most once

| Field | Value |
| --- | --- |
| Polarity | must not |
| Expected end | - |
| Refused step | 2 |
| Origin | added |
| Cites | design/brief/overview.md#claim-design |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | The export-ticket service | check | Ticket t and unused request key a. | - | - |
| 2 | The export-ticket service | check | Ticket t and the already-checked request key a again. | - | - |
