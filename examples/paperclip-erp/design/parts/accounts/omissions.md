# What customer accounts do not cover

| Passage | Reason |
| --- | --- |
| design/brief/accounts.md#customer-credit-invoices-and-receipts | Finance-set fixed limits and zero opening balances form the initial account data before orders begin; changing limits, opening balances, fees and rounding are outside the action set. |
| design/brief/accounts.md#recording-payment | Bank reconciliation is outside the examination and correctness of the actual receipt match is carried as truthful-receipts. |
| design/brief/stories.md#a-week-at-coil--clip | The concrete names and quantities are example inputs, not global bounds; any model reduction must retain competing orders, partial collection and the collection-to-invoice-to-payment gaps. |
