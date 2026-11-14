# Gate counter and world events

| Field | Value |
| --- | --- |
| Engine | tlc |
| Parts | gate |
| Entry | Gate.tla |
| Type invariant | TypeOK |

## Bounds

| Bound | Value | Meaning |
| --- | --- | --- |
| constant Count | 2 | one ticket and two attempted openings between resets |

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
| gate/door | t \in Tickets | DoorPhase(t) |
