# Gate relation and world events

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
| int | 5 | counts zero through two and all eight world events fit in the integer range |

## Actions

| Action | Operator | Parameters |
| --- | --- | --- |
| gate/open | Open | none |
| gate/reset | Reset | none |

## Misbehaviours

| Row | Item | Operator | Parameters |
| --- | --- | --- | --- |
| gate/robot | drop | Drop | none |
| gate/robot | duplicate | Duplicate | none |
| gate/robot | delay | Delay | none |
| gate/robot | reorder | Reorder | none |
| gate/robot | fail-forever | FailForever | none |
| gate/robot | fail-then-succeed | FailThenSucceed | none |
| gate/robot | crash | Crash | none |
| gate/robot | go-silent | GoSilent | none |

## Phases

| Lifecycle | Over | Expression |
| --- | --- | --- |
| gate/door | t: Ticket | DoorPhase[t] |
