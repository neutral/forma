# A thing completing one step

| Field | Value |
| --- | --- |
| Engine | tlc |
| Parts | p |
| Entry | Core.tla |
| Type invariant | TypeOK |

## Bounds

| Bound | Value | Meaning |
| --- | --- | --- |
| constant Things | {thing} | one thing |

## Actions

| Action | Operator | Parameters |
| --- | --- | --- |
| p/step | Step | none |

## Misbehaviours

| Row | Item | Operator | Parameters |
| --- | --- | --- | --- |

## Phases

| Lifecycle | Over | Expression |
| --- | --- | --- |
| p/life | e \in Things | Phase(e) |
