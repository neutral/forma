# Completion policy

| Field | Value |
| --- | --- |
| Question | Should completion advance immediately or wait twice? |
| Recommendation | a: complete promptly |
| Cites | design/brief/system.md#workflow |

## a

| Field | Value |
| --- | --- |
| Polarity | should happen |
| Expected end | The policy is followed. |
| Refused step | - |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | Worker | advance | - | - | - |

## b

| Field | Value |
| --- | --- |
| Polarity | should happen |
| Expected end | The policy is followed. |
| Refused step | - |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | Worker | wait | - | - | - |
| 2 | Worker | wait | - | - | - |
