# Only a fresh QA decision changes current quality

| Field | Value |
| --- | --- |
| Sentence | Every new successful hold or release uses the current batch revision and increments it once; stale new decisions and conflicting identity reuse change nothing, and every exact successful replay preserves the current quality and revision even after later decisions. |
| Kind | safety |
| Stake | Customers could receive defective cartons because an old release lifted a newer hold. |
| Rests on | serial-commits, stable-identities, store:records |
| Parts | stock |
| Origin | stated |
| Cites | design/brief/stock.md#holds-after-release, design/brief/overview.md#the-boundary-of-the-result, design/brief/stories.md#qa-stops-a-packed-box |
