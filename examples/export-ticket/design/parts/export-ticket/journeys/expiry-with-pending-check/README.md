# Expiry remains possible while a check is pending

| Field | Value |
| --- | --- |
| Polarity | should happen |
| Expected end | Ticket t is expired and unclaimed, its passing check for a is still remembered, and no receipt has been created. |
| Refused step | - |
| Origin | added |
| Cites | design/brief/overview.md#claim-design, design/brief/overview.md#required-behavior |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | The export-ticket service | check | Ticket t and unused request key a. | - | - |
| 2 | The export-ticket service | expire | Ticket t; take its sole expiry event. | - | - |
