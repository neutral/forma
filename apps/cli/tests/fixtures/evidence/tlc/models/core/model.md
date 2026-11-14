# Gate counter

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

## Phases

| Lifecycle | Over | Expression |
| --- | --- | --- |
| gate/door | t \in Tickets | DoorPhase(t) |
