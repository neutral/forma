# Door phase with a reducible count

| Field | Value |
| --- | --- |
| Engine | tlc |
| Parts | door |
| Entry | Door.tla |
| Type invariant | TypeOK |

## Bounds

| Bound | Value | Meaning |
| --- | --- | --- |
| constant Count | 1 | One candidate count; closing does not depend on it. |

## Actions

| Action | Operator | Parameters |
| --- | --- | --- |
| door/close | Close | none |

## Misbehaviours

| Row | Item | Operator | Parameters |
| --- | --- | --- | --- |

## Phases

| Lifecycle | Over | Expression |
| --- | --- | --- |
| door/state | d \in {1} | Phase(d) |
