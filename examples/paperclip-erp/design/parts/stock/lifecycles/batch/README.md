# Batch quality

| Field | Value |
| --- | --- |
| Entity | batch |
| Initial | unrecorded |
| Ends | none |
| Unaffected | none |
| Origin | stated |
| Cites | design/brief/stock.md#recording-a-batch, design/brief/stock.md#holds-after-release, design/brief/overview.md#the-boundary-of-the-result |

| Phase | receive-batch | release-batch | hold-batch |
| --- | --- | --- | --- |
| unrecorded | held | new: None.<br>replay: None. | new: None.<br>replay: None. |
| held | held | new: released<br>replay: held | new: None.<br>replay: held |
| released | released | new: None.<br>replay: released | new: held<br>replay: released |
