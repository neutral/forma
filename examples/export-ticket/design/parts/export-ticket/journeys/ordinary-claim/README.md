# An ordinary successful claim before expiry

| Field | Value |
| --- | --- |
| Polarity | should happen |
| Expected end | Ticket t is active and claimed, exactly one receipt r-a is stored, and the recipient has received that receipt. |
| Refused step | - |
| Origin | added |
| Cites | design/brief/overview.md#required-behavior, design/brief/overview.md#claim-design, design/brief/overview.md#purpose, design/brief/overview.md#scale |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | The export-ticket service | check | Ticket t and unused request key a. | - | - |
| 2 | The export-ticket service | complete | Ticket t and request key a's remembered check; create fresh receipt r-a. | - | - |
| 3 | The export-ticket service | return-receipt | Ticket t and completed request key a; deliver the already-stored receipt r-a in the ordinary successful reply. | - | - |
