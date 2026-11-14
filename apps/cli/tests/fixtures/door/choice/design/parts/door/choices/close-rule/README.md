# What does closing do?

| Field | Value |
| --- | --- |
| Question | Does closing shut the door or keep it open? |
| Recommendation | a: Closing should shut the door. |
| Cites | design/brief/overview.md#door |

## a

| Field | Value |
| --- | --- |
| Polarity | should happen |
| Expected end | The door is closed. |
| Refused step | - |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | Door controller | close | none | - | - |

| Lifecycle | Phase | Action | Outcome |
| --- | --- | --- | --- |
| state | open | close | closed |

## b

| Field | Value |
| --- | --- |
| Polarity | should happen |
| Expected end | The door stays open. |
| Refused step | - |

| Step | Actor | Action | Arguments | Entity | Case |
| --- | --- | --- | --- | --- | --- |
| 1 | Door controller | close | none | - | - |

| Lifecycle | Phase | Action | Outcome |
| --- | --- | --- | --- |
| state | open | close | open |
