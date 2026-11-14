# Stable request keys and fresh receipt ids

| Field | Value |
| --- | --- |
| Statement | Request keys and receipt ids retain their identities, and each fresh receipt creation receives an id different from every earlier receipt creation in the examination. |
| Class | world |
| Why not examined | not verifiable here: the identity providers and concrete id allocation are outside the abstract design examination. |
| Falsifier | A log shows the same id assigned to two distinct receipt creations, or one request key changing identity between its Check and Complete. |
| Provider | The recipient and the implementation team supplying request keys and receipt ids |
| Origin | stated |
| Cites | design/brief/overview.md#given-conditions |
