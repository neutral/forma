# One bank receipt reduces one invoice balance once

| Field | Value |
| --- | --- |
| Sentence | Each successful receipt reference permanently identifies one issued invoice and one positive £10-multiple amount no greater than its pre-application balance, the balance falls by that amount once and never below zero, exact replays change nothing, and premature, excessive or conflicting applications change no balance, exposure or successful identity record and leave previously unused references retryable. |
| Kind | safety |
| Stake | A customer could be charged again for paid debt, lose a valid later payment because an early attempt failed, or have credit released for money never correctly applied. |
| Rests on | stock/serial-commits, stock/stable-identities, store:stock/records, truthful-receipts |
| Parts | accounts |
| Origin | stated |
| Cites | design/brief/accounts.md#recording-payment, design/brief/accounts.md#customer-credit-invoices-and-receipts, design/brief/overview.md#the-boundary-of-the-result |
