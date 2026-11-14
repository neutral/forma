# Two distinct request keys can have passing checks

| Field | Value |
| --- | --- |
| Polarity | should happen |
| Expected end | Ticket t is still active and unclaimed with passing checks for distinct keys a and b and no receipt. |
| Refused step | - |
| Origin | added |
| Cites | design/brief/overview.md#claim-design, design/brief/overview.md#required-behavior, design/brief/overview.md#scope |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | The export-ticket service | check | Ticket t and unused request key a. | - | - |
| 2 | The export-ticket service | check | The same ticket t and distinct unused request key b. | - | - |
