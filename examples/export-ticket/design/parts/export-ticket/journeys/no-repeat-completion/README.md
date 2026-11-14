# The normal first-completion entry point cannot complete a key twice

| Field | Value |
| --- | --- |
| Polarity | must not |
| Expected end | - |
| Refused step | 3 |
| Origin | added |
| Cites | design/brief/overview.md#claim-design |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | The export-ticket service | check | Ticket t and unused request key a. | - | - |
| 2 | The export-ticket service | complete | Ticket t and request key a's remembered check; create fresh receipt r-a. | - | - |
| 3 | The export-ticket service | complete | Ticket t and already-completed request key a again; attempt to create another fresh receipt. | - | - |
