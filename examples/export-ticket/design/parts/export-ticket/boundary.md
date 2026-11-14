# Ownership and surface

## Boundary

| Row | Names | Kind | Side | Seam | Isolation | Reads | Writes | Origin | Cites |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| service | The export-ticket service that owns tickets, remembered checks and receipts | service | machine | - | - | - | - | stated | design/brief/overview.md#claim-design |
| recipient | The already-authorized recipient at the request and reply seam | actor | world | request-response | - | - | - | stated | design/brief/overview.md#purpose, design/brief/overview.md#claim-design, design/brief/overview.md#given-conditions |
| records | The service's store of tickets, remembered request-key checks and durable receipts | store | machine | - | unknown | service | service | stated | design/brief/overview.md#claim-design, design/brief/overview.md#given-conditions |
| ticket | The ticket with independent expiry and claim state and associations to its checks and receipts | entity | machine | - | - | service | service | stated | design/brief/overview.md#claim-design |
| pending-checks | Remembered passing checks indexed by stable request key and ticket | entity | machine | - | - | service | service | stated | design/brief/overview.md#claim-design, design/brief/overview.md#given-conditions |
| receipts | Durable receipts with distinct stable ids that unlock their prepared export | entity | machine | - | - | service | service | stated | design/brief/overview.md#purpose, design/brief/overview.md#claim-design, design/brief/overview.md#given-conditions |
| request-keys | Stable request-key identities whose check and completion history belongs to the service's records | entity | world | - | - | service | none | added | design/brief/overview.md#claim-design, design/brief/overview.md#given-conditions |
| export | The prepared export that a receipt unlocks, whose owner and byte delivery are outside this examination | entity | world | - | - | none | none | added | design/brief/overview.md#purpose, design/brief/overview.md#claim-design, design/brief/overview.md#scope |

## Surface

| Direction | Name | Cites |
| --- | --- | --- |
| reads | records | design/brief/overview.md#claim-design, design/brief/overview.md#given-conditions |
| writes | records | design/brief/overview.md#claim-design, design/brief/overview.md#given-conditions |
| reads | ticket | design/brief/overview.md#claim-design, design/brief/overview.md#given-conditions |
| writes | ticket | design/brief/overview.md#claim-design, design/brief/overview.md#given-conditions |
| reads | pending-checks | design/brief/overview.md#claim-design, design/brief/overview.md#given-conditions |
| writes | pending-checks | design/brief/overview.md#claim-design, design/brief/overview.md#given-conditions |
| reads | receipts | design/brief/overview.md#claim-design, design/brief/overview.md#given-conditions |
| writes | receipts | design/brief/overview.md#claim-design, design/brief/overview.md#given-conditions |
| reads | request-keys | design/brief/overview.md#claim-design, design/brief/overview.md#given-conditions |
| calls | recipient | design/brief/overview.md#claim-design, design/brief/overview.md#purpose |
