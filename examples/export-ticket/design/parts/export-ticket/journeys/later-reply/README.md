# The original reply can follow expiry

| Field | Value |
| --- | --- |
| Polarity | should happen |
| Expected end | The later reply returns the receipt r-a created before expiry, and creates nothing after expiry. |
| Refused step | - |
| Origin | added |
| Cites | design/brief/overview.md#claim-design, design/brief/overview.md#required-behavior |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | The export-ticket service | check | Ticket t and unused request key a. | - | - |
| 2 | The export-ticket service | complete | Ticket t and request key a's remembered check; create fresh receipt r-a. | - | - |
| 3 | The export-ticket service | expire | Ticket t; take its sole expiry event. | - | - |
| 4 | The export-ticket service | return-receipt | Ticket t and completed request key a; deliver the already-stored receipt r-a in the ordinary successful reply. | - | - |
