# All effects commit together on current records

| Field | Value |
| --- | --- |
| Statement | Every named business operation validates current authoritative records and commits all its effects together or none, and concurrent operations behave in the serial order of their commits, including quality revision checks and the order of hold, cancellation and collection. |
| Class | atomicity |
| Why not examined | not verifiable here: Implementing the transaction guarantee and recovering the store from storage failure are outside this examination. |
| Falsifier | A transaction audit shows a partial business commit, an accepted stale decision, or an outcome inconsistent with the committed order of competing operations. |
| Provider | The ERP implementation team and authoritative store |
| Origin | stated |
| Cites | design/brief/overview.md#the-boundary-of-the-result, design/brief/orders.md#authorising-collection |
