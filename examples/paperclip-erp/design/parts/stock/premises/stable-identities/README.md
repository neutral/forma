# Retries retain their business identity

| Field | Value |
| --- | --- |
| Statement | Staff retries of the same business command retain its stable business identity and contents; distinct fresh QA decisions have their own operation identities. |
| Class | world |
| Why not examined | not verifiable here: The model can check deduplication of supplied identities but cannot establish that a physical retry was labelled with the same identity. |
| Falsifier | Command logs show a retry of the same real operation given a new business identity. |
| Provider | Staff command clients and the staff using them |
| Origin | stated |
| Cites | design/brief/overview.md#the-boundary-of-the-result, design/brief/stock.md#holds-after-release |
