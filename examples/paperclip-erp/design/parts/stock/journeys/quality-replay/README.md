# A replay of an old release leaves the newer hold intact

| Field | Value |
| --- | --- |
| Polarity | should happen |
| Expected end | Exactly c1 and c2 remain recorded in B, B remains held at revision 2, and neither old release nor batch-receipt replay changes it. |
| Refused step | - |
| Origin | stated |
| Cites | design/brief/stock.md#recording-a-batch, design/brief/stock.md#holds-after-release, design/brief/overview.md#the-boundary-of-the-result, design/brief/stories.md#qa-stops-a-packed-box |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | Warehouse staff | receive-batch | Batch B; distinct cartons c1 and c2; quantity 2. | - | - |
| 2 | Warehouse staff | receive-batch | Exact replay of B with the same two carton identities and quantity. | - | - |
| 3 | QA | release-batch | Decision R1; B at revision 0; inspection complete. | - | new |
| 4 | QA | hold-batch | Decision H1; B at revision 1. | - | new |
| 5 | QA | release-batch | Replay successful decision R1 with its original revision 0 and contents, after H1. | - | replay |
| 6 | Warehouse staff | receive-batch | Replay original B receipt again after H1; do not reset revision 2 or the hold. | - | - |
