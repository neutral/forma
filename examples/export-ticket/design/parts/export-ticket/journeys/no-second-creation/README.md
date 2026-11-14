# Overlapping checks must not create two receipts

| Field | Value |
| --- | --- |
| Polarity | must not |
| Expected end | - |
| Refused step | 4 |
| Origin | added |
| Cites | design/brief/overview.md#required-behavior, design/brief/overview.md#claim-design, design/brief/overview.md#scale |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | The export-ticket service | check | Ticket t and unused request key a. | - | - |
| 2 | The export-ticket service | check | The same ticket t and distinct unused request key b. | - | - |
| 3 | The export-ticket service | complete | Ticket t and request key a's remembered check; create fresh receipt r-a. | - | - |
| 4 | The export-ticket service | complete | The same ticket t and request key b's remembered check; create fresh receipt r-b distinct from r-a. | - | - |
