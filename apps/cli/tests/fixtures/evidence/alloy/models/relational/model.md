# Gate relation

| Field | Value |
| --- | --- |
| Engine | alloy |
| Parts | gate |
| Entry | Gate.als |
| Type invariant | - |

## Bounds

| Bound | Value | Meaning |
| --- | --- | --- |
| scope | 3 | one ticket with its closed and opened phases |
| steps | 1..4 | up to four states to open, try opening again, and reset |
| int | 3 | counts zero through two fit in the integer range |

## Actions

| Action | Operator | Parameters |
| --- | --- | --- |
| gate/open | Open | none |
| gate/reset | Reset | none |

## Misbehaviours

| Row | Item | Operator | Parameters |
| --- | --- | --- | --- |

## Phases

| Lifecycle | Over | Expression |
| --- | --- | --- |
| gate/door | t: Ticket | DoorPhase[t] |
