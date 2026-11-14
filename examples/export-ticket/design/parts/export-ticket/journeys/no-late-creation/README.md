# A remembered check must not create a receipt after expiry

| Field | Value |
| --- | --- |
| Polarity | must not |
| Expected end | - |
| Refused step | 3 |
| Origin | added |
| Cites | design/brief/overview.md#required-behavior, design/brief/overview.md#claim-design, design/brief/overview.md#scale |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | The export-ticket service | check | Ticket t and unused request key a. | - | - |
| 2 | The export-ticket service | expire | Ticket t; take its sole expiry event. | - | - |
| 3 | The export-ticket service | complete | Ticket t and request key a's remembered check; create fresh receipt r-a. | - | - |
