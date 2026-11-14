# A claimed ticket can still expire

| Field | Value |
| --- | --- |
| Polarity | should happen |
| Expected end | Ticket t is expired and remains claimed, and receipt r-a and the prepared export remain stored. |
| Refused step | - |
| Origin | added |
| Cites | design/brief/overview.md#claim-design, design/brief/overview.md#required-behavior |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | The export-ticket service | check | Ticket t and unused request key a. | - | - |
| 2 | The export-ticket service | complete | Ticket t and request key a's remembered check; create fresh receipt r-a. | - | - |
| 3 | The export-ticket service | return-receipt | Ticket t and completed request key a; deliver the already-stored receipt r-a in the ordinary successful reply. | - | - |
| 4 | The export-ticket service | expire | Ticket t; take its sole expiry event. | - | - |
