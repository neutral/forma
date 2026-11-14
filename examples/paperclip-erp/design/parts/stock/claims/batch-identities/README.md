# One record per physical carton and received batch

| Field | Value |
| --- | --- |
| Sentence | Each recorded carton has one immutable identity and exactly one batch, the recorded batch quantity equals its distinct member cartons, and replaying a successful batch receipt adds no carton and resets no quality decision. |
| Kind | safety |
| Stake | Coil & Clip could promise stock it does not own or lose the production source of an unsafe carton. |
| Rests on | serial-commits, stable-identities, store:records, truthful-scans |
| Parts | stock |
| Origin | stated |
| Cites | design/brief/overview.md#the-business-we-examine, design/brief/stock.md#finished-cartons-and-quality, design/brief/stock.md#recording-a-batch, design/brief/overview.md#the-boundary-of-the-result |
