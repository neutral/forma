# Invoice issue and settlement

| Field | Value |
| --- | --- |
| Entity | invoice |
| Initial | unissued |
| Ends | settled |
| Unaffected | none |
| Origin | stated |
| Cites | design/brief/accounts.md#issuing-invoices, design/brief/accounts.md#recording-payment, design/brief/overview.md#the-boundary-of-the-result |

| Phase | issue-invoice | apply-receipt |
| --- | --- | --- |
| unissued | new: unpaid<br>replay: None. | partial: None.<br>settle: None.<br>replay: None. |
| unpaid | new: None.<br>replay: unpaid | partial: part-paid<br>settle: settled<br>replay: None. |
| part-paid | new: None.<br>replay: part-paid | partial: part-paid<br>settle: settled<br>replay: part-paid |
| settled | new: None.<br>replay: settled | partial: None.<br>settle: None.<br>replay: settled |
