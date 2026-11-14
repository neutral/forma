# Boundary

## Boundary

| Row | Names | Kind | Side | Seam | Isolation | Reads | Writes | Origin | Cites |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| worker | Worker | actor | machine | - | - | - | - | stated | design/brief/system.md#workflow |
| request | Request | entity | machine | - | - | worker | worker | stated | design/brief/system.md#workflow |
| records | Records | store | machine | - | serializable | worker | worker | stated | design/brief/system.md#workflow |
| remote | Remote service | service | world | request-response | - | - | - | added | design/brief/system.md#workflow |

## Surface

| Direction | Name | Cites |
| --- | --- | --- |
| emits | completed | design/brief/system.md#workflow |
