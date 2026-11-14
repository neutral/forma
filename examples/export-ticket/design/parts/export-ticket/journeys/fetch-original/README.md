# Read the original receipt while the ticket is active

| Field | Value |
| --- | --- |
| Polarity | should happen |
| Expected end | The recipient reads r-a while ticket t is active, and the number and identity of stored receipts remain unchanged by the fetch. |
| Refused step | - |
| Origin | added |
| Cites | design/brief/overview.md#purpose, design/brief/overview.md#required-behavior, design/brief/overview.md#scale |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | The export-ticket service | check | Ticket t and unused request key a. | - | - |
| 2 | The export-ticket service | complete | Ticket t and request key a's remembered check; create fresh receipt r-a. | - | - |
| 3 | The export-ticket service | return-receipt | Ticket t and completed request key a; deliver the already-stored receipt r-a in the ordinary successful reply. | - | - |
| 4 | The export-ticket service | fetch-receipt | Ticket t; retrieve the original stored receipt r-a without a new completion or creation. | - | - |
